import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { GraduationCap, Printer, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const QUARTERS = ['Q1','Q2','Q3','Q4']
const gradeColor = g => {
  const n = parseFloat(g)
  if (!n) return 'text-slate-300'
  if (n>=90) return 'text-emerald-600'
  if (n>=85) return 'text-green-600'
  if (n>=80) return 'text-blue-600'
  if (n>=75) return 'text-amber-600'
  return 'text-red-600'
}

export default function ReportCardPage() {
  const { user } = useAuth()
  const [selectedStudent, setSelectedStudent] = useState(
    user?.role==='student' ? String(user.studentId||'') : ''
  )

  const { data: students } = useQuery({
    queryKey: ['students-list'], staleTime: 60000,
    queryFn: () => api.get('/students').then(r=>r.data.data),
    enabled: user?.role!=='student'
  })

  const { data: report, isLoading } = useQuery({
    queryKey: ['report-card', selectedStudent],
    queryFn: () => api.get(`/reports/report-card/${selectedStudent}`).then(r=>r.data.data),
    enabled: !!selectedStudent,
    staleTime: 0,
  })

  const handlePrint = () => window.print()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Report Card</h1>
          <p className="text-slate-500 text-sm mt-1">Academic performance summary (Form 138)</p>
        </div>
        {report && (
          <button onClick={handlePrint} className="btn-secondary no-print">
            <Printer size={15}/> Print
          </button>
        )}
      </div>

      {user?.role !== 'student' && (
        <div className="card p-4 mb-6 no-print">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Student</label>
          <select className="input-field max-w-sm" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>
            <option value="">— Select student —</option>
            {(students||[]).map(s=>(
              <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} — {s.grade_level} · {s.section_name}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>}

      {report && !isLoading && (
        <div className="card overflow-hidden print:shadow-none print:border-none" id="report-card">
          {/* Header */}
          <div className="p-6 text-center border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Republic of the Philippines · Department of Education</p>
            <h2 className="font-display text-2xl font-bold text-slate-900 mt-1">{report.schoolConfig?.school_name || 'Senior High School'}</h2>
            <p className="text-sm text-slate-500">{report.schoolConfig?.school_address}</p>
            <div className="mt-3 inline-block bg-primary/10 text-primary font-bold text-sm px-4 py-1 rounded-full">
              School Year {report.schoolConfig?.school_year} · {report.schoolConfig?.semester}
            </div>
          </div>

          {/* Student info */}
          <div className="p-5 border-b border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                ['Student Name', `${report.student.last_name}, ${report.student.first_name}${report.student.middle_name?' '+report.student.middle_name[0]+'.':''}`],
                ['LRN', report.student.lrn],
                ['Grade Level', report.student.grade_level],
                ['Section', `${report.student.section_name||'—'} (${report.student.strand})`],
              ].map(([label,value])=>(
                <div key={label}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{value||'—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Grades table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Subject</th>
                  {QUARTERS.map(q=><th key={q} className="text-center px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{q}</th>)}
                  <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Final</th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(report.subjects||[]).map(sub=>{
                  const vals = QUARTERS.map(q=>parseFloat(sub.quarters[q]?.final_grade)||null).filter(Boolean)
                  const final = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : null
                  return (
                    <tr key={sub.name} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-800">{sub.name}</td>
                      {QUARTERS.map(q=>(
                        <td key={q} className="px-3 py-3 text-center">
                          <span className={`font-bold ${gradeColor(sub.quarters[q]?.final_grade)}`}>
                            {sub.quarters[q]?.final_grade||'—'}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${gradeColor(final)}`}>{final||'—'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {final&&<span className={parseFloat(final)>=75?'badge-green':'badge-red'}>{parseFloat(final)>=75?'Passed':'Failed'}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="p-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className={`text-3xl font-display font-bold ${gradeColor(report.gwa)}`}>{report.gwa||'—'}</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">General Weighted Average</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-display font-bold text-slate-700">{report.attendance?.total||0}</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Total Classes</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-display font-bold text-emerald-600">{report.attendance?.present||0}</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Present</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-display font-bold text-red-500">{report.attendance?.absent||0}</p>
              <p className="text-xs text-slate-500 font-semibold mt-1">Absent</p>
            </div>
          </div>
        </div>
      )}

      {!selectedStudent && !isLoading && (
        <div className="card p-16 text-center text-slate-400">
          <GraduationCap size={36} className="mx-auto mb-3 opacity-20"/>
          <p>Select a student to generate their report card.</p>
        </div>
      )}

      <style>{`@media print{.no-print{display:none!important}body{font-size:12px}}`}</style>
    </div>
  )
}
