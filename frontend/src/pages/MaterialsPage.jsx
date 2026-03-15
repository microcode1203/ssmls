/* @v2-fixed-imports */
import { useState, useEffect, useRef } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
 Upload, FileText, X, Plus, ExternalLink,
 Link, BookOpen, Trash2, Download, Eye,
 FileVideo, File, Presentation
} from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

// ─── Dedup helper — one entry per subject+section ────────────────────────────
const dedupeSchedules = (schedules) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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

// ─── File type config ─────────────────────────────────────────────────────────
const TYPE_CONFIG = {
 PDF: { icon: FileText, bg: 'bg-red-50', color: 'text-red-600', label: 'PDF' },
 DOCX: { icon: FileText, bg: 'bg-blue-50', color: 'text-blue-600', label: 'DOCX' },
 PPTX: { icon: FileText, bg: 'bg-amber-50', color: 'text-amber-600', label: 'PPTX' },
 VIDEO: { icon: FileVideo, bg: 'bg-purple-50', color: 'text-purple-600', label: 'Video' },
 LINK: { icon: Link, bg: 'bg-emerald-50',color: 'text-emerald-600',label: 'Link' },
 OTHER: { icon: File, bg: 'bg-slate-50', color: 'text-slate-500', label: 'File' },
}

export default function MaterialsPage() {
 const { user } = useAuth()
 const qc = useQueryClient()
 const [modal, setModal] = useState(false)
 const [filter, setFilter] = useState('')
 const [form, setForm] = useState({
 scheduleId: '', title: '', description: '', fileUrl: '', fileType: 'PDF'
 })
 const [saving, setSaving] = useState(false)
 const [confirm, setConfirm] = useState(null)

 const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

 const { data: materials, isLoading } = useQuery({
 queryKey: ['materials'],
 queryFn: () => api.get('/materials').then(r => r.data.data),
 staleTime: 0,
 })

 const { data: mySchedules } = useQuery({
 queryKey: ['my-schedules-mat'],
 queryFn: () => api.get('/schedules/my').then(r => r.data.data),
 enabled: !!user && user.role === 'teacher',
 })

 const handleSave = async (e) => {
 e.preventDefault()
 if (!form.fileUrl.trim())
 return toast.error('Please enter a file URL or link.')
 setSaving(true)
 try {
 await api.post('/materials', form)
 toast.success('Material uploaded.')
 setModal(false)
 setForm({ scheduleId:'', title:'', description:'', fileUrl:'', fileType:'PDF' })
 qc.invalidateQueries(['materials'])
 } catch (err) {
 toast.error(err.response?.data?.message || 'Failed to upload.')
 } finally { setSaving(false) }
 }

 const handleDelete = async (id) => {
 setConfirm({
 title: 'Delete Material?',
 message: 'This material will be removed for all students.',
 confirmLabel: 'Delete', variant: 'danger',
 onConfirm: async () => {
 try {
 await api.delete(`/materials/${id}`)
 toast.success('Material deleted.')
 qc.invalidateQueries(['materials'])
 } catch { toast.error('Failed to delete.') }
 }
 })
 }

 const openModal = () => {
 setForm({ scheduleId:'', title:'', description:'', fileUrl:'', fileType:'PDF' })
 setModal(true)
 }

 // Filter materials by type
 const filtered = (materials || []).filter(m =>
 !filter || m.file_type === filter
 )

 // Unique types present in data
 const typesPresent = [...new Set((materials || []).map(m => m.file_type).filter(Boolean))]

 return (
 <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">

 {/* Header */}
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Learning Materials</h1>
 <p className="text-slate-500 text-sm mt-1">
 {materials?.length || 0} material{materials?.length !== 1 ? 's' : ''} shared
 </p>
 </div>
 {user?.role === 'teacher' && (
 <button onClick={openModal} className="btn-primary">
 <Plus size={16}/> Upload Material
 </button>
 )}
 </div>

 {/* Type filter tabs */}
 {typesPresent.length > 1 && (
 <div className="flex gap-2 mb-5 flex-wrap">
 <button
 onClick={() => setFilter('')}
 className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all
 ${!filter ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'}`}>
 All ({materials?.length || 0})
 </button>
 {typesPresent.map(type => {
 const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.OTHER
 const count = (materials || []).filter(m => m.file_type === type).length
 return (
 <button key={type}
 onClick={() => setFilter(type)}
 className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all
 ${filter === type ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'}`}>
 {cfg.label} ({count})
 </button>
 )
 })}
 </div>
 )}

 {/* Materials grid */}
 {isLoading ? <CardGridSkeleton count={6}/> : filtered.length === 0 ? (
 <div className="card p-16 text-center text-slate-400">
 <BookOpen size={36} className="mx-auto mb-3 opacity-20"/>
 <p className="font-semibold">No materials yet.</p>
 {user?.role === 'teacher' && (
 <p className="text-xs mt-1">Click"Upload Material"to share resources with your students.</p>
 )}
 </div>
 ) : (
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filtered.map(m => {
 const cfg = TYPE_CONFIG[m.file_type] || TYPE_CONFIG.OTHER
 const Icon = cfg.icon
 return (
 <div key={m.id} className="card p-5 hover:shadow-md transition-all flex flex-col gap-3 group">
 {/* Top */}
 <div className="flex items-start gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
 <Icon size={18} className={cfg.color}/>
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-bold text-slate-900 text-sm leading-snug">{m.title}</h3>
 <p className="text-xs text-primary font-semibold mt-0.5">{m.subject_name}</p>
 {m.section_name && (
 <p className="text-xs text-slate-400">{m.grade_level} · {m.section_name}</p>
 )}
 </div>
 {/* Type badge */}
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
 {cfg.label}
 </span>
 </div>

 {/* Description */}
 {m.description && (
 <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{m.description}</p>
 )}

 {/* Footer */}
 <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
 <p className="text-xs text-slate-400">
 By {m.first_name} {m.last_name}
 </p>
 <div className="flex items-center gap-1.5">
 {m.file_url && (
 <a
 href={m.file_url}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-1 text-xs font-bold text-primary hover:underline px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors">
 <ExternalLink size={12}/> Open
 </a>
 )}
 {(user?.role === 'teacher' || user?.role === 'admin') && (
 <button
 onClick={() => handleDelete(m.id)}
 className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
 <Trash2 size={13}/>
 </button>
 )}
 </div>
 </div>
 </div>
 )
 })}
 </div>
 )}

 <ConfirmDialog {...confirm} onClose={() => setConfirm(null)}/>
 {/* Upload Modal */}
 {modal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
 <Upload size={16} className="text-primary"/>
 </div>
 <h2 className="font-display font-bold text-slate-900">Upload Material</h2>
 </div>
 <button onClick={() => setModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
 <X size={18}/>
 </button>
 </div>

 <form onSubmit={handleSave} className="p-5 space-y-4">
 {/* Class */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Class <span className="text-red-500">*</span>
 </label>
 <select className="input-field"value={form.scheduleId} onChange={set('scheduleId')} required>
 <option value="">— Select class —</option>
 {dedupeSchedules(mySchedules).map(s => (
 <option key={String(s.subject_id || s.id) + '_' + String(s.section_id)} value={s.id}>
 {s.subject || s.subject_name} · {s.grade_level} {s.section_name}
 </option>
 ))}
 </select>
 {!mySchedules?.length && (
 <p className="text-xs text-amber-600 mt-1 font-medium">
 ⚠ No approved schedules found. Ask admin to approve your schedules first.
 </p>
 )}
 </div>

 {/* Title */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Title <span className="text-red-500">*</span>
 </label>
 <input
 className="input-field"
 placeholder="e.g. Chapter 3 — Cell Division Notes"
 value={form.title}
 onChange={set('title')}
 required
 />
 </div>

 {/* Type */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">File Type</label>
 <div className="grid grid-cols-5 gap-2">
 {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'OTHER').map(([val, cfg]) => {
 const Icon = cfg.icon
 return (
 <button key={val} type="button"
 onClick={() => setForm(p => ({ ...p, fileType: val }))}
 className={`py-2.5 px-1 rounded-xl text-[11px] font-bold border-2 flex flex-col items-center gap-1 transition-all
 ${form.fileType === val
 ? 'border-primary bg-primary/5 text-primary'
 : 'border-slate-200 text-slate-500 hover:border-primary/40'}`}>
 <Icon size={15}/>
 {cfg.label}
 </button>
 )
 })}
 </div>
 </div>

 {/* File URL */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 File URL <span className="text-red-500">*</span>
 <span className="ml-1 text-xs font-normal text-slate-400">
 (Google Drive, OneDrive, YouTube, etc.)
 </span>
 </label>
 <input
 type="url"
 className="input-field"
 placeholder="https://drive.google.com/file/d/..."
 value={form.fileUrl}
 onChange={set('fileUrl')}
 required
 />
 <p className="text-xs text-slate-400 mt-1">
 Upload your file to Google Drive and paste the shareable link here.
 </p>
 </div>

 {/* Description */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Description
 <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
 </label>
 <textarea
 className="input-field h-20 resize-none"
 placeholder="Brief description of this material…"
 value={form.description}
 onChange={set('description')}
 />
 </div>

 <div className="flex gap-3 pt-1">
 <button type="button"onClick={() => setModal(false)} className="btn-secondary flex-1 justify-center">
 Cancel
 </button>
 <button type="submit"disabled={saving} className="btn-primary flex-1 justify-center">
 {saving
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
 : <><Upload size={15}/>Upload Material</>
 }
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 )
}
