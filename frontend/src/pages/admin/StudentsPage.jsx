import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, X, AlertTriangle, Shield } from 'lucide-react'

const CONFIRM_PHRASE = 'DELETE'

// ─── Add / Edit Student Modal ─────────────────────────────────────────────────
function StudentModal({ student, sections, onClose, onSave }) {
  const [form, setForm] = useState(student ? {
    firstName:    student.first_name     || '',
    lastName:     student.last_name      || '',
    email:        student.email          || '',
    lrn:          student.lrn            || '',
    gradeLevel:   student.grade_level    || 'Grade 11',
    sectionId:    student.section_id     || '',
    strand:       student.strand         || 'STEM',
    phone:        student.phone          || '',
    guardianName: student.guardian_name  || '',
    guardianPhone:student.guardian_phone || '',
  } : {
    firstName:'', lastName:'', email:'', lrn:'',
    gradeLevel:'Grade 11', sectionId:'', strand:'STEM',
    phone:'', guardianName:'', guardianPhone:''
  })
  const [saving, setSaving] = useState(false)

  const set = (name) => (e) => setForm(p => ({ ...p, [name]: e.target.value }))

  // Auto-fill Grade Level and Strand when section is selected
  const handleSectionChange = (e) => {
    const selectedId = e.target.value
    const selectedSection = (sections || []).find(s => String(s.id) === String(selectedId))
    setForm(p => ({
      ...p,
      sectionId:  selectedId,
      gradeLevel: selectedSection ? selectedSection.grade_level : p.gradeLevel,
      strand:     selectedSection ? selectedSection.strand      : p.strand,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">
            {student ? 'Edit Student' : 'Add Student'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
            <input className="input-field" value={form.firstName} onChange={set('firstName')} required />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name <span className="text-red-500">*</span></label>
            <input className="input-field" value={form.lastName} onChange={set('lastName')} required />
          </div>

          {!student && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email <span className="text-red-500">*</span></label>
              <input type="email" className="input-field" value={form.email} onChange={set('email')} required />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">LRN (12 digits) <span className="text-red-500">*</span></label>
            <input className="input-field" value={form.lrn} onChange={set('lrn')} maxLength={12} required />
          </div>

          {/* Section — full width, auto-fills grade & strand */}
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Section
              <span className="ml-2 text-xs font-normal text-primary">(auto-fills Grade & Strand)</span>
            </label>
            <select className="input-field" value={form.sectionId} onChange={handleSectionChange}>
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
            <input type="tel" className="input-field" placeholder="09XX-XXX-XXXX" value={form.phone} onChange={set('phone')} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guardian Name</label>
            <input className="input-field" value={form.guardianName} onChange={set('guardianName')} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guardian Phone</label>
            <input type="tel" className="input-field" placeholder="09XX-XXX-XXXX" value={form.guardianPhone} onChange={set('guardianPhone')} />
          </div>

          <div className="col-span-2 flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

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
              {student?.first_name?.[0]}{student?.last_name?.[0]}
            </div>
            <div>
              <p className="font-bold text-slate-800">{student?.first_name} {student?.last_name}</p>
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
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><polyline points="1,5 4,8 9,2" stroke="white" strokeWidth="2"/></svg>
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
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
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
  const qc = useQueryClient()
  const [search,        setSearch]        = useState('')
  const [grade,         setGrade]         = useState('')
  const [modal,         setModal]         = useState(null)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  const { data: students, isLoading } = useQuery({
    queryKey: ['students', search, grade],
    queryFn: () => api.get('/students', {
      params: { search, gradeLevel: grade }
    }).then(r => r.data.data),
    keepPreviousData: true,
  })

  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections').then(r => r.data.data),
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/students/${deleteTarget.id}`)
      toast.success(`${deleteTarget.first_name} ${deleteTarget.last_name}'s account has been deactivated.`)
      setDeleteTarget(null)
      qc.invalidateQueries(['students'])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete student.')
    } finally {
      setDeleting(false)
    }
  }

  const statusBadge = {
    active:      'badge-green',
    inactive:    'badge-slate',
    transferred: 'badge-amber',
    graduated:   'badge-blue',
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="text-slate-500 text-sm mt-1">{students?.length || 0} students found</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary">
          <Plus size={16}/> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            className="input-field pl-9"
            placeholder="Search by name or LRN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field w-40" value={grade} onChange={e => setGrade(e.target.value)}>
          <option value="">All Grades</option>
          <option>Grade 11</option>
          <option>Grade 12</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"/>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Student','LRN','Grade & Section','Strand','Status','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(students || []).map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{s.first_name} {s.last_name}</p>
                          <p className="text-xs text-slate-400">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.lrn}</td>
                    <td className="px-4 py-3 text-slate-600">{s.grade_level} · {s.section_name || '—'}</td>
                    <td className="px-4 py-3"><span className="badge-blue">{s.strand}</span></td>
                    <td className="px-4 py-3">
                      <span className={statusBadge[s.status] || 'badge-slate'}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal(s)}
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg"
                          title="Edit student"
                        >
                          <Edit2 size={14}/>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"
                          title="Delete student"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!students?.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">No students found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </div>
  )
}
