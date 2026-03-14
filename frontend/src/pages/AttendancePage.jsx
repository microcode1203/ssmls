import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { QrCode, RefreshCw, StopCircle, Users, CheckCircle, Clock, XCircle } from 'lucide-react'

function QRGenerator() {
  const [schedules, setSchedules]   = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [qrData, setQrData]         = useState(null)
  const [countdown, setCountdown]   = useState(60)
  const [attLog, setAttLog]         = useState([])
  const intervalRef = useRef(null)
  const pollRef     = useRef(null)

  // Load teacher's schedules
  useEffect(() => {
    api.get('/dashboard').then(res => {
      setSchedules(res.data.data.myClasses || [])
    })
  }, [])

  const generateQR = async () => {
    if (!selectedId) return toast.error('Please select a class first.')
    try {
      const res = await api.post('/attendance/generate-qr', { scheduleId: selectedId })
      setQrData(res.data.data)
      setCountdown(60)
      startAutoRefresh()
      toast.success('QR code generated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate QR.')
    }
  }

  const startAutoRefresh = () => {
    // Countdown ticker
    if (intervalRef.current) clearInterval(intervalRef.current)
    let c = 60
    intervalRef.current = setInterval(async () => {
      c--
      setCountdown(c)
      if (c <= 0) {
        // Regenerate
        try {
          const res = await api.post('/attendance/generate-qr', { scheduleId: selectedId })
          setQrData(res.data.data)
          c = 60
          setCountdown(60)
        } catch {}
      }
    }, 1000)

    // Poll attendance every 5 seconds
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      if (qrData?.classId) {
        const res = await api.get(`/attendance/class/${qrData.classId}`)
        setAttLog(res.data.data.records || [])
      }
    }, 5000)
  }

  const stopSession = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollRef.current)     clearInterval(pollRef.current)
    if (qrData?.classId) {
      await api.patch(`/attendance/close/${qrData.classId}`)
      toast.success('Attendance session closed.')
    }
    setQrData(null)
    setCountdown(60)
  }

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollRef.current)     clearInterval(pollRef.current)
  }, [])

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: controls + QR */}
      <div className="card p-6 space-y-5">
        <h3 className="font-display font-bold text-slate-800">Generate QR Attendance</h3>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Select Class</label>
          <select
            className="input-field"
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setQrData(null) }}
          >
            <option value="">— Choose a class —</option>
            {schedules.map(s => (
              <option key={s.id} value={s.id}>
                {s.subject} · {s.grade_level} {s.section_name} · {s.day_of_week} {s.start_time}
              </option>
            ))}
          </select>
        </div>

        {!qrData ? (
          <button onClick={generateQR} disabled={!selectedId} className="btn-primary w-full justify-center py-3">
            <QrCode size={18} /> Generate QR Code
          </button>
        ) : (
          <>
            {/* QR Image */}
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white rounded-2xl border-2 border-primary/20 shadow-lg qr-pulse">
                <img src={qrData.qrImage} alt="QR Code" className="w-56 h-56" />
              </div>

              {/* Countdown bar */}
              <div className="w-full">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-slate-500">Auto-refreshes in</span>
                  <span className={`text-sm font-bold ${countdown <= 10 ? 'text-red-500' : 'text-primary'}`}>
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

              <div className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  {qrData.scheduleInfo?.subjectName} · {qrData.scheduleInfo?.gradeLevel} {qrData.scheduleInfo?.sectionName}
                </p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">Room: {qrData.scheduleInfo?.room}</p>
              </div>

              <div className="flex gap-3 w-full">
                <button onClick={generateQR} className="btn-secondary flex-1 justify-center">
                  <RefreshCw size={15} /> Refresh Now
                </button>
                <button onClick={stopSession} className="btn-danger flex-1 justify-center">
                  <StopCircle size={15} /> End Session
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: live log */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-slate-800">Live Attendance Log</h3>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-500">Live</span>
          </div>
        </div>

        {attLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Users size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">No scans yet</p>
            <p className="text-xs mt-1">Students will appear here as they scan</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {attLog.map((rec, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {rec.first_name?.[0]}{rec.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{rec.first_name} {rec.last_name}</p>
                  <p className="text-xs text-slate-400">{rec.lrn}</p>
                </div>
                <div className="text-right">
                  <span className={`${rec.status==='present' ? 'badge-green' : rec.status==='late' ? 'badge-amber' : 'badge-red'}`}>
                    {rec.status}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">{rec.time_in ? new Date(rec.time_in).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {attLog.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{attLog.filter(r=>r.status==='present').length}</p>
              <p className="text-xs text-slate-400">Present</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-500">{attLog.filter(r=>r.status==='late').length}</p>
              <p className="text-xs text-slate-400">Late</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-400">{attLog.filter(r=>r.status==='absent').length}</p>
              <p className="text-xs text-slate-400">Absent</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StudentAttendance() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => api.get(`/attendance/student/${user.studentId}`).then(r => r.data.data),
    enabled: !!user?.studentId
  })

  const statusIcon = { present: <CheckCircle size={14} className="text-green-500"/>, late: <Clock size={14} className="text-amber-500"/>, absent: <XCircle size={14} className="text-red-400"/> }

  return (
    <div className="card">
      <div className="p-5 border-b border-slate-100">
        <h3 className="font-display font-bold text-slate-800">My Attendance Record</h3>
      </div>
      {isLoading ? (
        <div className="p-8 text-center"><div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Date','Subject','Status','Time In'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data||[]).map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{new Date(r.class_date).toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'})}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{r.subject_name}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5">{statusIcon[r.status]}<span className="capitalize font-medium">{r.status}</span></div></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.time_in ? new Date(r.time_in).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No attendance records found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AttendancePage() {
  const { user } = useAuth()
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Attendance</h1>
        <p className="text-slate-500 text-sm mt-1">
          {user?.role === 'teacher' ? 'Generate dynamic QR codes and monitor student attendance in real-time.' : 'View your attendance history.'}
        </p>
      </div>
      {user?.role === 'teacher' && <QRGenerator />}
      {user?.role === 'student' && <StudentAttendance />}
      {user?.role === 'admin'   && <StudentAttendance />}
    </div>
  )
}
