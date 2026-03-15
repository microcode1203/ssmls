/* @v2-fixed-imports */
import { fullName, formalName, initials } from '../utils/nameUtils'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  QrCode, RefreshCw, StopCircle, Users,
  CheckCircle, Clock, XCircle, BookOpen
} from 'lucide-react'

const dedupeSchedules = (schedules) => {
  const seen = new Map()
  return (schedules || [])
    .filter(s => !('status' in s) || s.status === 'approved')
    .reduce((acc, s) => {
      const key = String(s.subject_id || s.subject || s.subject_name || '') + '_' + String(s.section_id || '')
      if (!seen.has(key)) { seen.set(key, true); acc.push(s) }
      return acc
    }, [])
    .sort((a, b) => {
      const na = a.subject || a.subject_name || ''
      const nb = b.subject || b.subject_name || ''
      return na.localeCompare(nb) || (a.grade_level || '').localeCompare(b.grade_level || '')
    })
}

function QRGenerator() {
  const [schedules,  setSchedules]  = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [qrData,     setQrData]     = useState(null)
  const [countdown,  setCountdown]  = useState(60)
  const [attLog,     setAttLog]     = useState([])
  const [loadingSch, setLoadingSch] = useState(true)

  const classIdRef    = useRef(null)
  const selectedIdRef = useRef('')
  const intervalRef   = useRef(null)
  const pollRef       = useRef(null)
  const countRef      = useRef(60)

  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  useEffect(() => {
    api.get('/dashboard')
      .then(res => { setSchedules(res.data.data?.myClasses || []); setLoadingSch(false) })
      .catch(() => setLoadingSch(false))
  }, [])

  const startPolling = useCallback((classId) => {
    classIdRef.current = classId
    if (pollRef.current) clearInterval(pollRef.current)
    api.get(`/attendance/class/${classId}`)
      .then(res => setAttLog(res.data.data?.records || []))
      .catch(() => {})
    pollRef.current = setInterval(async () => {
      if (!classIdRef.current) return
      try {
        const res = await api.get(`/attendance/class/${classIdRef.current}`)
        setAttLog(res.data.data?.records || [])
      } catch {}
    }, 4000)
  }, [])

  const stopTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollRef.current)     clearInterval(pollRef.current)
    intervalRef.current = null
    pollRef.current     = null
  }, [])

  const doGenerateQR = useCallback(async (schedId) => {
    try {
      const res = await api.post('/attendance/generate-qr', { scheduleId: schedId })
      const data = res.data.data
      setQrData(data)
      classIdRef.current = data.classId
      return data
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate QR.')
      return null
    }
  }, [])

  const startCountdown = useCallback((classId) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    countRef.current = 60
    setCountdown(60)
    intervalRef.current = setInterval(async () => {
      countRef.current -= 1
      setCountdown(countRef.current)
      if (countRef.current <= 0) {
        const data = await doGenerateQR(selectedIdRef.current)
        if (data) classIdRef.current = data.classId
        countRef.current = 60
        setCountdown(60)
      }
    }, 1000)
  }, [doGenerateQR])

  const generateQR = async () => {
    if (!selectedId) return toast.error('Please select a class first.')
    stopTimers()
    const data = await doGenerateQR(selectedId)
    if (!data) return
    startCountdown(data.classId)
    startPolling(data.classId)
    toast.success('QR code generated!')
  }

  const stopSession = async () => {
    stopTimers()
    if (classIdRef.current) {
      try {
        const res = await api.patch(`/attendance/close/${classIdRef.current}`)
        const absent = res.data?.markedAbsent || 0
        if (absent > 0) {
          toast.success(`Session closed. ${absent} student${absent !== 1 ? 's' : ''} marked absent.`, { duration: 5000 })
        } else {
          toast.success('Attendance session closed. All students were present.')
        }
      } catch {
        toast.success('Attendance session closed.')
      }
    }
    classIdRef.current = null
    setQrData(null)
    setAttLog([])
    setCountdown(60)
    countRef.current = 60
  }

  useEffect(() => () => stopTimers(), [stopTimers])

  const present = attLog.filter(r => r.status === 'present').length
  const late    = attLog.filter(r => r.status === 'late').length
  const absent  = attLog.filter(r => r.status === 'absent').length

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <QrCode size={18} className="text-primary"/>
          </div>
          <h3 className="font-display font-bold text-slate-800">Generate QR Attendance</h3>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Class</label>
          {loadingSch ? (
            <div className="input-field flex items-center gap-2 text-slate-400 text-sm">
              <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-primary rounded-full animate-spin"/>
              Loading your classes…
            </div>
          ) : (
            <select
              className="input-field"
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setQrData(null); stopTimers(); setAttLog([]) }}
            >
              <option value="">— Choose a class —</option>
              {dedupeSchedules(schedules).map(s => (
                <option key={String(s.subject_id || s.id) + '_' + String(s.section_id)} value={s.id}>
                  {s.subject || s.subject_name} · {s.grade_level} {s.section_name}
                </option>
              ))}
            </select>
          )}
          {!loadingSch && !schedules.length && (
            <p className="text-xs text-amber-600 mt-1.5 font-medium">
              ⚠ No approved schedules found. Ask admin to approve your schedules first.
            </p>
          )}
        </div>

        {!qrData ? (
          <button onClick={generateQR} disabled={!selectedId} className="btn-primary w-full justify-center py-3">
            <QrCode size={18}/> Generate QR Code
          </button>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-2xl border-2 border-primary/20 shadow-lg">
              <img src={qrData.qrImage} alt="QR Code" className="w-56 h-56"/>
            </div>

            <div className="w-full">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-500">Auto-refreshes in</span>
                <span className={`text-sm font-bold font-mono ${countdown <= 10 ? 'text-red-500' : 'text-primary'}`}>
                  {countdown}s
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${(countdown / 60) * 100}%` }}
                />
              </div>
            </div>

            <div className="w-full p-3 bg-primary/5 rounded-xl border border-primary/20 text-center">
              <p className="text-xs font-semibold text-slate-700">
                {qrData.scheduleInfo?.subjectName} · {qrData.scheduleInfo?.gradeLevel} {qrData.scheduleInfo?.sectionName}
              </p>
              <p className="text-xs font-mono text-slate-400 mt-0.5">Room: {qrData.scheduleInfo?.room}</p>
            </div>

            <div className="flex gap-3 w-full">
              <button onClick={generateQR} className="btn-secondary flex-1 justify-center">
                <RefreshCw size={15}/> Refresh
              </button>
              <button
                onClick={() => {
                  if (window.confirm('End attendance session? Students who have not scanned will be automatically marked ABSENT.')) {
                    stopSession()
                  }
                }}
                className="btn-danger flex-1 justify-center">
                <StopCircle size={15}/> End Session
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-slate-800">Live Attendance Log</h3>
          <div className="flex items-center gap-2">
            {qrData && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                <span className="text-xs font-semibold text-slate-500">Live</span>
              </div>
            )}
            <span className="text-xs text-slate-400">{attLog.length} scanned</span>
          </div>
        </div>

        {attLog.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
              <p className="text-xl font-bold text-green-600">{present}</p>
              <p className="text-xs text-green-500 font-semibold">Present</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
              <p className="text-xl font-bold text-amber-500">{late}</p>
              <p className="text-xs text-amber-500 font-semibold">Late</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <p className="text-xl font-bold text-slate-400">{absent}</p>
              <p className="text-xs text-slate-400 font-semibold">Absent</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {attLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Users size={36} className="mb-3 opacity-30"/>
              <p className="text-sm font-semibold">No scans yet</p>
              <p className="text-xs mt-1 text-center">
                {qrData ? 'Students will appear here as they scan' : 'Generate a QR code to start attendance'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {attLog.map((rec, i) => (
                <div key={rec.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {initials(rec.first_name, rec.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{fullName(rec.first_name, rec.middle_name, rec.last_name)}</p>
                    <p className="text-xs text-slate-400 font-mono">{rec.lrn}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={rec.status === 'present' ? 'badge-green' : rec.status === 'late' ? 'badge-amber' : 'badge-red'}>
                      {rec.status}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      {rec.time_in ? new Date(rec.time_in).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudentAttendance() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance', user?.studentId],
    queryFn:  () => api.get(`/attendance/student/${user.studentId}`).then(r => r.data.data),
    enabled:  !!user?.studentId,
    staleTime: 0,
  })

  const statusIcon = {
    present: <CheckCircle size={14} className="text-green-500"/>,
    late:    <Clock       size={14} className="text-amber-500"/>,
    absent:  <XCircle    size={14} className="text-red-400"/>,
  }

  const total   = data?.length || 0
  const present = data?.filter(r => r.status === 'present').length || 0
  const late    = data?.filter(r => r.status === 'late').length    || 0
  const rate    = total ? Math.round(((present + late) / total) * 100) : 0

  return (
    <div className="space-y-5">
      {!isLoading && total > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Classes',    value: total,    color: 'text-primary' },
            { label: 'Present',          value: present,  color: 'text-green-600' },
            { label: 'Late',             value: late,     color: 'text-amber-500' },
            { label: 'Attendance Rate',  value: `${rate}%`, color: 'text-purple-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-400 font-semibold mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-display font-bold text-slate-800">Attendance Record</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"/>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {['Date', 'Subject', 'Section', 'Status', 'Time In'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data || []).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(r.class_date).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{r.subject_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.section_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusIcon[r.status]}
                        <span className="capitalize font-medium text-slate-700">{r.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {r.time_in ? new Date(r.time_in).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
                {!data?.length && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    No attendance records found.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AttendancePage() {
  const { user } = useAuth()
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">
          {user?.role === 'teacher'
            ? 'Generate QR codes for students to scan. Live updates every 4 seconds.'
            : 'View your attendance history across all subjects.'}
        </p>
      </div>
      {user?.role === 'teacher' && <QRGenerator/>}
      {(user?.role === 'student' || user?.role === 'admin') && <StudentAttendance/>}
    </div>
  )
}
