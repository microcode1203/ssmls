// @v2-fixed-imports
import { useState, useEffect } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import {
 Plus, X, Trash2, AlertTriangle, Shield,
 Search, ChevronRight, CalendarDays, BookOpen,
 Users, GraduationCap, Clock, Filter
} from 'lucide-react'
import Modal from '../../components/ui/Modal'

const CONFIRM_PHRASE = 'DELETE'

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_COLOR = {
 Monday: 'bg-blue-100 text-blue-700',
 Tuesday: 'bg-purple-100 text-purple-700',
 Wednesday: 'bg-green-100 text-green-700',
 Thursday: 'bg-amber-100 text-amber-700',
 Friday: 'bg-red-100 text-red-700',
 Saturday: 'bg-slate-100 text-slate-600',
}

// ─── Add Teacher Modal ────────────────────────────────────────────────────────
function TeacherModal({ onClose, onSave }) {
 const [form, setForm] = useState({
 firstName:'', lastName:'', email:'',
 employeeId:'', department:'', phone:''
 })
 const [saving, setSaving] = useState(false)

 const set = (name) => (e) => setForm(p => ({ ...p, [name]: e.target.value }))

 const handleSubmit = async (e) => {
 e.preventDefault(); setSaving(true)
 try {
 await api.post('/teachers', form)
 toast.success('Teacher created. Default password: Teacher@2026')
 onSave()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to create teacher.')
 } finally { setSaving(false) }
 }

 return (
 <Modal onClose={onClose}>
 <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <h2 className="font-display font-bold text-slate-900">Add Teacher</h2>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>
 <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
 {[
 ['firstName','First Name',true], ['lastName','Last Name',true],
 ['email','Email',true], ['employeeId','Employee ID',true],
 ['department','Department',false], ['phone','Phone',false],
 ].map(([name,label,req]) => (
 <div key={name}>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 {label} {req && <span className="text-red-500">*</span>}
 </label>
 <input
 className="input-field"
 type={name==='email'?'email':'text'}
 value={form[name]}
 onChange={set(name)}
 required={req}
 />
 </div>
 ))}
 <div className="col-span-2 p-3 bg-amber-50 rounded-xl border border-amber-200 flex gap-2">
 <Shield size={15} className="text-amber-600 flex-shrink-0 mt-0.5"/>
 <p className="text-xs text-amber-700 font-medium">
 Default password: <strong>Teacher@2026</strong>. Teacher should change after first login.
 </p>
 </div>
 <div className="col-span-2 flex gap-3">
 <button type="button"onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button type="submit"disabled={saving} className="btn-primary flex-1 justify-center">
 {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : 'Add Teacher'}
 </button>
 </div>
 </form>
 </div>
 </Modal>
 )
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
function DeleteTeacherModal({ teacher, onClose, onConfirm, deleting }) {
 const [phrase, setPhrase] = useState('')

 const isMatch = phrase === CONFIRM_PHRASE

 useEffect(() => {
 const handleKey = (e) => {
 if (e.key === 'Escape') { e.preventDefault(); onClose() }
 if (e.key === 'Enter' && isMatch && !deleting) { e.preventDefault(); onConfirm() }
 }
 window.addEventListener('keydown', handleKey)
 return () => window.removeEventListener('keydown', handleKey)
 }, [isMatch, deleting, onClose, onConfirm])

 return (
 <Modal onClose={onClose}>
 <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
 <Trash2 size={20} className="text-red-500"/>
 </div>
 <div>
 <h2 className="font-display font-bold text-slate-900">Delete Teacher Account</h2>
 <p className="text-xs text-slate-400 mt-0.5">This cannot be undone</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>
 <div className="p-6 space-y-5">
 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
 <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 flex-shrink-0">
 {teacher?.first_name?.[0]}{teacher?.last_name?.[0]}
 </div>
 <div>
 <p className="font-bold text-slate-800">{teacher?.first_name} {teacher?.last_name}</p>
 <p className="text-xs text-slate-500">{teacher?.email}</p>
 <p className="text-xs text-slate-400 font-mono mt-0.5">{teacher?.employee_id}</p>
 </div>
 </div>
 <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex gap-3">
 <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
 <p className="text-xs text-red-700 font-medium">
 The teacher will lose access. All schedules, records, and grades are preserved but they cannot log in.
 </p>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Type <code className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">{CONFIRM_PHRASE}</code> to confirm
 </label>
 <input
 className={`input-field font-mono tracking-widest text-center text-lg transition-all
 ${phrase===''?'':isMatch?'border-green-400 bg-green-50 text-green-700':'border-red-300 bg-red-50 text-red-600'}`}
 placeholder="Type DELETE here"
 value={phrase}
 onChange={e => setPhrase(e.target.value.toUpperCase())}
 autoFocus autoComplete="off"spellCheck={false}
 />
 {phrase.length > 0 && (
 <div className="mt-2 flex items-center gap-2">
 {isMatch ? (
 <p className="text-xs font-bold text-green-600 flex items-center gap-1">
 <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</span>
 Confirmed — press Enter or click Delete
 </p>
 ) : (
 <p className="text-xs text-red-500 font-medium">
 {CONFIRM_PHRASE.slice(0,phrase.length)===phrase
 ? `${CONFIRM_PHRASE.length-phrase.length} more character(s)`
 : 'Incorrect phrase'}
 </p>
 )}
 </div>
 )}
 </div>
 <div className="flex gap-3">
 <button onClick={onClose} className="btn-secondary flex-1 justify-center">
 Cancel <kbd className="text-xs bg-slate-100 border rounded px-1 ml-1">Esc</kbd>
 </button>
 <button
 onClick={onConfirm}
 disabled={!isMatch||deleting}
 className={`flex-1 flex items-center justify-center gap-2 font-semibold text-sm px-4 py-2 rounded-lg transition-all
 ${isMatch&&!deleting?'bg-red-500 hover:bg-red-600 text-white':'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
 >
 {deleting
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Deleting…</>
 : <><Trash2 size={14}/>Delete {isMatch&&<kbd className="text-xs bg-red-400/30 border border-red-300/50 rounded px-1">Enter</kbd>}</>
 }
 </button>
 </div>
 </div>
 </div>
 </Modal>
 )
}

// ─── Teacher Detail Drawer ────────────────────────────────────────────────────
function TeacherDrawer({ teacher, onClose, onDelete }) {
 const [filterSection, setFilterSection] = useState('')
 const [filterSubject, setFilterSubject] = useState('')

 const { data: schedules, isLoading } = useQuery({
 queryKey: ['teacher-schedules', teacher?.id],
 queryFn: () => api.get(`/teachers/${teacher.id}/schedules`).then(r => r.data.data),
 enabled: !!teacher?.id,
 staleTime: 0,
 })

 // Build unique section and subject lists from schedules
 const sections = [...new Map((schedules||[]).map(s =>
 [s.section_id, { id:s.section_id, name:`${s.grade_level} · ${s.section_name}`, strand:s.strand }]
 )).values()]

 const subjects = [...new Map((schedules||[]).map(s =>
 [s.subject_id, { id:s.subject_id, name:s.subject_name, code:s.subject_code }]
 )).values()]

 // Apply filters
 const filtered = (schedules||[]).filter(s => {
 if (filterSection && s.section_id !== parseInt(filterSection)) return false
 if (filterSubject && s.subject_id !== parseInt(filterSubject)) return false
 return true
 })

 // Group filtered schedules by day
 const byDay = DAY_ORDER.reduce((acc, day) => {
 const items = filtered.filter(s => s.day_of_week === day)
 if (items.length) acc[day] = items
 return acc
 }, {})

 return (
 <div className="fixed inset-0 z-50 flex justify-end">
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/40"onClick={onClose}/>

 {/* Drawer */}
 <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-slide-in">
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-sm flex-shrink-0">
 {teacher?.first_name?.[0]}{teacher?.last_name?.[0]}
 </div>
 <div>
 <h2 className="font-display font-bold text-slate-900">{teacher?.first_name} {teacher?.last_name}</h2>
 <p className="text-xs text-slate-500 font-mono">{teacher?.employee_id}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => onDelete(teacher)}
 className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
 title="Delete teacher"
 >
 <Trash2 size={16}/>
 </button>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
 <X size={18}/>
 </button>
 </div>
 </div>

 {/* Teacher info */}
 <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 gap-3 flex-shrink-0">
 <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Department</p>
 <p className="text-sm font-semibold text-slate-700">{teacher?.department || '—'}</p>
 </div>
 <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</p>
 <p className="text-sm font-semibold text-slate-700 truncate">{teacher?.email}</p>
 </div>
 <div className="bg-primary/5 rounded-xl p-3 border border-primary/20 col-span-2 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <CalendarDays size={15} className="text-primary"/>
 <span className="text-sm font-bold text-primary">
 {schedules?.length || 0} approved schedule{schedules?.length !== 1 ? 's' : ''}
 </span>
 </div>
 <div className="flex gap-3 text-xs text-slate-500">
 <span className="flex items-center gap-1">
 <BookOpen size={11}/>{subjects.length} subject{subjects.length!==1?'s':''}
 </span>
 <span className="flex items-center gap-1">
 <Users size={11}/>{sections.length} section{sections.length!==1?'s':''}
 </span>
 </div>
 </div>
 </div>

 {/* Filters */}
 <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
 <div className="flex items-center gap-2 mb-3">
 <Filter size={14} className="text-slate-400"/>
 <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter Schedules</span>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1">Section</label>
 <select
 className="input-field text-sm"
 value={filterSection}
 onChange={e => setFilterSection(e.target.value)}
 >
 <option value="">All Sections</option>
 {sections.map(s => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
 <select
 className="input-field text-sm"
 value={filterSubject}
 onChange={e => setFilterSubject(e.target.value)}
 >
 <option value="">All Subjects</option>
 {subjects.map(s => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>
 </div>
 {(filterSection || filterSubject) && (
 <button
 onClick={() => { setFilterSection(''); setFilterSubject('') }}
 className="mt-2 text-xs font-semibold text-primary hover:text-primary-700 flex items-center gap-1"
 >
 <X size={11}/> Clear filters
 </button>
 )}
 </div>

 {/* Schedule list */}
 <div className="flex-1 overflow-y-auto px-6 py-4">
 {isLoading ? <TableSkeleton cols={5} rows={5}/> : Object.keys(byDay).length === 0 ? (
 <div className="text-center py-12 text-slate-400">
 <CalendarDays size={32} className="mx-auto mb-3 opacity-30"/>
 <p className="font-semibold text-sm">No schedules found</p>
 <p className="text-xs mt-1">
 {(filterSection||filterSubject) ? 'Try changing the filters' : 'No approved schedules assigned yet'}
 </p>
 </div>
 ) : (
 <div className="space-y-5">
 {Object.entries(byDay).map(([day, items]) => (
 <div key={day}>
 {/* Day header */}
 <div className="flex items-center gap-2 mb-3">
 <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${DAY_COLOR[day]}`}>{day}</span>
 <div className="flex-1 h-px bg-slate-100"/>
 <span className="text-xs text-slate-400">{items.length} class{items.length!==1?'es':''}</span>
 </div>

 {/* Schedule cards */}
 <div className="space-y-2">
 {items.map(s => (
 <div key={s.id} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-primary/30 hover:bg-blue-50/30 transition-all">
 {/* Time column */}
 <div className="text-center flex-shrink-0 min-w-16">
 <p className="font-mono text-xs font-bold text-primary">{s.start_time}</p>
 <div className="w-px h-4 bg-slate-300 mx-auto my-0.5"/>
 <p className="font-mono text-xs text-slate-400">{s.end_time}</p>
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <p className="font-bold text-slate-900 text-sm">{s.subject_name}</p>
 <p className="text-xs text-slate-500 font-mono">{s.subject_code}</p>
 <div className="flex items-center gap-2 mt-2 flex-wrap">
 <span className="flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-full px-2.5 py-0.5 font-semibold text-slate-700">
 <GraduationCap size={10}/>{s.grade_level} · {s.section_name}
 </span>
 <span className="text-xs text-slate-400 font-medium">
 Room {s.room}
 </span>
 </div>
 </div>

 {/* Strand badge */}
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0
 ${s.strand==='STEM'?'bg-blue-100 text-blue-700'
 :s.strand==='HUMSS'?'bg-purple-100 text-purple-700'
 :s.strand==='ABM'?'bg-green-100 text-green-700'
 :'bg-amber-100 text-amber-700'}`}>
 {s.strand}
 </span>
 </div>
 ))}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeachersPage() {
 const qc = useQueryClient()
 const [addModal, setAddModal] = useState(false)
 const [deleteTarget, setDeleteTarget] = useState(null)
 const [deleting, setDeleting] = useState(false)
 const [selected, setSelected] = useState(null) // teacher for drawer
 const [search, setSearch] = useState('')
 const [filterSection, setFilterSection] = useState('')
 const [filterSubject, setFilterSubject] = useState('')

 const { data, isLoading, refetch: refetchTeachers } = useQuery({
 queryKey: ['teachers'],
 queryFn: () => api.get('/teachers').then(r => r.data.data),
 staleTime: 0,
 })

 const { data: sections } = useQuery({
 queryKey: ['sections'],
 queryFn: () => api.get('/sections').then(r => r.data.data),
 })

 // All unique subjects across all teachers' schedules for filter
 const { data: allSubjects } = useQuery({
 queryKey: ['all-subjects'],
 queryFn: () => api.get('/schedules/section/0').then(()=>[]).catch(()=>[]),
 })

 const handleDelete = async () => {
 if (!deleteTarget) return
 setDeleting(true)
 try {
 await api.delete(`/teachers/${deleteTarget.id}`)
 toast.success(`${deleteTarget.first_name} ${deleteTarget.last_name}'s account deactivated.`)
 setDeleteTarget(null)
 if (selected?.id === deleteTarget.id) setSelected(null)
 await qc.invalidateQueries(['teachers'])
 await refetchTeachers()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to delete teacher.')
 } finally { setDeleting(false) }
 }

 // Client-side search filter
 const filtered = (data||[]).filter(t => {
 if (!search) return true
 const q = search.toLowerCase()
 return (
 t.first_name?.toLowerCase().includes(q) ||
 t.last_name?.toLowerCase().includes(q) ||
 t.email?.toLowerCase().includes(q) ||
 t.employee_id?.toLowerCase().includes(q) ||
 t.department?.toLowerCase().includes(q)
 )
 })

 return (
 <div className="p-6 lg:p-8 max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Teachers</h1>
 <p className="text-slate-500 text-sm mt-1">
 {filtered.length} teacher{filtered.length!==1?'s':''} · click a row to view their schedule
 </p>
 </div>
 <button onClick={() => setAddModal(true)} className="btn-primary">
 <Plus size={16}/> Add Teacher
 </button>
 </div>

 {/* Search */}
 <div className="card p-4 mb-5 flex gap-3 flex-wrap">
 <div className="relative flex-1 min-w-48">
 <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
 <input
 className="input-field pl-9"
 placeholder="Search by name, email, employee ID…"
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>
 {search && (
 <button onClick={() => setSearch('')} className="btn-secondary text-xs">
 <X size={12}/> Clear
 </button>
 )}
 </div>

 {/* Table */}
 <div className="card overflow-hidden">
 {isLoading ? (
 <div className="p-12 text-center">
<TableSkeleton cols={6} rows={8}/>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-slate-50 border-b border-slate-100">
 <tr>
 {['Teacher','Employee ID','Department','Email','Status',''].map(h => (
 <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {filtered.map(t => (
 <tr
 key={t.id}
 onClick={() => setSelected(t)}
 className={`hover:bg-blue-50/40 cursor-pointer group transition-colors
 ${selected?.id===t.id ? 'bg-blue-50 border-l-2 border-primary' : ''}`}
 >
 <td className="px-4 py-3">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 flex-shrink-0">
 {t.first_name?.[0]}{t.last_name?.[0]}
 </div>
 <div>
 <p className="font-semibold text-slate-800">{t.first_name} {t.last_name}</p>
 <p className="text-xs text-slate-400">{t.phone || '—'}</p>
 </div>
 </div>
 </td>
 <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.employee_id}</td>
 <td className="px-4 py-3 text-slate-600">{t.department || '—'}</td>
 <td className="px-4 py-3 text-slate-500 text-xs">{t.email}</td>
 <td className="px-4 py-3">
 <span className={t.is_active ? 'badge-green' : 'badge-slate'}>
 {t.is_active ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={e => { e.stopPropagation(); setDeleteTarget(t) }}
 className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg"
 title="Delete"
 >
 <Trash2 size={14}/>
 </button>
 <ChevronRight size={14} className="text-slate-300"/>
 </div>
 </td>
 </tr>
 ))}
 {!filtered.length && (
 <tr>
 <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
 {search ? `No teachers found for"${search}"` : 'No teachers found.'}
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Add Modal */}
 {addModal && (
 <TeacherModal
 onClose={() => setAddModal(false)}
 onSave={() => { setAddModal(false); qc.invalidateQueries(['teachers']); refetchTeachers() }}
 />
 )}

 {/* Delete Confirm Modal */}
 {deleteTarget && (
 <DeleteTeacherModal
 teacher={deleteTarget}
 onClose={() => setDeleteTarget(null)}
 onConfirm={handleDelete}
 deleting={deleting}
 />
 )}

 {/* Teacher Detail Drawer */}
 {selected && (
 <TeacherDrawer
 teacher={selected}
 onClose={() => setSelected(null)}
 onDelete={(t) => { setSelected(null); setDeleteTarget(t) }}
 />
 )}
 </div>
 )
}
