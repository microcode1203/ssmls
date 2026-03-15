// @v2-fixed-imports
import { useState } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import {
 Plus, X, Edit2, Trash2, BookMarked,
 AlertTriangle, Search, Hash, Layers
} from 'lucide-react'

const GRADE_COLORS = {
 'Grade 11': 'bg-blue-100 text-blue-700 border-blue-200',
 'Grade 12': 'bg-green-100 text-green-700 border-green-200',
 'Both': 'bg-purple-100 text-purple-700 border-purple-200',
}

// ─── Subject Modal (Add / Edit) ───────────────────────────────────────────────
function SubjectModal({ subject, onClose, onSave }) {
 const [form, setForm] = useState({
 code: subject?.code || '',
 name: subject?.name || '',
 description: subject?.description || '',
 gradeLevel: subject?.grade_level || 'Both',
 units: subject?.units || 1,
 })
 const [saving, setSaving] = useState(false)
 const isEdit = !!subject

 const set = (name) => (e) => setForm(p => ({ ...p, [name]: e.target.value }))

 const handleSubmit = async (e) => {
 e.preventDefault()
 setSaving(true)
 try {
 if (isEdit) {
 await api.put(`/subjects/${subject.id}`, form)
 toast.success('Subject updated successfully.')
 } else {
 await api.post('/subjects', form)
 toast.success('Subject created successfully.')
 }
 onSave()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to save subject.')
 } finally { setSaving(false) }
 }

 return (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm px-4">
 <div className="relative mx-auto my-8 bg-white rounded-2xl shadow-2xl w-full max-w-lg">
 {/* Header */}
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
 <BookMarked size={18} className="text-primary"/>
 </div>
 <h2 className="font-display font-bold text-slate-900">
 {isEdit ? 'Edit Subject' : 'Add New Subject'}
 </h2>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
 <X size={18}/>
 </button>
 </div>

 <form onSubmit={handleSubmit} className="p-6 space-y-4">
 {/* Code + Name side by side */}
 <div className="grid grid-cols-3 gap-3">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Code <span className="text-red-500">*</span>
 </label>
 <input
 className="input-field font-mono uppercase tracking-wider"
 placeholder="e.g. MATH11"
 value={form.code}
 onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
 maxLength={20}
 required
 />
 </div>
 <div className="col-span-2">
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Subject Name <span className="text-red-500">*</span>
 </label>
 <input
 className="input-field"
 placeholder="e.g. General Mathematics"
 value={form.name}
 onChange={set('name')}
 required
 />
 </div>
 </div>

 {/* Description */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Description <span className="text-xs font-normal text-slate-400">(optional)</span>
 </label>
 <textarea
 className="input-field h-20 resize-none"
 placeholder="Brief description of the subject…"
 value={form.description}
 onChange={set('description')}
 />
 </div>

 {/* Grade Level + Units */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Grade Level <span className="text-red-500">*</span>
 </label>
 <select className="input-field"value={form.gradeLevel} onChange={set('gradeLevel')}>
 <option value="Both">Both (G11 & G12)</option>
 <option value="Grade 11">Grade 11 only</option>
 <option value="Grade 12">Grade 12 only</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Units <span className="text-red-500">*</span>
 </label>
 <input
 type="number"
 className="input-field"
 min={1} max={6}
 value={form.units}
 onChange={set('units')}
 required
 />
 </div>
 </div>

 {/* Preview */}
 {form.code && form.name && (
 <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
 <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
 <BookMarked size={16} className="text-primary"/>
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-slate-800 text-sm">{form.name}</p>
 <p className="text-xs font-mono text-slate-500">{form.code}</p>
 </div>
 <div className="flex items-center gap-2">
 <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${GRADE_COLORS[form.gradeLevel]}`}>
 {form.gradeLevel === 'Both' ? 'G11 & G12' : form.gradeLevel}
 </span>
 <span className="text-xs text-slate-400 font-semibold">{form.units} unit{form.units!==1?'s':''}</span>
 </div>
 </div>
 )}

 {/* Buttons */}
 <div className="flex gap-3 pt-2">
 <button type="button"onClick={onClose} className="btn-secondary flex-1 justify-center">
 Cancel
 </button>
 <button type="submit"disabled={saving} className="btn-primary flex-1 justify-center">
 {saving
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
 : isEdit ? 'Save Changes' : 'Create Subject'
 }
 </button>
 </div>
 </form>
 </div>
 </div>
 )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteSubjectModal({ subject, onClose, onConfirm, deleting }) {
 return (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm px-4">
 <div className="relative mx-auto my-8 bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
 <div className="flex flex-col items-center text-center gap-3 mb-6">
 <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
 <Trash2 size={24} className="text-red-500"/>
 </div>
 <div>
 <h3 className="font-display font-bold text-slate-900 text-lg">Delete Subject?</h3>
 <p className="text-slate-500 text-sm mt-1">
 Are you sure you want to delete{' '}
 <span className="font-bold text-slate-800">{subject?.name}</span>?
 </p>
 <p className="text-xs text-red-500 mt-2 font-medium">This cannot be undone.</p>
 </div>
 </div>

 {/* Warning if it has schedules */}
 {subject?.class_count > 0 && (
 <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
 <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5"/>
 <p className="text-xs text-amber-700 font-medium">
 This subject is used in {subject.class_count} schedule(s). You must remove those schedules first.
 </p>
 </div>
 )}

 <div className="flex gap-3">
 <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button
 onClick={onConfirm}
 disabled={deleting || subject?.class_count > 0}
 className={`flex-1 flex items-center justify-center gap-2 font-semibold text-sm px-4 py-2 rounded-lg transition-all
 ${subject?.class_count > 0 || deleting
 ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
 : 'bg-red-500 hover:bg-red-600 text-white'
 }`}
 >
 {deleting
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Deleting…</>
 : <><Trash2 size={14}/>Delete</>
 }
 </button>
 </div>
 </div>
 </div>
 )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubjectsPage() {
 const qc = useQueryClient()
 const [modal, setModal] = useState(null) // null | 'add' | subject obj
 const [deleteTarget, setDeleteTarget] = useState(null)
 const [deleting, setDeleting] = useState(false)
 const [search, setSearch] = useState('')
 const [filterGrade, setFilterGrade] = useState('')

 const { data, isLoading, refetch } = useQuery({
 queryKey: ['subjects'],
 queryFn: () => api.get('/subjects').then(r => r.data.data),
 staleTime: 0,
 })

 const handleDelete = async () => {
 if (!deleteTarget) return
 setDeleting(true)
 try {
 await api.delete(`/subjects/${deleteTarget.id}`)
 toast.success('Subject deleted.')
 setDeleteTarget(null)
 await qc.invalidateQueries(['subjects'])
 await refetch()
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to delete subject.')
 } finally { setDeleting(false) }
 }

 // Client-side filter
 const filtered = (data || []).filter(s => {
 const q = search.toLowerCase()
 const matchSearch = !search ||
 s.name?.toLowerCase().includes(q) ||
 s.code?.toLowerCase().includes(q) ||
 s.description?.toLowerCase().includes(q)
 const matchGrade = !filterGrade ||
 s.grade_level === filterGrade || s.grade_level === 'Both'
 return matchSearch && matchGrade
 })

 // Group by grade level
 const groups = {
 'Grade 11': filtered.filter(s => s.grade_level === 'Grade 11' || s.grade_level === 'Both'),
 'Grade 12': filtered.filter(s => s.grade_level === 'Grade 12' || s.grade_level === 'Both'),
 'Both': filtered.filter(s => s.grade_level === 'Both'),
 }

 // Display grouping
 const displayGroups = filterGrade
 ? [[filterGrade, filtered]]
 : [
 ['Grade 11', filtered.filter(s => s.grade_level === 'Grade 11')],
 ['Grade 12', filtered.filter(s => s.grade_level === 'Grade 12')],
 ['Both Grades', filtered.filter(s => s.grade_level === 'Both')],
 ].filter(([, items]) => items.length > 0)

 return (
 <div className="p-6 lg:p-8 max-w-6xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Subjects</h1>
 <p className="text-slate-500 text-sm mt-1">
 {data?.length || 0} subjects · {data?.reduce((a,s) => a + Number(s.units||0), 0) || 0} total units
 </p>
 </div>
 <button onClick={() => setModal('add')} className="btn-primary">
 <Plus size={16}/> Add Subject
 </button>
 </div>

 {/* Filters */}
 <div className="card p-4 mb-6 flex gap-3 flex-wrap">
 <div className="relative flex-1 min-w-48">
 <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
 <input
 className="input-field pl-9"
 placeholder="Search by name or code…"
 value={search}
 onChange={e => setSearch(e.target.value)}
 />
 </div>
 <select
 className="input-field w-44"
 value={filterGrade}
 onChange={e => setFilterGrade(e.target.value)}
 >
 <option value="">All Grades</option>
 <option value="Grade 11">Grade 11</option>
 <option value="Grade 12">Grade 12</option>
 </select>
 {(search || filterGrade) && (
 <button
 onClick={() => { setSearch(''); setFilterGrade('') }}
 className="btn-secondary text-xs"
 >
 <X size={12}/> Clear
 </button>
 )}
 </div>

 {/* Subject list */}
 {isLoading ? (
 <div className="flex justify-center py-20">
<TableSkeleton cols={6} rows={8}/>
 </div>
 ) : filtered.length === 0 ? (
 <div className="card p-16 text-center text-slate-400">
 <BookMarked size={36} className="mx-auto mb-3 opacity-30"/>
 <p className="font-semibold">No subjects found.</p>
 <p className="text-xs mt-1">Try changing your filters or add a new subject.</p>
 </div>
 ) : (
 <div className="space-y-8">
 {displayGroups.map(([groupLabel, items]) => (
 <div key={groupLabel}>
 {/* Group header */}
 <div className="flex items-center gap-3 mb-4">
 <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
 {groupLabel}
 </span>
 <div className="flex-1 h-px bg-slate-200"/>
 <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${GRADE_COLORS[groupLabel] || GRADE_COLORS['Both']}`}>
 {items.length} subject{items.length!==1?'s':''}
 </span>
 </div>

 {/* Subject cards */}
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {items.map(s => (
 <div
 key={s.id}
 className="card p-5 hover:shadow-md transition-all group flex flex-col gap-3"
 >
 {/* Top row */}
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
 <BookMarked size={18} className="text-primary"/>
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-bold text-slate-900 text-sm leading-snug">{s.name}</h3>
 <p className="text-xs font-mono font-bold text-primary mt-0.5">{s.code}</p>
 </div>
 {/* Action buttons — visible on hover */}
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
 <button
 onClick={() => setModal(s)}
 className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg"
 title="Edit"
 >
 <Edit2 size={13}/>
 </button>
 <button
 onClick={() => setDeleteTarget(s)}
 className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg"
 title="Delete"
 >
 <Trash2 size={13}/>
 </button>
 </div>
 </div>

 {/* Description */}
 {s.description && (
 <p className="text-xs text-slate-500 line-clamp-2">{s.description}</p>
 )}

 {/* Footer */}
 <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
 <div className="flex items-center gap-2">
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${GRADE_COLORS[s.grade_level]}`}>
 {s.grade_level === 'Both' ? 'G11 & G12' : s.grade_level}
 </span>
 </div>
 <div className="flex items-center gap-3 text-xs text-slate-400">
 <span className="flex items-center gap-1">
 <Layers size={11}/>{s.units} unit{s.units!==1?'s':''}
 </span>
 {s.class_count > 0 && (
 <span className="flex items-center gap-1 text-green-600 font-semibold">
 {s.class_count} class{s.class_count!==1?'es':''}
 </span>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Summary cards at bottom */}
 {data && data.length > 0 && (
 <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { label: 'Total Subjects', value: data.length, color: 'blue' },
 { label: 'Grade 11', value: data.filter(s=>s.grade_level==='Grade 11'||s.grade_level==='Both').length, color: 'green' },
 { label: 'Grade 12', value: data.filter(s=>s.grade_level==='Grade 12'||s.grade_level==='Both').length, color: 'purple' },
 { label: 'Total Units', value: data.reduce((a,s)=>a+Number(s.units||0),0), color: 'amber' },
 ].map(({ label, value, color }) => (
 <div key={label} className={`card p-4 text-center border-t-2 ${
 color==='blue'?'border-blue-400':color==='green'?'border-green-400':color==='purple'?'border-purple-400':'border-amber-400'
 }`}>
 <p className={`text-2xl font-display font-bold ${
 color==='blue'?'text-blue-600':color==='green'?'text-green-600':color==='purple'?'text-purple-600':'text-amber-600'
 }`}>{value}</p>
 <p className="text-xs text-slate-500 font-semibold mt-1">{label}</p>
 </div>
 ))}
 </div>
 )}

 {/* Add / Edit Modal */}
 {modal && (
 <SubjectModal
 subject={modal === 'add' ? null : modal}
 onClose={() => setModal(null)}
 onSave={() => { setModal(null); qc.invalidateQueries(['subjects']); refetch() }}
 />
 )}

 {/* Delete Confirm */}
 {deleteTarget && (
 <DeleteSubjectModal
 subject={deleteTarget}
 onClose={() => setDeleteTarget(null)}
 onConfirm={handleDelete}
 deleting={deleting}
 />
 )}
 </div>
 )
}
