// ExamAttemptsPage.jsx — teacher: exam code, who is taking the exam, violations, essay scoring, retakes
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useConfirm } from '../hooks/useConfirm'
import { ArrowLeft, Copy, Check, RefreshCw, RotateCcw, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'

const EVENT_LABEL = {
  tab_hidden: 'Left the exam tab / app', window_blur: 'Window lost focus', fullscreen_exit: 'Exited full screen',
  clipboard: 'Copy / paste attempt', key_blocked: 'Blocked shortcut', right_click: 'Right-click',
  print_attempt: 'Print attempt', away: 'Connection gap',
}
const COUNTS = ['tab_hidden', 'window_blur', 'fullscreen_exit']
const REASON = { violations: 'Locked: too many violations', time_up: 'Time ran out', student: 'Submitted' }
const time = (v) => (v ? new Date(v).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

function StatusBadge({ a }) {
  if (a.status === 'in_progress') return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Taking now</span>
  const bad = a.submit_reason === 'violations'
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${bad ? 'bg-red-100 text-red-700' : a.status === 'auto_submitted' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
    {REASON[a.submit_reason] || 'Submitted'}</span>
}

function Detail({ attempt, onChanged }) {
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['attempt-detail', attempt.id],
    queryFn: () => api.get(`/exams/attempts/${attempt.id}`).then(r => r.data.data),
  })
  if (isLoading) return <p className="text-xs text-slate-400 p-3">Loading…</p>

  const saveReview = async () => {
    setSaving(true); setMsg('')
    try { await api.post(`/exams/attempts/${attempt.id}/review`, { scores }); setMsg('Saved.'); onChanged() }
    catch (e) { setMsg(e.response?.data?.message || 'Could not save.') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-slate-50 border-t border-slate-100 p-3 space-y-3">
      <div>
        <p className="text-xs font-bold text-slate-700 mb-1">Activity log</p>
        {data.events.length === 0 ? <p className="text-xs text-slate-400">No events recorded.</p> : (
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {data.events.map((e, i) => (
              <p key={i} className={`text-xs flex gap-2 ${COUNTS.includes(e.type) ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                <span className="w-28 flex-shrink-0">{time(e.created_at)}</span>
                <span>{EVENT_LABEL[e.type] || e.type}{e.detail ? ` — ${e.detail}` : ''}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {data.essays.length > 0 && attempt.status !== 'in_progress' && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-700">Written answers</p>
          {data.essays.map(q => (
            <div key={q.questionId} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5">
              <p className="text-xs text-slate-500">{q.prompt}</p>
              {q.rubric && <p className="text-[11px] text-slate-400">Rubric: {q.rubric}</p>}
              <p className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 rounded p-2">{q.answer || <i className="text-slate-400">No answer</i>}</p>
              <div className="flex items-center gap-2 text-xs text-slate-500">Score
                <input type="number" min="0" max={q.points} step="0.5" className="input-field !py-1 !px-2 w-20 text-sm"
                  value={scores[q.questionId] ?? q.score ?? ''} onChange={e => setScores({ ...scores, [q.questionId]: e.target.value })} />
                / {q.points}</div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button onClick={saveReview} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-40">{saving ? 'Saving…' : 'Save essay scores'}</button>
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExamAttemptsPage() {
  const [confirmDialog, ask] = useConfirm()
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(null)
  const [copied, setCopied] = useState(false)
  const key = ['exam-attempts', id]
  const { data, isLoading, refetch } = useQuery({
    queryKey: key, refetchInterval: 15000,
    queryFn: () => api.get(`/exams/${id}/attempts`).then(r => r.data.data),
  })
  if (isLoading) return <p className="p-8 text-sm text-slate-400">Loading…</p>
  if (!data) return <p className="p-8 text-sm text-red-500">Could not load this exam.</p>
  const { exam, attempts } = data

  const copy = () => { navigator.clipboard.writeText(exam.access_code || ''); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const newCode = async () => {
    if (!(await ask({ title: 'Create a new code?', message: 'The old code stops working for students who have not started.', confirmLabel: 'New code', variant: 'warning' }))) return
    await api.post(`/exams/${id}/code`); refetch()
  }
  const retake = async (a) => {
    if (!(await ask({ title: 'Allow retake?', message: `${a.student_label}'s answers and score are deleted so they can take the exam again.`, confirmLabel: 'Delete attempt' }))) return
    await api.delete(`/exams/attempts/${a.id}`); setOpen(null); qc.invalidateQueries({ queryKey: key })
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      {confirmDialog}
      <div className="flex items-center gap-3">
        <button onClick={() => nav('/exams')} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowLeft size={18} /></button>
        <div><h1 className="text-lg font-bold text-slate-900">{exam.title}</h1><p className="text-xs text-slate-400">Online results · refreshes every 15 seconds</p></div>
        <button onClick={() => refetch()} className="ml-auto p-2 hover:bg-slate-100 rounded-xl text-slate-500" title="Refresh"><RefreshCw size={16} /></button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
        <div><p className="text-[11px] text-slate-400 font-semibold">EXAM CODE</p>
          <p className="text-3xl font-mono font-black tracking-[0.25em] text-slate-900">{exam.access_code || '—'}</p></div>
        <div className="flex gap-2">
          <button onClick={copy} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 flex items-center gap-1.5">{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}</button>
          <button onClick={newCode} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600">New code</button>
        </div>
        <p className={`ml-auto text-xs font-semibold px-3 py-1.5 rounded-full ${exam.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {exam.published ? 'Open to students' : 'Not open — enable it in Edit exam → Online settings'}</p>
      </div>

      {attempts.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">No student has started this exam yet.</p> : (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {attempts.map(a => {
            const hot = exam.max_violations > 0 && a.violation_count >= exam.max_violations
            return (
              <div key={a.id}>
                <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{a.student_label}</p>
                    <p className="text-[11px] text-slate-400">Started {time(a.started_at)}{a.submitted_at ? ` · submitted ${time(a.submitted_at)}` : ''}</p>
                  </div>
                  <StatusBadge a={a} />
                  <span className={`text-xs font-bold flex items-center gap-1 ${hot ? 'text-red-600' : a.violation_count ? 'text-amber-600' : 'text-slate-300'}`}>
                    <ShieldAlert size={13} /> {a.violation_count}</span>
                  <span className="w-24 text-right text-sm font-bold text-slate-800">
                    {a.score !== null ? `${Number(a.score)} / ${Number(a.total)}` : '—'}{a.needs_review ? ' ⚠' : ''}</span>
                  <button onClick={() => setOpen(open === a.id ? null : a.id)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Details">
                    {open === a.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                  <button onClick={() => retake(a)} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Allow retake"><RotateCcw size={15} /></button>
                </div>
                {open === a.id && <Detail attempt={a} onChanged={() => qc.invalidateQueries({ queryKey: key })} />}
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-slate-400">⚠ next to a score means written answers still need your score. Violation counts are recorded by the server.</p>
    </div>
  )
}
