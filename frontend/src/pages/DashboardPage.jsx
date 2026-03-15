import React from 'react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fullName, formalName, initials } from '../utils/nameUtils'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import { DashboardSkeleton } from '../components/ui/Skeleton'
import {
  Users, GraduationCap, CalendarDays, ClipboardList,
  Clock, BookOpen, AlertCircle, TrendingUp,
  FileCheck, School, BarChart3, ChevronRight
} from 'lucide-react'

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const palette = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   val: 'text-blue-700' },
    green:  { bg: 'bg-emerald-50',text: 'text-emerald-600',val: 'text-emerald-700' },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  val: 'text-amber-700' },
    purple: { bg: 'bg-violet-50', text: 'text-violet-600', val: 'text-violet-700' },
    red:    { bg: 'bg-red-50',    text: 'text-red-500',    val: 'text-red-600' },
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   val: 'text-teal-700' },
  }
  const c = palette[color] || palette.blue
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
          <Icon size={18} className={c.text}/>
        </div>
        <p className="text-xs sm:text-sm font-semibold text-slate-500 leading-tight">{label}</p>
      </div>
      <p className={`text-2xl sm:text-3xl font-bold tracking-tight leading-none ${c.val}`}>
        {value ?? <span className="text-slate-200">—</span>}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-1.5 leading-snug">{sub}</p>}
    </div>
  )
}

// ─── Attendance Ring ──────────────────────────────────────────────────────────
function AttRing({ rate }) {
  const r      = 44
  const circ   = 2 * Math.PI * r
  const pct    = Math.min(100, Math.max(0, parseFloat(rate) || 0))
  const offset = circ - (pct / 100) * circ
  const color  = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative flex items-center justify-center" style={{width:100,height:100}}>
      <svg width="100" height="100" className="-rotate-90" style={{position:'absolute'}}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="9"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{transition:'stroke-dashoffset 1.2s ease'}}/>
      </svg>
      <div className="text-center z-10">
        <p className="text-xl font-bold leading-none" style={{color}}>{pct}%</p>
        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Rate</p>
      </div>
    </div>
  )
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ data }) {
  const { totals, attendanceToday, weeklyAtt, gradeBreakdown, strandBreakdown, recentLogs } = data

  const todayPresent = Number(attendanceToday?.find(r=>r.status==='present')?.count || 0)
  const todayLate    = Number(attendanceToday?.find(r=>r.status==='late')?.count    || 0)
  const todayAbsent  = Number(attendanceToday?.find(r=>r.status==='absent')?.count  || 0)
  const todayTotal   = todayPresent + todayLate + todayAbsent

  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weekMap   = {}
  ;(weeklyAtt||[]).forEach(d => { weekMap[d.day_label] = d })
  const weekData = dayLabels.map(d => ({
    day:      d,
    attended: weekMap[d]?.attended || 0,
    total:    weekMap[d]?.total    || 0,
  }))

  const strandColors = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444']
  const strandTotal  = (strandBreakdown||[]).reduce((a,b) => a+Number(b.count), 0)

  return (
    <div className="space-y-5">

      {/* ── Primary stats — 2 col mobile, 4 col desktop ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={GraduationCap} label="Active Students" value={totals.total_students?.toLocaleString()} color="blue"/>
        <StatCard icon={Users}         label="Teachers"         value={totals.total_teachers?.toLocaleString()} color="purple"/>
        <StatCard icon={School}        label="Sections"         value={totals.total_sections?.toLocaleString()} color="teal"/>
        <StatCard icon={CalendarDays}  label="Active Classes"   value={totals.total_classes?.toLocaleString()}  color="green"/>
      </div>

      {/* ── Secondary stats — 2 col mobile, 4 col desktop ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={ClipboardList} label="Total Scans"          value={totals.total_scans?.toLocaleString()} color="blue"  sub="All-time records"/>
        <StatCard icon={BookOpen}      label="Active Assignments"    value={totals.active_assignments?.toLocaleString()} color="amber" sub="Not yet due"/>
        <StatCard icon={FileCheck}     label="Ungraded"              value={totals.ungraded_submissions?.toLocaleString()} color="red" sub="Awaiting review"/>
        <StatCard icon={Clock}         label="Pending Schedules"     value={totals.pending_schedules?.toLocaleString()} color="amber" sub="Need approval"/>
      </div>

      {/* ── Charts row — stack on mobile, 3-col on desktop ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Attendance rate */}
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Overall Attendance Rate</p>
          <p className="text-xs text-slate-400 mb-4">Based on all recorded scans</p>
          <div className="flex items-center gap-6">
            <AttRing rate={totals.attendance_rate}/>
            <div className="flex-1 space-y-2">
              {[
                { label:'Present', value: totals.present_count, color:'text-emerald-600', dot:'bg-emerald-500' },
                { label:'Late',    value: totals.late_count,    color:'text-amber-500',   dot:'bg-amber-400' },
                { label:'Absent',  value: totals.absent_count,  color:'text-red-500',     dot:'bg-red-400' },
                { label:'Total',   value: totals.total_scans,   color:'text-slate-500',   dot:'bg-slate-300' },
              ].map(({ label, value, color, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`}/>
                  <span className="text-xs text-slate-500 flex-1">{label}</span>
                  <span className={`text-xs font-bold tabular-nums ${color}`}>
                    {Number(value||0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Today bar */}
          {todayTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Today</p>
              <div className="flex gap-2">
                {[
                  { label:'Present', val:todayPresent, color:'#10b981' },
                  { label:'Late',    val:todayLate,    color:'#f59e0b' },
                  { label:'Absent',  val:todayAbsent,  color:'#ef4444' },
                ].filter(d=>d.val>0).map(d=>(
                  <div key={d.label} className="flex-1 py-2 rounded-lg text-center" style={{background:d.color+'15'}}>
                    <p className="text-base font-bold" style={{color:d.color}}>{d.val}</p>
                    <p className="text-[10px] font-semibold text-slate-500">{d.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {todayTotal === 0 && (
            <p className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-300 text-center">No attendance today yet</p>
          )}
        </div>

        {/* Weekly chart */}
        <div className="card p-5">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Weekly Attendance</p>
          <p className="text-xs text-slate-400 mb-3">Last 7 days</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={weekData} margin={{top:4,right:0,left:-28,bottom:0}}>
              <XAxis dataKey="day" tick={{fontSize:10,fontWeight:600}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip
                contentStyle={{fontSize:11,fontWeight:600,borderRadius:8,border:'1px solid #e2e8f0',padding:'6px 10px'}}
                formatter={(v,n) => [v, n==='attended'?'Attended':'Total']}
                cursor={{fill:'#f8fafc'}}
              />
              <Bar dataKey="attended" fill="#3b82f6" radius={[5,5,0,0]} maxBarSize={32}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Students by strand */}
        <div className="card p-5 md:col-span-2 lg:col-span-1">
          <p className="text-sm font-bold text-slate-800 mb-0.5">Students by Strand</p>
          <p className="text-xs text-slate-400 mb-4">Active enrollment breakdown</p>
          {strandBreakdown?.length > 0 ? (
            <div className="space-y-3">
              {(strandBreakdown||[]).map((s,i) => {
                const pct = strandTotal > 0 ? Math.round(Number(s.count)/strandTotal*100) : 0
                return (
                  <div key={s.strand}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-700">{s.strand}</span>
                      <span className="text-xs font-bold tabular-nums" style={{color:strandColors[i%strandColors.length]}}>
                        {Number(s.count)} <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{width:`${pct}%`,background:strandColors[i%strandColors.length]}}/>
                    </div>
                  </div>
                )
              })}
              {/* Grade pills */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                {(gradeBreakdown||[]).map(g => (
                  <div key={g.grade_level} className="flex-1 bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                    <p className="text-lg font-bold text-primary tabular-nums">{Number(g.count)}</p>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">{g.grade_level}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-28 text-slate-300">
              <BarChart3 size={24} className="mb-2"/>
              <p className="text-xs">No student data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="card p-5">
        <p className="text-sm font-bold text-slate-800 mb-4">Recent System Activity</p>
        <div className="divide-y divide-slate-50">
          {(recentLogs||[]).slice(0,6).map(log => (
            <div key={log.id} className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                {initials(log.first_name, log.last_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {fullName(log.first_name, log.middle_name, log.last_name)}
                  <span className="ml-2 text-xs font-normal text-slate-400">{log.action}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(log.timestamp).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                log.role==='admin'?'bg-violet-100 text-violet-700':
                log.role==='teacher'?'bg-blue-100 text-blue-700':
                'bg-emerald-100 text-emerald-700'}`}>
                {log.role}
              </span>
            </div>
          ))}
          {!recentLogs?.length && (
            <p className="py-8 text-center text-xs text-slate-400">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Teacher Dashboard ────────────────────────────────────────────────────────
function TeacherDashboard({ data }) {
  const { myClasses, todayAttendance, pendingGrades } = data
  const DAY_COLOR = {
    Monday:'bg-blue-100 text-blue-700', Tuesday:'bg-purple-100 text-purple-700',
    Wednesday:'bg-emerald-100 text-emerald-700', Thursday:'bg-amber-100 text-amber-700',
    Friday:'bg-red-100 text-red-700', Saturday:'bg-slate-100 text-slate-600',
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={CalendarDays}  label="My Classes"        value={myClasses?.length ?? 0}       color="blue"/>
        <StatCard icon={ClipboardList} label="Today's Scans"     value={todayAttendance?.total ?? 0}  color="green"/>
        <StatCard icon={FileCheck}     label="Pending Grades"    value={pendingGrades?.count ?? 0}    color="amber" />
      </div>
      <div className="card p-5">
        <p className="text-sm font-bold text-slate-800 mb-4">My Schedule</p>
        {myClasses?.length ? (
          <div className="space-y-2">
            {myClasses.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${DAY_COLOR[s.day_of_week]||'bg-slate-100 text-slate-500'}`}>
                  {s.day_of_week?.slice(0,3)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.subject}</p>
                  <p className="text-xs text-slate-400">{s.grade_level} · {s.section_name} · {s.room}</p>
                </div>
                <p className="font-mono text-xs text-slate-500 flex-shrink-0">{s.start_time}–{s.end_time}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400 py-8">No approved schedules yet.</p>
        )}
      </div>
    </div>
  )
}

// ─── Student Dashboard ────────────────────────────────────────────────────────
function StudentDashboard({ data }) {
  const { schedule, pendingAssignments, attSummary } = data
  const rate = attSummary?.total > 0
    ? Math.round(((Number(attSummary.present)+Number(attSummary.late))/Number(attSummary.total))*100)
    : 0
  const DAY_COLOR = {
    Monday:'bg-blue-100 text-blue-700', Tuesday:'bg-purple-100 text-purple-700',
    Wednesday:'bg-emerald-100 text-emerald-700', Thursday:'bg-amber-100 text-amber-700',
    Friday:'bg-red-100 text-red-700', Saturday:'bg-slate-100 text-slate-600',
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={ClipboardList} label="Total Classes"     value={attSummary?.total      ?? 0} color="blue"/>
        <StatCard icon={TrendingUp}    label="Present"           value={attSummary?.present    ?? 0} color="green"/>
        <StatCard icon={AlertCircle}   label="Late"              value={attSummary?.late        ?? 0} color="amber"/>
        <StatCard icon={BarChart3}     label="Attendance Rate"   value={`${rate}%`}                  color="purple"/>
      </div>
      <div className="card p-5">
        <p className="text-sm font-bold text-slate-800 mb-4">My Class Schedule</p>
        {schedule?.length ? (
          <div className="space-y-2">
            {schedule.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${DAY_COLOR[s.day_of_week]||'bg-slate-100 text-slate-500'}`}>
                  {s.day_of_week?.slice(0,3)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.subject_name||s.subject}</p>
                  <p className="text-xs text-slate-400">{s.room}</p>
                </div>
                <p className="font-mono text-xs text-slate-500 flex-shrink-0">{s.start_time}–{s.end_time}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400 py-8">No classes assigned yet.</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <p className="text-xl font-bold font-mono text-slate-800 tabular-nums">
      {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </p>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey:  ['dashboard', user?.id],
    queryFn:   () => api.get('/dashboard').then(r => r.data.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5 sm:mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Welcome back, <span className="font-semibold text-slate-700">{user?.firstName}</span>!
            {' '}Here's what's happening today.
          </p>
        </div>
        <div className="text-right">
          <LiveClock/>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
      </div>

      {isLoading && <DashboardSkeleton/>}

      {error && !isLoading && (
        <div className="card p-8 text-center text-slate-400">
          <AlertCircle size={28} className="mx-auto mb-2 text-red-400 opacity-60"/>
          <p className="font-semibold text-sm">Failed to load dashboard</p>
          <p className="text-xs mt-1">{error.message}</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {user?.role === 'admin'   && <AdminDashboard   data={data}/>}
          {user?.role === 'teacher' && <TeacherDashboard data={data}/>}
          {user?.role === 'student' && <StudentDashboard data={data}/>}
        </>
      )}
    </div>
  )
}
