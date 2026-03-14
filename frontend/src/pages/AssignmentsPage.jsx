import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, Clock, BookOpen, CheckCircle, Send } from 'lucide-react'
import { format, isPast } from 'date-fns'

function AssignmentModal({ schedules, onClose, onSave }) {
  const [form, setForm] = useState({ scheduleId:'', title:'', description:'', dueDate:'', maxScore:100, type:'homework' })
  const [saving, setSaving] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await api.post('/assignments', form); toast.success('Assignment created.'); onSave() }
    catch (err) { toast.error(err.response?.data?.message||'Failed.') }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">Create Assignment</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Class</label>
            <select className="input-field" value={form.scheduleId} onChange={e=>setForm(p=>({...p,scheduleId:e.target.value}))} required>
              <option value="">— Select Class —</option>
              {(schedules||[]).map(s=><option key={s.id} value={s.id}>{s.subject} · {s.grade_level} {s.section_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
            <input className="input-field" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} required/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea className="input-field h-24 resize-none" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Due Date</label>
              <input type="datetime-local" className="input-field" value={form.dueDate} onChange={e=>setForm(p=>({...p,dueDate:e.target.value}))} required/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Max Score</label>
              <input type="number" className="input-field" value={form.maxScore} onChange={e=>setForm(p=>({...p,maxScore:e.target.value}))}/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
            <select className="input-field" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
              {['homework','quiz','activity','project','exam'].map(t=><option key={t} className="capitalize">{t}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Saving…':'Create Assignment'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SubmitModal({ assignment, studentId, onClose, onSave }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await api.post('/assignments/submit', { assignmentId: assignment.id, textAnswer: text }); toast.success('Assignment submitted!'); onSave() }
    catch (err) { toast.error(err.response?.data?.message||'Failed.') }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">Submit: {assignment.title}</h2>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Answer</label>
            <textarea className="input-field h-36 resize-none" placeholder="Type your answer here…" value={text} onChange={e=>setText(e.target.value)} required/>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center"><Send size={15}/>{saving?'Submitting…':'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AssignmentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [submitModal, setSubmitModal] = useState(null)

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => api.get('/assignments').then(r=>r.data.data)
  })
  const { data: mySchedules } = useQuery({
    queryKey: ['my-schedules'],
    queryFn: () => user?.teacherId ? api.get(`/schedules/teacher/${user.teacherId}`).then(r=>r.data.data) : [],
    enabled: user?.role === 'teacher'
  })

  const typeBadge = { homework:'badge-blue', quiz:'badge-amber', activity:'badge-green', project:'badge-purple', exam:'badge-red' }
  const typeColor = { homework:'bg-blue-50', quiz:'bg-amber-50', activity:'bg-green-50', project:'bg-purple-50', exam:'bg-red-50' }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">{assignments?.length||0} assignments</p>
        </div>
        {user?.role==='teacher' && <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={16}/>Create Assignment</button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(assignments||[]).map(a => {
            const overdue = isPast(new Date(a.due_date))
            return (
              <div key={a.id} className={`card p-5 hover:shadow-md transition-shadow flex flex-col gap-3 ${overdue ? 'border-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColor[a.type]||'bg-slate-50'}`}>
                    <BookOpen size={16} className="text-slate-600"/>
                  </div>
                  <span className={typeBadge[a.type]||'badge-slate'}>{a.type}</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{a.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{a.subject_name}</p>
                  {a.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${overdue ? 'text-red-500' : 'text-slate-500'}`}>
                    <Clock size={12}/>
                    {overdue ? 'Overdue · ' : 'Due · '}
                    {format(new Date(a.due_date), 'MMM d, h:mm a')}
                  </div>
                  <span className="text-xs font-bold text-slate-400">{a.max_score} pts</span>
                </div>
                {user?.role==='student' && !overdue && (
                  <button onClick={()=>setSubmitModal(a)} className="btn-primary w-full justify-center text-xs py-2">
                    <Send size={13}/>Submit
                  </button>
                )}
              </div>
            )
          })}
          {!assignments?.length && (
            <div className="col-span-3 card p-16 text-center text-slate-400">
              <BookOpen size={36} className="mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">No assignments yet.</p>
            </div>
          )}
        </div>
      )}

      {modal && <AssignmentModal schedules={mySchedules} onClose={()=>setModal(false)} onSave={()=>{setModal(false);qc.invalidateQueries(['assignments'])}}/>}
      {submitModal && <SubmitModal assignment={submitModal} onClose={()=>setSubmitModal(null)} onSave={()=>{setSubmitModal(null);qc.invalidateQueries(['assignments'])}}/>}
    </div>
  )
}
