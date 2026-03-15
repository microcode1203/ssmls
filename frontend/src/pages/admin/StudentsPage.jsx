// @v2-fixed-imports
import { useState, useEffect } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../../components/ui/Skeleton'
import { fullName, formalName, initials } from '../../utils/nameUtils'
import { useAuth } from '../../context/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, X, AlertTriangle, Shield, KeyRound, Eye, EyeOff, Copy, Check, LayoutList, LayoutGrid, Filter, GraduationCap, Users } from 'lucide-react'

const CONFIRM_PHRASE = 'DELETE'

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function PasswordModal({ student, onClose }) {
 const [password, setPassword] = useState('Student@2026')
 const [showPw, setShowPw] = useState(false)
 const [saving, setSaving] = useState(false)
 const [copied, setCopied] = useState(false)

 const handleReset = async () => {
 if (!password || password.length < 8)
 return toast.error('Password must be at least 8 characters.')
 setSaving(true)
 try {
 await api.post(`/students/${student.id}/reset-password`, { newPassword: password })
 toast.success(`Password reset for ${fullName(student.first_name, student.middle_name, student.last_name)}.`)
 onClose()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to reset password.')
 } finally { setSaving(false) }
 }

 const handleCopy = () => {
 navigator.clipboard.writeText(password).then(() => {
 setCopied(true)
 setTimeout(() => setCopied(false), 2000)
 })
 }

 const generatePassword = () => {
 const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'
 let pw = ''
 for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
 setPassword(pw)
 }

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
 <KeyRound size={20} className="text-amber-600"/>
 </div>
 <div>
 <h2 className="font-display font-bold text-slate-900">Reset Password</h2>
 <p className="text-xs text-slate-400 mt-0.5">Set a new password for this student</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>

 <div className="p-6 space-y-5">
 {/* Student info */}
 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
 <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
 {initials(student?.first_name, student?.last_name)}
 </div>
 <div>
 <p className="font-bold text-slate-800 text-sm">{fullName(student?.first_name, student?.middle_name, student?.last_name)}</p>
 <p className="text-xs text-slate-400">{student?.email}</p>
 </div>
 <div className="ml-auto text-right">
 <p className="text-xs text-slate-400">LRN</p>
 <p className="text-xs font-mono font-bold text-slate-600">{student?.lrn}</p>
 </div>
 </div>

 {/* Password input */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
 <div className="relative">
 <input
 type={showPw ? 'text' : 'password'}
 className="input-field pr-20 font-mono"
 value={password}
 onChange={e => setPassword(e.target.value)}
 autoComplete="new-password"
 />
 <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
 <button
 type="button"
 onClick={() => setShowPw(p => !p)}
 className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
 title={showPw ? 'Hide' : 'Show'}
 >
 {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
 </button>
 <button
 type="button"
 onClick={handleCopy}
 className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
 title="Copy password"
 >
 {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
 </button>
 </div>
 </div>
 <div className="flex items-center justify-between mt-2">
 <p className="text-xs text-slate-400">Min. 8 characters</p>
 <button
 type="button"
 onClick={generatePassword}
 className="text-xs font-semibold text-primary hover:text-primary-700 underline"
 >
 Generate random password
 </button>
 </div>
 </div>

 {/* Warning */}
 <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex gap-2">
 <Shield size={15} className="text-amber-600 flex-shrink-0 mt-0.5"/>
 <p className="text-xs text-amber-700 font-medium">
 Make sure to share the new password with the student. They should change it after logging in.
 </p>
 </div>

 <div className="flex gap-3">
 <button type="button"onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button
 onClick={handleReset}
 disabled={saving || password.length < 8}
 className="btn-primary flex-1 justify-center"
 >
 {saving
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Resetting…</>
 : <><KeyRound size={15}/>Reset Password</>
 }
 </button>
 </div>
 </div>
 </div>
 </div>
 )
}

// ─── Add / Edit Student Modal ─────────────────────────────────────────────────
function StudentModal({ student, sections, onClose, onSave }) {
 const [form, setForm] = useState(student ? {
 firstName: student.first_name || '',
 middleName: student.middle_name || '',
 lastName: student.last_name || '',
 email: student.email || '',
 lrn: student.lrn || '',
 gradeLevel: student.grade_level || 'Grade 11',
 sectionId: student.section_id || '',
 strand: student.strand || 'STEM',
 phone: student.phone || '',
 birthday: student.birthday?.slice(0,10) || '',
 birthplace: student.birthplace || '',
 guardianName: student.guardian_name || '',
 guardianPhone:student.guardian_phone || '',
 } : {
 firstName:'', middleName:'', lastName:'', email:'', lrn:'',
 gradeLevel:'Grade 11', sectionId:'', strand:'STEM',
 phone:'', birthday:'', birthplace:'',
 guardianName:'', guardianPhone:''
 })
 const [saving, setSaving] = useState(false)

 const set = (name) => (e) => setForm(p => ({ ...p, [name]: e.target.value }))

 // Auto-fill Grade Level and Strand when section is selected
 const handleSectionChange = (e) => {
 const selectedId = e.target.value
 const selectedSection = (sections || []).find(s => String(s.id) === String(selectedId))
 setForm(p => ({
 ...p,
 sectionId: selectedId,
 gradeLevel: selectedSection ? selectedSection.grade_level : p.gradeLevel,
 strand: selectedSection ? selectedSection.strand : p.strand,
 }))
 }

 const handleSubmit = async (e) => {
 e.preventDefault()
 setSaving(true)
 try {
 if (student?.id) {
 await api.put(`/students/${student.id}`, form)
 toast.success('Student updated.')
 } else {
 await api.post('/students', form)
 toast.success('Student created.')
 }
 onSave()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to save student.')
 } finally { setSaving(false) }
 }

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <h2 className="font-display font-bold text-slate-900">
 {student ? 'Edit Student' : 'Add Student'}
 </h2>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>

 <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">

 {/* Name row — 3 columns */}
 <div className="col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
 <input className="input-field"placeholder="Given name"value={form.firstName} onChange={set('firstName')} required />
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Middle Name
 <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
 </label>
 <input className="input-field"placeholder="Middle name"value={form.middleName} onChange={set('middleName')} />
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name <span className="text-red-500">*</span></label>
 <input className="input-field"placeholder="Surname"value={form.lastName} onChange={set('lastName')} required />
 </div>
 </div>

 {!student && (
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
 <input type="email"className="input-field"value={form.email} onChange={set('email')} required />
 </div>
 )}

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 LRN <span className="text-red-500">*</span>
 <span className="ml-1 text-xs font-normal text-slate-400">(exactly 12 digits)</span>
 </label>
 <input
 className={`input-field font-mono tracking-wider ${
 form.lrn && !/^\d{12}$/.test(form.lrn)
 ? 'border-red-300 bg-red-50 focus:ring-red-200'
 : form.lrn && /^\d{12}$/.test(form.lrn)
 ? 'border-green-400 bg-green-50 focus:ring-green-300'
 : ''
 }`}
 placeholder="e.g. 123456789012"
 value={form.lrn}
 onChange={set('lrn')}
 maxLength={12}
 required
 />
 {form.lrn && !/^\d{12}$/.test(form.lrn) && (
 <p className="text-xs text-red-500 mt-1 font-medium">
 {/\D/.test(form.lrn)
 ? '✗ Numbers only — no letters or spaces'
 : form.lrn.length < 12
 ? `✗ ${12 - form.lrn.length} more digit(s) needed`
 : '✗ Must be exactly 12 digits'
 }
 </p>
 )}
 {form.lrn && /^\d{12}$/.test(form.lrn) && (
 <p className="text-xs text-green-600 mt-1 font-medium">✓ Valid LRN</p>
 )}
 </div>

 {/* Section — full width, auto-fills grade & strand */}
 <div className="col-span-2">
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Section
 <span className="ml-2 text-xs font-normal text-primary">(auto-fills Grade & Strand)</span>
 </label>
 <select className="input-field"value={form.sectionId} onChange={handleSectionChange}>
 <option value="">— Select Section —</option>
 {(sections || []).map(s => (
 <option key={s.id} value={s.id}>
 {s.grade_level} · {s.section_name} ({s.strand})
 </option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grade Level <span className="text-red-500">*</span></label>
 <select
 className={`input-field ${form.sectionId ? 'bg-blue-50 border-blue-200 text-blue-800 font-semibold' : ''}`}
 value={form.gradeLevel}
 onChange={set('gradeLevel')}
 >
 <option value="Grade 11">Grade 11</option>
 <option value="Grade 12">Grade 12</option>
 </select>
 {form.sectionId && <p className="text-xs text-blue-500 mt-1 font-medium">✓ Auto-filled from section</p>}
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Strand <span className="text-red-500">*</span></label>
 <select
 className={`input-field ${form.sectionId ? 'bg-blue-50 border-blue-200 text-blue-800 font-semibold' : ''}`}
 value={form.strand}
 onChange={set('strand')}
 >
 {['STEM','HUMSS','ABM','TVL','GAS'].map(s => (
 <option key={s} value={s}>{s}</option>
 ))}
 </select>
 {form.sectionId && <p className="text-xs text-blue-500 mt-1 font-medium">✓ Auto-filled from section</p>}
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
 <input type="tel"className="input-field"placeholder="09XX-XXX-XXXX"value={form.phone} onChange={set('phone')} />
 </div>

 {/* Date of Birth + Birthplace */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Date of Birth
 <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
 </label>
 <input
 type="date"
 className="input-field"
 value={form.birthday}
 onChange={set('birthday')}
 max={new Date().toISOString().slice(0,10)}
 />
 {form.birthday && (
 <p className="text-xs text-slate-400 mt-1">
 Age: {Math.floor((new Date() - new Date(form.birthday)) / (365.25*24*60*60*1000))} years old
 </p>
 )}
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Birthplace
 <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
 </label>
 <input
 className="input-field"
 placeholder="City / Municipality, Province"
 value={form.birthplace}
 onChange={set('birthplace')}
 />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guardian Name</label>
 <input className="input-field"value={form.guardianName} onChange={set('guardianName')} />
 </div>

 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guardian Phone</label>
 <input type="tel"className="input-field"placeholder="09XX-XXX-XXXX"value={form.guardianPhone} onChange={set('guardianPhone')} />
 </div>

 <div className="col-span-2 flex gap-3 pt-2">
 <button type="button"onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button
 type="submit"
 disabled={saving || (form.lrn && !/^\d{12}$/.test(form.lrn))}
 className="btn-primary flex-1 justify-center"
 >
 {saving
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
 : student ? 'Update Student' : 'Add Student'
 }
 </button>
 </div>
 </form>
 </div>
 </div>
 )
}

// ─── Delete Confirmation Modal with phrase ────────────────────────────────────
function DeleteStudentModal({ student, onClose, onConfirm, deleting }) {
 const [phrase, setPhrase] = useState('')
 const isMatch = phrase === CONFIRM_PHRASE

 // Enter = confirm (if phrase matches), Escape = cancel
 useEffect(() => {
 const handleKey = (e) => {
 if (e.key === 'Escape') { e.preventDefault(); onClose() }
 if (e.key === 'Enter' && isMatch && !deleting) { e.preventDefault(); onConfirm() }
 }
 window.addEventListener('keydown', handleKey)
 return () => window.removeEventListener('keydown', handleKey)
 }, [isMatch, deleting, onClose, onConfirm])

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

 {/* Header */}
 <div className="p-6 border-b border-slate-100 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
 <Trash2 size={20} className="text-red-500"/>
 </div>
 <div>
 <h2 className="font-display font-bold text-slate-900">Delete Student Account</h2>
 <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>

 <div className="p-6 space-y-5">
 {/* Student info card */}
 <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
 <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 flex-shrink-0">
 {initials(student?.first_name, student?.last_name)}
 </div>
 <div>
 <p className="font-bold text-slate-800">{fullName(student?.first_name, student?.middle_name, student?.last_name)}</p>
 <p className="text-xs text-slate-500">{student?.email}</p>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-xs text-slate-400 font-mono">LRN: {student?.lrn}</span>
 <span className="text-xs text-slate-300">·</span>
 <span className="text-xs text-slate-400">{student?.grade_level} · {student?.section_name || 'No section'}</span>
 </div>
 </div>
 </div>

 {/* Warning */}
 <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex gap-3">
 <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
 <div className="text-sm text-red-700 space-y-1">
 <p className="font-bold">This will deactivate the student's account.</p>
 <p className="text-xs text-red-600">
 The student will no longer be able to log in. Their attendance records, grades, and submissions will be preserved but they will lose access to the system.
 </p>
 </div>
 </div>

 {/* Phrase input */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Type{' '}
 <code className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold text-sm">
 {CONFIRM_PHRASE}
 </code>
 {' '}to confirm deletion
 </label>
 <input
 className={`input-field font-mono tracking-widest text-center text-lg transition-all duration-200
 ${phrase === '' ? '' :
 isMatch
 ? 'border-green-400 bg-green-50 text-green-700 focus:ring-green-300'
 : 'border-red-300 bg-red-50 text-red-600 focus:ring-red-200'
 }`}
 placeholder="Type DELETE here"
 value={phrase}
 onChange={e => setPhrase(e.target.value.toUpperCase())}
 autoFocus
 autoComplete="off"
 spellCheck={false}
 />

 {/* Live feedback */}
 {phrase.length > 0 && (
 <div className="mt-2 flex items-center gap-2">
 {isMatch ? (
 <>
 <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
 <svg width="8"height="8"viewBox="0 0 10 10"fill="none"><polyline points="1,5 4,8 9,2"stroke="white"strokeWidth="2"/></svg>
 </div>
 <p className="text-xs font-bold text-green-600">Phrase confirmed — you can now delete</p>
 <kbd className="ml-auto text-xs bg-green-100 border border-green-200 rounded px-1.5 py-0.5 font-mono text-green-700">Enter</kbd>
 </>
 ) : (
 <>
 <div className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
 <X size={8} className="text-white"/>
 </div>
 <p className="text-xs font-medium text-red-500">
 {CONFIRM_PHRASE.slice(0, phrase.length) === phrase
 ? `Keep typing… ${CONFIRM_PHRASE.length - phrase.length} more character(s)`
 : 'Incorrect phrase'
 }
 </p>
 </>
 )}
 </div>
 )}
 </div>

 {/* Buttons */}
 <div className="flex gap-3 pt-1">
 <button type="button"onClick={onClose} className="btn-secondary flex-1 justify-center">
 <span className="flex items-center gap-1.5">
 Cancel
 <kbd className="text-xs bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
 </span>
 </button>
 <button
 onClick={onConfirm}
 disabled={!isMatch || deleting}
 className={`flex-1 flex items-center justify-center gap-2 font-semibold text-sm px-4 py-2 rounded-lg transition-all duration-200
 ${isMatch && !deleting
 ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
 : 'bg-slate-100 text-slate-400 cursor-not-allowed'
 }`}
 >
 {deleting ? (
 <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Deleting…</>
 ) : (
 <span className="flex items-center gap-1.5">
 <Trash2 size={14}/>
 Delete Account
 {isMatch && <kbd className="text-xs bg-red-400/30 border border-red-300/50 rounded px-1.5 py-0.5 font-mono">Enter</kbd>}
 </span>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsPage() {
 const { user } = useAuth()
 const qc = useQueryClient()
 const isTeacher = user?.role === 'teacher'

 const [search, setSearch] = useState('')
 const [grade, setGrade] = useState('')
 const [sectionFilter, setSectionFilter] = useState('')
 const [strandFilter, setStrandFilter] = useState('')
 const [viewMode, setViewMode] = useState('grouped') // grouped | list
 const [modal, setModal] = useState(null)
 const [deleteTarget, setDeleteTarget] = useState(null)
 const [deleting, setDeleting] = useState(false)
 const [passwordTarget, setPasswordTarget] = useState(null)

  // Body scroll lock - opens with any modal
  useEffect(() => {
    const open = !!modal || !!deleteTarget || !!passwordTarget
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [modal, deleteTarget, passwordTarget])






 const { data: students, isLoading, refetch: refetchStudents } = useQuery({
 queryKey: ['students', search, grade, sectionFilter, strandFilter],
 queryFn: () => api.get('/students', {
 params: {
 search,
 gradeLevel: grade,
 sectionId: sectionFilter || undefined,
 strand: strandFilter || undefined,
 }
 }).then(r => r.data.data),
 keepPreviousData: true,
 staleTime: 0,
 })

 const { data: sections } = useQuery({
 queryKey: ['sections'],
 queryFn: () => api.get('/sections').then(r => r.data.data),
 })

 // Group students by grade → section
 const grouped = (students || []).reduce((acc, s) => {
 const gradeKey = s.grade_level || 'Unknown'
 const sectionKey = s.section_name || 'No Section'
 const key = `${gradeKey}||${sectionKey}||${s.strand || ''}`
 if (!acc[gradeKey]) acc[gradeKey] = {}
 if (!acc[gradeKey][key]) acc[gradeKey][key] = {
 sectionName: sectionKey,
 gradeLevel: gradeKey,
 strand: s.strand || '',
 students: []
 }
 acc[gradeKey][key].students.push(s)
 return acc
 }, {})

 const gradeOrder = ['Grade 11', 'Grade 12']
 const hasFilters = search || grade || sectionFilter || strandFilter

 const handleDelete = async () => {
 if (!deleteTarget) return
 setDeleting(true)
 try {
 await api.delete(`/students/${deleteTarget.id}`)
 toast.success(`${fullName(deleteTarget.first_name, deleteTarget.middle_name, deleteTarget.last_name)}'s account has been deactivated.`)
 setDeleteTarget(null)
 await qc.invalidateQueries(['students'])
 await refetchStudents()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to delete student.')
 } finally {
 setDeleting(false)
 }
 }

 const statusBadge = {
 active: 'badge-green',
 inactive: 'badge-slate',
 transferred: 'badge-amber',
 graduated: 'badge-blue',
 }

 const strandColor = {
 STEM: 'bg-blue-100 text-blue-700',
 HUMSS: 'bg-purple-100 text-purple-700',
 ABM: 'bg-green-100 text-green-700',
 TVL: 'bg-amber-100 text-amber-700',
 GAS: 'bg-slate-100 text-slate-600',
 }

 return (
 <div className="p-6 lg:p-8 max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Students</h1>
 <p className="text-slate-500 text-sm mt-1">
 {students?.length || 0} student{students?.length !== 1 ? 's' : ''}
 {sectionFilter && sections && ` · ${sections.find(s=>String(s.id)===sectionFilter)?.section_name || ''}`}
 </p>
 </div>
 {!isTeacher && (
 <button onClick={() => setModal('add')} className="btn-primary">
 <Plus size={16}/> Add Student
 </button>
 )}
 </div>

 {/* Filters */}
 <div className="card p-4 mb-5">
 <div className="flex gap-3 flex-wrap">
 {/* Search */}
 <div className="relative flex-1 min-w-48">
 <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
 <input
 className="input-field pl-9"
 placeholder="Search by name or LRN…"
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>

 {/* Grade */}
 <select className="input-field w-36"value={grade} onChange={e => { setGrade(e.target.value); setSectionFilter('') }}>
 <option value="">All Grades</option>
 <option value="Grade 11">Grade 11</option>
 <option value="Grade 12">Grade 12</option>
 </select>

 {/* Section */}
 <select className="input-field w-48"value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
 <option value="">All Sections</option>
 {(sections || [])
 .filter(s => !grade || s.grade_level === grade)
 .map(s => (
 <option key={s.id} value={s.id}>
 {s.grade_level} · {s.section_name}
 </option>
 ))
 }
 </select>

 {/* Strand */}
 <select className="input-field w-36"value={strandFilter} onChange={e => setStrandFilter(e.target.value)}>
 <option value="">All Strands</option>
 {['STEM','HUMSS','ABM','TVL','GAS'].map(s => (
 <option key={s} value={s}>{s}</option>
 ))}
 </select>

 {/* Clear */}
 {hasFilters && (
 <button
 onClick={() => { setSearch(''); setGrade(''); setSectionFilter(''); setStrandFilter('') }}
 className="btn-ghost text-xs"
 >
 <X size={13}/> Clear
 </button>
 )}

 {/* View mode toggle */}
 <div className="flex gap-1 ml-auto">
 <button
 onClick={() => setViewMode('grouped')}
 className={`p-2 rounded-lg transition-colors ${viewMode==='grouped' ? 'bg-primary text-white' : 'hover:bg-slate-100 text-slate-500'}`}
 title="Grouped view"
 >
 <LayoutGrid size={16}/>
 </button>
 <button
 onClick={() => setViewMode('list')}
 className={`p-2 rounded-lg transition-colors ${viewMode==='list' ? 'bg-primary text-white' : 'hover:bg-slate-100 text-slate-500'}`}
 title="List view"
 >
 <LayoutList size={16}/>
 </button>
 </div>
 </div>
 </div>

 {/* Student Table — reusable row */}
 {(() => {
 const StudentRow = ({ s }) => (
 <tr key={s.id} className="hover:bg-slate-50/60 group transition-colors">
 <td className="px-4 py-3">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
 {initials(s.first_name, s.last_name)}
 </div>
 <div>
 <p className="font-semibold text-slate-800 text-sm">{formalName(s.first_name, s.middle_name, s.last_name)}</p>
 <p className="text-xs text-slate-400">{s.email}</p>
 </div>
 </div>
 </td>
 <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.lrn}</td>
 {viewMode === 'list' && (
 <>
 <td className="px-4 py-3 text-xs text-slate-600">{s.grade_level}</td>
 <td className="px-4 py-3 text-xs text-slate-600">{s.section_name || '—'}</td>
 <td className="px-4 py-3">
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${strandColor[s.strand]||'bg-slate-100 text-slate-600'}`}>{s.strand}</span>
 </td>
 </>
 )}
 <td className="px-4 py-3">
 <span className={statusBadge[s.status] || 'badge-slate'}>{s.status}</span>
 </td>
 <td className="px-4 py-3">
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 {!isTeacher && (
 <button onClick={() => setModal(s)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"title="Edit">
 <Edit2 size={13}/>
 </button>
 )}
 {!isTeacher && (
 <button onClick={() => setPasswordTarget(s)} className="p-1.5 hover:bg-amber-50 text-amber-500 rounded-lg"title="Reset password">
 <KeyRound size={13}/>
 </button>
 )}
 {!isTeacher && (
 <button onClick={() => setDeleteTarget(s)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"title="Delete">
 <Trash2 size={13}/>
 </button>
 )}
 </div>
 </td>
 </tr>
 )

 const TableHead = ({ grouped }) => (
 <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0">
 <tr>
 {['Student','LRN', ...(grouped ? [] : ['Grade','Section','Strand']), 'Status',''].map(h => (
 <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
 ))}
 </tr>
 </thead>
 )

 if (isLoading) return (
 <div className="card p-12 text-center">
<TableSkeleton cols={6} rows={8}/>
 </div>
 )

 if (!students?.length) return (
 <div className="card p-12 text-center text-slate-400">
 <GraduationCap size={32} className="mx-auto mb-3 opacity-30"/>
 <p className="font-semibold">No students found</p>
 <p className="text-xs mt-1">Try adjusting your filters</p>
 </div>
 )

 /* ── GROUPED VIEW ── */
 if (viewMode === 'grouped') {
 return (
 <div className="space-y-6">
 {gradeOrder.map(gradeKey => {
 const gradeSections = grouped[gradeKey]
 if (!gradeSections) return null
 const sectionGroups = Object.values(gradeSections)
 const totalInGrade = sectionGroups.reduce((a,g) => a + g.students.length, 0)
 return (
 <div key={gradeKey}>
 {/* Grade header */}
 <div className="flex items-center gap-3 mb-3">
 <div className="flex items-center gap-2">
 <GraduationCap size={16} className="text-primary"/>
 <span className="font-bold text-slate-900 text-sm tracking-tight">{gradeKey}</span>
 </div>
 <div className="flex-1 h-px bg-slate-200"/>
 <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
 {totalInGrade} student{totalInGrade!==1?'s':''}
 </span>
 </div>

 {/* Section cards */}
 <div className="space-y-3">
 {sectionGroups.map(group => (
 <div key={group.sectionName} className="card overflow-hidden">
 {/* Section header */}
 <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-100">
 <div className="flex items-center gap-2.5">
 <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
 <Users size={13} className="text-primary"/>
 </div>
 <div>
 <span className="font-bold text-slate-800 text-sm">{group.sectionName}</span>
 <span className="text-slate-400 text-xs ml-2">{group.gradeLevel}</span>
 </div>
 </div>
 {group.strand && (
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${strandColor[group.strand]||'bg-slate-100 text-slate-600'}`}>
 {group.strand}
 </span>
 )}
 <span className="ml-auto text-xs font-semibold text-slate-400">
 {group.students.length} student{group.students.length!==1?'s':''}
 </span>
 </div>
 {/* Students table */}
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <TableHead grouped={true}/>
 <tbody className="divide-y divide-slate-50/80">
 {group.students.map(s => <StudentRow key={s.id} s={s}/>)}
 </tbody>
 </table>
 </div>
 </div>
 ))}
 </div>
 </div>
 )
 })}
 </div>
 )
 }

 /* ── LIST VIEW ── */
 return (
 <div className="card overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <TableHead grouped={false}/>
 <tbody className="divide-y divide-slate-50">
 {(students||[]).map(s => <StudentRow key={s.id} s={s}/>)}
 </tbody>
 </table>
 </div>
 </div>
 )
 })()}

 {/* Add / Edit Modal */}
 {modal && (
 <StudentModal
 student={modal === 'add' ? null : modal}
 sections={sections}
 onClose={() => setModal(null)}
 onSave={() => { setModal(null); qc.invalidateQueries(['students']) }}
 />
 )}

 {/* Delete Confirmation Modal */}
 {deleteTarget && (
 <DeleteStudentModal
 student={deleteTarget}
 onClose={() => setDeleteTarget(null)}
 onConfirm={handleDelete}
 deleting={deleting}
 />
 )}

 {/* Reset Password Modal */}
 {passwordTarget && (
 <PasswordModal
 student={passwordTarget}
 onClose={() => setPasswordTarget(null)}
 />
 )}
 </div>
 )
}
