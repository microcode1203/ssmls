/* @v2-fixed-imports */
import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fullName, formalName, initials } from '../utils/nameUtils'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts'
import { DashboardSkeleton } from '../components/ui/Skeleton'
import {
  Users, GraduationCap, CalendarDays,
  Clock, BookOpen, AlertCircle,
  FileCheck, School, BarChart3, ChevronRight, Award,
  CheckCircle, XCircle, AlertTriangle, Activity,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ─── Live Clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="text-right">
      <p className="text-xl font-bold text-slate-800 tabular-nums tracking-tight">
        {now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">
        {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────
function KpiTile({ icon: Icon, label, value, sub, color = 'blue', onClick, trend }) {
  const palette = {
    blue:   { val: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100' },
    green:  { val: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-100' },
    amber:  { val: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100' },
    purple: { val: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
    red:    { val: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
    teal:   { val: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-100' },
    indigo: { val: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
  }
  const c = palette[color] || palette.blue
  return (
    <div
      onClick={onClick}
      className={`bg-white border ${c.border} rounded-xl p-4 flex items-center gap-3
        ${onClick ? 'cursor-pointer hover:shadow-sm active:scale-[0.99]' : ''} transition-all duration-150`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
        <Icon size={16} className={c.val} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xl font-bold leading-none tabular-nums ${c.val}`}>
          {value ?? <span className="text-slate-200">—</span>}
        </p>
        <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
      {trend != null && (
        <div className={`text-xs font-bold flex items-center gap-0.5 flex-shrink-0 ${trend >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  )
}

// ─── Attendance Ring ──────────────────────────────────────────────────────────
function AttRing({ rate, size = 80 }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 9
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, parseFloat(rate) || 0))
  const offset = circ - (pct / 100) * circ
  const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444'
  // Font size scales with ring size so it always fits
  const fontSize = size <= 60 ? 10 : size <= 80 ? 13 : 15
  const subSize = size <= 60 ? 7 : 9
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="7"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 1.2s ease' }}/>
      <text x={cx} y={cy - subSize / 2 - 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight="800" fill={color} fontFamily="inherit">
        {pct}%
      </text>
      <text x={cx} y={cy + fontSize / 2 + 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={subSize} fontWeight="600" fill="#94a3b8" fontFamily="inherit">
        Rate
      </text>
    </svg>
  )
}

// ─── Grade Badge ──────────────────────────────────────────────────────────────
function GradeBadge({ grade }) {
  const g = parseFloat(grade)
  if (isNaN(g)) return <span className="text-slate-300 text-sm">—</span>
  const cls =
    g >= 90 ? 'bg-emerald-100 text-emerald-700' :
    g >= 85 ? 'bg-green-100 text-green-700' :
    g >= 80 ? 'bg-blue-100 text-blue-700' :
    g >= 75 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-600'
  return <span className={`text-xs font-bold tabular-nums ${cls} px-2 py-0.5 rounded-md`}>{g.toFixed(0)}</span>
}

// ─── Card + Section Header helpers ───────────────────────────────────────────
const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick}
    className={`bg-white border border-slate-100 rounded-xl ${onClick ? 'cursor-pointer hover:shadow-sm' : ''} ${className}`}>
    {children}
  </div>
)

function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
          {action} <ChevronRight size={11} />
        </button>
      )}
    </div>
  )
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
      <p style={{ fontWeight: 700, color: '#334155', marginBottom: 3 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function AdminDashboard({ data }) {
  const navigate = useNavigate()
  const { totals, attendanceToday, weeklyAtt, gradeBreakdown, strandBreakdown,
    recentLogs, monthlyTrend, atRiskStudents, gradeDistribution, submissionStats } = data

  const todayPresent = Number(attendanceToday?.find(r => r.status === 'present')?.count || 0)
  const todayLate    = Number(attendanceToday?.find(r => r.status === 'late')?.count || 0)
  const todayAbsent  = Number(attendanceToday?.find(r => r.status === 'absent')?.count || 0)
  const todayTotal   = todayPresent + todayLate + todayAbsent

  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekMap = {};
  (weeklyAtt || []).forEach(d => { weekMap[d.day_label] = d })
  const weekData = dayOrder.map(d => ({ day: d, attended: Number(weekMap[d]?.attended || 0) }))

  const strandColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
  const strandTotal  = (strandBreakdown || []).reduce((a, b) => a + Number(b.count), 0)
  const GRADE_COLORS = { 'Outstanding': '#10b981', 'Very Satisfactory': '#3b82f6', 'Satisfactory': '#8b5cf6', 'Fairly Satisfactory': '#f59e0b', 'Did Not Meet': '#ef4444' }
  const trendData = (monthlyTrend || []).map(m => ({ month: m.month, rate: Number(m.rate || 0) }))

  return (
    <div className="space-y-4">
      {/* Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile icon={GraduationCap} label="Active Students" value={Number(totals.total_students || 0).toLocaleString()} color="blue"   onClick={() => navigate('/students')} />
        <KpiTile icon={Users}         label="Teachers"         value={Number(totals.total_teachers || 0).toLocaleString()} color="purple" onClick={() => navigate('/teachers')} />
        <KpiTile icon={School}        label="Sections"         value={Number(totals.total_sections || 0).toLocaleString()} color="teal"   onClick={() => navigate('/sections')} />
        <KpiTile icon={CalendarDays}  label="Active Classes"   value={Number(totals.total_classes || 0).toLocaleString()}  color="green"  onClick={() => navigate('/schedules')} />
      </div>
      {/* Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile icon={Clock}     label="Pending Approvals"  value={Number(totals.pending_schedules || 0)}     color="amber"  sub="Schedules to review"  onClick={() => navigate('/schedules')} />
        <KpiTile icon={FileCheck} label="Ungraded Work"       value={Number(totals.ungraded_submissions || 0)} color="red"    sub="Awaiting teacher"     onClick={() => navigate('/grades')} />
        <KpiTile icon={BookOpen}  label="Active Assignments"  value={Number(totals.active_assignments || 0)}   color="indigo" sub="Not yet due"           onClick={() => navigate('/assignments')} />
        <KpiTile icon={Activity}  label="Attendance Rate"     value={`${totals.attendance_rate || 0}%`}        color="green"  sub="All-time overall" />
      </div>

      {/* Row 3: Attendance + Weekly + Strand */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-slate-800">Attendance Overview</p>
              <p className="text-xs text-slate-400">All-time · active students</p>
            </div>
            <AttRing rate={totals.attendance_rate} size={60} />
          </div>
          <div className="space-y-2">
            {[
              { label: 'Present', value: totals.present_count, color: '#10b981' },
              { label: 'Late',    value: totals.late_count,    color: '#f59e0b' },
              { label: 'Absent',  value: totals.absent_count,  color: '#ef4444' },
            ].map(({ label, value, color }) => {
              const t = Number(totals.total_scans || 1)
              const pct = t > 0 ? Math.round(Number(value || 0) / t * 100) : 0
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-12 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color }}>{Number(value || 0).toLocaleString()}</span>
                </div>
              )
            })}
          </div>
          {todayTotal > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Today</p>
              <div className="flex gap-2">
                {[{ label: 'Present', val: todayPresent, color: '#10b981' }, { label: 'Late', val: todayLate, color: '#f59e0b' }, { label: 'Absent', val: todayAbsent, color: '#ef4444' }]
                  .filter(d => d.val > 0).map(d => (
                    <div key={d.label} className="flex-1 py-1.5 rounded-lg text-center" style={{ background: d.color + '18' }}>
                      <p className="text-sm font-bold" style={{ color: d.color }}>{d.val}</p>
                      <p className="text-[10px] font-medium text-slate-500">{d.label}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeader title="This Week's Attendance" sub="Students attended per day" />
          <ResponsiveContainer width="100%" height={148}>
            <BarChart data={weekData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="attended" name="Attended" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <SectionHeader title="Enrollment by Strand" sub="Active students breakdown" />
          {strandBreakdown?.length > 0 ? (
            <div className="space-y-2.5">
              {strandBreakdown.map((s, i) => {
                const pct = strandTotal > 0 ? Math.round(Number(s.count) / strandTotal * 100) : 0
                return (
                  <div key={s.strand}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-700">{s.strand}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: strandColors[i % strandColors.length] }}>
                        {Number(s.count)} <span className="text-slate-400 font-normal">· {pct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: strandColors[i % strandColors.length] }} />
                    </div>
                  </div>
                )
              })}
              {(gradeBreakdown || []).length > 0 && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                  {(gradeBreakdown || []).map(g => (
                    <div key={g.grade_level} className="flex-1 bg-primary/5 rounded-lg p-2 text-center border border-primary/10">
                      <p className="text-lg font-bold text-primary tabular-nums">{Number(g.count)}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{g.grade_level?.replace('Grade ', 'G')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-slate-300">
              <BarChart3 size={20} className="mb-1.5" /><p className="text-xs">No data yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Row 4: Trend + Grade Dist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <SectionHeader title="6-Month Attendance Trend" sub="Monthly attendance rate (%)" />
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={138}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="rate" name="Rate (%)" stroke="#3b82f6" fill="url(#attGrad)" strokeWidth={2} dot={{ fill: '#3b82f6', r: 2.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-36 text-slate-300 text-xs">No monthly data yet</div>}
        </Card>

        <Card className="p-4">
          <SectionHeader title="Grade Distribution" sub="Student performance breakdown" />
          {gradeDistribution?.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={gradeDistribution} cx="50%" cy="50%" innerRadius={28} outerRadius={50} dataKey="count" paddingAngle={3}>
                    {gradeDistribution.map((entry, i) => <Cell key={i} fill={GRADE_COLORS[entry.category] || '#e2e8f0'} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {gradeDistribution.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: GRADE_COLORS[entry.category] || '#e2e8f0' }} />
                    <span className="text-xs text-slate-600 flex-1 truncate">{entry.category}</span>
                    <span className="text-xs font-bold tabular-nums text-slate-700">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="flex items-center justify-center h-32 text-slate-300 text-xs">No grade data yet</div>}
        </Card>
      </div>

      {/* Row 5: At-Risk + Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <SectionHeader title="At-Risk Students" sub="Highest absence count" action="View all" onAction={() => navigate('/ranking')} />
          {atRiskStudents?.length > 0 ? (
            <div className="space-y-2">
              {atRiskStudents.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600 flex-shrink-0">
                    {initials(s.first_name, s.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{formalName(s.first_name, s.middle_name, s.last_name)}</p>
                    <p className="text-[11px] text-slate-400">{s.grade_level} · {s.section_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-500">{s.absences}</p>
                    <p className="text-[10px] text-slate-400">absences</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-20 text-slate-300">
              <CheckCircle size={20} className="mb-1 text-emerald-300" />
              <p className="text-xs font-semibold text-slate-400">No at-risk students</p>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeader title="Submission Rates" sub="Recent past-due assignments" action="View all" onAction={() => navigate('/assignments')} />
          {submissionStats?.length > 0 ? (
            <div className="space-y-2.5">
              {submissionStats.map((a, i) => {
                const pct = a.enrolled > 0 ? Math.round(a.submitted / a.enrolled * 100) : 0
                const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-700 truncate flex-1 mr-3">{a.title}</p>
                      <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color }}>{a.submitted}/{a.enrolled}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <div className="flex items-center justify-center h-20 text-slate-300 text-xs">No past-due assignments</div>}
        </Card>
      </div>

      {/* Row 6: Recent Activity */}
      <Card className="p-4">
        <SectionHeader title="Recent System Activity" action="View all" onAction={() => navigate('/audit-logs')} />
        <div className="divide-y divide-slate-50">
          {(recentLogs || []).slice(0, 6).map(log => {
            const roleColor = log.role === 'admin' ? 'bg-violet-100 text-violet-700' : log.role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
            return (
              <div key={log.id} className="flex items-center gap-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                  {initials(log.first_name, log.last_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{fullName(log.first_name, log.middle_name, log.last_name)}</p>
                  <p className="text-[11px] text-slate-400 truncate">{log.action}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleColor}`}>{log.role}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(log.timestamp).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
          {!recentLogs?.length && <p className="py-6 text-center text-xs text-slate-400">No activity yet.</p>}
        </div>
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TEACHER DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function TeacherDashboard({ data }) {
  const navigate = useNavigate()
  const { myClasses, attStats, pendingGradesCount, teacherWeeklyAtt, teacherSubmissions } = data

  const DAY_COLOR = {
    Monday: 'bg-blue-100 text-blue-700', Tuesday: 'bg-purple-100 text-purple-700',
    Wednesday: 'bg-emerald-100 text-emerald-700', Thursday: 'bg-amber-100 text-amber-700',
    Friday: 'bg-red-100 text-red-700', Saturday: 'bg-slate-100 text-slate-600',
  }

  const weekData = (teacherWeeklyAtt || []).map(d => ({ day: d.day, attended: Number(d.attended || 0) }))
  const todayRate = attStats?.total > 0
    ? Math.round((Number(attStats.present || 0) + Number(attStats.late || 0)) / Number(attStats.total) * 100) : 0

  const uniqueClasses = useMemo(() => {
    const seen = new Map()
    return (myClasses || []).filter(c => {
      const key = `${c.subject}_${c.section_id}`
      if (seen.has(key)) return false
      seen.set(key, true); return true
    })
  }, [myClasses])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile icon={CalendarDays} label="My Classes"     value={uniqueClasses.length}           color="blue" />
        <KpiTile icon={Users}        label="Today's Scans"  value={Number(attStats?.total || 0)}    color="green" sub={attStats?.total > 0 ? `${todayRate}% attended` : 'No class today'} />
        <KpiTile icon={FileCheck}    label="Ungraded"       value={Number(pendingGradesCount || 0)} color="red"   sub="Submissions pending" onClick={() => navigate('/assignments')} />
        <KpiTile icon={BookOpen}     label="Active Assigns" value={(myClasses?.length || 0)}        color="amber" sub="Across all classes" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4">
          <SectionHeader title="Today's Attendance" />
          {attStats?.total > 0 ? (
            <div className="flex items-center gap-4">
              <AttRing rate={todayRate} size={80} />
              <div className="flex-1 space-y-2">
                {[{ label: 'Present', val: attStats?.present, color: '#10b981' }, { label: 'Late', val: attStats?.late, color: '#f59e0b' }, { label: 'Absent', val: attStats?.absent, color: '#ef4444' }].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs text-slate-500 flex-1">{label}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color }}>{Number(val || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-slate-300">
              <CalendarDays size={24} className="mb-1.5 opacity-40" />
              <p className="text-xs text-slate-400 font-semibold">No attendance today</p>
              <button onClick={() => navigate('/attendance')} className="mt-2 text-xs text-primary font-semibold hover:underline">Start a session →</button>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeader title="This Week" sub="Attendance per day" />
          {weekData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={weekData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="attended" name="Attended" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-32 text-slate-300 text-xs">No data this week</div>}
        </Card>

        <Card className="p-4">
          <SectionHeader title="Submission Rates" sub="Recent assignments" />
          {teacherSubmissions?.length > 0 ? (
            <div className="space-y-2.5">
              {teacherSubmissions.map((a, i) => {
                const pct = a.enrolled > 0 ? Math.round(a.submitted / a.enrolled * 100) : 0
                const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-700 truncate flex-1 mr-2">{a.title}</p>
                      <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width .7s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <div className="flex items-center justify-center h-24 text-slate-300 text-xs">No completed assignments</div>}
        </Card>
      </div>

      <Card className="p-4">
        <SectionHeader title="My Classes" action="Manage" onAction={() => navigate('/schedules')} />
        {uniqueClasses.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {uniqueClasses.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${DAY_COLOR[s.day_of_week] || 'bg-slate-100 text-slate-500'}`}>
                  {s.day_of_week?.slice(0, 3)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{s.subject}</p>
                  <p className="text-[11px] text-slate-400">{s.grade_level} · {s.section_name}</p>
                </div>
                <p className="font-mono text-[11px] text-slate-500 flex-shrink-0">{s.start_time}–{s.end_time}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <CalendarDays size={24} className="mb-1.5 opacity-30" />
            <p className="text-sm font-semibold">No approved schedules</p>
            <p className="text-xs mt-0.5">Ask the admin to approve your schedule</p>
          </div>
        )}
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// STUDENT DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function StudentDashboard({ data }) {
  const navigate = useNavigate()
  const { schedule, pendingAssignments, attSummary, studentMonthlyAtt, studentGrades } = data

  const total   = Number(attSummary?.total   || 0)
  const present = Number(attSummary?.present || 0)
  const late    = Number(attSummary?.late    || 0)
  const absent  = Number(attSummary?.absent  || 0)
  const rate    = total > 0 ? Math.round((present + late) / total * 100) : 0

  const DAY_COLOR = {
    Monday: 'bg-blue-100 text-blue-700', Tuesday: 'bg-purple-100 text-purple-700',
    Wednesday: 'bg-emerald-100 text-emerald-700', Thursday: 'bg-amber-100 text-amber-700',
    Friday: 'bg-red-100 text-red-700', Saturday: 'bg-slate-100 text-slate-600',
  }

  const gradesBySubject = useMemo(() => {
    const map = {}
    ;(studentGrades || []).forEach(g => {
      if (!map[g.subject]) map[g.subject] = {}
      map[g.subject][g.quarter] = g
    })
    return Object.entries(map).map(([subject, quarters]) => {
      const vals = Object.values(quarters).map(q => parseFloat(q.final_grade)).filter(Boolean)
      const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null
      return { subject, quarters, avg }
    })
  }, [studentGrades])

  const overallGWA = useMemo(() => {
    const avgs = gradesBySubject.map(s => s.avg).filter(Boolean)
    return avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2) : null
  }, [gradesBySubject])

  const monthChartData = (studentMonthlyAtt || []).map(m => ({
    month: m.month, present: Number(m.present || 0), late: Number(m.late || 0), absent: Number(m.absent || 0),
  }))

  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile icon={Activity}    label="Attendance Rate" value={`${rate}%`} color={rate >= 90 ? 'green' : rate >= 75 ? 'amber' : 'red'} />
        <KpiTile icon={CheckCircle} label="Present"         value={present}    color="green" />
        <KpiTile icon={Clock}       label="Late"            value={late}       color="amber" />
        <KpiTile icon={XCircle}     label="Absent"          value={absent}     color="red" />
      </div>

      {overallGWA && (
        <div className={`bg-white border-2 rounded-xl p-4 flex items-center gap-4 ${parseFloat(overallGWA) >= 90 ? 'border-emerald-200' : parseFloat(overallGWA) >= 75 ? 'border-blue-200' : 'border-red-200'}`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${parseFloat(overallGWA) >= 90 ? 'bg-emerald-100' : parseFloat(overallGWA) >= 75 ? 'bg-blue-100' : 'bg-red-100'}`}>
            <Award size={18} className={parseFloat(overallGWA) >= 90 ? 'text-emerald-600' : parseFloat(overallGWA) >= 75 ? 'text-blue-600' : 'text-red-500'} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">General Weighted Average</p>
            <p className={`text-3xl font-bold leading-tight ${parseFloat(overallGWA) >= 90 ? 'text-emerald-700' : parseFloat(overallGWA) >= 75 ? 'text-blue-700' : 'text-red-600'}`}>{overallGWA}</p>
            <p className="text-xs text-slate-500">
              {parseFloat(overallGWA) >= 90 ? '🏆 Outstanding' : parseFloat(overallGWA) >= 85 ? '⭐ Very Satisfactory' : parseFloat(overallGWA) >= 80 ? '✅ Satisfactory' : parseFloat(overallGWA) >= 75 ? '📘 Fairly Satisfactory' : '⚠️ Needs improvement'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <SectionHeader title="My Attendance Summary" />
          <div className="flex items-center gap-4 mb-3">
            <AttRing rate={rate} size={80} />
            <div className="flex-1 space-y-2">
              {[
                { label: 'Present', val: present, color: '#10b981', pct: total > 0 ? Math.round(present / total * 100) : 0 },
                { label: 'Late',    val: late,    color: '#f59e0b', pct: total > 0 ? Math.round(late / total * 100) : 0 },
                { label: 'Absent',  val: absent,  color: '#ef4444', pct: total > 0 ? Math.round(absent / total * 100) : 0 },
              ].map(({ label, val, color, pct }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-xs text-slate-500 w-11">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width .7s' }} />
                  </div>
                  <span className="text-xs font-bold w-5 text-right tabular-nums" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          {monthChartData.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Monthly Trend</p>
              <ResponsiveContainer width="100%" height={95}>
                <BarChart data={monthChartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="present" name="Present" stackId="a" fill="#10b981" maxBarSize={22} />
                  <Bar dataKey="late"    name="Late"    stackId="a" fill="#f59e0b" maxBarSize={22} />
                  <Bar dataKey="absent"  name="Absent"  stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeader title="Pending Assignments" sub="Not yet submitted" action="View all" onAction={() => navigate('/assignments')} />
          {pendingAssignments?.length > 0 ? (
            <div className="space-y-2">
              {pendingAssignments.map(a => {
                const due = new Date(a.due_date)
                const h = (due - new Date()) / 3600000
                const color = h < 24 ? 'text-red-500' : h < 72 ? 'text-amber-500' : 'text-slate-400'
                const bg = h < 24 ? 'bg-red-50 border-red-100' : h < 72 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'
                return (
                  <div key={a.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${bg}`}>
                    <BookOpen size={13} className={`flex-shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{a.title}</p>
                      <p className="text-[11px] text-slate-500">{a.subject}</p>
                    </div>
                    <p className={`text-xs font-bold flex-shrink-0 ${color}`}>{formatDistanceToNow(due, { addSuffix: true })}</p>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-slate-300">
              <CheckCircle size={22} className="mb-1.5 text-emerald-300" />
              <p className="text-sm font-semibold text-slate-400">All caught up!</p>
              <p className="text-xs text-slate-400">No pending assignments</p>
            </div>
          )}
        </Card>
      </div>

      {gradesBySubject.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">My Grades</p>
            <button onClick={() => navigate('/grades')} className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">Full report <ChevronRight size={11} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Subject</th>
                  {QUARTERS.map(q => <th key={q} className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{q}</th>)}
                  <th className="text-center px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {gradesBySubject.map(({ subject, quarters, avg }) => (
                  <tr key={subject} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-semibold text-slate-800 text-xs">{subject}</td>
                    {QUARTERS.map(q => (
                      <td key={q} className="px-3 py-2.5 text-center">
                        {quarters[q] ? <GradeBadge grade={quarters[q].final_grade} /> : <span className="text-slate-200">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-center">{avg ? <GradeBadge grade={avg.toFixed(2)} /> : <span className="text-slate-200">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <SectionHeader title="My Class Schedule" action="View" onAction={() => navigate('/schedules')} />
        {schedule?.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-2">
            {schedule.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${DAY_COLOR[s.day_of_week] || 'bg-slate-100 text-slate-500'}`}>{s.day_of_week?.slice(0, 3)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{s.subject_name || s.subject}</p>
                  <p className="text-[11px] text-slate-400">{fullName(s.first_name, s.middle_name, s.last_name)} · {s.room}</p>
                </div>
                <p className="font-mono text-[11px] text-slate-500 flex-shrink-0">{s.start_time}–{s.end_time}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <CalendarDays size={24} className="mb-1.5 opacity-30" />
            <p className="text-sm font-semibold">No schedule assigned</p>
            <p className="text-xs mt-0.5">Contact your admin for section assignment</p>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => api.get('/dashboard').then(r => r.data.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Welcome back, <span className="font-semibold text-slate-700">{user?.firstName}</span>! Here's what's happening today.
          </p>
        </div>
        <LiveClock />
      </div>

      {isLoading && <DashboardSkeleton />}

      {error && !isLoading && (
        <div className="bg-white border border-red-100 rounded-xl p-8 text-center">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-400 opacity-60" />
          <p className="font-semibold text-sm text-slate-600">Failed to load dashboard</p>
          <p className="text-xs text-slate-400 mt-1">{error.message}</p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {user?.role === 'admin'   && <AdminDashboard   data={data} />}
          {user?.role === 'teacher' && <TeacherDashboard data={data} />}
          {user?.role === 'student' && <StudentDashboard data={data} />}
        </>
      )}
    </div>
  )
}
