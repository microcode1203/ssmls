/* @v2-fixed-imports */
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../components/ui/Skeleton'
import { fullName, formalName, initials } from '../utils/nameUtils'
import { useEffect, useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { BarChart3, X, Users, BookOpen, GraduationCap } from 'lucide-react'
import Modal from '../components/ui/Modal'

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

function GradeModal({ mySchedules, onClose, onSave }) {
 const [scheduleId, setScheduleId] = useState('')
 const [studentId, setStudentId] = useState('')
 const [quarter, setQuarter] = useState('Q1')
 const [scores, setScores] = useState({ writtenWorks: '', performanceTasks: '', quarterlyAssessment: '' })
 const [preview, setPreview] = useState(null)
 const [saving, setSaving] = useState(false)

 const selectedSchedule = (mySchedules || []).find(s => String(s.id) === String(scheduleId))

 const { data: sectionStudents } = useQuery({
 queryKey: ['section-students', selectedSchedule?.section_id],
 queryFn: () => api.get('/students', { params: { sectionId: selectedSchedule.section_id } }).then(r => r.data.data),
 enabled: !!selectedSchedule?.section_id,
 staleTime: 30000,
 })

 const { data: existingGrade } = useQuery({
 queryKey: ['existing-grade', studentId, scheduleId, quarter],
 queryFn: () => api.get('/grades', { params: { studentId, scheduleId } })
 .then(r => r.data.data?.find(g => g.quarter === quarter) || null),
 enabled: !!(studentId && scheduleId && quarter),
 onSuccess: (g) => {
 if (g) {
 setScores({
 writtenWorks: String(g.written_works || ''),
 performanceTasks: String(g.performance_tasks || ''),
 quarterlyAssessment: String(g.quarterly_assessment || ''),
 })
 setPreview({ finalGrade: g.final_grade, remarks: g.remarks })
 } else {
 setScores({ writtenWorks: '', performanceTasks: '', quarterlyAssessment: '' })
 setPreview(null)
 }
 }
 })

 const computeGrade = () => {
 const ww = parseFloat(scores.writtenWorks) || 0
 const pt = parseFloat(scores.performanceTasks) || 0
 const qa = parseFloat(scores.quarterlyAssessment) || 0
 const fg = (ww * 0.25 + pt * 0.50 + qa * 0.25).toFixed(2)
 setPreview({ finalGrade: fg, remarks: parseFloat(fg) >= 75 ? 'Passed' : 'Failed' })
 }

 const setScore = (name) => (e) => { setScores(p => ({ ...p, [name]: e.target.value })); setPreview(null) }

 const handleSubmit = async (e) => {
 e.preventDefault()
 if (!scheduleId || !studentId) return toast.error('Select a class and student first.')
 setSaving(true)
 try {
 await api.post('/grades', { studentId, scheduleId, quarter, ...scores })
 toast.success('Grade saved successfully.')
 onSave()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to save grade.')
 } finally { setSaving(false) }
 }

 return (
 <Modal onClose={onClose}>
 <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
 <BarChart3 size={18} className="text-primary"/>
 </div>
 <h2 className="font-display font-bold text-slate-900">Enter / Update Grade</h2>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>

 <form onSubmit={handleSubmit} className="p-6 space-y-5">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 <span className="flex items-center gap-1.5"><BookOpen size={13}/>Class / Subject <span className="text-red-500">*</span></span>
 </label>
 <select className="input-field"value={scheduleId}
 onChange={e => { setScheduleId(e.target.value); setStudentId(''); setPreview(null) }} required>
 <option value="">— Select your class —</option>
 {dedupeSchedules(mySchedules).map(s => (
 <option key={String(s.subject_id || s.id) + '_' + String(s.section_id)} value={s.id}>
 {s.subject_name || s.subject} · {s.grade_level} {s.section_name}
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 <span className="flex items-center gap-1.5">
 <Users size={13}/>Student <span className="text-red-500">*</span>
 {selectedSchedule && (
 <span className="font-normal text-xs text-primary ml-1">· from {selectedSchedule.section_name}</span>
 )}
 </span>
 </label>
 <select className="input-field"value={studentId}
 onChange={e => { setStudentId(e.target.value); setPreview(null) }} required disabled={!scheduleId}>
 <option value="">{!scheduleId ? '— Select a class first —' : '— Select student —'}</option>
 {(sectionStudents || []).map(s => (
 <option key={s.id} value={s.id}>{formalName(s.first_name, s.middle_name, s.last_name)} · {s.lrn}</option>
 ))}
 </select>
 {scheduleId && !sectionStudents?.length && (
 <p className="text-xs text-amber-600 mt-1">No students found in this section.</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quarter</label>
 <div className="grid grid-cols-4 gap-2">
 {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
 <button key={q} type="button"
 onClick={() => { setQuarter(q); setPreview(null) }}
 className={`py-2 rounded-lg text-sm font-bold border transition-all ${
 quarter === q
 ? 'bg-primary text-white border-primary shadow-sm'
 : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50'
 }`}>{q}
 </button>
 ))}
 </div>
 {existingGrade && (
 <p className="text-xs text-amber-600 mt-1.5 font-medium">
 ⚠ A grade already exists for this quarter — saving will overwrite it.
 </p>
 )}
 </div>

 <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grade Components (DepEd Formula)</p>
 <div className="grid grid-cols-3 gap-3">
 {[
 ['writtenWorks', 'Written Works', '25%'],
 ['performanceTasks', 'Performance Tasks', '50%'],
 ['quarterlyAssessment', 'Quarterly Assessment', '25%'],
 ].map(([key, label, weight]) => (
 <div key={key}>
 <label className="block text-xs font-semibold text-slate-600 mb-1">
 {label} <span className="text-slate-400 font-normal">{weight}</span>
 </label>
 <input type="number"min="0"max="100"step="0.01"
 className="input-field text-center font-mono text-base"
 placeholder="0"value={scores[key]} onChange={setScore(key)}/>
 </div>
 ))}
 </div>
 <button type="button"onClick={computeGrade} className="btn-secondary w-full justify-center text-xs">
 Preview Final Grade
 </button>
 </div>

 {preview && (
 <div className={`p-4 rounded-xl text-center border-2 ${
 preview.remarks === 'Passed' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
 }`}>
 <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Final Grade</p>
 <p className={`text-4xl font-display font-bold ${preview.remarks === 'Passed' ? 'text-green-600' : 'text-red-600'}`}>
 {preview.finalGrade}
 </p>
 <span className={`inline-block mt-2 text-sm font-bold px-3 py-1 rounded-full ${
 preview.remarks === 'Passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
 }`}>{preview.remarks}</span>
 </div>
 )}

 <div className="flex gap-3 pt-1">
 <button type="button"onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button type="submit"disabled={saving || !scheduleId || !studentId} className="btn-primary flex-1 justify-center">
 {saving
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
 : <><BarChart3 size={15}/>Save Grade</>
 }
 </button>
 </div>
 </form>
 </div>
 </Modal>
 )
}

export default function GradesPage() {
 const { user } = useAuth()
 const qc = useQueryClient()
 const isTeacher = user?.role === 'teacher'
 const isAdmin = user?.role === 'admin'
 const isStudent = user?.role === 'student'

 const [modal, setModal] = useState(false)
 const [selectedSection, setSelectedSection] = useState('')
 const [selectedStudent, setSelectedStudent] = useState(isStudent ? String(user?.studentId || '') : '')
 const [selectedSchedule, setSelectedSchedule] = useState('')

 const { data: mySchedules } = useQuery({
 queryKey: ['my-schedules', user?.teacherId],
 queryFn: () => api.get('/schedules/my').then(r => r.data.data),
 enabled: !!user && user.role === 'teacher',
 staleTime: 60000,
 })

 const teacherSections = useMemo(() => {
 if (!mySchedules) return []
 const map = new Map()
 mySchedules.forEach(s => {
 if (!map.has(s.section_id)) {
 map.set(s.section_id, {
 id: s.section_id, label: `${s.grade_level} · ${s.section_name}`,
 gradeLevel: s.grade_level, sectionName: s.section_name, strand: s.strand,
 })
 }
 })
 return [...map.values()]
 }, [mySchedules])

 const filteredSchedules = useMemo(() => {
 if (!mySchedules) return []
 if (!selectedSection) return mySchedules
 return mySchedules.filter(s => String(s.section_id) === String(selectedSection))
 }, [mySchedules, selectedSection])

 const { data: sectionStudents } = useQuery({
 queryKey: ['students-for-grades', selectedSection, selectedSchedule],
 queryFn: () => {
 const params = {}
 if (selectedSection) params.sectionId = selectedSection
 if (selectedSchedule) {
 const sched = (mySchedules || []).find(s => String(s.id) === String(selectedSchedule))
 if (sched) params.sectionId = sched.section_id
 }
 return api.get('/students', { params }).then(r => r.data.data)
 },
 enabled: isTeacher || isAdmin,
 staleTime: 30000,
 })

 const studentId = isStudent ? String(user?.studentId || '') : selectedStudent

 const { data: grades, isLoading: gradesLoading } = useQuery({
 queryKey: ['grades', studentId, selectedSchedule],
 queryFn: () => api.get('/grades', {
 params: { studentId, ...(selectedSchedule ? { scheduleId: selectedSchedule } : {}) }
 }).then(r => r.data.data),
 enabled: !!studentId,
 staleTime: 0,
 })

 const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
 const gradeColor = (g) => {
 if (!g) return 'text-slate-300'
 const n = parseFloat(g)
 if (n >= 90) return 'text-emerald-600'
 if (n >= 85) return 'text-green-600'
 if (n >= 75) return 'text-blue-600'
 return 'text-red-500'
 }

 const bySubject = (grades || []).reduce((acc, g) => {
 const k = `${g.subject_name}||${g.section_name || ''}`
 if (!acc[k]) acc[k] = { subject: g.subject_name, section: g.section_name, quarters: {} }
 acc[k].quarters[g.quarter] = g
 return acc
 }, {})

 const STRAND_COLOR = {
 STEM: 'bg-blue-100 text-blue-700 border-blue-200',
 HUMSS: 'bg-purple-100 text-purple-700 border-purple-200',
 ABM: 'bg-amber-100 text-amber-700 border-amber-200',
 TVL: 'bg-green-100 text-green-700 border-green-200',
 GAS: 'bg-slate-100 text-slate-600 border-slate-200',
 }

 return (
 <div className="p-6 lg:p-8 max-w-5xl mx-auto">
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Grades</h1>
 <p className="text-slate-500 text-sm mt-1">Academic performance using the DepEd grading formula.</p>
 </div>
 {isTeacher && (
 <button onClick={() => setModal(true)} className="btn-primary">
 <BarChart3 size={16}/> Enter Grade
 </button>
 )}
 </div>

 {(isTeacher || isAdmin) && (
 <div className="card p-5 mb-6 space-y-4">
 <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Filter by Section & Subject</p>
 <div className="grid sm:grid-cols-3 gap-3">
 {isTeacher && (
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1.5">
 <span className="flex items-center gap-1"><GraduationCap size={12}/>Section</span>
 </label>
 <select className="input-field text-sm"value={selectedSection}
 onChange={e => { setSelectedSection(e.target.value); setSelectedSchedule(''); setSelectedStudent('') }}>
 <option value="">All My Sections</option>
 {teacherSections.map(s => (
 <option key={s.id} value={s.id}>{s.label}</option>
 ))}
 </select>
 </div>
 )}
 {isTeacher && (
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1.5">
 <span className="flex items-center gap-1"><BookOpen size={12}/>Subject</span>
 </label>
 <select className="input-field text-sm"value={selectedSchedule}
 onChange={e => { setSelectedSchedule(e.target.value); setSelectedStudent('') }}>
 <option value="">All Subjects</option>
 {dedupeSchedules(filteredSchedules).map(s => (
 <option key={String(s.subject_id || s.id) + '_' + String(s.section_id)} value={s.id}>
 {s.subject_name || s.subject} · {s.section_name}
 </option>
 ))}
 </select>
 </div>
 )}
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1.5">
 <span className="flex items-center gap-1"><Users size={12}/>Student</span>
 </label>
 <select className="input-field text-sm"value={selectedStudent}
 onChange={e => setSelectedStudent(e.target.value)}>
 <option value="">— Select student —</option>
 {(sectionStudents || []).map(s => (
 <option key={s.id} value={s.id}>{formalName(s.first_name, s.middle_name, s.last_name)} · {s.section_name}</option>
 ))}
 </select>
 </div>
 </div>
 {isTeacher && teacherSections.length > 0 && !selectedSection && (
 <div className="flex flex-wrap gap-2 pt-1">
 {teacherSections.map(s => (
 <button key={s.id}
 onClick={() => { setSelectedSection(String(s.id)); setSelectedSchedule(''); setSelectedStudent('') }}
 className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
 ${STRAND_COLOR[s.strand] || 'bg-slate-100 text-slate-600 border-slate-200'} hover:opacity-80`}>
 {s.label} · {s.strand}
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 {gradesLoading ? (
 <div className="flex justify-center py-16">
<TableSkeleton cols={6} rows={8}/>
 </div>
 ) : !studentId ? (
 <div className="card p-16 text-center text-slate-400">
 <BarChart3 size={36} className="mx-auto mb-3 opacity-20"/>
 <p className="font-semibold">Select a student to view grades</p>
 {isTeacher && <p className="text-xs mt-1">Use the filters above to narrow by section or subject first</p>}
 </div>
 ) : (
 <div className="card overflow-hidden">
 <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-2">
 <div>
 <h3 className="font-bold text-slate-900">
 {isStudent ? 'My Grade Report'
 : (sectionStudents || []).find(s => String(s.id) === String(selectedStudent))
 ? formalName((sectionStudents||[]).find(s=>String(s.id)===String(selectedStudent))?.first_name, (sectionStudents||[]).find(s=>String(s.id)===String(selectedStudent))?.middle_name, (sectionStudents||[]).find(s=>String(s.id)===String(selectedStudent))?.last_name)
 : 'Grade Report'
 }
 </h3>
 </div>
 <span className="text-xs text-slate-400 font-medium">WW 25% · PT 50% · QA 25%</span>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-slate-50/80 border-b border-slate-100">
 <tr>
 <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 min-w-48">Subject</th>
 {quarters.map(q => (
 <th key={q} className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{q}</th>
 ))}
 <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Average</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {Object.values(bySubject).map(({ subject, section, quarters: qMap }) => {
 const vals = quarters.map(q => parseFloat(qMap[q]?.final_grade) || null).filter(Boolean)
 const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null
 return (
 <tr key={`${subject}||${section}`} className="hover:bg-slate-50/60">
 <td className="px-4 py-3">
 <p className="font-semibold text-slate-900">{subject}</p>
 {section && <p className="text-xs text-slate-400 mt-0.5">{section}</p>}
 </td>
 {quarters.map(q => {
 const g = qMap[q]
 return (
 <td key={q} className="px-4 py-3 text-center">
 {g ? (
 <div>
 <p className={`font-bold text-lg ${gradeColor(g.final_grade)}`}>{g.final_grade}</p>
 <span className={g.remarks === 'Passed' ? 'badge-green' : 'badge-red'}>{g.remarks}</span>
 </div>
 ) : (
 <span className="text-slate-200 text-lg">—</span>
 )}
 </td>
 )
 })}
 <td className="px-4 py-3 text-center">
 {avg ? (
 <div>
 <p className={`font-bold text-xl ${gradeColor(avg)}`}>{avg}</p>
 <span className={parseFloat(avg) >= 75 ? 'badge-green' : 'badge-red'}>
 {parseFloat(avg) >= 75 ? 'Passed' : 'Failed'}
 </span>
 </div>
 ) : <span className="text-slate-200">—</span>}
 </td>
 </tr>
 )
 })}
 {!Object.keys(bySubject).length && (
 <tr>
 <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
 <BarChart3 size={28} className="mx-auto mb-2 opacity-20"/>
 <p>No grades recorded yet.</p>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {modal && (
 <GradeModal
 mySchedules={mySchedules}
 onClose={() => setModal(false)}
 onSave={() => { setModal(false); qc.invalidateQueries(['grades']) }}
 />
 )}
 </div>
 )
}
