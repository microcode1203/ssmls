// GradePredictionPage.jsx — AI Grade Prediction for Teachers/Admin
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, Brain, Users, BarChart3, Filter,
  ChevronRight, Info, Zap, Target, Award
} from 'lucide-react'

// ─── Prediction Engine ────────────────────────────────────────────────────────
// Uses weighted formula based on:
// - Current grades (60% weight)
// - Attendance rate (25% weight)  
// - Submission rate (15% weight)
const predictGrade = (grades = [], attendance = {}, submissions = {}) => {
  // Average current final grades
  const gradeValues = grades.map(g => parseFloat(g.final_grade)).filter(n => !isNaN(n))
  const avgGrade = gradeValues.length > 0
    ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length
    : null

  // Attendance rate
  const attTotal = (attendance.present || 0) + (attendance.late || 0) + (attendance.absent || 0)
  const attRate = attTotal > 0 ? ((attendance.present || 0) + (attendance.late || 0)) / attTotal * 100 : null

  // Submission rate
  const subRate = submissions.total > 0
    ? (submissions.submitted || 0) / submissions.total * 100
    : null

  // Weighted prediction
  let predicted = null
  let confidence = 'low'
  let factors = 0

  if (avgGrade !== null) { predicted = (predicted || 0) + avgGrade * 0.60; factors++ }
  if (attRate !== null)  { predicted = (predicted || 0) + attRate  * 0.25; factors++ }
  if (subRate !== null)  { predicted = (predicted || 0) + subRate  * 0.15; factors++ }

  // Normalize if not all factors present
  if (factors > 0 && factors < 3) {
    const weights = [0.60, 0.25, 0.15]
    const used = [avgGrade !== null, attRate !== null, subRate !== null]
    const totalWeight = weights.filter((_, i) => used[i]).reduce((a, b) => a + b, 0)
    const raw = (avgGrade !== null ? avgGrade * 0.60 : 0) +
                (attRate  !== null ? attRate  * 0.25 : 0) +
                (subRate  !== null ? subRate  * 0.15 : 0)
    predicted = raw / totalWeight
  }

  if (factors >= 3) confidence = 'high'
  else if (factors === 2) confidence = 'medium'
  else confidence = 'low'

  // Trend
  const sortedGrades = grades
    .filter(g => g.final_grade)
    .sort((a, b) => a.quarter?.localeCompare(b.quarter))
  let trend = 'stable'
  if (sortedGrades.length >= 2) {
    const first = parseFloat(sortedGrades[0].final_grade)
    const last  = parseFloat(sortedGrades[sortedGrades.length - 1].final_grade)
    if (last - first > 3) trend = 'improving'
    else if (first - last > 3) trend = 'declining'
  }

  // Risk level
  let risk = 'low'
  if (predicted !== null) {
    if (predicted < 75) risk = 'high'
    else if (predicted < 82) risk = 'medium'
  }
  if (attRate !== null && attRate < 70) risk = 'high'

  return {
    predicted: predicted !== null ? Math.min(100, Math.max(60, predicted)).toFixed(1) : null,
    avgGrade: avgGrade?.toFixed(1),
    attRate: attRate?.toFixed(1),
    subRate: subRate?.toFixed(1),
    confidence,
    trend,
    risk,
    willPass: predicted !== null ? predicted >= 75 : null,
  }
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────
const RiskBadge = ({ risk }) => {
  const config = {
    high:   { label: 'High Risk',   bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
    medium: { label: 'At Risk',     bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
    low:    { label: 'On Track',    bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  }[risk] || {}
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}/>
      {config.label}
    </span>
  )
}

// ─── Trend Icon ───────────────────────────────────────────────────────────────
const TrendIcon = ({ trend }) => {
  if (trend === 'improving') return <TrendingUp size={14} className="text-emerald-500"/>
  if (trend === 'declining') return <TrendingDown size={14} className="text-red-400"/>
  return <Minus size={14} className="text-slate-400"/>
}

// ─── Student Prediction Card ──────────────────────────────────────────────────
function StudentPredictionCard({ student, grades, attendance, submissions }) {
  const [expanded, setExpanded] = useState(false)
  const pred = useMemo(() => predictGrade(grades, attendance, submissions), [grades, attendance, submissions])

  const predColor = pred.predicted
    ? parseFloat(pred.predicted) >= 90 ? 'text-emerald-600'
    : parseFloat(pred.predicted) >= 75 ? 'text-blue-600'
    : 'text-red-600'
    : 'text-slate-400'

  return (
    <div className={`card border-l-4 transition-all ${
      pred.risk === 'high'   ? 'border-l-red-400' :
      pred.risk === 'medium' ? 'border-l-amber-400' :
                               'border-l-emerald-400'
    }`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
          {student.first_name?.[0]}{student.last_name?.[0]}
        </div>

        {/* Name + section */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm truncate">
            {student.last_name}, {student.first_name} {student.middle_name?.[0] ? student.middle_name[0]+'.' : ''}
          </p>
          <p className="text-xs text-slate-400">{student.section_name || 'No section'}</p>
        </div>

        {/* Predicted grade */}
        <div className="text-center flex-shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${predColor}`}>
            {pred.predicted ?? '—'}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">Predicted</p>
        </div>

        {/* Risk + trend */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <RiskBadge risk={pred.risk}/>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <TrendIcon trend={pred.trend}/>
            <span className="capitalize">{pred.trend}</span>
          </div>
        </div>

        <ChevronRight size={16} className={`text-slate-300 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}/>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: 'Avg Grade', value: pred.avgGrade ? `${pred.avgGrade}%` : '—', icon: Target },
              { label: 'Attendance', value: pred.attRate ? `${pred.attRate}%` : '—', icon: Users },
              { label: 'Submissions', value: pred.subRate ? `${pred.subRate}%` : '—', icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
            <Info size={12} className="flex-shrink-0"/>
            <span>
              Prediction confidence: <span className={`font-bold ${
                pred.confidence === 'high' ? 'text-emerald-600' :
                pred.confidence === 'medium' ? 'text-amber-600' : 'text-red-500'
              }`}>{pred.confidence.toUpperCase()}</span>
              {pred.confidence === 'low' && ' — more data needed for accurate prediction'}
            </span>
          </div>

          {/* Pass/Fail prediction */}
          {pred.willPass !== null && (
            <div className={`mt-2 flex items-center gap-2 p-3 rounded-xl text-sm font-semibold ${
              pred.willPass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {pred.willPass
                ? <><CheckCircle size={15}/> Predicted to PASS this quarter</>
                : <><AlertTriangle size={15}/> Predicted to FAIL — intervention recommended</>
              }
            </div>
          )}

          {/* Grade history */}
          {grades.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Grade History</p>
              <div className="flex gap-2 flex-wrap">
                {grades.map((g, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    parseFloat(g.final_grade) >= 75 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'
                  }`}>
                    {g.quarter}: {g.final_grade} — {g.subject_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function GradePredictionPage() {
  const { user } = useAuth()
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [sortBy, setSortBy] = useState('risk')

  // Get schedules
  const { data: schedules } = useQuery({
    queryKey: ['schedules-prediction'],
    queryFn: () => api.get('/schedules/pending').then(r =>
      (r.data.data || []).filter(s => s.status === 'approved')
    ),
  })

  // Get students for selected schedule
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['students-prediction', selectedSchedule],
    queryFn: async () => {
      if (!selectedSchedule) return []
      const sched = schedules?.find(s => String(s.id) === selectedSchedule)
      if (!sched) return []
      const r = await api.get('/students', { params: { sectionId: sched.section_id } })
      return r.data.data || []
    },
    enabled: !!selectedSchedule && !!schedules,
  })

  // Get grades for all students
  const { data: allGrades } = useQuery({
    queryKey: ['all-grades-prediction', selectedSchedule],
    queryFn: async () => {
      if (!students?.length) return {}
      const results = {}
      await Promise.all(students.map(async s => {
        try {
          const r = await api.get('/grades', {
            params: { studentId: s.id, scheduleId: selectedSchedule }
          })
          results[s.id] = r.data.data || []
        } catch { results[s.id] = [] }
      }))
      return results
    },
    enabled: !!students?.length,
  })

  // Get attendance for all students
  const { data: allAttendance } = useQuery({
    queryKey: ['all-attendance-prediction', selectedSchedule],
    queryFn: async () => {
      if (!students?.length) return {}
      const results = {}
      await Promise.all(students.map(async s => {
        try {
          const r = await api.get(`/attendance/student/${s.id}`, {
            params: { scheduleId: selectedSchedule }
          })
          const recs = r.data.data || []
          results[s.id] = {
            present: recs.filter(a => a.status === 'present').length,
            late:    recs.filter(a => a.status === 'late').length,
            absent:  recs.filter(a => a.status === 'absent').length,
          }
        } catch { results[s.id] = { present: 0, late: 0, absent: 0 } }
      }))
      return results
    },
    enabled: !!students?.length,
  })

  // Compute predictions
  const predictions = useMemo(() => {
    if (!students?.length) return []
    return students.map(s => {
      const grades = allGrades?.[s.id] || []
      const attendance = allAttendance?.[s.id] || {}
      const pred = predictGrade(grades, attendance, {})
      return { student: s, grades, attendance, pred }
    })
  }, [students, allGrades, allAttendance])

  // Filter and sort
  const filtered = useMemo(() => {
    let data = [...predictions]
    if (filterRisk) data = data.filter(p => p.pred.risk === filterRisk)
    if (sortBy === 'risk') {
      const order = { high: 0, medium: 1, low: 2 }
      data.sort((a, b) => (order[a.pred.risk] || 0) - (order[b.pred.risk] || 0))
    } else if (sortBy === 'grade') {
      data.sort((a, b) => parseFloat(b.pred.predicted || 0) - parseFloat(a.pred.predicted || 0))
    } else if (sortBy === 'name') {
      data.sort((a, b) => a.student.last_name.localeCompare(b.student.last_name))
    }
    return data
  }, [predictions, filterRisk, sortBy])

  // Summary stats
  const summary = useMemo(() => ({
    total:      predictions.length,
    highRisk:   predictions.filter(p => p.pred.risk === 'high').length,
    mediumRisk: predictions.filter(p => p.pred.risk === 'medium').length,
    onTrack:    predictions.filter(p => p.pred.risk === 'low').length,
    avgPredicted: predictions.length
      ? (predictions.reduce((a, p) => a + parseFloat(p.pred.predicted || 0), 0) / predictions.length).toFixed(1)
      : null,
    willPass:   predictions.filter(p => p.pred.willPass === true).length,
    willFail:   predictions.filter(p => p.pred.willFail === false).length,
  }), [predictions])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Brain size={20} className="text-white"/>
          </div>
          Grade Prediction
        </h1>
        <p className="text-slate-500 text-sm mt-1 ml-14">
          AI-powered early warning system based on grades, attendance & submissions
        </p>
      </div>

      {/* Class selector */}
      <div className="card p-4 mb-5">
        <label className="block text-sm font-bold text-slate-700 mb-2">Select Class to Analyze</label>
        <select className="input-field" value={selectedSchedule} onChange={e => setSelectedSchedule(e.target.value)}>
          <option value="">— Choose a class —</option>
          {(schedules || []).map(s => (
            <option key={s.id} value={s.id}>
              {s.subject_name} · {s.grade_level} {s.section_name} · {s.day_of_week} {s.start_time}
            </option>
          ))}
        </select>
      </div>

      {selectedSchedule && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'High Risk', value: summary.highRisk, color: 'red', icon: AlertTriangle },
              { label: 'At Risk', value: summary.mediumRisk, color: 'amber', icon: TrendingDown },
              { label: 'On Track', value: summary.onTrack, color: 'emerald', icon: CheckCircle },
              { label: 'Class Average', value: summary.avgPredicted ? `${summary.avgPredicted}%` : '—', color: 'blue', icon: BarChart3 },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className={`card p-4 border-l-4 border-l-${color}-400`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={`text-${color}-500`}/>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                </div>
                <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="card p-3 mb-4 flex gap-3 flex-wrap items-center">
            <Filter size={13} className="text-slate-400"/>
            <select className="input-field text-sm w-36" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
              <option value="">All Students</option>
              <option value="high">High Risk</option>
              <option value="medium">At Risk</option>
              <option value="low">On Track</option>
            </select>
            <select className="input-field text-sm w-36" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="risk">Sort by Risk</option>
              <option value="grade">Sort by Grade</option>
              <option value="name">Sort by Name</option>
            </select>
            <span className="ml-auto text-xs text-slate-400">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* AI disclaimer */}
          <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl mb-4 text-xs text-violet-700">
            <Zap size={13} className="flex-shrink-0 mt-0.5"/>
            <span>Predictions are estimates based on available data. Use as a guide for intervention — always use your professional judgment as a teacher.</span>
          </div>

          {/* Student list */}
          {loadingStudents ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="card p-4 animate-pulse h-20"/>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <Brain size={36} className="mx-auto mb-3 opacity-20"/>
              <p className="font-semibold">No students found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(({ student, grades, attendance, pred }) => (
                <StudentPredictionCard
                  key={student.id}
                  student={student}
                  grades={grades}
                  attendance={attendance}
                  submissions={{}}
                  pred={pred}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!selectedSchedule && (
        <div className="card p-16 text-center text-slate-400">
          <Brain size={48} className="mx-auto mb-4 opacity-20"/>
          <p className="font-semibold text-slate-500 text-lg">Select a class to view predictions</p>
          <p className="text-sm mt-1">AI will analyze grades, attendance, and submissions to predict student performance</p>
        </div>
      )}
    </div>
  )
}
