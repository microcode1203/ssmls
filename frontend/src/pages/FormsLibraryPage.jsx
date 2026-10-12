import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { FileText, Upload, Download, Trash2, Search, X, FolderOpen, Wand2, Info, FileCheck2 } from 'lucide-react'
import { TableSkeleton } from '../components/ui/Skeleton'
import Modal from '../components/ui/Modal'
import { useConfirm } from '../hooks/useConfirm'
import { format } from 'date-fns'

const MAX_FILE_BYTES = 6 * 1024 * 1024 // 6MB — blank templates (DOCX/PDF) with letterheads can be a bit larger

const CATEGORIES = [
  { value: 'deped_form',   label: 'DepEd School Form' },
  { value: 'request_form', label: 'Request Form' },
  { value: 'health_form',  label: 'Health Form' },
  { value: 'enrollment',   label: 'Enrollment Form' },
  { value: 'other',        label: 'Other' },
]
const catLabel = (v) => CATEGORIES.find(c => c.value === v)?.label || 'Other'
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result.split(',')[1])
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const fmtSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const downloadBase64 = (fileData, fileName, fileType) => {
  const a = document.createElement('a')
  a.href = `data:${fileType || 'application/octet-stream'};base64,${fileData}`
  a.download = fileName
  a.click()
}

// ─── Placeholder reference, shown while an admin is designing a template ─────
function FieldReference() {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['form-fields'],
    queryFn: () => api.get('/forms/fields').then(r => r.data.data),
    staleTime: Infinity,
  })

  return (
    <div className="border border-blue-100 bg-blue-50 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-blue-700">
        <Info size={14}/> Available placeholder tags for auto-fill {open ? '▲' : '▼'}
      </button>
      {open && data && (
        <div className="px-3 pb-3 space-y-2 text-xs text-blue-800">
          <p>Put these inside your .docx using double curly braces, e.g. <code className="bg-white px-1 rounded">{'{{student_name}}'}</code>. They'll be replaced automatically when a teacher generates the form for a student.</p>
          {Object.entries(data).map(([group, fields]) => (
            <div key={group}>
              <p className="font-bold uppercase tracking-wide text-[10px] text-blue-500 mt-1.5">{group.replace('_', ' ')}</p>
              <p className="font-mono text-[11px] leading-relaxed break-words">
                {fields.map(f => `{{${f}}}`).join('  ')}
              </p>
            </div>
          ))}
          <p className="italic text-blue-500">Only .docx files support auto-fill. PDF/Excel forms can still be uploaded, but only as blank downloads.</p>
        </div>
      )}
    </div>
  )
}

function UploadModal({ onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('deped_form')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    if (f.size > MAX_FILE_BYTES) { setError('File too large. Maximum size is 6MB.'); return }
    setFile(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return toast.error('Please give the form a title.')
    if (!file) return toast.error('Please attach the form file.')
    setSaving(true)
    try {
      const fileData = await toBase64(file)
      await api.post('/forms', {
        title: title.trim(),
        category,
        description: description.trim() || null,
        fileData, fileName: file.name, fileType: file.type, fileSize: file.size,
      })
      toast.success('Form uploaded to the library.')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload form.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} closeOnEscape={!saving} closeOnBackdrop={!saving}>
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-slate-800">Upload Form Template</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Upload a .docx with placeholder tags (e.g. SF9, SF10) so teachers can auto-fill it per student —
          or upload a plain PDF/Excel form for blank download only.
        </p>

        <FieldReference/>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Form Title</label>
          <input className="input-field" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. SF9 - Report Card" required/>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
          <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (optional)</label>
          <textarea className="input-field" rows={2} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Notes on when/how this form is used"/>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">File</label>
          <input type="file" onChange={handleFile}
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:font-semibold hover:file:bg-primary/20"/>
          {file && <p className="text-xs text-slate-500 mt-1.5">{file.name} · {fmtSize(file.size)}</p>}
          {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5">
          {saving ? 'Uploading…' : <><Upload size={16}/> Upload Form</>}
        </button>
      </form>
      </div>
    </Modal>
  )
}

// ─── Generate/fill modal — teacher picks a class + student (+ optional quarter) ─
function GenerateModal({ form, onClose }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [scheduleId, setScheduleId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentId, setStudentId] = useState('')
  const [quarter, setQuarter] = useState('')
  const [generating, setGenerating] = useState(false)

  const { data: schedules } = useQuery({
    queryKey: ['my-schedules-forms'],
    queryFn: () => api.get('/schedules/my').then(r => r.data.data),
    enabled: !isAdmin,
  })
  const selectedSchedule = schedules?.find(s => String(s.id) === String(scheduleId))

  const { data: students } = useQuery({
    queryKey: ['students-for-form', isAdmin, selectedSchedule?.section_id, studentSearch],
    queryFn: () => isAdmin
      ? api.get('/students', { params: { search: studentSearch || undefined } }).then(r => r.data.data)
      : api.get('/students', { params: { sectionId: selectedSchedule.section_id } }).then(r => r.data.data),
    enabled: isAdmin ? studentSearch.length > 1 : !!selectedSchedule,
  })

  const handleGenerate = async () => {
    if (!studentId) return toast.error('Please select a student.')
    setGenerating(true)
    try {
      const res = await api.post(`/forms/${form.id}/generate`, {
        studentId, scheduleId: scheduleId || undefined, quarter: quarter || undefined,
      })
      const { fileData, fileName, fileType } = res.data.data
      downloadBase64(fileData, fileName, fileType)
      toast.success('Form generated and downloaded.')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate form.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Modal onClose={onClose} closeOnEscape={!generating} closeOnBackdrop={!generating}>
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-slate-800">Fill "{form.title}"</h3>
            <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            The template's placeholders will be auto-filled from this student's registration, attendance, and grade records.
          </p>

          {!isAdmin && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Class</label>
              <select className="input-field" value={scheduleId} onChange={e => { setScheduleId(e.target.value); setStudentId('') }}>
                <option value="">— Select a class —</option>
                {(schedules || []).map(s => (
                  <option key={s.id} value={s.id}>{s.subject || s.subject_name} · {s.grade_level} {s.section_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student</label>
            {isAdmin ? (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input className="input-field pl-8" placeholder="Search by name or LRN…"
                    value={studentSearch} onChange={e => { setStudentSearch(e.target.value); setStudentId('') }}/>
                </div>
                {students?.length > 0 && (
                  <div className="mt-1.5 border border-slate-100 rounded-lg max-h-40 overflow-y-auto">
                    {students.map(s => (
                      <button type="button" key={s.id}
                        onClick={() => { setStudentId(s.id); setStudentSearch(`${s.first_name} ${s.last_name} (${s.lrn})`) }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${String(studentId) === String(s.id) ? 'bg-primary/5 font-semibold' : ''}`}>
                        {s.first_name} {s.last_name} · LRN {s.lrn}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <select className="input-field" value={studentId} onChange={e => setStudentId(e.target.value)} disabled={!selectedSchedule}>
                <option value="">{selectedSchedule ? '— Select a student —' : 'Select a class first'}</option>
                {(students || []).map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · LRN {s.lrn}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quarter (optional)</label>
            <select className="input-field" value={quarter} onChange={e => setQuarter(e.target.value)}>
              <option value="">All quarters / not applicable</option>
              {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>

          <button onClick={handleGenerate} disabled={!studentId || generating} className="btn-primary w-full justify-center py-2.5">
            {generating ? 'Generating…' : <><Wand2 size={16}/> Generate & Download</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function FormsLibraryPage() {
  const [confirmDialog, ask] = useConfirm()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [generateFor, setGenerateFor] = useState(null)
  const qc = useQueryClient()

  const { data: forms, isLoading } = useQuery({
    queryKey: ['school-forms', category, search],
    queryFn: () => api.get('/forms', { params: { category: category || undefined, search: search || undefined } }).then(r => r.data.data),
  })

  const isAdmin = user?.role === 'admin'
  const canFill = user?.role === 'teacher' || user?.role === 'admin'

  const handleDownload = async (form) => {
    try {
      const res = await api.get(`/forms/${form.id}`)
      const { file_data, file_name, file_type } = res.data.data
      downloadBase64(file_data, file_name, file_type)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to download form.')
    }
  }

  const handleDelete = async (form) => {
    if (!(await ask({ title: 'Remove form?', message: `"${form.title}" will be removed from the library.`, confirmLabel: 'Remove' }))) return
    try {
      await api.delete(`/forms/${form.id}`)
      toast.success('Form removed.')
      qc.invalidateQueries(['school-forms'])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete form.')
    }
  }

  const grouped = (forms || []).reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f)
    return acc
  }, {})

  return (
    <div className="p-6 lg:p-8">
      {confirmDialog}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">Forms Library</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isAdmin
              ? 'Upload blank templates once — teachers auto-fill and download them per student.'
              : 'Download blank forms, or auto-fill a template with a student\'s own data.'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Upload size={16}/> Upload Form
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input className="input-field pl-9" placeholder="Search forms…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input-field sm:w-56" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="card p-6"><TableSkeleton cols={4} rows={6}/></div>
      ) : !forms?.length ? (
        <div className="card p-12 text-center text-slate-400">
          <FolderOpen size={32} className="mx-auto mb-3 opacity-30"/>
          <p className="font-semibold">No forms found</p>
          <p className="text-xs mt-1">{isAdmin ? 'Upload the first form template to get started.' : 'Check back later, or ask your admin to upload one.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{catLabel(cat)}</h3>
              <div className="card divide-y divide-slate-50">
                {items.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-4 hover:bg-slate-50/60 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-primary"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-slate-800 truncate">{f.title}</p>
                        {f.is_fillable && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">
                            <FileCheck2 size={10}/> Auto-fill
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {f.description ? `${f.description} · ` : ''}
                        {f.file_name} · {fmtSize(f.file_size)} · Uploaded by {f.uploader_first_name} {f.uploader_last_name} · {format(new Date(f.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {f.is_fillable && canFill && (
                        <button onClick={() => setGenerateFor(f)} className="p-2 hover:bg-green-50 text-green-600 rounded-lg" title="Fill for a student">
                          <Wand2 size={15}/>
                        </button>
                      )}
                      <button onClick={() => handleDownload(f)} className="p-2 hover:bg-primary/10 text-primary rounded-lg" title="Download blank">
                        <Download size={15}/>
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(f)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg" title="Remove">
                          <Trash2 size={15}/>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSaved={() => { setShowUpload(false); qc.invalidateQueries(['school-forms']) }}
        />
      )}

      {generateFor && (
        <GenerateModal form={generateFor} onClose={() => setGenerateFor(null)}/>
      )}
    </div>
  )
}
