import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Users, GraduationCap, CalendarDays, ClipboardList, Clock, BookOpen, AlertCircle } from 'lucide-react'

function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-slate-900">{value ?? '—'}</p>
        <p className="text-sm font-semibold text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function AdminDashboard({ data }) {
  const { totals, recentLogs, attendanceToday } = data

  const attChartData = [
    { name: 'Present', value: Number(attendanceToday?.find(r=>r.status==='present')?.count||0), fill: '#22c55e' },
    { name: 'Late',    value: Number(attendanceToday?.find(r=>r.status==='late')?.count||0),    fill: '#f59e0b' },
    { name: 'Absent',  value: Number(attendanceToday?.find(r=>r.status==='absent')?.count||0),  fill: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={GraduationCap} label="Total Students"   value={totals.students}        color="blue" />
        <StatCard icon={Users}          label="Teachers"          value={totals.teachers}         color="purple" />
        <StatCard icon={CalendarDays}   label="Active Classes"    value={totals.classes}          color="green" />
        <StatCard icon={ClipboardList}  label="Today's Scans"     value={totals.today_att}        color="amber" />
        <StatCard icon={Clock}          label="Pending Schedules" value={totals.pending}          color="amber" sub="Awaiting approval" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-1">
          <h3 className="font-display font-bold text-slate-800 mb-4">Today's Attendance</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={attChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, fontWeight: 600, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="value" radius={[6,6,0,0]}>
                {attChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-bold text-slate-800 mb-4">Recent Activity Log</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(recentLogs||[]).map(log => (
              <div key={log.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                  {log.first_name?.[0]}{log.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 truncate">{log.first_name} {log.last_name}</p>
                  <p className="text-xs text-slate-400">{log.action}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TeacherDashboard({ data }) {
  const { myClasses, attStats, pendingGradesCount } = data
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday']

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays}  label="My Classes"     value={myClasses?.length}              color="blue" />
        <StatCard icon={ClipboardList} label="Present Today"  value={attStats?.present||0}            color="green" />
        <StatCard icon={Clock}         label="Late Today"      value={attStats?.late||0}               color="amber" />
        <StatCard icon={BookOpen}      label="To Grade"        value={pendingGradesCount}              color="purple" sub="Submissions pending" />
      </div>

      <div className="card p-5">
        <h3 className="font-display font-bold text-slate-800 mb-4">My Weekly Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Subject','Section','Day','Time','Room','Status'].map(h => (
                  <th key={h} className="text-left pb-3 text-xs font-bold text-slate-400 uppercase tracking-wider pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(myClasses||[]).map(cls => (
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
    ? Math.round((Number(attSummary.present) + Number(attSummary.late)) / attSummary.total * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Total Classes"   value={attSummary?.total||0}   color="blue" />
        <StatCard icon={ClipboardList} label="Present"         value={attSummary?.present||0}  color="green" />
        <StatCard icon={Clock}         label="Late"            value={attSummary?.late||0}     color="amber" />
        <StatCard icon={AlertCircle}   label="Absent"          value={attSummary?.absent||0}   color="purple" sub={`${attRate}% rate`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-display font-bold text-slate-800 mb-4">My Class Schedule</h3>
          <div className="space-y-2">
            {(schedule||[]).map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-blue-50 transition-colors">
                <div className="w-2 h-10 rounded-full bg-primary flex-shrink-0" />
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
            {(pendingAssignments||[]).map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50">
                <BookOpen size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.subject}</p>
                </div>
                <p className="text-xs font-bold text-amber-600 flex-shrink-0">{new Date(a.due_date).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</p>
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
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="card p-8 text-center text-slate-500">
          <AlertCircle className="mx-auto mb-2 text-red-400" size={32}/>
          Failed to load dashboard. Please refresh.
        </div>
      )}
      {data && user?.role === 'admin'   && <AdminDashboard   data={data} />}
      {data && user?.role === 'teacher' && <TeacherDashboard data={data} />}
      {data && user?.role === 'student' && <StudentDashboard data={data} />}
    </div>
  )
}
