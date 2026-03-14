import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'
import {
  Users, GraduationCap, CalendarDays, ClipboardList,
  Clock, BookOpen, AlertCircle, TrendingUp,
  FileCheck, School, BarChart3
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, color = 'blue', sub, trend }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red:    'bg-red-50 text-red-500',
    teal:   'bg-teal-50 text-teal-600',
  }
  return (
    <div className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-display font-bold text-slate-900 leading-none">{value ?? <span className="text-slate-300">—</span>}</p>
        <p className="text-sm font-semibold text-slate-500 mt-1">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// Attendance rate ring
function AttRing({ rate }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, parseFloat(rate) || 0))
  const offset = circ - (pct / 100) * circ
  const color = pct >= 90 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{transition:'stroke-dashoffset 1s ease'}}/>
      </svg>
      <div className="text-center -mt-16">
        <p className="text-2xl font-display font-bold" style={{color}}>{pct}%</p>
        <p className="text-xs text-slate-400 font-semibold mt-0.5">Rate</p>
      </div>
    </div>
  )
}

function AdminDashboard({ data }) {
  const { totals, attendanceToday, weeklyAtt, gradeBreakdown, strandBreakdown, recentLogs } = data

  const todayPresent = Number(attendanceToday?.find(r=>r.status==='present')?.count  || 0)
  const todayLate    = Number(attendanceToday?.find(r=>r.status==='late')?.count     || 0)
  const todayAbsent  = Number(attendanceToday?.find(r=>r.status==='absent')?.count   || 0)
  const todayTotal   = todayPresent + todayLate + todayAbsent

  const attChartData = [
    { name:'Present', value: todayPresent, fill:'#22c55e' },
    { name:'Late',    value: todayLate,    fill:'#f59e0b' },
    { name:'Absent',  value: todayAbsent,  fill:'#ef4444' },
  ]

  const strandColors = ['#3b82f6','#8b5cf6','#22c55e','#f59e0b','#ef4444']

  // Fill missing days in weekly chart
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const weekMap = {}
  ;(weeklyAtt||[]).forEach(d => { weekMap[d.day_label] = d })
  const weekData = dayLabels.map(d => ({
    day: d,
    attended: weekMap[d]?.attended || 0,
    total:    weekMap[d]?.total    || 0,
  }))

  return (
    <div className="space-y-6">
      {/* Row 1 — Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Active Students"    value={totals.total_students?.toLocaleString()}  color="blue" />
        <StatCard icon={Users}         label="Teachers"            value={totals.total_teachers?.toLocaleString()}  color="purple" />
        <StatCard icon={School}        label="Sections"            value={totals.total_sections?.toLocaleString()}  color="teal" />
        <StatCard icon={CalendarDays}  label="Active Classes"      value={totals.total_classes?.toLocaleString()}   color="green" />
      </div>

      {/* Row 2 — Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Total Scans (All)"   value={totals.total_scans?.toLocaleString()}     color="blue"   sub="All-time attendance records" />
        <StatCard icon={BookOpen}      label="Active Assignments"   value={totals.active_assignments?.toLocaleString()} color="amber" sub="Not yet due" />
        <StatCard icon={FileCheck}     label="Ungraded Submissions" value={totals.ungraded_submissions?.toLocaleString()} color="red" sub="Awaiting teacher review" />
        <StatCard icon={Clock}         label="Pending Schedules"    value={totals.pending_schedules?.toLocaleString()} color="amber" sub="Awaiting your approval" />
      </div>

      {/* Row 3 — Charts */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Attendance rate ring + today breakdown */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-slate-800 mb-1">Overall Attendance Rate</h3>
          <p className="text-xs text-slate-400 mb-4">Based on all recorded scans</p>
          <div className="flex items-center justify-around">
            <AttRing rate={totals.attendance_rate} />
            <div className="space-y-2 text-sm">
              {[
                { label:'Present', value: totals.present_count, color:'text-green-600', dot:'bg-green-500' },
                { label:'Late',    value: totals.late_count,    color:'text-amber-600', dot:'bg-amber-400' },
                { label:'Absent',  value: totals.absent_count,  color:'text-red-500',   dot:'bg-red-400' },
              ].map(({ label, value, color, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`}/>
                  <span className="text-slate-500 text-xs">{label}</span>
                  <span className={`font-bold text-xs ml-auto ${color}`}>{Number(value||0).toLocaleString()}</span>
                </div>
              ))}
              <div className="pt-1 border-t border-slate-100 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300 flex-shrink-0"/>
                <span className="text-slate-400 text-xs">Total</span>
                <span className="font-bold text-xs ml-auto text-slate-600">{Number(totals.total_scans||0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Today's summary */}
          {todayTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Today</p>
              <div className="flex gap-2">
                {attChartData.filter(d=>d.value>0).map(d=>(
                  <div key={d.name} className="flex-1 text-center py-2 rounded-lg" style={{background:d.fill+'18'}}>
                    <p className="text-base font-bold" style={{color:d.fill}}>{d.value}</p>
                    <p className="text-xs font-medium text-slate-500">{d.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {todayTotal === 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
              No attendance recorded today yet
            </div>
          )}
        </div>

        {/* Weekly attendance chart */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-slate-800 mb-1">Weekly Attendance</h3>
          <p className="text-xs text-slate-400 mb-4">Last 7 days — scans per day</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weekData} margin={{top:0,right:0,left:-24,bottom:0}}>
              <XAxis dataKey="day" tick={{fontSize:11,fontWeight:600}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip
                contentStyle={{fontSize:12,fontWeight:600,borderRadius:8,border:'1px solid #e2e8f0'}}
                formatter={(v,n)=>[v, n==='attended'?'Attended':'Total']}
              />
              <Bar dataKey="attended" fill="#3b82f6" radius={[4,4,0,0]} name="attended"/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Students by strand */}
        <div className="card p-5">
          <h3 className="font-display font-bold text-slate-800 mb-1">Students by Strand</h3>
          <p className="text-xs text-slate-400 mb-4">Active enrollment breakdown</p>
          {strandBreakdown?.length > 0 ? (
            <div className="space-y-2">
              {(strandBreakdown||[]).map((s,i) => {
                const total = strandBreakdown.reduce((a,b)=>a+Number(b.count),0)
                const pct = total > 0 ? Math.round(Number(s.count)/total*100) : 0
                return (
                  <div key={s.strand}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-700">{s.strand}</span>
                      <span className="text-xs font-bold" style={{color:strandColors[i%strandColors.length]}}>
                        {Number(s.count).toLocaleString()} <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{width:`${pct}%`, background:strandColors[i%strandColors.length]}}/>
                    </div>
                  </div>
                )
              })}
              {/* Grade breakdown */}
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                {(gradeBreakdown||[]).map(g=>(
                  <div key={g.grade_level} className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-primary">{Number(g.count).toLocaleString()}</p>
                    <p className="text-xs text-slate-500 font-medium">{g.grade_level}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-300">
              <BarChart3 size={28} className="mb-2"/>
              <p className="text-xs">No student data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity log */}
      <div className="card p-5">
        <h3 className="font-display font-bold text-slate-800 mb-4">Recent System Activity</h3>
        <div className="space-y-0 divide-y divide-slate-50">
          {(recentLogs||[]).map(log => (
            <div key={log.id} className="flex items-center gap-3 py-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                {log.first_name?.[0]}{log.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-700 text-sm">{log.first_name} {log.last_name}</span>
                <span className="text-slate-400 text-xs mx-1.5">·</span>
                <span className="text-xs text-slate-500">{log.action}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize
                  ${log.role==='admin'?'bg-purple-100 text-purple-700':log.role==='teacher'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700'}`}>
                  {log.role}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}
                </p>
              </div>
            </div>
          ))}
          {!recentLogs?.length && (
            <p className="text-sm text-slate-400 py-6 text-center">No activity logged yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TeacherDashboard({ data }) {
  const { myClasses, attStats, pendingGradesCount } = data
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays}  label="My Classes"    value={myClasses?.length}   color="blue" />
        <StatCard icon={ClipboardList} label="Present Today" value={attStats?.present||0} color="green" />
        <StatCard icon={Clock}         label="Late Today"    value={attStats?.late||0}    color="amber" />
        <StatCard icon={BookOpen}      label="To Grade"      value={pendingGradesCount}   color="purple" sub="Submissions pending" />
      </div>
      <div className="card p-5">
        <h3 className="font-display font-bold text-slate-800 mb-4">My Weekly Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Subject','Section','Day','Time','Room','Status'].map(h=>(
                  <th key={h} className="text-left pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(myClasses||[]).map(cls=>(
                <tr key={cls.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-4 font-semibold text-slate-800">{cls.subject}</td>
                  <td className="py-3 pr-4 text-slate-600">{cls.grade_level} · {cls.section_name}</td>
                  <td className="py-3 pr-4 text-slate-600">{cls.day_of_week}</td>
                  <td className="py-3 pr-4 text-slate-600 font-mono text-xs">{cls.start_time}–{cls.end_time}</td>
                  <td className="py-3 pr-4 text-slate-500">{cls.room}</td>
                  <td className="py-3"><span className="badge-green">Active</span></td>
                </tr>
              ))}
              {!myClasses?.length && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">No classes assigned yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StudentDashboard({ data }) {
  const { schedule, pendingAssignments, attSummary } = data
  const attRate = attSummary?.total > 0
    ? Math.round((Number(attSummary.present)+Number(attSummary.late))/attSummary.total*100) : 0
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Total Classes"  value={attSummary?.total||0}   color="blue" />
        <StatCard icon={ClipboardList} label="Present"        value={attSummary?.present||0}  color="green" />
        <StatCard icon={Clock}         label="Late"           value={attSummary?.late||0}     color="amber" />
        <StatCard icon={AlertCircle}   label="Absent"         value={attSummary?.absent||0}   color="red" sub={`${attRate}% attendance rate`} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-display font-bold text-slate-800 mb-4">My Class Schedule</h3>
          <div className="space-y-2">
            {(schedule||[]).map(s=>(
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-blue-50 transition-colors">
                <div className="w-2 h-10 rounded-full bg-primary flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{s.subject}</p>
                  <p className="text-xs text-slate-500">{s.first_name} {s.last_name} · {s.room}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary">{s.day_of_week}</p>
                  <p className="text-xs text-slate-400 font-mono">{s.start_time}–{s.end_time}</p>
                </div>
              </div>
            ))}
            {!schedule?.length && <p className="text-sm text-slate-400 py-4 text-center">No schedule found.</p>}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-display font-bold text-slate-800 mb-4">Pending Assignments</h3>
          <div className="space-y-2">
            {(pendingAssignments||[]).map(a=>(
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50">
                <BookOpen size={16} className="text-amber-600 mt-0.5 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.subject}</p>
                </div>
                <p className="text-xs font-bold text-amber-600 flex-shrink-0">
                  {new Date(a.due_date).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}
                </p>
              </div>
            ))}
            {!pendingAssignments?.length && (
              <div className="text-center py-6 text-slate-400 text-sm">
                <p className="text-2xl mb-1">🎉</p>No pending assignments!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => api.get('/dashboard').then(r => r.data.data),
    refetchInterval: 60000, // auto-refresh every 60s
  })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Welcome back, <span className="font-semibold text-slate-700">{user?.firstName}</span>!
          {' '}Here's what's happening today.
        </p>
      </div>
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/>
        </div>
      )}
      {error && (
        <div className="card p-8 text-center text-slate-500">
          <AlertCircle className="mx-auto mb-2 text-red-400" size={32}/>
          Failed to load dashboard. Please refresh.
        </div>
      )}
      {data && user?.role==='admin'   && <AdminDashboard   data={data}/>}
      {data && user?.role==='teacher' && <TeacherDashboard data={data}/>}
      {data && user?.role==='student' && <StudentDashboard data={data}/>}
    </div>
  )
}
