import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function ScheduleModal({ onClose, onSave, sections, subjects, teachers, userRole }) {
  const [form, setForm] = useState({ subjectId:'', sectionId:'', room:'', dayOfWeek:'Monday', startTime:'08:00', endTime:'09:00', teacherId:'' })
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setConflict(null)
    try {
      await api.post('/schedules', form)
      toast.success(userRole==='admin' ? 'Schedule created and approved.' : 'Schedule submitted for admin approval.')
      onSave()
    } catch (err) {
      if (err.response?.status === 409) setConflict(err.response.data)
      else toast.error(err.response?.data?.message || 'Failed to save schedule.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">Add Schedule</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {conflict && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
              <div>
                <p className="font-bold text-red-700 text-sm">{conflict.message}</p>
                {conflict.conflicts?.map((c,i) => (
                  <p key={i} className="text-xs text-red-500 mt-1">Existing: {c.day} {c.start}–{c.end}</p>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject <span className="text-red-500">*</span></label>
            <select className="input-field" value={form.subjectId} onChange={e=>setForm(p=>({...p,subjectId:e.target.value}))} required>
              <option value="">— Select Subject —</option>
              {(subjects||[]).map(s=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Section <span className="text-red-500">*</span></label>
            <select className="input-field" value={form.sectionId} onChange={e=>setForm(p=>({...p,sectionId:e.target.value}))} required>
              <option value="">— Select Section —</option>
              {(sections||[]).map(s=><option key={s.id} value={s.id}>{s.grade_level} · {s.section_name} ({s.strand})</option>)}
            </select>
          </div>
          {userRole==='admin' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teacher <span className="text-red-500">*</span></label>
              <select className="input-field" value={form.teacherId} onChange={e=>setForm(p=>({...p,teacherId:e.target.value}))} required>
                <option value="">— Select Teacher —</option>
                {(teachers||[]).map(t=><option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Room <span className="text-red-500">*</span></label>
            <input className="input-field" placeholder="e.g. Room 201" value={form.room} onChange={e=>setForm(p=>({...p,room:e.target.value}))} required/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Day <span className="text-red-500">*</span></label>
            <select className="input-field" value={form.dayOfWeek} onChange={e=>setForm(p=>({...p,dayOfWeek:e.target.value}))}>
              {DAYS.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Time</label>
              <input type="time" className="input-field" value={form.startTime} onChange={e=>setForm(p=>({...p,startTime:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">End Time</label>
              <input type="time" className="input-field" value={form.endTime} onChange={e=>setForm(p=>({...p,endTime:e.target.value}))}/>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Checking conflicts…' : 'Submit Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SchedulesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [view,  setView]  = useState('list') // list | grid

  const { data: sections } = useQuery({ queryKey:['sections'], queryFn:()=>api.get('/sections').then(r=>r.data.data) })
  const { data: subjects  } = useQuery({ queryKey:['subjects'], queryFn:()=>api.get('/schedules/section/0').then(()=>[]).catch(()=>[]) })
  const { data: teachers  } = useQuery({ queryKey:['teachers'], queryFn:()=>api.get('/teachers').then(r=>r.data.data), enabled: user?.role==='admin' })

  // Fetch schedules based on role
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules', user?.teacherId, user?.sectionId],
    queryFn: async () => {
      if (user?.role === 'teacher' && user?.teacherId) {
        return api.get(`/schedules/teacher/${user.teacherId}`).then(r=>r.data.data)
      }
      if (user?.role === 'student' && user?.sectionId) {
        return api.get(`/schedules/section/${user.sectionId}`).then(r=>r.data.data)
      }
      if (user?.role === 'admin') {
        return api.get(`/schedules/pending`).then(r=>r.data.data)
      }
      return []
    }
  })

  const approveMut = async (id, action) => {
    try {
      await api.patch(`/schedules/${id}/approve`, { action })
      toast.success(`Schedule ${action}.`)
      qc.invalidateQueries(['schedules'])
    } catch { toast.error('Failed.') }
  }

  const deleteMut = async (id) => {
    if (!confirm('Delete this schedule?')) return
    try { await api.delete(`/schedules/${id}`); toast.success('Deleted.'); qc.invalidateQueries(['schedules']) }
    catch { toast.error('Failed to delete.') }
  }

  const statusBadge = { approved:'badge-green', pending:'badge-amber', rejected:'badge-red' }
  const dayColor = { Monday:'bg-blue-100 text-blue-700', Tuesday:'bg-purple-100 text-purple-700', Wednesday:'bg-green-100 text-green-700', Thursday:'bg-amber-100 text-amber-700', Friday:'bg-red-100 text-red-700', Saturday:'bg-slate-100 text-slate-600' }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Schedules</h1>
          <p className="text-slate-500 text-sm mt-1">
            {user?.role==='admin' ? 'Review and approve submitted schedules.' : user?.role==='teacher' ? 'Your assigned class schedules.' : 'Your class schedule for this semester.'}
          </p>
        </div>
        {(user?.role==='teacher'||user?.role==='admin') && (
          <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={16}/>Add Schedule</button>
        )}
      </div>

      {/* Weekly Grid View for students/teachers */}
      {user?.role !== 'admin' && (
        <div className="card mb-6 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">Weekly View</span>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-6 min-w-[700px]">
              {DAYS.slice(0,5).map(day => (
                <div key={day}>
                  <div className="px-3 py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50">{day.slice(0,3)}</div>
                  <div className="p-2 space-y-2 min-h-32">
                    {(schedules||[]).filter(s=>s.day_of_week===day).map(s=>(
                      <div key={s.id} className="rounded-lg p-2 bg-primary/8 border border-primary/20 text-xs">
                        <p className="font-bold text-primary truncate">{s.subject_name||s.subject}</p>
                        <p className="text-slate-500 mt-0.5">{s.room}</p>
                        <p className="font-mono text-slate-400 mt-0.5">{s.start_time}–{s.end_time}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-700">{user?.role==='admin' ? 'Pending Approval' : 'All Schedules'}</span>
        </div>
        {isLoading ? (
          <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"/></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Subject','Section','Day & Time','Room','Teacher','Status','Actions'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(schedules||[]).map(s=>(
                  <tr key={s.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.subject_name||s.subject}</td>
                    <td className="px-4 py-3 text-slate-600">{s.grade_level} · {s.section_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${dayColor[s.day_of_week]||'badge-slate'}`}>{s.day_of_week}</span>
                      <span className="font-mono text-xs text-slate-500">{s.start_time}–{s.end_time}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.room}</td>
                    <td className="px-4 py-3 text-slate-600">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3"><span className={statusBadge[s.status]||'badge-slate'}>{s.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {user?.role==='admin' && s.status==='pending' && (
                          <>
                            <button onClick={()=>approveMut(s.id,'approved')} className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg"><CheckCircle size={14}/></button>
                            <button onClick={()=>approveMut(s.id,'rejected')} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"><X size={14}/></button>
                          </>
                        )}
                        {(user?.role==='admin'||user?.role==='teacher') && (
                          <button onClick={()=>deleteMut(s.id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg text-xs font-bold">Del</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!schedules?.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No schedules found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ScheduleModal
          userRole={user?.role}
          sections={sections}
          subjects={[
            {id:1,name:'General Mathematics',code:'MATH11'},
            {id:2,name:'Earth and Life Science',code:'SCI11'},
            {id:3,name:'Oral Communication',code:'ENG11'},
            {id:4,name:'Statistics and Probability',code:'STAT12'},
            {id:5,name:'Pre-Calculus',code:'STEM11'},
          ]}
          teachers={teachers}
          onClose={()=>setModal(false)}
          onSave={()=>{ setModal(false); qc.invalidateQueries(['schedules']) }}
        />
      )}
    </div>
  )
}
