// @v2-fixed-imports
import { useState, useEffect } from 'react'
import { fullName, formalName, initials } from '../../utils/nameUtils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, X, Users, Edit2, Trash2, School, GraduationCap } from 'lucide-react'

// ─── Modal — defined OUTSIDE to prevent focus loss ───────────────────────────
function SectionModal({ section, onClose, onSave }) {
  const [form, setForm] = useState({
    sectionName: section?.section_name || '',
    gradeLevel:  section?.grade_level  || 'Grade 11',
    strand:      section?.strand       || 'STEM',
  })
  const [saving, setSaving] = useState(false)
  const isEdit = !!section

  const set = (name) => (e) => setForm(p => ({ ...p, [name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/sections/${section.id}`, form)
        toast.success('Section updated successfully.')
      } else {
        await api.post('/sections', form)
        toast.success('Section created successfully.')
      }
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save section.')
    } finally {
      setSaving(false)
    }
  }

  const strandColors = {
    STEM:  'bg-blue-100 text-blue-700',
    HUMSS: 'bg-purple-100 text-purple-700',
    ABM:   'bg-green-100 text-green-700',
    TVL:   'bg-amber-100 text-amber-700',
    GAS:   'bg-slate-100 text-slate-700',
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <School size={18} className="text-primary" />
            </div>
            <h2 className="font-display font-bold text-slate-900">
              {isEdit ? 'Edit Section' : 'Add New Section'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Section Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Section Name <span className="text-red-500">*</span>
            </label>
            <input
              className="input-field"
              placeholder="e.g. STEM-A, HUMSS-B"
              value={form.sectionName}
              onChange={set('sectionName')}
              required
            />
          </div>

          {/* Grade Level */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Grade Level <span className="text-red-500">*</span>
            </label>
            <select
              className="input-field"
              value={form.gradeLevel}
              onChange={set('gradeLevel')}
            >
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>

          {/* Strand */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Strand <span className="text-red-500">*</span>
            </label>
            <select
              className="input-field"
              value={form.strand}
              onChange={set('strand')}
            >
              {['STEM','HUMSS','ABM','TVL','GAS'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Preview badge */}
          {form.sectionName && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{form.sectionName}</p>
                <p className="text-xs text-slate-500">{form.gradeLevel} · {form.strand}</p>
              </div>
              <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${strandColors[form.strand]}`}>
                {form.strand}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 justify-center"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                : isEdit ? 'Save Changes' : 'Create Section'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ section, onClose, onConfirm, deleting }) {
  // Keyboard shortcuts: Enter = confirm delete, Escape = cancel
  useEffect(() => {
    const handleKey = (e) => {
      if (deleting) return
      if (e.key === 'Enter')  { e.preventDefault(); onConfirm() }
      if (e.key === 'Escape') { e.preventDefault(); onClose()   }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [deleting, onConfirm, onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg">Delete Section?</h3>
            <p className="text-slate-500 text-sm mt-1">
              Are you sure you want to delete{' '}
              <span className="font-bold text-slate-800">{section?.section_name}</span>?
            </p>
            <p className="text-xs text-red-500 mt-2 font-medium">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            <span className="flex items-center gap-1.5">
              Cancel
              <kbd className="text-xs bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono hidden sm:inline">Esc</kbd>
            </span>
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="btn-danger flex-1 justify-center"
          >
            {deleting
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting…</>
              : <span className="flex items-center gap-1.5">
                  <Trash2 size={14} />Delete
                  <kbd className="text-xs bg-red-400/30 border border-red-300/50 rounded px-1.5 py-0.5 font-mono hidden sm:inline">Enter</kbd>
                </span>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Strand colors & grade colors ────────────────────────────────────────────
const strandColor = {
  STEM:  'bg-blue-100 text-blue-700 border-blue-200',
  HUMSS: 'bg-purple-100 text-purple-700 border-purple-200',
  ABM:   'bg-green-100 text-green-700 border-green-200',
  TVL:   'bg-amber-100 text-amber-700 border-amber-200',
  GAS:   'bg-slate-100 text-slate-600 border-slate-200',
}
const strandBg = {
  STEM:  'from-blue-50',
  HUMSS: 'from-purple-50',
  ABM:   'from-green-50',
  TVL:   'from-amber-50',
  GAS:   'from-slate-50',
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SectionsPage() {
  const qc = useQueryClient()
  const [modal,      setModal]      = useState(null)  // null | 'add' | section obj
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,   setDeleting]   = useState(false)
  const [filterGrade, setFilterGrade] = useState('')
  const [filterStrand, setFilterStrand] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections').then(r => r.data.data),
    staleTime: 0,              // always treat as stale
    refetchOnWindowFocus: true, // refetch when tab regains focus
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/sections/${deleteTarget.id}`)
      toast.success('Section deleted.')
      setDeleteTarget(null)
      // Invalidate AND immediately refetch so deleted section disappears at once
      await qc.invalidateQueries(['sections'])
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete section.')
    } finally {
      setDeleting(false)
    }
  }

  // Filter sections
  const filtered = (data || []).filter(s => {
    if (filterGrade  && s.grade_level !== filterGrade)  return false
    if (filterStrand && s.strand      !== filterStrand) return false
    return true
  })

  // Group by grade level
  const grade11 = filtered.filter(s => s.grade_level === 'Grade 11')
  const grade12 = filtered.filter(s => s.grade_level === 'Grade 12')

  const SectionCard = ({ s }) => (
    <div className={`card p-5 hover:shadow-md transition-all duration-200 group relative overflow-hidden bg-gradient-to-br ${strandBg[s.strand] || 'from-slate-50'} to-white`}>
      {/* Action buttons — visible on hover */}
      <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setModal(s)}
          className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-slate-500 hover:text-blue-600 transition-colors"
          title="Edit section"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={() => setDeleteTarget(s)}
          className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-500 transition-colors"
          title="Delete section"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Card content */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0 pr-14">
          <h3 className="font-display font-bold text-slate-900 text-base leading-tight">
            {s.section_name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{s.grade_level}</p>
        </div>
      </div>

      {/* Strand badge */}
      <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${strandColor[s.strand] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
        {s.strand}
      </span>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-500 text-sm">
          <Users size={13} className="text-slate-400" />
          <span className="font-semibold text-slate-700">{s.student_count}</span>
          <span className="text-xs">student{s.student_count !== 1 ? 's' : ''}</span>
        </div>
        {s.first_name && (
          <p className="text-xs text-slate-400 truncate max-w-24">
            {fullName(s.first_name, s.middle_name, s.last_name)}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Sections</h1>
          <p className="text-slate-500 text-sm mt-1">
            {data?.length || 0} sections · {data?.reduce((a, s) => a + Number(s.student_count || 0), 0) || 0} total students
          </p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary">
          <Plus size={16} /> Add Section
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex gap-3 flex-wrap">
        <select
          className="input-field w-40"
          value={filterGrade}
          onChange={e => setFilterGrade(e.target.value)}
        >
          <option value="">All Grades</option>
          <option>Grade 11</option>
          <option>Grade 12</option>
        </select>
        <select
          className="input-field w-40"
          value={filterStrand}
          onChange={e => setFilterStrand(e.target.value)}
        >
          <option value="">All Strands</option>
          {['STEM','HUMSS','ABM','TVL','GAS'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {(filterGrade || filterStrand) && (
          <button
            onClick={() => { setFilterGrade(''); setFilterStrand('') }}
            className="btn-secondary text-xs"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grade 11 */}
          {grade11.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Grade 11</span>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="badge-blue">{grade11.length} sections</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grade11.map(s => <SectionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {/* Grade 12 */}
          {grade12.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Grade 12</span>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="badge-green">{grade12.length} sections</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grade12.map(s => <SectionCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="card p-16 text-center text-slate-400">
              <School size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No sections found.</p>
              <p className="text-xs mt-1">Try changing the filters or add a new section.</p>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <SectionModal
          section={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null)
            qc.invalidateQueries(['sections'])
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DeleteModal
          section={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  )
}
