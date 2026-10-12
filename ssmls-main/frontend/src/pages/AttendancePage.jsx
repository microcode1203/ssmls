/* @v3-personal-qr-badges */
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../components/ui/Skeleton'
import { fullName, formalName, initials } from '../utils/nameUtils'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm'
import {
 QrCode, StopCircle, Users, Camera, Download,
 CheckCircle, Clock, XCircle, BookOpen, ScanLine
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

function TeacherScanner() {
  const [confirmDialog, ask] = useConfirm()
 const [schedules, setSchedules] = useState([])
 const [selectedId, setSelectedId] = useState('')
 const [session, setSession] = useState(null) // { classId, scheduleInfo }
 const [scanning, setScanning] = useState(false)
 const [starting, setStarting] = useState(false)
 const [attLog, setAttLog] = useState([])
 const [lastResult, setLastResult] = useState(null)
 const [loadingSch, setLoadingSch] = useState(true)

 const html5QrRef = useRef(null)
 const classIdRef = useRef(null)
 const pollRef = useRef(null)
 const lastScanRef = useRef({ token: null, time: 0 })

 useEffect(() => {
 api.get('/schedules/my')
 .then(res => { setSchedules(res.data.data || []); setLoadingSch(false) })
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

 const stopPolling = useCallback(() => {
 if (pollRef.current) clearInterval(pollRef.current)
 pollRef.current = null
 }, [])

 const submitScan = useCallback(async (token, classId) => {
 try {
 const res = await api.post('/attendance/scan-student', { token, classId })
 const student = res.data.data?.student
 setLastResult({ ok: true, message: res.data.message, name: student ? fullName(student.first_name, student.middle_name, student.last_name) : null })
 toast.success(res.data.message, { duration: 2200 })
 } catch (err) {
 const data = err.response?.data
 if (data?.data?.alreadyScanned) {
 // Not a real error — the student (or someone else) simply re-presented an already-scanned badge.
 setLastResult({ ok: null, message: data.message })
 } else {
 setLastResult({ ok: false, message: data?.message || 'Scan failed.' })
 toast.error(data?.message || 'Scan failed.')
 }
 }
 }, [])

 const startCamera = useCallback(async (classId) => {
 try {
 const html5Qr = new Html5Qrcode('qr-reader-teacher')
 html5QrRef.current = html5Qr
 await html5Qr.start(
 { facingMode: 'environment' },
 { fps: 12, qrbox: { width: 260, height: 260 } },
 async (decodedText) => {
 const now = Date.now()
 // Debounce: ignore the same badge if it's still sitting in frame within 3s
 if (lastScanRef.current.token === decodedText && now - lastScanRef.current.time < 3000) return
 lastScanRef.current = { token: decodedText, time: now }
 await submitScan(decodedText, classId)
 },
 () => {} // ignore per-frame "no QR found" errors
 )
 setScanning(true)
 } catch (err) {
 toast.error('Could not access camera. Please allow camera permission.')
 console.error(err)
 }
 }, [submitScan])

 const stopCamera = useCallback(async () => {
 if (html5QrRef.current) {
 try { await html5QrRef.current.stop(); await html5QrRef.current.clear() } catch {}
 html5QrRef.current = null
 }
 setScanning(false)
 }, [])

 const startSession = async () => {
 if (!selectedId) return toast.error('Please select a class first.')
 setStarting(true)
 try {
 const res = await api.post('/attendance/start-session', { scheduleId: selectedId })
 const data = res.data.data
 setLastResult(null)
 startPolling(data.classId)
 setSession(data) // camera starts via effect once the viewfinder div is in the DOM
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to start session.')
 } finally {
 setStarting(false)
 }
 }

 // The camera can only attach once React has actually rendered the
 // #qr-reader-teacher div, which only exists after `session` is set.
 useEffect(() => {
 if (session && !html5QrRef.current) {
 startCamera(session.classId)
 }
 }, [session, startCamera])

 const endSession = async () => {
 await stopCamera()
 stopPolling()
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
 setSession(null)
 setAttLog([])
 setLastResult(null)
 }

 useEffect(() => () => { stopCamera(); stopPolling() }, [stopCamera, stopPolling])

 const present = attLog.filter(r => r.status === 'present').length
 const late = attLog.filter(r => r.status === 'late').length
 const absent = attLog.filter(r => r.status === 'absent').length

 return (
 <div className="grid lg:grid-cols-2 gap-6">
   {confirmDialog}
 <div className="card p-6 space-y-5">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
 <ScanLine size={18} className="text-primary"/>
 </div>
 <h3 className="font-display font-bold text-slate-800">Scan Student Badges</h3>
 </div>

 {!session && (
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
 onChange={e => setSelectedId(e.target.value)}
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
 )}

 {!session ? (
 <button onClick={startSession} disabled={!selectedId || starting} className="btn-primary w-full justify-center py-3">
 {starting
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Starting…</>
 : <><Camera size={18}/> Start Scanning</>}
 </button>
 ) : (
 <div className="flex flex-col items-center gap-4">
 <div className="w-full p-3 bg-primary/5 rounded-xl border border-primary/20 text-center">
 <p className="text-xs font-semibold text-slate-700">
 {session.scheduleInfo?.subjectName} · {session.scheduleInfo?.gradeLevel} {session.scheduleInfo?.sectionName}
 </p>
 <p className="text-xs font-mono text-slate-400 mt-0.5">Room: {session.scheduleInfo?.room}</p>
 </div>

 {/* Camera viewfinder */}
 <div className="relative w-full bg-slate-900 aspect-square rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg">
 <div id="qr-reader-teacher" className="w-full h-full"/>
 {scanning && (
 <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
 <div className="relative w-56 h-56">
 <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-lg"/>
 <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-lg"/>
 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-lg"/>
 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-lg"/>
 </div>
 </div>
 )}
 </div>

 {lastResult && (
 <div className={`w-full p-3 rounded-xl flex items-start gap-2.5 text-sm font-semibold
 ${lastResult.ok === true ? 'bg-green-50 border border-green-200 text-green-800'
 : lastResult.ok === false ? 'bg-red-50 border border-red-200 text-red-800'
 : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
 {lastResult.ok === true ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5"/>
 : lastResult.ok === false ? <XCircle size={16} className="flex-shrink-0 mt-0.5"/>
 : <Clock size={16} className="flex-shrink-0 mt-0.5"/>}
 <span>{lastResult.message}</span>
 </div>
 )}

 <p className="text-xs text-slate-400 text-center -mt-1">
 Keep pointing the camera at each student's badge — scanning continues automatically.
 </p>

 <button
 onClick={async () => {
 if (await ask({ title: 'End attendance session?', message: 'Students who have not been scanned will be automatically marked ABSENT.', confirmLabel: 'End session' })) {
   endSession()
 }
}}
 className="btn-danger w-full justify-center">
 <StopCircle size={15}/> End Session
 </button>
 </div>
 )}
 </div>

 <div className="card p-6 flex flex-col">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-display font-bold text-slate-800">Live Attendance Log</h3>
 <div className="flex items-center gap-2">
 {session && (
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
 {session ? 'Students will appear here as their badges are scanned' : 'Start scanning to open attendance'}
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

function MyQRCard() {
 const { data, isLoading } = useQuery({
 queryKey: ['my-qr-badge'],
 queryFn: () => api.get('/attendance/my-qr').then(r => r.data.data),
 staleTime: 5 * 60 * 1000,
 })

 const download = () => {
 if (!data?.qrImage) return
 const a = document.createElement('a')
 a.href = data.qrImage
 a.download = `${data.student?.lrn || 'my'}-attendance-qr.png`
 a.click()
 }

 return (
 <div className="card p-6 flex flex-col sm:flex-row items-center gap-6">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center sm:hidden">
 <QrCode size={18} className="text-primary"/>
 </div>
 {isLoading ? (
 <div className="w-40 h-40 rounded-2xl bg-slate-100 animate-pulse flex-shrink-0"/>
 ) : (
 <div className="p-3 bg-white rounded-2xl border-2 border-primary/20 shadow-sm flex-shrink-0">
 <img src={data?.qrImage} alt="My attendance QR code" className="w-36 h-36"/>
 </div>
 )}
 <div className="flex-1 text-center sm:text-left">
 <div className="hidden sm:flex items-center gap-2 mb-1">
 <QrCode size={16} className="text-primary"/>
 <h3 className="font-display font-bold text-slate-800">My Attendance QR Code</h3>
 </div>
 <p className="text-sm text-slate-500 leading-relaxed">
 This is your personal badge — it's permanent and unique to you. Show it to your teacher
 at the start of class and they'll scan it to mark you present. No need to open the camera yourself.
 </p>
 {data?.student && (
 <p className="text-xs text-slate-400 font-mono mt-2">LRN: {data.student.lrn}</p>
 )}
 <button onClick={download} disabled={!data?.qrImage} className="btn-secondary mt-3 text-xs py-2 px-3 mx-auto sm:mx-0">
 <Download size={13}/> Save to Photos
 </button>
 </div>
 </div>
 )
}

function StudentAttendance() {
 const { user } = useAuth()
 const isStudent = user?.role === 'student'
 const { data, isLoading } = useQuery({
 queryKey: ['my-attendance', user?.studentId],
 queryFn: () => api.get(`/attendance/student/${user.studentId}`).then(r => r.data.data),
 enabled: !!user?.studentId,
 staleTime: 0,
 })

 const statusIcon = {
 present: <CheckCircle size={14} className="text-green-500"/>,
 late: <Clock size={14} className="text-amber-500"/>,
 absent: <XCircle size={14} className="text-red-400"/>,
 }

 const total = data?.length || 0
 const present = data?.filter(r => r.status === 'present').length || 0
 const late = data?.filter(r => r.status === 'late').length || 0
 const rate = total ? Math.round(((present + late) / total) * 100) : 0

 return (
 <div className="space-y-5">
 {isStudent && <MyQRCard/>}
 {!isLoading && total > 0 && (
 <div className="grid grid-cols-4 gap-4">
 {[
 { label: 'Total Classes', value: total, color: 'text-primary' },
 { label: 'Present', value: present, color: 'text-green-600' },
 { label: 'Late', value: late, color: 'text-amber-500' },
 { label: 'Attendance Rate', value: `${rate}%`, color: 'text-purple-600' },
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
 ? "Scan each student's personal QR badge with your camera. Live updates every 4 seconds."
 : 'View your attendance history and your personal QR badge.'}
 </p>
 </div>
 {user?.role === 'teacher' && <TeacherScanner/>}
 {(user?.role === 'student' || user?.role === 'admin') && <StudentAttendance/>}
 </div>
 )
}
