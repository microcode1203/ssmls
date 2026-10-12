// ParentPortalPage.jsx — Read-only parent access to student data
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  GraduationCap, BarChart3, ClipboardList, Bell,
  BookOpen, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, Calendar, Award, Clock
} from 'lucide-react'
import { format, isPast } from 'date-fns'

const gradeColor = (g) => {
  const n = parseFloat(g)
  if (n >= 90) return 'text-emerald-600'
  if (n >= 75) return 'text-blue-600'
  return 'text-red-500'
}

export default function ParentPortalPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('grades')

  // Parent sees their linked student
  const { data: studentData } = useQuery({
    queryKey: ['parent-student', user?.id],
    queryFn: () => api.get('/parent/student').then(r => r.data.data),
  })

  const { data: grades } = useQuery({
    queryKey: ['parent-grades', studentData?.id],
    queryFn: () => api.get('/grades', { params: { studentId: studentData?.id } }).then(r => r.data.data),
    enabled: !!studentData?.id,
  })

  const { data: attendance } = useQuery({
    queryKey: ['parent-attendance', studentData?.id],
    queryFn: () => api.get(`/attendance/student/${studentData?.id}`).then(r => r.data.data),
    enabled: !!studentData?.id,
  })

  const { data: assignments } = useQuery({
    queryKey: ['parent-assignments'],
    queryFn: () => api.get('/assignments').then(r => r.data.data),
    enabled: !!studentData,
  })

  const { data: notifications } = useQuery({
    queryKey: ['parent-notifs'],
    queryFn: () => api.get('/notifications').then(r => r.data.data),
  })

  const student = studentData
  const attTotal = (attendance || []).length
  const attPresent = (attendance || []).filter(a => a.status === 'present' || a.status === 'late').length
  const attRate = attTotal > 0 ? Math.round(attPresent / attTotal * 100) : 0
  const generalAvg = grades?.length
    ? (grades.reduce((a, g) => a + parseFloat(g.final_grade || 0), 0) / grades.length).toFixed(1)
    : null

  const TABS = [
    { id: 'grades', label: 'Grades', icon: BarChart3 },
    { id: 'attendance', label: 'Attendance', icon: ClipboardList },
    { id: 'assignments', label: 'Assignments', icon: BookOpen },
    { id: 'notifications', label: 'Alerts', icon: Bell },
  ]

  if (!student) return (
    <div className="p-8 text-center text-slate-400">
      <GraduationCap size={40} className="mx-auto mb-3 opacity-20"/>
      <p className="font-semibold">No student linked to this account</p>
      <p className="text-sm mt-1">Please contact the school administrator</p>
    </div>
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Student profile card */}
      <div className="card p-5 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary flex-shrink-0">
          {student.first_name?.[0]}{student.last_name?.[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">
            {student.first_name} {student.middle_name} {student.last_name}
          </h1>
          <p className="text-slate-500 text-sm">{student.grade_level} — {student.section_name} · {student.strand}</p>
          <p className="text-xs text-slate-400 mt-0.5">LRN: {student.lrn}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 flex-shrink-0">
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <p className={`text-2xl font-bold ${generalAvg ? gradeColor(generalAvg) : 'text-slate-400'}`}>
              {generalAvg ?? '—'}
            </p>
            <p className="text-xs text-slate-500 font-semibold">Gen. Avg</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-xl">
            <p className={`text-2xl font-bold ${attRate >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>
              {attRate}%
            </p>
            <p className="text-xs text-slate-500 font-semibold">Attendance</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              tab === id ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
            }`}>
            <Icon size={13}/>{label}
            {id === 'notifications' && (notifications || []).filter(n => !n.is_read).length > 0 && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {(notifications || []).filter(n => !n.is_read).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grades tab */}
      {tab === 'grades' && (
        <div className="space-y-3">
          {!grades?.length ? (
            <div className="card p-10 text-center text-slate-400">No grades recorded yet</div>
          ) : (
            grades.map((g, i) => (
              <div key={i} className="card p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">{g.subject_name}</p>
                  <p className="text-xs text-slate-400">{g.quarter}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  <div>
                    <p className="font-bold text-slate-700">{g.written_works ?? '—'}</p>
                    <p className="text-slate-400">Written</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">{g.performance_tasks ?? '—'}</p>
                    <p className="text-slate-400">Perf.</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">{g.quarterly_assessment ?? '—'}</p>
                    <p className="text-slate-400">Quarterly</p>
                  </div>
                </div>
                <div className="text-center min-w-[60px]">
                  <p className={`text-2xl font-bold ${gradeColor(g.final_grade)}`}>{g.final_grade ?? '—'}</p>
                  <p className={`text-xs font-bold ${parseFloat(g.final_grade) >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {g.remarks || '—'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Attendance tab */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Present', value: (attendance||[]).filter(a=>a.status==='present').length, color: 'emerald' },
              { label: 'Late', value: (attendance||[]).filter(a=>a.status==='late').length, color: 'amber' },
              { label: 'Absent', value: (attendance||[]).filter(a=>a.status==='absent').length, color: 'red' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`card p-4 text-center border-t-4 border-t-${color}-400`}>
                <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(attendance||[]).map((a, i) => (
              <div key={i} className="card p-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  a.status==='present'?'bg-emerald-500':a.status==='late'?'bg-amber-500':'bg-red-400'
                }`}/>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">{a.subject_name}</p>
                  <p className="text-xs text-slate-400">{a.class_date ? format(new Date(a.class_date), 'MMM d, yyyy') : '—'}</p>
                </div>
                <span className={`text-xs font-bold capitalize px-2 py-0.5 rounded-full ${
                  a.status==='present'?'bg-emerald-100 text-emerald-700':
                  a.status==='late'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assignments tab */}
      {tab === 'assignments' && (
        <div className="space-y-3">
          {!(assignments||[]).length ? (
            <div className="card p-10 text-center text-slate-400">No assignments yet</div>
          ) : (assignments||[]).map((a, i) => (
            <div key={i} className="card p-4 flex items-center gap-3">
              <div className="flex-1">
                <p className="font-bold text-slate-800 text-sm">{a.title}</p>
                <p className="text-xs text-slate-400">{a.subject_name}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold ${isPast(new Date(a.due_date)) ? 'text-red-500' : 'text-slate-500'}`}>
                  {isPast(new Date(a.due_date)) ? 'Overdue' : 'Due'}: {format(new Date(a.due_date), 'MMM d')}
                </p>
                <p className="text-xs text-slate-400">{a.max_score} pts</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="space-y-3">
          {!(notifications||[]).length ? (
            <div className="card p-10 text-center text-slate-400">No notifications</div>
          ) : (notifications||[]).map((n, i) => (
            <div key={i} className={`card p-4 flex gap-3 ${!n.is_read ? 'border-l-4 border-l-primary' : ''}`}>
              <AlertTriangle size={16} className={`flex-shrink-0 mt-0.5 ${n.type==='alert'?'text-red-500':'text-blue-500'}`}/>
              <div>
                <p className="font-bold text-slate-800 text-sm">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-slate-400 mt-1">{format(new Date(n.created_at), 'MMM d, yyyy h:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
