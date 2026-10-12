'use strict';
// Question validation + auto-grading for every supported exam type.
//
// Stored question shapes (column "answer", JSON):
//   mcq    choices:[..]  answer:{ index }
//   tf     answer:{ value:true|false }
//   mtf    answer:{ value:true|false, correction:'word' }   (prompt marks the underlined word as [[word]])
//   ident  answer:{ accepted:['answer','alternative'] }
//   enum   answer:{ items:['a','b','c'], ordered:false }    (points are split evenly per item)
//   essay  answer:{ rubric:'...' }                          (teacher gives the score)

const TYPES = ['mcq', 'tf', 'mtf', 'ident', 'enum', 'essay'];
const DEFAULT_POINTS = { mcq: 1, tf: 1, mtf: 2, ident: 1, essay: 5 };

const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function lev(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Same answer ignoring case/punctuation; allows 1 typo on long non-numeric words.
function same(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  return Math.max(a.length, b.length) >= 6 && lev(a, b) <= 1;
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', 't', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', 'f', '0', 'no', 'n'].includes(s)) return false;
  return null;
}

function toIndex(v) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  const s = String(v ?? '').trim();
  if (/^[a-z]$/i.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
  if (/^\d+$/.test(s)) return Number(s);
  return -1;
}

function toList(v) {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(/\r?\n|;|,/);
  return arr.map((x) => String(x).trim()).filter(Boolean);
}

// ── Validate / normalise a question coming from the builder form or the AI ──
function normalizeQuestion(raw) {
  if (!isObj(raw) || !TYPES.includes(raw.type)) return null;
  const type = raw.type;
  const prompt = String(raw.prompt || '').trim().slice(0, 1000);
  if (!prompt) return null;

  const ans = raw.answer;
  const obj = isObj(ans) ? ans : {};
  let choices = null;
  let answer;

  switch (type) {
    case 'mcq': {
      choices = (Array.isArray(raw.choices) ? raw.choices : [])
        .map((c) => String(c).replace(/^\s*[A-Fa-f][).:]\s+/, '').trim())
        .filter(Boolean)
        .slice(0, 6);
      const index = toIndex(obj.index ?? ans);
      if (choices.length < 2 || index < 0 || index >= choices.length) return null;
      answer = { index };
      break;
    }
    case 'tf': {
      const value = toBool(obj.value ?? ans);
      if (value === null) return null;
      answer = { value };
      break;
    }
    case 'mtf': {
      const value = toBool(obj.value ?? ans);
      const correction = String(obj.correction ?? raw.correction ?? '').trim().slice(0, 200);
      if (value === null || (!value && !correction)) return null;
      answer = { value, correction: value ? '' : correction };
      break;
    }
    case 'ident': {
      const accepted = toList(obj.accepted ?? ans).slice(0, 10);
      if (!accepted.length) return null;
      answer = { accepted };
      break;
    }
    case 'enum': {
      const items = toList(obj.items ?? ans).slice(0, 20);
      if (!items.length) return null;
      answer = { items, ordered: !!obj.ordered };
      break;
    }
    default: // essay
      answer = { rubric: String(obj.rubric ?? (typeof ans === 'string' ? ans : '')).trim().slice(0, 1000) };
  }

  const fallback = type === 'enum' ? answer.items.length : DEFAULT_POINTS[type];
  const points = clamp(Number(raw.points) || fallback, 0.5, 100);

  return {
    type,
    prompt,
    choices,
    answer,
    points: round2(points),
    explanation: String(raw.explanation || '').trim().slice(0, 600),
  };
}

function describeKey(q) {
  const a = q.answer || {};
  switch (q.type) {
    case 'mcq': {
      const i = Number(a.index);
      return `${String.fromCharCode(65 + i)}. ${(q.choices || [])[i] ?? ''}`;
    }
    case 'tf': return toBool(a.value) ? 'True' : 'False';
    case 'mtf': return toBool(a.value) ? 'True' : `False → ${a.correction}`;
    case 'ident': return toList(a.accepted).join(' / ');
    case 'enum': return toList(a.items).join(', ') + (a.ordered ? ' (in order)' : '');
    default: return a.rubric || 'Scored by the teacher';
  }
}

// ── Grade one question ──
function gradeQuestion(q, given) {
  const max = Number(q.points) || 0;
  const a = q.answer || {};
  let score = 0;
  let needsReview = false;

  switch (q.type) {
    case 'mcq':
      score = toIndex(given) === Number(a.index) ? max : 0;
      break;
    case 'tf':
      score = toBool(given) !== null && toBool(given) === toBool(a.value) ? max : 0;
      break;
    case 'mtf': {
      const g = isObj(given) ? given : { value: given };
      const truth = toBool(a.value);
      if (toBool(g.value) !== truth) break;
      if (truth) { score = max; break; }
      const okWord = String(a.correction || '').split('|').some((c) => same(g.correction, c));
      score = max / 2 + (okWord ? max / 2 : 0);
      break;
    }
    case 'ident':
      score = toList(a.accepted).some((x) => same(given, x)) ? max : 0;
      break;
    case 'enum': {
      const expected = toList(a.items);
      const got = toList(given);
      if (!expected.length) break;
      let hits = 0;
      if (a.ordered) {
        expected.forEach((e, i) => { if (got[i] !== undefined && same(got[i], e)) hits++; });
      } else {
        const used = new Set();
        for (const e of expected) {
          const k = got.findIndex((g, i) => !used.has(i) && same(g, e));
          if (k >= 0) { used.add(k); hits++; }
        }
      }
      score = (max / expected.length) * hits;
      break;
    }
    default: // essay
      if (given === undefined || given === null || given === '') needsReview = true;
      else score = clamp(Number(given) || 0, 0, max);
  }

  return { max, score: round2(score), needsReview, expected: describeKey(q) };
}

const statusOf = (score, max, needsReview) =>
  needsReview ? 'review' : score >= max - 1e-9 ? 'correct' : score > 0 ? 'partial' : 'wrong';

// ── Grade a whole exam. overrides = { [questionId]: score } set by the teacher ──
function gradeExam(questions, answers = {}, overrides = {}) {
  const items = questions.map((q, i) => {
    const r = gradeQuestion(q, answers?.[q.id]);
    const ov = overrides?.[q.id];
    let overridden = false;
    if (ov !== undefined && ov !== null && ov !== '' && !Number.isNaN(Number(ov))) {
      r.score = round2(clamp(Number(ov), 0, r.max));
      r.needsReview = false;
      overridden = true;
    }
    return {
      questionId: q.id,
      number: i + 1,
      type: q.type,
      ...r,
      overridden,
      status: statusOf(r.score, r.max, r.needsReview),
    };
  });
  return {
    items,
    score: round2(items.reduce((s, x) => s + x.score, 0)),
    total: round2(items.reduce((s, x) => s + x.max, 0)),
    needsReview: items.some((x) => x.needsReview),
  };
}

module.exports = { TYPES, normalizeQuestion, gradeQuestion, gradeExam, describeKey, same, norm };
