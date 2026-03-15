/* @v2-fixed-imports */
import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, X, Clock, BookOpen, CheckCircle, Send,
  Users, Award, Filter, Eye, ChevronDown, AlertCircle,
  FileText, Trash2
} from 'lucide-react'
import { format, isPast, formatDistanceToNow } from 'date-fns'

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  homework: { badge:'badge-blue',   bg:'bg-blue-50',   label:'Homework' },
  quiz:     { badge:'badge-amber',  bg:'bg-amber-50',  label:'Quiz' },
  activity: { badge:'badge-green',  bg:'bg-emerald-50',label:'Activity' },
  project:  { badge:'badge-purple', bg:'bg-violet-50', label:'Project' },
  exam:     { badge:'badge-red',    bg:'bg-red-50',    label:'Exam' },
}

// ─── Create Assignment Modal (Teacher) ────────────────────────────────────────
function CreateModal({ schedules, onClose, onSave }) {
  const [form, setForm] = useState({
    scheduleId:'', title:'', description:'', dueDate:'', maxScore:100, type:'homework'
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/assignments', form)
      toast.success('Assignment created.')
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">Create Assignment</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Class <span className="text-red-500">*</span></label>
            <select className="input-field" value={form.scheduleId} onChange={set('scheduleId')} required>
              <option value="">— Select class —</option>
              {(schedules||[]).filter(s=>s.status==='approved').map(s=>(
                <option key={s.id} value={s.id}>
                  {s.subject||s.subject_name} · {s.grade_level} {s.section_name} · {s.day_of_week}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
                <button key={val} type="button"
                  onClick={() => setForm(p=>({...p, type:val}))}
                  className={`py-2 rounded-lg text-xs font-bold border-2 transition-all capitalize
                    ${form.type===val ? 'border-primary bg-primary text-white' : 'border-slate-200 text-slate-600 hover:border-primary/40'}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title <span className="text-red-500">*</span></label>
            <input className="input-field" placeholder="e.g. Chapter 3 Quiz" value={form.title} onChange={set('title')} required/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Instructions</label>
            <textarea className="input-field h-24 resize-none" placeholder="Describe what students need to do…"
              value={form.description} onChange={set('description')}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Due Date <span className="text-red-500">*</span></label>
              <input type="datetime-local" className="input-field" value={form.dueDate} onChange={set('dueDate')} required/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Max Score</label>
              <input type="number" className="input-field" value={form.maxScore} onChange={set('maxScore')} min="1" max="1000"/>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
                : <><Plus size={15}/>Create Assignment</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Submit Assignment Modal (Student) ────────────────────────────────────────
function SubmitModal({ assignment, onClose, onSave }) {
  const [text,   setText]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.post('/assignments/submit', { assignmentId: assignment.id, textAnswer: text })
      toast.success('Assignment submitted!')
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-display font-bold text-slate-900">{assignment.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Due: {format(new Date(assignment.due_date), 'MMM d, yyyy h:mm a')} · {assignment.max_score} pts
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {assignment.description && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600">
              {assignment.description}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Answer <span className="text-red-500">*</span></label>
            <textarea className="input-field h-40 resize-none" placeholder="Type your answer here…"
              value={text} onChange={e => setText(e.target.value)} required/>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting…</>
                : <><Send size={15}/>Submit Answer</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Submissions Drawer (Teacher/Admin) ───────────────────────────────────────
function SubmissionsDrawer({ assignment, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['submissions', assignment.id],
    queryFn:  () => api.get(`/assignments/${assignment.id}/submissions`).then(r => r.data.data),
    staleTime: 0,
  })
  const [grading,    setGrading]    = useState(null) // submission being graded
  const [score,      setScore]      = useState('')
  const [feedback,   setFeedback]   = useState('')
  const [savingGrade,setSavingGrade]= useState(false)
  const qc = useQueryClient()

  const handleGrade = async () => {
    if (!score) return toast.error('Enter a score.')
    setSavingGrade(true)
    try {
      await api.patch(`/assignments/submissions/${grading.id}/grade`, { score, feedback })
      toast.success('Graded!')
      setGrading(null); setScore(''); setFeedback('')
      qc.invalidateQueries(['submissions', assignment.id])
    } catch { toast.error('Failed to grade.') }
    finally { setSavingGrade(false) }
  }

  const submitted = (data||[]).filter(s => s.status !== 'missing').length
  const graded    = (data||[]).filter(s => s.status === 'graded').length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-display font-bold text-slate-900">{assignment.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {assignment.subject_name} · Due {format(new Date(assignment.due_date), 'MMM d, h:mm a')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-slate-100 flex-shrink-0">
          {[
            { label:'Submitted', value: submitted,              color:'text-blue-600' },
            { label:'Graded',    value: graded,                 color:'text-emerald-600' },
            { label:'Pending',   value: submitted - graded,     color:'text-amber-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center bg-slate-50 rounded-xl p-3">
              <p className={'text-2xl font-bold ' + color}>{value}</p>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Submissions list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/>
            </div>
          ) : !(data||[]).length ? (
            <div className="text-center py-12 text-slate-400">
              <FileText size={28} className="mx-auto mb-2 opacity-20"/>
              <p>No submissions yet.</p>
            </div>
          ) : (
            (data||[]).map(sub => (
              <div key={sub.id} className={`p-4 rounded-xl border transition-all
                ${sub.status==='graded' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {sub.first_name?.[0]}{sub.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{sub.last_name}, {sub.first_name}</p>
                      <p className="text-xs text-slate-400">
                        Submitted {formatDistanceToNow(new Date(sub.submitted_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sub.status==='graded'
                      ? <span className="text-sm font-bold text-emerald-600">{sub.score}/{assignment.max_score}</span>
                      : <span className="badge-amber">Pending</span>
                    }
                    {sub.status!=='graded' && (
                      <button
                        onClick={() => { setGrading(sub); setScore(''); setFeedback('') }}
                        className="btn-primary text-xs py-1.5 px-3">
                        <Award size={12}/> Grade
                      </button>
                    )}
                  </div>
                </div>
                {sub.text_answer && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-600 max-h-24 overflow-y-auto">
                    {sub.text_answer}
                  </div>
                )}
                {sub.feedback && (
                  <p className="mt-2 text-xs text-emerald-700 font-medium">Feedback: {sub.feedback}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Grade panel */}
        {grading && (
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex-shrink-0">
            <p className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">
              Grading: {grading.first_name} {grading.last_name}
            </p>
            <div className="flex gap-3 mb-3">
              <div className="w-28 flex-shrink-0">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Score / {assignment.max_score}</label>
                <input type="number" className="input-field text-center font-bold"
                  min="0" max={assignment.max_score}
                  value={score} onChange={e => setScore(e.target.value)}
                  placeholder="0" autoFocus/>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Feedback (optional)</label>
                <input className="input-field" placeholder="e.g. Good work, but review section 3"
                  value={feedback} onChange={e => setFeedback(e.target.value)}/>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setGrading(null)} className="btn-secondary text-xs flex-1 justify-center">Cancel</button>
              <button onClick={handleGrade} disabled={savingGrade} className="btn-primary text-xs flex-1 justify-center">
                {savingGrade ? 'Saving…' : <><Award size={13}/> Submit Grade</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AssignmentsPage() {
  const { user } = useAuth()
  const qc       = useQueryClient()
  const [createModal,    setCreateModal]    = useState(false)
  const [submitModal,    setSubmitModal]    = useState(null)
  const [submissionsFor, setSubmissionsFor] = useState(null)
  const [filter,         setFilter]         = useState({ type:'', status:'' })

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn:  () => api.get('/assignments').then(r => r.data.data),
    staleTime: 0,
  })

  const { data: mySchedules } = useQuery({
    queryKey: ['my-schedules-assignments'],
    queryFn:  () => user?.teacherId
      ? api.get(`/schedules/teacher/${user.teacherId}`).then(r => r.data.data)
      : Promise.resolve([]),
    enabled: user?.role === 'teacher',
  })

  // Admin gets all schedules
  const { data: allSchedules } = useQuery({
    queryKey: ['all-schedules-assignments'],
    queryFn:  () => api.get('/schedules/pending').then(r => r.data.data),
    enabled:  user?.role === 'admin',
  })

  const schedules = user?.role === 'admin' ? allSchedules : mySchedules

  // Apply filters
  const filtered = useMemo(() => {
    return (assignments || []).filter(a => {
      if (filter.type && a.type !== filter.type) return false
      if (filter.status === 'overdue'  && !isPast(new Date(a.due_date))) return false
      if (filter.status === 'active'   &&  isPast(new Date(a.due_date))) return false
      return true
    })
  }, [assignments, filter])

  const deleteAssignment = async (id) => {
    if (!window.confirm('Delete this assignment? All submissions will be lost.')) return
    try {
      await api.delete(`/assignments/${id}`)
      toast.success('Assignment deleted.')
      qc.invalidateQueries(['assignments'])
    } catch { toast.error('Failed to delete.') }
  }

  const activeCount  = (assignments||[]).filter(a => !isPast(new Date(a.due_date))).length
  const overdueCount = (assignments||[]).filter(a =>  isPast(new Date(a.due_date))).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeCount} active · {overdueCount} overdue
          </p>
        </div>
        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <button onClick={() => setCreateModal(true)} className="btn-primary">
            <Plus size={16}/> Create Assignment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex gap-3 flex-wrap items-center">
        <Filter size={14} className="text-slate-400 flex-shrink-0"/>
        <select className="input-field w-36 text-sm" value={filter.type}
          onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}>
          <option value="">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
            <option key={val} value={val}>{cfg.label}</option>
          ))}
        </select>
        <select className="input-field w-36 text-sm" value={filter.status}
          onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
        </select>
        {(filter.type || filter.status) && (
          <button onClick={() => setFilter({ type:'', status:'' })} className="btn-ghost text-xs">
            <X size={12}/> Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} of {assignments?.length || 0} assignments
        </span>
      </div>

      {/* Assignment grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center text-slate-400">
          <BookOpen size={36} className="mx-auto mb-3 opacity-20"/>
          <p className="font-semibold">No assignments found.</p>
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <p className="text-xs mt-1">Click "Create Assignment" to add one.</p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => {
            const overdue  = isPast(new Date(a.due_date))
            const cfg      = TYPE_CONFIG[a.type] || TYPE_CONFIG.homework
            const timeLeft = overdue
              ? 'Overdue ' + formatDistanceToNow(new Date(a.due_date), { addSuffix: true })
              : 'Due ' + formatDistanceToNow(new Date(a.due_date), { addSuffix: true })

            return (
              <div key={a.id} className={`card p-5 flex flex-col gap-3 hover:shadow-md transition-all
                ${overdue ? 'border-red-100' : ''}`}>

                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                    <BookOpen size={16} className="text-slate-600"/>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cfg.badge}>{cfg.label}</span>
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      <button onClick={() => deleteAssignment(a.id)}
                        className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-lg transition-colors">
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{a.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{a.subject_name}</p>
                  {a.section_name && (
                    <p className="text-xs text-slate-400">{a.grade_level} · {a.section_name}</p>
                  )}
                  {a.description && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{a.description}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold
                      ${overdue ? 'text-red-500' : 'text-slate-500'}`}>
                      <Clock size={11}/>
                      {timeLeft}
                    </div>
                    <span className="text-xs font-bold text-slate-400">{a.max_score} pts</span>
                  </div>

                  {/* Teacher/Admin: see submissions */}
                  {(user?.role === 'teacher' || user?.role === 'admin') && (
                    <button
                      onClick={() => setSubmissionsFor(a)}
                      className="btn-secondary w-full justify-center text-xs py-2">
                      <Eye size={13}/> View Submissions
                    </button>
                  )}

                  {/* Student: submit */}
                  {user?.role === 'student' && (
                    overdue ? (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-red-400 font-semibold py-2">
                        <AlertCircle size={12}/> Submission closed
                      </div>
                    ) : (
                      <button onClick={() => setSubmitModal(a)}
                        className="btn-primary w-full justify-center text-xs py-2">
                        <Send size={13}/> Submit Answer
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {createModal && (
        <CreateModal
          schedules={schedules}
          onClose={() => setCreateModal(false)}
          onSave={() => { setCreateModal(false); qc.invalidateQueries(['assignments']) }}
        />
      )}
      {submitModal && (
        <SubmitModal
          assignment={submitModal}
          onClose={() => setSubmitModal(null)}
          onSave={() => { setSubmitModal(null); qc.invalidateQueries(['assignments']) }}
        />
      )}
      {submissionsFor && (
        <SubmissionsDrawer
          assignment={submissionsFor}
          onClose={() => setSubmissionsFor(null)}
        />
      )}
    </div>
  )
}
