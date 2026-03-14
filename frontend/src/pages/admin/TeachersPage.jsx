import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, X, Trash2, AlertTriangle, Shield } from 'lucide-react'

const CONFIRM_PHRASE = 'DELETE'

// ─── Add Teacher Modal ────────────────────────────────────────────────────────
function TeacherModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    firstName:'', lastName:'', email:'',
    employeeId:'', department:'', phone:''
  })
  const [saving, setSaving] = useState(false)

  const set = (name) => (e) => setForm(p => ({ ...p, [name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/teachers', form)
      toast.success('Teacher created. Default password: Teacher@2026')
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create teacher.')
    } finally { setSaving(false) }
  }

  const fields = [
    ['firstName',  'First Name',  true],
    ['lastName',   'Last Name',   true],
    ['email',      'Email',       true],
    ['employeeId', 'Employee ID', true],
    ['department', 'Department',  false],
    ['phone',      'Phone',       false],
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">Add Teacher</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
          {fields.map(([name, label, required]) => (
            <div key={name}>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
              </label>
              <input
                className="input-field"
                type={name === 'email' ? 'email' : 'text'}
                value={form[name]}
                onChange={set(name)}
                required={required}
              />
            </div>
          ))}

          {/* Default password notice */}
          <div className="col-span-2 p-3 bg-amber-50 rounded-xl border border-amber-200 flex gap-2">
            <Shield size={15} className="text-amber-600 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700 font-medium">
              Default password will be <strong>Teacher@2026</strong>. The teacher should change it after first login.
            </p>
          </div>

          <div className="col-span-2 flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
                : 'Add Teacher'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirmation Modal with phrase ────────────────────────────────────
function DeleteTeacherModal({ teacher, onClose, onConfirm, deleting }) {
  const [phrase, setPhrase] = useState('')
  const isMatch = phrase === CONFIRM_PHRASE

  // Keyboard: Enter to confirm if phrase matches, Escape to cancel
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
              <h2 className="font-display font-bold text-slate-900">Delete Teacher Account</h2>
              <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={18}/>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Teacher info */}
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

          {/* Warning */}
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
            <div className="text-sm text-red-700 space-y-1">
              <p className="font-bold">This will deactivate the teacher's account.</p>
              <p className="text-xs text-red-600">
                The teacher will no longer be able to log in. All their schedules, attendance records, and grades will be preserved but they will lose access to the system.
              </p>
            </div>
          </div>

          {/* Phrase confirmation */}
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
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="white"><polyline points="1,5 4,8 9,2" strokeWidth="2" stroke="white" fill="none"/></svg>
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
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 justify-center"
            >
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
export default function TeachersPage() {
  const qc = useQueryClient()
  const [modal,         setModal]         = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleting,      setDeleting]      = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.get('/teachers').then(r => r.data.data)
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/teachers/${deleteTarget.id}`)
      toast.success(`${deleteTarget.first_name} ${deleteTarget.last_name}'s account has been deactivated.`)
      setDeleteTarget(null)
      qc.invalidateQueries(['teachers'])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete teacher.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="text-slate-500 text-sm mt-1">{data?.length || 0} teachers registered</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus size={16}/> Add Teacher
        </button>
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
                  {['Teacher','Employee ID','Department','Email','Status','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data || []).map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 group">
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
                      {/* Delete button — only show for active teachers */}
                      {t.is_active ? (
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg"
                          title="Delete teacher account"
                        >
                          <Trash2 size={15}/>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300 italic">Deactivated</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!isLoading && !data?.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No teachers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Teacher Modal */}
      {modal && (
        <TeacherModal
          onClose={() => setModal(false)}
          onSave={() => { setModal(false); qc.invalidateQueries(['teachers']) }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteTeacherModal
          teacher={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  )
}
