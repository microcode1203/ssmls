'use strict';
// Online exam taking. The SERVER is the source of truth for: the deadline, the violation
// count, auto-submission and grading. The student's browser never receives the answer key.
const crypto = require('crypto');
const { pool } = require('../config/database');
const { gradeExam } = require('../utils/examGrading');

const fail = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra });
const serverError = (res, err, tag) => { console.error(tag, err); fail(res, 500, 'Server error.'); };

const GRACE_MS = 15000;                       // network slack after the deadline
const AWAY_GAP_MS = 40000;                    // heartbeat gap that is logged as "away"
const COUNTED = new Set(['tab_hidden', 'window_blur', 'fullscreen_exit']);   // count toward auto-submit
const INFO = new Set(['clipboard', 'key_blocked', 'right_click', 'print_attempt', 'away']); // logged only

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

const WINDOW_MSG = {
  not_published: 'This exam is not available yet.',
  not_open: 'This exam has not opened yet.',
  closed: 'This exam is closed.',
};
function windowState(exam) {
  const now = Date.now();
  if (!exam.published) return 'not_published';
  if (exam.opens_at && now < new Date(exam.opens_at).getTime()) return 'not_open';
  if (exam.closes_at && now > new Date(exam.closes_at).getTime()) return 'closed';
  return 'open';
}
const isExpired = (a) => !!a.deadline_at && Date.now() > new Date(a.deadline_at).getTime() + GRACE_MS;
const rulesOf = (e) => ({
  maxViolations: e.max_violations ?? 3,
  enforceFullscreen: e.enforce_fullscreen !== false,
  durationMinutes: e.duration_minutes || null,
  showResult: !!e.show_result,
});

async function one(sql, params) { const [rows] = await pool.execute(sql, params); return rows[0] || null; }
async function getExamByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(c)) return null;
  return one('SELECT * FROM exams WHERE access_code = ?', [c]);
}
async function studentLabel(userId) {
  try {
    const u = await one('SELECT first_name, last_name FROM users WHERE id = ?', [userId]);
    const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
    if (name) return name.slice(0, 120);
  } catch { /* column names differ — fall back */ }
  return `Student #${userId}`;
}
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const publicQuestion = (q) => ({
  id: q.id, type: q.type, prompt: q.prompt, choices: q.choices || null, points: Number(q.points),
  count: q.type === 'enum' ? (q.answer?.items || []).length : undefined,   // NO answers leave the server
});

// ── grading + saving (used on submit, auto-submit and teacher review) ───────
async function finalize(attemptId, status, reason) {
  const a = await one('SELECT * FROM exam_attempts WHERE id = ?', [attemptId]);
  if (!a) return null;
  const exam = await one('SELECT * FROM exams WHERE id = ?', [a.exam_id]);
  const [questions] = await pool.execute('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY position', [a.exam_id]);

  const answers = a.answers || {};
  const toGrade = {};
  for (const q of questions) toGrade[q.id] = q.type === 'essay' ? undefined : answers[q.id]; // essays are scored by the teacher
  const result = gradeExam(questions, toGrade, a.essay_scores || {});

  await pool.execute(
    `UPDATE exam_attempts SET status=?, submit_reason=?, submitted_at=COALESCE(submitted_at, NOW()),
       score=?, total=?, needs_review=? WHERE id=?`,
    [status, reason || null, result.score, result.total, result.needsReview, a.id]
  );
  await pool.execute(
    `INSERT INTO exam_results (exam_id, student_key, student_id, student_label, answers, item_scores, score, total, needs_review)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT (exam_id, student_key) DO UPDATE SET
       student_label=EXCLUDED.student_label, answers=EXCLUDED.answers, item_scores=EXCLUDED.item_scores,
       score=EXCLUDED.score, total=EXCLUDED.total, needs_review=EXCLUDED.needs_review, created_at=NOW()`,
    [a.exam_id, `uid:${a.user_id}`, null, a.student_label, JSON.stringify(answers),
     JSON.stringify(result.items.map((i) => ({ q: i.questionId, s: i.score }))), result.score, result.total, result.needsReview]
  );
  return { ...result, exam };
}

function resultPayload(exam, r) {
  const show = !!exam.show_result;
  return {
    submitted: true,
    showResult: show,
    ...(show ? { score: r.score, total: r.total, pendingReview: r.needsReview } : {}),
  };
}

async function ownAttempt(req) {
  return one('SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
}
// If the attempt already ended (time up / locked), report it instead of accepting more input.
async function guardActive(res, a) {
  if (!a) { fail(res, 404, 'Attempt not found.'); return false; }
  if (a.status !== 'in_progress') { fail(res, 409, 'This exam was already submitted.', { submitted: true }); return false; }
  if (isExpired(a)) {
    await finalize(a.id, 'auto_submitted', 'time_up');
    fail(res, 409, 'Time is up. Your exam was submitted.', { submitted: true, reason: 'time_up' });
    return false;
  }
  return true;
}

// ── STUDENT ─────────────────────────────────────────────────────────────────
exports.preview = async (req, res) => {
  try {
    const exam = await getExamByCode(req.body?.code);
    if (!exam) return fail(res, 404, 'Invalid exam code.');
    const w = windowState(exam);
    if (w !== 'open') return fail(res, 403, WINDOW_MSG[w]);
    const [qs] = await pool.execute('SELECT COUNT(*) AS n FROM exam_questions WHERE exam_id = ?', [exam.id]);
    const attempt = await one('SELECT status FROM exam_attempts WHERE exam_id = ? AND user_id = ?', [exam.id, req.user.id]);
    res.json({ success: true, data: {
      title: exam.title, subject: exam.subject_label, section: exam.section_label,
      instructions: exam.instructions, questionCount: Number(qs[0]?.n || 0), totalPoints: Number(exam.total_points),
      closesAt: exam.closes_at, rules: rulesOf(exam), attemptStatus: attempt?.status || null,
    } });
  } catch (err) { serverError(res, err, 'exam preview'); }
};

exports.start = async (req, res) => {
  try {
    const exam = await getExamByCode(req.body?.code);
    if (!exam) return fail(res, 404, 'Invalid exam code.');
    const w = windowState(exam);
    if (w !== 'open') return fail(res, 403, WINDOW_MSG[w]);

    let a = await one('SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ?', [exam.id, req.user.id]);
    if (a && a.status !== 'in_progress') return fail(res, 409, 'You already took this exam.', { submitted: true });
    if (a && isExpired(a)) {
      await finalize(a.id, 'auto_submitted', 'time_up');
      return fail(res, 409, 'Your time for this exam has ended.', { submitted: true });
    }

    const [questions] = await pool.execute('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY position', [exam.id]);
    if (!questions.length) return fail(res, 400, 'This exam has no questions.');

    if (!a) {
      const ids = questions.map((q) => q.id);
      const order = exam.shuffle_questions ? shuffle(ids) : ids;
      const ends = [];
      if (exam.duration_minutes) ends.push(Date.now() + exam.duration_minutes * 60000);
      if (exam.closes_at) ends.push(new Date(exam.closes_at).getTime());
      const deadline = ends.length ? new Date(Math.min(...ends)).toISOString() : null;
      try {
        await pool.execute(
          'INSERT INTO exam_attempts (exam_id, user_id, student_label, question_order, deadline_at) VALUES (?,?,?,?,?)',
          [exam.id, req.user.id, await studentLabel(req.user.id), JSON.stringify(order), deadline]
        );
      } catch (e) { if (e.code !== '23505') throw e; }          // double-click: attempt already created
      a = await one('SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ?', [exam.id, req.user.id]);
    }

    const byId = new Map(questions.map((q) => [q.id, q]));
    const ordered = (a.question_order || []).map((id) => byId.get(id)).filter(Boolean);
    res.json({ success: true, data: {
      attemptId: a.id, studentLabel: a.student_label, title: exam.title,
      deadlineAt: a.deadline_at, serverNow: new Date().toISOString(),
      questions: ordered.map(publicQuestion), answers: a.answers || {},
      violations: a.violation_count, rules: rulesOf(exam),
    } });
  } catch (err) { serverError(res, err, 'exam start'); }
};

exports.saveAnswers = async (req, res) => {
  try {
    const a = await ownAttempt(req);
    if (!(await guardActive(res, a))) return;
    const answers = req.body?.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) || JSON.stringify(answers).length > 200000)
      return fail(res, 400, 'Invalid answers.');
    await pool.execute('UPDATE exam_attempts SET answers = ?, last_seen_at = NOW() WHERE id = ?', [JSON.stringify(answers), a.id]);
    res.json({ success: true });
  } catch (err) { serverError(res, err, 'exam saveAnswers'); }
};

exports.heartbeat = async (req, res) => {
  try {
    const a = await ownAttempt(req);
    if (!(await guardActive(res, a))) return;
    const gap = Date.now() - new Date(a.last_seen_at).getTime();
    if (gap > AWAY_GAP_MS)
      await pool.execute('INSERT INTO exam_events (attempt_id, type, detail) VALUES (?,?,?)', [a.id, 'away', `${Math.round(gap / 1000)}s without contact`]);
    await pool.execute('UPDATE exam_attempts SET last_seen_at = NOW() WHERE id = ?', [a.id]);
    res.json({ success: true, data: { deadlineAt: a.deadline_at, serverNow: new Date().toISOString(), violations: a.violation_count } });
  } catch (err) { serverError(res, err, 'exam heartbeat'); }
};

exports.event = async (req, res) => {
  try {
    const type = String(req.body?.type || '');
    if (!COUNTED.has(type) && !INFO.has(type)) return fail(res, 400, 'Unknown event.');
    const a = await ownAttempt(req);
    if (!(await guardActive(res, a))) return;

    const n = await one('SELECT COUNT(*) AS n FROM exam_events WHERE attempt_id = ?', [a.id]);
    if (Number(n?.n || 0) < 300)
      await pool.execute('INSERT INTO exam_events (attempt_id, type, detail) VALUES (?,?,?)', [a.id, type, String(req.body?.detail || '').slice(0, 200)]);

    let violations = a.violation_count;
    if (COUNTED.has(type)) {
      await pool.execute('UPDATE exam_attempts SET violation_count = violation_count + 1 WHERE id = ?', [a.id]);
      violations = (await one('SELECT violation_count FROM exam_attempts WHERE id = ?', [a.id])).violation_count;
      const exam = await one('SELECT max_violations, show_result FROM exams WHERE id = ?', [a.exam_id]);
      const max = exam.max_violations ?? 3;
      if (max > 0 && violations >= max) {
        const r = await finalize(a.id, 'auto_submitted', 'violations');
        return res.json({ success: true, data: { violations, maxViolations: max, ...resultPayload({ show_result: exam.show_result }, r), reason: 'violations' } });
      }
    }
    const exam = await one('SELECT max_violations FROM exams WHERE id = ?', [a.exam_id]);
    res.json({ success: true, data: { violations, maxViolations: exam.max_violations ?? 3, submitted: false } });
  } catch (err) { serverError(res, err, 'exam event'); }
};

exports.submit = async (req, res) => {
  try {
    const a = await ownAttempt(req);
    if (!a) return fail(res, 404, 'Attempt not found.');
    const exam = await one('SELECT * FROM exams WHERE id = ?', [a.exam_id]);

    if (a.status !== 'in_progress')                                   // already finished: repeat the result
      return res.json({ success: true, data: resultPayload(exam, { score: Number(a.score), total: Number(a.total), needsReview: a.needs_review }) });   // NUMERIC columns arrive as strings from PostgreSQL

    const answers = req.body?.answers;
    if (answers && typeof answers === 'object' && !Array.isArray(answers) && JSON.stringify(answers).length <= 200000 && !isExpired(a))
      await pool.execute('UPDATE exam_attempts SET answers = ? WHERE id = ?', [JSON.stringify(answers), a.id]);

    const late = a.deadline_at && Date.now() > new Date(a.deadline_at).getTime();
    const r = await finalize(a.id, late ? 'auto_submitted' : 'submitted', late ? 'time_up' : 'student');
    res.json({ success: true, data: resultPayload(exam, r) });
  } catch (err) { serverError(res, err, 'exam submit'); }
};

// ── TEACHER ─────────────────────────────────────────────────────────────────
async function ownedExam(req, id) {
  const exam = await one('SELECT * FROM exams WHERE id = ?', [id]);
  if (!exam) return { error: [404, 'Exam not found.'] };
  if (req.user.role !== 'admin' && exam.teacher_user_id !== req.user.id) return { error: [403, 'Not your exam.'] };
  return { exam };
}
async function ownedAttempt(req) {
  const a = await one('SELECT * FROM exam_attempts WHERE id = ?', [req.params.attemptId]);
  if (!a) return { error: [404, 'Attempt not found.'] };
  const { exam, error } = await ownedExam(req, a.exam_id);
  return error ? { error } : { a, exam };
}

exports.listAttempts = async (req, res) => {
  try {
    const { exam, error } = await ownedExam(req, req.params.id);
    if (error) return fail(res, ...error);
    const [open] = await pool.execute("SELECT * FROM exam_attempts WHERE exam_id = ? AND status = 'in_progress'", [exam.id]);
    for (const a of open) if (isExpired(a)) await finalize(a.id, 'auto_submitted', 'time_up');   // close abandoned attempts
    const [rows] = await pool.execute(
      `SELECT id, user_id, student_label, status, submit_reason, violation_count, score, total, needs_review,
              started_at, submitted_at, last_seen_at
       FROM exam_attempts WHERE exam_id = ? ORDER BY student_label`, [exam.id]);
    res.json({ success: true, data: { exam: {
      id: exam.id, title: exam.title, access_code: exam.access_code, published: exam.published,
      max_violations: exam.max_violations, total_points: exam.total_points,
    }, attempts: rows } });
  } catch (err) { serverError(res, err, 'listAttempts'); }
};

exports.attemptDetail = async (req, res) => {
  try {
    const { a, error } = await ownedAttempt(req);
    if (error) return fail(res, ...error);
    const [events] = await pool.execute('SELECT type, detail, created_at FROM exam_events WHERE attempt_id = ? ORDER BY created_at', [a.id]);
    const [qs] = await pool.execute("SELECT id, prompt, points, answer FROM exam_questions WHERE exam_id = ? AND type = 'essay' ORDER BY position", [a.exam_id]);
    const answers = a.answers || {};
    const scores = a.essay_scores || {};
    res.json({ success: true, data: {
      events,
      essays: qs.map((q) => ({
        questionId: q.id, prompt: q.prompt, points: Number(q.points), rubric: q.answer?.rubric || '',
        answer: typeof answers[q.id] === 'string' ? answers[q.id] : '', score: scores[q.id] ?? null,
      })),
    } });
  } catch (err) { serverError(res, err, 'attemptDetail'); }
};

exports.reviewAttempt = async (req, res) => {
  try {
    const { a, error } = await ownedAttempt(req);
    if (error) return fail(res, ...error);
    if (a.status === 'in_progress') return fail(res, 409, 'The student has not submitted yet.');
    const [qs] = await pool.execute("SELECT id, points FROM exam_questions WHERE exam_id = ? AND type = 'essay'", [a.exam_id]);
    const scores = { ...(a.essay_scores || {}) };
    for (const q of qs) {
      const v = req.body?.scores?.[q.id];
      if (v === undefined || v === null || v === '' || Number.isNaN(Number(v))) continue;
      scores[q.id] = Math.min(Number(q.points), Math.max(0, Number(v)));
    }
    await pool.execute('UPDATE exam_attempts SET essay_scores = ? WHERE id = ?', [JSON.stringify(scores), a.id]);
    const r = await finalize(a.id, a.status, a.submit_reason);
    res.json({ success: true, data: { score: r.score, total: r.total, needsReview: r.needsReview } });
  } catch (err) { serverError(res, err, 'reviewAttempt'); }
};

// Delete an attempt so the student can take the exam again.
exports.deleteAttempt = async (req, res) => {
  try {
    const { a, error } = await ownedAttempt(req);
    if (error) return fail(res, ...error);
    await pool.execute('DELETE FROM exam_attempts WHERE id = ?', [a.id]);
    await pool.execute('DELETE FROM exam_results WHERE exam_id = ? AND student_key = ?', [a.exam_id, `uid:${a.user_id}`]);
    res.json({ success: true, message: 'Attempt removed. The student can retake the exam.' });
  } catch (err) { serverError(res, err, 'deleteAttempt'); }
};

exports.regenerateCode = async (req, res) => {
  try {
    const { exam, error } = await ownedExam(req, req.params.id);
    if (error) return fail(res, ...error);
    const code = makeCode();
    await pool.execute('UPDATE exams SET access_code = ? WHERE id = ?', [code, exam.id]);
    res.json({ success: true, data: { access_code: code } });
  } catch (err) { serverError(res, err, 'regenerateCode'); }
};

exports.makeCode = makeCode;
exports._test = { windowState, isExpired, finalize };
