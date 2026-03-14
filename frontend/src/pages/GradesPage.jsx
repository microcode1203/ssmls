import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { BarChart3, X } from 'lucide-react'

function GradeModal({ schedules, students, onClose, onSave }) {
  const [form, setForm] = useState({ studentId:'', scheduleId:'', quarter:'Q1', writtenWorks:'', performanceTasks:'', quarterlyAssessment:'' })
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  const computeGrade = () => {
    const ww = parseFloat(form.writtenWorks)||0
    const pt = parseFloat(form.performanceTasks)||0
    const qa = parseFloat(form.quarterlyAssessment)||0
    const fg = (ww*0.25 + pt*0.50 + qa*0.25).toFixed(2)
    setPreview({ finalGrade: fg, remarks: fg >= 75 ? 'Passed' : 'Failed' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await api.post('/grades', form); toast.success('Grade saved.'); onSave() }
    catch (err) { toast.error(err.response?.data?.message||'Failed.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">Enter Grade</h2>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[['studentId','Student',students?.map(s=>({value:s.id,label:`${s.first_name} ${s.last_name}`}))],
            ['scheduleId','Subject/Class',schedules?.map(s=>({value:s.id,label:`${s.subject} · ${s.grade_level} ${s.section_name}`}))],
            ['quarter','Quarter',[{value:'Q1',label:'1st Quarter'},{value:'Q2',label:'2nd Quarter'},{value:'Q3',label:'3rd Quarter'},{value:'Q4',label:'4th Quarter'}]]
          ].map(([name,label,opts])=>(
            <div key={name}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
              <select className="input-field" value={form[name]} onChange={e=>setForm(p=>({...p,[name]:e.target.value}))} required>
                <option value="">— Select —</option>
                {(opts||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            {[['writtenWorks','Written Works (25%)'],['performanceTasks','Performance Tasks (50%)'],['quarterlyAssessment','Quarterly Assessment (25%)']].map(([n,l])=>(
              <div key={n}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{l}</label>
                <input type="number" min="0" max="100" step="0.01" className="input-field text-center" value={form[n]} onChange={e=>{setForm(p=>({...p,[n]:e.target.value}));setPreview(null)}}/>
              </div>
            ))}
          </div>
          <button type="button" onClick={computeGrade} className="btn-secondary w-full justify-center">Preview Final Grade</button>
          {preview && (
            <div className={`p-4 rounded-xl text-center border ${preview.remarks==='Passed'?'bg-green-50 border-green-200':'bg-red-50 border-red-200'}`}>
              <p className="text-3xl font-display font-bold" style={{color:preview.remarks==='Passed'?'#16a34a':'#dc2626'}}>{preview.finalGrade}</p>
              <p className={`text-sm font-bold mt-1 ${preview.remarks==='Passed'?'text-green-700':'text-red-700'}`}>{preview.remarks}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Saving…':'Save Grade'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GradesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(user?.studentId||'')

  const { data: students } = useQuery({ queryKey:['students-list'], queryFn:()=>api.get('/students').then(r=>r.data.data), enabled:user?.role!=='student' })
  const { data: mySchedules } = useQuery({ queryKey:['my-schedules-t'], queryFn:()=>api.get(`/schedules/teacher/${user.teacherId}`).then(r=>r.data.data), enabled:!!user?.teacherId })

  const studentId = user?.role==='student' ? user.studentId : selectedStudent
  const { data: grades, isLoading } = useQuery({
    queryKey: ['grades', studentId],
    queryFn: () => api.get('/grades', { params: { studentId } }).then(r=>r.data.data),
    enabled: !!studentId
  })

  const quarters = ['Q1','Q2','Q3','Q4']
  const gradeColor = (g) => {
    if (!g) return 'text-slate-300'
    const n = parseFloat(g)
    if (n >= 90) return 'text-green-600'
    if (n >= 75) return 'text-blue-600'
    return 'text-red-500'
  }

  // Group grades by subject
  const bySubject = (grades||[]).reduce((acc, g) => {
    const k = g.subject_name; if (!acc[k]) acc[k] = {}; acc[k][g.quarter] = g; return acc
  }, {})

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Grades</h1>
          <p className="text-slate-500 text-sm mt-1">Academic performance records.</p>
        </div>
        {user?.role==='teacher' && <button onClick={()=>setModal(true)} className="btn-primary"><BarChart3 size={16}/>Enter Grade</button>}
      </div>

      {user?.role !== 'student' && (
        <div className="card p-4 mb-5">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">View Student</label>
          <select className="input-field max-w-xs" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>
            <option value="">— Select Student —</option>
            {(students||[]).map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.grade_level}</option>)}
          </select>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>}

      {!isLoading && studentId && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Grade Report</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Subject</th>
                  {quarters.map(q=><th key={q} className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{q}</th>)}
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(bySubject).map(([subject, qMap]) => {
                  const vals = quarters.map(q=>parseFloat(qMap[q]?.final_grade)||null).filter(Boolean)
                  const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : null
                  return (
                    <tr key={subject} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{subject}</td>
                      {quarters.map(q => {
                        const g = qMap[q]
                        return (
                          <td key={q} className="px-4 py-3 text-center">
                            {g ? (
                              <div>
                                <p className={`font-bold text-base ${gradeColor(g.final_grade)}`}>{g.final_grade}</p>
                                <span className={g.remarks==='Passed'?'badge-green':'badge-red'}>{g.remarks}</span>
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-center">
                        {avg ? <p className={`font-bold text-lg ${gradeColor(avg)}`}>{avg}</p> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
                {!Object.keys(bySubject).length && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No grades recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <GradeModal
          schedules={mySchedules}
          students={students}
          onClose={()=>setModal(false)}
          onSave={()=>{setModal(false);qc.invalidateQueries(['grades'])}}
        />
      )}
    </div>
  )
}
