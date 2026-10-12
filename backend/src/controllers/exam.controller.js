'use strict';
const QRCode = require('qrcode');
const { pool } = require('../config/database');
const { TYPES, normalizeQuestion, gradeExam, norm } = require('../utils/examGrading');
const { makeCode } = require('./examOnline.controller');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const fail = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra });
const serverError = (res, err, tag) => { console.error(tag, err); fail(res, 500, 'Server error.'); };

// ── helpers ─────────────────────────────────────────────────────────────────
async function loadExam(req, id) {
  const [rows] = await pool.execute('SELECT * FROM exams WHERE id = ?', [id]);
  const exam = rows[0];
  if (!exam) return { error: [404, 'Exam not found.'] };
  if (req.user.role !== 'admin' && exam.teacher_user_id !== req.user.id) return { error: [403, 'Not your exam.'] };
  const [questions] = await pool.execute('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY position', [id]);
  return { exam, questions };
}

function cleanQuestions(list) {
  if (!Array.isArray(list) || !list.length) return { error: 'Add at least one question.' };
  if (list.length > 100) return { error: 'An exam can have at most 100 questions.' };
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const q = normalizeQuestion(list[i]);
    if (!q) return { error: `Question ${i + 1} is incomplete (check the prompt and the answer).` };
    out.push(q);
  }
  return { questions: out };
}

async function insertQuestions(conn, examId, questions) {
  await conn.execute('DELETE FROM exam_questions WHERE exam_id = ?', [examId]);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await conn.execute(
      `INSERT INTO exam_questions (exam_id, position, type, prompt, choices, answer, points, explanation)
       VALUES (?,?,?,?,?,?,?,?)`,
      [examId, i + 1, q.type, q.prompt, q.choices ? JSON.stringify(q.choices) : null,
       JSON.stringify(q.answer), q.points, q.explanation]
    );
  }
}

async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

const toDate = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null; };
const toInt = (v, min, max, def) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

const examFields = (b) => ({
  published: !!b.published,
  duration: b.duration_minutes ? toInt(b.duration_minutes, 1, 600, null) : null,
  opens: toDate(b.opens_at),
  closes: toDate(b.closes_at),
  maxViolations: toInt(b.max_violations, 0, 20, 3),
  shuffle: !!b.shuffle_questions,
  showResult: !!b.show_result,
  fullscreen: b.enforce_fullscreen !== false,
  title: String(b.title || '').trim().slice(0, 200),
  subject: String(b.subject_label || '').trim().slice(0, 120),
  section: String(b.section_label || '').trim().slice(0, 120),
  instructions: String(b.instructions || '').trim().slice(0, 2000),
});

// ── CRUD ────────────────────────────────────────────────────────────────────
exports.listExams = async (req, res) => {
  try {
    const admin = req.user.role === 'admin';
    const [rows] = await pool.execute(
      `SELECT e.id, e.title, e.subject_label, e.section_label, e.total_points, e.created_at, e.access_code, e.published,
         (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count,
         (SELECT COUNT(*) FROM exam_results r WHERE r.exam_id = e.id) AS result_count
       FROM exams e ${admin ? '' : 'WHERE e.teacher_user_id = ?'}
       ORDER BY e.created_at DESC`,
      admin ? [] : [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { serverError(res, err, 'listExams'); }
};

exports.getExam = async (req, res) => {
  try {
    const { exam, questions, error } = await loadExam(req, req.params.id);
    if (error) return fail(res, ...error);
    res.json({ success: true, data: { ...exam, questions } });
  } catch (err) { serverError(res, err, 'getExam'); }
};

exports.createExam = async (req, res) => {
  try {
    const f = examFields(req.body);
    if (!f.title) return fail(res, 400, 'Exam title is required.');
    if (f.opens && f.closes && f.closes <= f.opens) return fail(res, 400, 'The closing time must be after the opening time.');
    const { questions, error } = cleanQuestions(req.body.questions);
    if (error) return fail(res, 400, error);
    const total = questions.reduce((s, q) => s + q.points, 0);

    const id = await withTransaction(async (conn) => {
      const [r] = await conn.execute(
        `INSERT INTO exams (title, subject_label, section_label, instructions, teacher_user_id, total_points,
           access_code, published, duration_minutes, opens_at, closes_at, max_violations, shuffle_questions, show_result, enforce_fullscreen)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [f.title, f.subject, f.section, f.instructions, req.user.id, total,
         makeCode(), f.published, f.duration, f.opens, f.closes, f.maxViolations, f.shuffle, f.showResult, f.fullscreen]
      );
      await insertQuestions(conn, r.insertId, questions);
      return r.insertId;
    });
    res.status(201).json({ success: true, data: { id }, message: 'Exam saved.' });
  } catch (err) { serverError(res, err, 'createExam'); }
};

exports.updateExam = async (req, res) => {
  try {
    const { exam, error: e1 } = await loadExam(req, req.params.id);
    if (e1) return fail(res, ...e1);
    const f = examFields(req.body);
    if (!f.title) return fail(res, 400, 'Exam title is required.');
    if (f.opens && f.closes && f.closes <= f.opens) return fail(res, 400, 'The closing time must be after the opening time.');
    const { questions, error } = cleanQuestions(req.body.questions);
    if (error) return fail(res, 400, error);
    const total = questions.reduce((s, q) => s + q.points, 0);

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE exams SET title=?, subject_label=?, section_label=?, instructions=?, total_points=?, updated_at=NOW(),
           published=?, duration_minutes=?, opens_at=?, closes_at=?, max_violations=?, shuffle_questions=?, show_result=?, enforce_fullscreen=?
         WHERE id=?`,
        [f.title, f.subject, f.section, f.instructions, total,
         f.published, f.duration, f.opens, f.closes, f.maxViolations, f.shuffle, f.showResult, f.fullscreen, exam.id]
      );
      await insertQuestions(conn, exam.id, questions);
    });
    res.json({ success: true, message: 'Exam updated.' });
  } catch (err) { serverError(res, err, 'updateExam'); }
};

exports.deleteExam = async (req, res) => {
  try {
    const { exam, error } = await loadExam(req, req.params.id);
    if (error) return fail(res, ...error);
    await pool.execute('DELETE FROM exams WHERE id = ?', [exam.id]);
    res.json({ success: true, message: 'Exam deleted.' });
  } catch (err) { serverError(res, err, 'deleteExam'); }
};

// ── QR code printed on the answer sheet: SSMLS-EXAM:<id> ────────────────────
exports.examQr = async (req, res) => {
  try {
    const { exam, error } = await loadExam(req, req.params.id);
    if (error) return fail(res, ...error);
    const dataUrl = await QRCode.toDataURL(`SSMLS-EXAM:${exam.id}`, { margin: 1, width: 240 });
    res.json({ success: true, data: { dataUrl, code: `SSMLS-EXAM:${exam.id}` } });
  } catch (err) { serverError(res, err, 'examQr'); }
};

// ── Grade a student's answers (optionally save) ─────────────────────────────
exports.gradeSubmission = async (req, res) => {
  try {
    const { exam, questions, error } = await loadExam(req, req.params.id);
    if (error) return fail(res, ...error);
    const { studentId, studentName, answers, overrides, save } = req.body || {};

    const result = gradeExam(questions, answers || {}, overrides || {});
    let saved = false;

    if (save) {
      const label = String(studentName || '').trim().slice(0, 120);
      const sid = Number.isInteger(Number(studentId)) && Number(studentId) > 0 ? Number(studentId) : null;
      if (!label && !sid) return fail(res, 400, 'Enter the student name before saving.');
      const key = sid ? `id:${sid}` : `name:${norm(label)}`;
      await pool.execute(
        `INSERT INTO exam_results (exam_id, student_key, student_id, student_label, answers, item_scores, score, total, needs_review, graded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (exam_id, student_key) DO UPDATE SET
           student_label = EXCLUDED.student_label, answers = EXCLUDED.answers, item_scores = EXCLUDED.item_scores,
           score = EXCLUDED.score, total = EXCLUDED.total, needs_review = EXCLUDED.needs_review,
           graded_by = EXCLUDED.graded_by, created_at = NOW()`,
        [exam.id, key, sid, label, JSON.stringify(answers || {}),
         JSON.stringify(result.items.map((i) => ({ q: i.questionId, s: i.score }))),
         result.score, result.total, result.needsReview, req.user.id]
      );
      saved = true;
    }
    res.json({ success: true, data: { ...result, saved } });
  } catch (err) { serverError(res, err, 'gradeSubmission'); }
};

exports.listResults = async (req, res) => {
  try {
    const { exam, error } = await loadExam(req, req.params.id);
    if (error) return fail(res, ...error);
    const [rows] = await pool.execute(
      `SELECT id, student_id, student_label, score, total, needs_review, created_at
       FROM exam_results WHERE exam_id = ? ORDER BY student_label`,
      [exam.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { serverError(res, err, 'listResults'); }
};

// ── AI question generator (Groq free tier) ──────────────────────────────────
const AI_SYSTEM = `You write exam questions for Philippine Senior High School (DepEd K-12).
Reply with ONLY a JSON object: {"questions":[ ... ]}. No markdown, no commentary.
Every question has "type" and "prompt". Formats by type:
- "mcq": "choices": [4 short options, no letter prefixes], "answer": "B" (the correct letter)
- "tf": "answer": true or false
- "mtf" (modified true or false): "prompt" is a statement with ONE key word or phrase wrapped in [[double brackets]] (that part is underlined). "answer": true if the statement is correct as written, otherwise false, and then "correction": the single word/phrase that replaces the underlined part to make it true.
- "ident" (identification): "answer": ["main answer", "accepted alternative"]
- "enum" (enumeration): "prompt" says what to list (e.g. "Give the 3 states of matter."), "answer": ["item1","item2","item3"]
- "essay": "answer": "short scoring rubric"
Questions must be accurate, unambiguous, appropriate to the level, and have exactly one correct answer. Add a one-sentence "explanation" for each.`;

function readUsage(r) {
  const num = (h) => { const v = r.headers.get(h); return v == null || v === '' ? null : Number(v); };
  return {
    requests: { limit: num('x-ratelimit-limit-requests'), remaining: num('x-ratelimit-remaining-requests') },
    tokens: { limit: num('x-ratelimit-limit-tokens'), remaining: num('x-ratelimit-remaining-tokens') },
    resetRequests: r.headers.get('x-ratelimit-reset-requests'),
    resetTokens: r.headers.get('x-ratelimit-reset-tokens'),
  };
}

exports.aiGenerate = async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return fail(res, 503, 'AI is not configured. Ask your administrator to set GROQ_API_KEY.');

    const topic = String(req.body?.topic || '').trim().slice(0, 300);
    const level = String(req.body?.level || 'Senior High School').trim().slice(0, 80);
    if (!topic) return fail(res, 400, 'Enter a topic first.');

    const counts = {};
    let total = 0;
    for (const t of TYPES) {
      counts[t] = Math.max(0, Math.min(15, parseInt(req.body?.counts?.[t], 10) || 0));
      total += counts[t];
    }
    if (total < 1) return fail(res, 400, 'Choose how many questions of at least one type.');
    if (total > 20) return fail(res, 400, 'Generate at most 20 questions at a time.');

    const wanted = TYPES.filter((t) => counts[t]).map((t) => `${counts[t]} "${t}"`).join(', ');
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const payload = {
      model,
      messages: [
        { role: 'system', content: AI_SYSTEM },
        { role: 'user', content: `Topic: ${topic}\nLevel / strand: ${level}\nWrite exactly these questions: ${wanted}.` },
      ],
      temperature: 0.4,
      max_tokens: Math.min(5000, 700 + total * 220),
      response_format: { type: 'json_object' },
    };
    if (model.includes('gpt-oss')) payload.reasoning_effort = 'low';

    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });
    const usage = readUsage(r);

    if (!r.ok) {
      console.error('Groq exam error', r.status, (await r.text()).slice(0, 400));
      const msg = r.status === 429 || r.status === 413
        ? 'The free AI limit was reached. Wait a minute or generate fewer questions.'
        : 'The AI is unavailable right now. Please try again later.';
      return fail(res, r.status === 429 || r.status === 413 ? 429 : 502, msg, { usage });
    }

    const data = await r.json();
    const text = (data.choices?.[0]?.message?.content || '').replace(/^```(?:json)?|```$/gim, '').trim();
    let list;
    try { list = JSON.parse(text).questions; } catch { list = null; }
    if (!Array.isArray(list)) return fail(res, 502, 'The AI returned an unreadable answer. Please try again.', { usage });

    const questions = list.map(normalizeQuestion).filter(Boolean);
    res.json({
      success: true,
      data: { questions, skipped: list.length - questions.length },
      usage,
    });
  } catch (err) { serverError(res, err, 'aiGenerate'); }
};
