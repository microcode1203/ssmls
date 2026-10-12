// ExamsPage.jsx — list exams, build exams (all question types), generate questions with AI
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useConfirm } from '../hooks/useConfirm'
import CreditBar from '../components/CreditBar'
import {
  Plus, Trash2, Copy, Sparkles, Save, ArrowLeft, Printer, ScanLine,
  Pencil, ChevronUp, ChevronDown, FileQuestion, ShieldCheck,
} from 'lucide-react'

const TYPE_META = {
  mcq:   { label: 'Multiple choice',        hint: 'Choose the letter of the best answer.' },
  tf:    { label: 'True or False',          hint: 'Write TRUE if the statement is correct, FALSE if not.' },
  mtf:   { label: 'Modified True or False', hint: 'Write TRUE if correct. If FALSE, replace the underlined word.' },
  ident: { label: 'Identification',         hint: 'Write the answer on the line.' },
  enum:  { label: 'Enumeration',            hint: 'List the items asked for.' },
  essay: { label: 'Essay / Problem solving', hint: 'Answer in complete sentences or show your solution.' },
}
const TYPES = Object.keys(TYPE_META)
const lines = (s) => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
let uid = 0

const DEFAULT_SETTINGS = {
  published: false, duration_minutes: '', opens_at: '', closes_at: '',
  max_violations: 3, shuffle_questions: false, show_result: false, enforce_fullscreen: true,
}
// ISO (UTC) <-> <input type="datetime-local"> (local time)
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso), p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const toIso = (v) => (v ? new Date(v).toISOString() : null)

// ── editor shape <-> API shape ───────────────────────────────────────────────
function blank(type) {
  return {
    uid: ++uid, type, prompt: '', points: type === 'mtf' ? 2 : type === 'essay' ? 5 : 1, explanation: '',
    choices: ['', '', '', ''], mcqIndex: 0, tfValue: true, mtfValue: false, correction: '',
    accepted: '', items: '', ordered: false, rubric: '',
  }
}
function fromApi(q) {
  const a = q.answer || {}
  return {
    ...blank(q.type), prompt: q.prompt, points: Number(q.points) || 1, explanation: q.explanation || '',
    choices: q.type === 'mcq' ? (q.choices || []) : ['', '', '', ''],
    mcqIndex: a.index ?? 0, tfValue: a.value ?? true, mtfValue: a.value ?? false,
    correction: a.correction || '', accepted: (a.accepted || []).join('\n'),
    items: (a.items || []).join('\n'), ordered: !!a.ordered, rubric: a.rubric || '',
  }
}
function toApi(q) {
  const base = { type: q.type, prompt: q.prompt, points: Number(q.points) || 1, explanation: q.explanation }
  switch (q.type) {
    case 'mcq': {
      const keep = q.choices.map((c, i) => ({ c: c.trim(), i })).filter(x => x.c)
      return { ...base, choices: keep.map(x => x.c), answer: { index: keep.findIndex(x => x.i === q.mcqIndex) } }
    }
    case 'tf':    return { ...base, answer: { value: q.tfValue } }
    case 'mtf':   return { ...base, answer: { value: q.mtfValue, correction: q.correction } }
    case 'ident': return { ...base, answer: { accepted: lines(q.accepted) } }
    case 'enum':  return { ...base, answer: { items: lines(q.items), ordered: q.ordered } }
    default:      return { ...base, answer: { rubric: q.rubric } }
  }
}

// ── one question card ────────────────────────────────────────────────────────
function QuestionCard({ q, n, total, onChange, onRemove, onCopy, onMove }) {
  const set = (patch) => onChange({ ...q, ...patch })
  const radio = (checked, onClick, label) => (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${checked ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200'}`}>
      {label}
    </button>
  )
  const perItem = q.type === 'enum' && lines(q.items).length ? (Number(q.points) / lines(q.items).length).toFixed(2) : null

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{n}</span>
        <span className="text-xs font-bold text-slate-700">{TYPE_META[q.type].label}</span>
        {q.fromAi && <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">AI draft — review</span>}
        <div className="ml-auto flex items-center gap-1">
          <label className="text-[11px] text-slate-400 mr-1">Points</label>
          <input type="number" min="0.5" step="0.5" className="input-field !py-1 !px-2 w-16 text-sm"
            value={q.points} onChange={e => set({ points: e.target.value })} />
          <button type="button" disabled={n === 1} onClick={() => onMove(-1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronUp size={15} /></button>
          <button type="button" disabled={n === total} onClick={() => onMove(1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ChevronDown size={15} /></button>
          <button type="button" onClick={onCopy} className="p-1.5 text-slate-400 hover:text-slate-700" title="Duplicate"><Copy size={15} /></button>
          <button type="button" onClick={onRemove} className="p-1.5 text-slate-400 hover:text-red-500" title="Remove"><Trash2 size={15} /></button>
        </div>
      </div>

      <textarea className="input-field w-full text-sm" rows={2} value={q.prompt} onChange={e => set({ prompt: e.target.value })}
        placeholder={q.type === 'mtf' ? 'Statement. Put the underlined word in [[double brackets]], e.g. The [[mitochondria]] makes proteins.' : 'Question / statement'} />

      {q.type === 'mcq' && (
        <div className="space-y-2">
          {q.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <button type="button" onClick={() => set({ mcqIndex: i })}
                className={`w-7 h-7 rounded-full text-xs font-bold border flex-shrink-0 ${q.mcqIndex === i ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-500 border-slate-300'}`}
                title="Mark as correct">{String.fromCharCode(65 + i)}</button>
              <input className="input-field flex-1 text-sm" value={c} placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                onChange={e => set({ choices: q.choices.map((x, j) => j === i ? e.target.value : x) })} />
            </div>
          ))}
          <div className="flex items-center gap-3">
            {q.choices.length < 6 && <button type="button" className="text-xs text-primary font-semibold" onClick={() => set({ choices: [...q.choices, ''] })}>+ Add choice</button>}
            <span className="text-[11px] text-slate-400">Tap a letter to mark the correct answer (green).</span>
          </div>
        </div>
      )}

      {q.type === 'tf' && (
        <div className="flex items-center gap-2"><span className="text-xs text-slate-500">Correct answer:</span>
          {radio(q.tfValue === true, () => set({ tfValue: true }), 'True')}
          {radio(q.tfValue === false, () => set({ tfValue: false }), 'False')}
        </div>
      )}

      {q.type === 'mtf' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><span className="text-xs text-slate-500">The statement as written is:</span>
            {radio(q.mtfValue === true, () => set({ mtfValue: true }), 'True')}
            {radio(q.mtfValue === false, () => set({ mtfValue: false }), 'False')}
          </div>
          {q.mtfValue === false && (
            <input className="input-field w-full text-sm" value={q.correction} onChange={e => set({ correction: e.target.value })}
              placeholder="Correct word that replaces the underlined part (use | for alternatives)" />
          )}
        </div>
      )}

      {q.type === 'ident' && (
        <textarea className="input-field w-full text-sm" rows={2} value={q.accepted} onChange={e => set({ accepted: e.target.value })}
          placeholder={'Accepted answers — one per line\n(spelling is checked leniently)'} />
      )}

      {q.type === 'enum' && (
        <div className="space-y-2">
          <textarea className="input-field w-full text-sm" rows={3} value={q.items} onChange={e => set({ items: e.target.value })}
            placeholder={'Correct items — one per line'} />
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={q.ordered} onChange={e => set({ ordered: e.target.checked })} /> Order matters</label>
            {perItem && <span>{lines(q.items).length} items · {perItem} pt each</span>}
          </div>
        </div>
      )}

      {q.type === 'essay' && (
        <textarea className="input-field w-full text-sm" rows={2} value={q.rubric} onChange={e => set({ rubric: e.target.value })}
          placeholder="Scoring rubric / expected answer (you enter the score when grading)" />
      )}

      <input className="input-field w-full text-xs" value={q.explanation} onChange={e => set({ explanation: e.target.value })}
        placeholder="Note / explanation (optional, for your reference)" />
    </div>
  )
}

// ── AI generator panel ───────────────────────────────────────────────────────
function AiPanel({ onAdd }) {
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('Grade 11 STEM')
  const [counts, setCounts] = useState({ mcq: 5, tf: 3, mtf: 2, ident: 3, enum: 1, essay: 0 })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [usage, setUsage] = useState(null)
  const total = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0)

  const run = async () => {
    setBusy(true); setMsg('')
    try {
      const r = await api.post('/exams/ai-generate', { topic, level, counts })
      setUsage(r.data.usage || null)
      const qs = r.data.data.questions.map(q => ({ ...fromApi(q), fromAi: true }))
      onAdd(qs)
      setMsg(`Added ${qs.length} question${qs.length === 1 ? '' : 's'}${r.data.data.skipped ? ` (${r.data.data.skipped} unusable ones skipped)` : ''}. Please check every answer before saving.`)
    } catch (e) {
      if (e.response?.data?.usage) setUsage(e.response.data.usage)
      setMsg(e.response?.data?.message || 'Could not generate questions.')
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Sparkles size={16} className="text-violet-600" />
        <p className="text-sm font-bold text-slate-800">Generate questions with AI</p></div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input className="input-field text-sm" placeholder="Topic, e.g. Photosynthesis" value={topic} onChange={e => setTopic(e.target.value)} />
        <input className="input-field text-sm" placeholder="Level / strand" value={level} onChange={e => setLevel(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {TYPES.map(t => (
          <label key={t} className="text-[10px] text-slate-500 font-semibold leading-tight">
            {TYPE_META[t].label}
            <input type="number" min="0" max="15" className="input-field !py-1 !px-2 text-sm mt-1 w-full"
              value={counts[t]} onChange={e => setCounts({ ...counts, [t]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy || !topic.trim() || total < 1 || total > 20} onClick={run}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2">
          {busy ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles size={14} />}
          {busy ? 'Writing questions…' : `Generate ${total} question${total === 1 ? '' : 's'}`}
        </button>
        <span className="text-[11px] text-slate-500">Max 20 per run. AI can be wrong — review before use.</span>
      </div>
      {msg && <p className="text-xs text-slate-700">{msg}</p>}
      {usage && <CreditBar usage={usage} />}
    </div>
  )
}

// ── builder ──────────────────────────────────────────────────────────────────
function Builder({ examId, onDone }) {
  const [form, setForm] = useState({ title: '', subject_label: '', section_label: '', instructions: '', ...DEFAULT_SETTINGS })
  const [accessCode, setAccessCode] = useState('')
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(!!examId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!examId) return
    let alive = true
    api.get(`/exams/${examId}`).then(r => {
      if (!alive) return
      const e = r.data.data
      setForm({
        title: e.title, subject_label: e.subject_label || '', section_label: e.section_label || '', instructions: e.instructions || '',
        published: !!e.published, duration_minutes: e.duration_minutes || '', opens_at: toLocalInput(e.opens_at), closes_at: toLocalInput(e.closes_at),
        max_violations: e.max_violations ?? 3, shuffle_questions: !!e.shuffle_questions, show_result: !!e.show_result,
        enforce_fullscreen: e.enforce_fullscreen !== false,
      })
      setAccessCode(e.access_code || '')
      setQuestions(e.questions.map(fromApi))
    }).catch(() => alive && setError('Could not load this exam.')).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [examId])

  const total = questions.reduce((s, q) => s + (Number(q.points) || 0), 0)
  const update = (i, q) => setQuestions(qs => qs.map((x, j) => j === i ? q : x))
  const move = (i, d) => setQuestions(qs => { const a = [...qs]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a })

  const save = async () => {
    setSaving(true); setError('')
    try {
      const body = { ...form, opens_at: toIso(form.opens_at), closes_at: toIso(form.closes_at), questions: questions.map(toApi) }
      if (examId) await api.put(`/exams/${examId}`, body); else await api.post('/exams', body)
      onDone(true)
    } catch (e) { setError(e.response?.data?.message || 'Could not save the exam.') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="p-8 text-sm text-slate-400">Loading…</p>

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => onDone(false)} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowLeft size={18} /></button>
        <h1 className="text-lg font-bold text-slate-900">{examId ? 'Edit exam' : 'New exam'}</h1>
        <span className="ml-auto text-xs text-slate-500">{questions.length} questions · {total} pts</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 grid sm:grid-cols-2 gap-2">
        <input className="input-field text-sm sm:col-span-2" placeholder="Exam title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <input className="input-field text-sm" placeholder="Subject" value={form.subject_label} onChange={e => setForm({ ...form, subject_label: e.target.value })} />
        <input className="input-field text-sm" placeholder="Section" value={form.section_label} onChange={e => setForm({ ...form, section_label: e.target.value })} />
        <textarea className="input-field text-sm sm:col-span-2" rows={2} placeholder="General instructions (optional)" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck size={16} className="text-primary" />
          <p className="text-sm font-bold text-slate-800">Online exam settings</p>
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} /> Open for students to take online
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="text-[11px] font-semibold text-slate-500">Time limit (minutes)
            <input type="number" min="1" className="input-field text-sm mt-1 w-full" placeholder="No limit"
              value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} /></label>
          <label className="text-[11px] font-semibold text-slate-500">Opens
            <input type="datetime-local" className="input-field text-sm mt-1 w-full"
              value={form.opens_at} onChange={e => setForm({ ...form, opens_at: e.target.value })} /></label>
          <label className="text-[11px] font-semibold text-slate-500">Closes
            <input type="datetime-local" className="input-field text-sm mt-1 w-full"
              value={form.closes_at} onChange={e => setForm({ ...form, closes_at: e.target.value })} /></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-600">
          <label className="flex items-center gap-2">Auto-submit after
            <input type="number" min="0" max="20" className="input-field !py-1 !px-2 w-16 text-sm"
              value={form.max_violations} onChange={e => setForm({ ...form, max_violations: e.target.value })} /> violations (0 = only record them)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.enforce_fullscreen} onChange={e => setForm({ ...form, enforce_fullscreen: e.target.checked })} /> Require full screen</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.shuffle_questions} onChange={e => setForm({ ...form, shuffle_questions: e.target.checked })} /> Shuffle question order</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.show_result} onChange={e => setForm({ ...form, show_result: e.target.checked })} /> Show the score to students after submitting</label>
        </div>
        {accessCode
          ? <p className="text-xs text-slate-500">Exam code for students: <b className="font-mono tracking-widest text-slate-800 text-sm">{accessCode}</b></p>
          : <p className="text-xs text-slate-400">The exam code is created when you save.</p>}
        <p className="text-[11px] text-slate-400">The browser can detect and record leaving the exam (tab switch, home screen, exiting full screen) but cannot physically block it, so students are warned and the server auto-submits at your limit.</p>
      </div>

      <AiPanel onAdd={qs => setQuestions(cur => [...cur, ...qs])} />

      {questions.map((q, i) => (
        <QuestionCard key={q.uid} q={q} n={i + 1} total={questions.length}
          onChange={nq => update(i, nq)} onRemove={() => setQuestions(qs => qs.filter((_, j) => j !== i))}
          onCopy={() => setQuestions(qs => [...qs.slice(0, i + 1), { ...q, uid: ++uid, fromAi: false }, ...qs.slice(i + 1)])}
          onMove={d => move(i, d)} />
      ))}

      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">Add a question</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button key={t} type="button" onClick={() => setQuestions(qs => [...qs, blank(t)])}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary flex items-center gap-1">
              <Plus size={12} /> {TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-100 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex justify-end">
        <button onClick={save} disabled={saving || !form.title.trim() || !questions.length}
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2">
          <Save size={15} /> {saving ? 'Saving…' : 'Save exam'}
        </button>
      </div>
    </div>
  )
}

// ── list ─────────────────────────────────────────────────────────────────────
export default function ExamsPage() {
  const [confirmDialog, ask] = useConfirm()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(undefined) // undefined=list, null=new, id=edit
  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'], queryFn: () => api.get('/exams').then(r => r.data.data),
  })

  const remove = async (e) => {
    if (!(await ask({ title: 'Delete exam?', message: `"${e.title}" and all its saved results will be permanently deleted.`, confirmLabel: 'Delete' }))) return
    await api.delete(`/exams/${e.id}`)
    qc.invalidateQueries({ queryKey: ['exams'] })
  }

  if (editing !== undefined)
    return <Builder examId={editing} onDone={(saved) => { setEditing(undefined); if (saved) qc.invalidateQueries({ queryKey: ['exams'] }) }} />

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      {confirmDialog}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><FileQuestion size={20} /></div>
        <div><h1 className="text-lg font-bold text-slate-900">Exams</h1>
          <p className="text-xs text-slate-400">Build exams, print them, then scan and grade the answer sheets</p></div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => nav('/exams/scan')} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 flex items-center gap-2"><ScanLine size={15} /> Scan & grade</button>
          <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2"><Plus size={15} /> New exam</button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-400">Loading…</p> : !exams?.length ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500 mb-3">No exams yet.</p>
          <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold">Create your first exam</button>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map(e => (
            <div key={e.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 text-sm truncate">{e.title}</p>
                <p className="text-xs text-slate-400">
                  {[e.subject_label, e.section_label].filter(Boolean).join(' · ') || 'No subject'} · {e.question_count} questions · {Number(e.total_points)} pts · {e.result_count} graded{e.published ? ` · online code ${e.access_code}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditing(e.id)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Edit"><Pencil size={15} /></button>
                <button onClick={() => nav(`/exams/${e.id}/attempts`)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Online results & code"><ShieldCheck size={15} /></button>
                <button onClick={() => nav(`/exams/${e.id}/print`)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Print exam & answer sheet"><Printer size={15} /></button>
                <button onClick={() => nav(`/exams/scan?exam=${e.id}`)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Scan & grade"><ScanLine size={15} /></button>
                <button onClick={() => remove(e)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" title="Delete"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
