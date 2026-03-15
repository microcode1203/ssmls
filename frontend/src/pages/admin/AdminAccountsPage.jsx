// @v2-fixed-imports
import { useState, useEffect } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, X, Trash2, KeyRound, Shield,
  Eye, EyeOff, Copy, Check, AlertTriangle,
  Crown, Mail, Calendar
} from 'lucide-react'

const CONFIRM_PHRASE = 'DELETE'

// ─── Add Admin Modal ──────────────────────────────────────────────────────────
function AddAdminModal({ onClose, onSave }) {
  const [form,    setForm]    = useState({ firstName:'', lastName:'', email:'', password:'', confirmPassword:'' })
  const [showPw,  setShowPw]  = useState(false)
  const [saving,  setSaving]  = useState(false)

  const set = (name) => (e) => setForm(p => ({ ...p, [name]: e.target.value }))

  const pwStrength = (pw) => {
    if (!pw) return { score: 0, label: '', color: '' }
    let s = 0
    if (pw.length >= 8)          s++
    if (/[A-Z]/.test(pw))        s++
    if (/[0-9]/.test(pw))        s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    const map = [
      { label:'Too short', color:'bg-red-400' },
      { label:'Weak',      color:'bg-red-400' },
      { label:'Fair',      color:'bg-amber-400' },
      { label:'Good',      color:'bg-blue-400' },
      { label:'Strong',    color:'bg-green-500' },
    ]
    return { score: s, ...map[s] }
  }
  const strength = pwStrength(form.password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword)
      return toast.error('Passwords do not match.')
    if (form.password.length < 8)
      return toast.error('Password must be at least 8 characters.')
    setSaving(true)
    try {
      await api.post('/admin/admins', {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        password:  form.password,
      })
      toast.success(`Admin account created for ${form.firstName} ${form.lastName}.`)
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create admin.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex flex-col items-center justify-start py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Crown size={20} className="text-purple-600"/>
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-900">Add Admin Account</h2>
              <p className="text-xs text-slate-400">Full system access will be granted</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-amber-700 font-medium">
              Admin accounts have <strong>full access</strong> to all system data including student records, grades, and audit logs. Only create accounts for authorized personnel.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                First Name <span className="text-red-500">*</span>
              </label>
              <input className="input-field" value={form.firstName} onChange={set('firstName')} required/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input className="input-field" value={form.lastName} onChange={set('lastName')} required/>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="admin@ssmls.edu.ph"
              value={form.email}
              onChange={set('email')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set('password')}
                required
              />
              <button type="button" onClick={() => setShowPw(p=>!p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            {/* Strength bar */}
            {form.password && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i<=strength.score?strength.color:'bg-slate-100'}`}/>
                  ))}
                </div>
                <p className={`text-xs font-semibold ${strength.score<=1?'text-red-500':strength.score===2?'text-amber-500':strength.score===3?'text-blue-500':'text-green-600'}`}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              className={`input-field ${form.confirmPassword && form.password!==form.confirmPassword?'border-red-300 bg-red-50':form.confirmPassword&&form.password===form.confirmPassword?'border-green-400 bg-green-50':''}`}
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              required
            />
            {form.confirmPassword && (
              <p className={`text-xs font-semibold mt-1 ${form.password===form.confirmPassword?'text-green-600':'text-red-500'}`}>
                {form.password===form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              type="submit"
              disabled={saving || form.password !== form.confirmPassword || form.password.length < 8}
              className="btn-primary flex-1 justify-center"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Creating…</>
                : <><Crown size={15}/>Create Admin</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({ admin, onClose }) {
  const [password, setPassword]   = useState('')
  const [showPw,   setShowPw]     = useState(false)
  const [copied,   setCopied]     = useState(false)
  const [saving,   setSaving]     = useState(false)

  const generate = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'
    setPassword(Array.from({length:12}, ()=>chars[Math.floor(Math.random()*chars.length)]).join(''))
  }

  const copy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleReset = async () => {
    if (!password || password.length < 8) return toast.error('Password must be at least 8 characters.')
    setSaving(true)
    try {
      await api.patch(`/admin/admins/${admin.id}/reset-password`, { newPassword: password })
      toast.success(`Password reset for ${admin.first_name} ${admin.last_name}.`)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex flex-col items-center justify-start py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <KeyRound size={18} className="text-amber-600"/>
            </div>
            <h2 className="font-display font-bold text-slate-900">Reset Password</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Admin info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
              {admin?.first_name?.[0]}{admin?.last_name?.[0]}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">{admin?.first_name} {admin?.last_name}</p>
              <p className="text-xs text-slate-400">{admin?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPw?'text':'password'}
                className="input-field pr-20 font-mono"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button type="button" onClick={()=>setShowPw(p=>!p)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
                <button type="button" onClick={copy} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                  {copied ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                </button>
              </div>
            </div>
            <button type="button" onClick={generate} className="mt-1.5 text-xs font-semibold text-primary hover:underline">
              Generate random password
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleReset} disabled={saving||password.length<8} className="btn-primary flex-1 justify-center">
              {saving?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Resetting…</>:<><KeyRound size={15}/>Reset Password</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Admin Modal ───────────────────────────────────────────────────────
function DeleteAdminModal({ admin, onClose, onConfirm, deleting }) {
  const [phrase, setPhrase] = useState('')
  const isMatch = phrase === CONFIRM_PHRASE

  useEffect(() => {
    const fn = (e) => {
      if (e.key==='Escape') onClose()
      if (e.key==='Enter' && isMatch && !deleting) onConfirm()
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [isMatch, deleting])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto flex flex-col items-center justify-start py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Trash2 size={20} className="text-red-500"/>
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-900">Delete Admin Account</h2>
              <p className="text-xs text-slate-400">This cannot be undone</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-sm">
              {admin?.first_name?.[0]}{admin?.last_name?.[0]}
            </div>
            <div>
              <p className="font-bold text-slate-800">{admin?.first_name} {admin?.last_name}</p>
              <p className="text-xs text-slate-400">{admin?.email}</p>
            </div>
          </div>
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
            <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5"/>
            <p className="text-xs text-red-700 font-medium">
              This admin account will be permanently deactivated and lose all system access.
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Type <code className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">DELETE</code> to confirm
            </label>
            <input
              className={`input-field font-mono tracking-widest text-center text-lg ${phrase===''?'':isMatch?'border-green-400 bg-green-50 text-green-700':'border-red-300 bg-red-50 text-red-600'}`}
              placeholder="Type DELETE here"
              value={phrase}
              onChange={e=>setPhrase(e.target.value.toUpperCase())}
              autoFocus autoComplete="off" spellCheck={false}
            />
            {phrase.length>0 && (
              <p className={`text-xs font-semibold mt-1 ${isMatch?'text-green-600':'text-red-500'}`}>
                {isMatch ? '✓ Confirmed — press Enter or click Delete' : `${CONFIRM_PHRASE.length-phrase.length} more character(s)`}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              onClick={onConfirm}
              disabled={!isMatch||deleting}
              className={`flex-1 flex items-center justify-center gap-2 font-semibold text-sm px-4 py-2 rounded-lg transition-all
                ${isMatch&&!deleting?'bg-red-500 hover:bg-red-600 text-white':'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              {deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Deleting…</> : <><Trash2 size={14}/>Delete</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminAccountsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [addModal,     setAddModal]     = useState(false)
  const [resetTarget,  setResetTarget]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: () => api.get('/admin/admins').then(r => r.data.data),
    staleTime: 0,
  })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/admins/${deleteTarget.id}`)
      toast.success('Admin account deactivated.')
      setDeleteTarget(null)
      await qc.invalidateQueries(['admin-accounts'])
      await refetch()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete.')
    } finally { setDeleting(false) }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Admin Accounts</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage administrator accounts with full system access.
          </p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary">
          <Plus size={16}/> Add Admin
        </button>
      </div>

      {/* Info banner */}
      <div className="card p-4 mb-6 flex items-start gap-3 bg-purple-50 border-purple-200">
        <Shield size={18} className="text-purple-600 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-bold text-purple-800">Admin accounts have full access</p>
          <p className="text-xs text-purple-600 mt-0.5">
            All admin accounts can manage students, teachers, sections, schedules, grades, and view audit logs.
            Only create accounts for trusted school administrators.
          </p>
        </div>
      </div>

      {/* Admin list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
<TableSkeleton cols={6} rows={8}/>
        </div>
      ) : (
        <div className="space-y-3">
          {(data||[]).map(admin => (
            <div key={admin.id} className={`card p-5 flex items-center gap-4 flex-wrap
              ${admin.id === user?.id ? 'border-primary/30 bg-blue-50/30' : ''}`}>
              {/* Avatar */}
              <div className="w-11 h-11 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-700 flex-shrink-0">
                {admin.first_name?.[0]}{admin.last_name?.[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-900">{admin.first_name} {admin.last_name}</p>
                  {admin.id === user?.id && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">You</span>
                  )}
                  <span className="badge-green">{admin.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Mail size={11}/>{admin.email}
                  </span>
                  {admin.last_login && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Calendar size={11}/>
                      Last login: {new Date(admin.last_login).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar size={11}/>
                    Created: {new Date(admin.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {admin.id !== user?.id && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setResetTarget(admin)}
                    className="btn-secondary text-xs py-1.5 px-3"
                    title="Reset password"
                  >
                    <KeyRound size={13}/> Reset PW
                  </button>
                  <button
                    onClick={() => setDeleteTarget(admin)}
                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Delete account"
                  >
                    <Trash2 size={15}/>
                  </button>
                </div>
              )}
              {admin.id === user?.id && (
                <span className="text-xs text-slate-400 italic flex-shrink-0">Use Settings to edit your account</span>
              )}
            </div>
          ))}

          {!data?.length && (
            <div className="card p-12 text-center text-slate-400">
              <Crown size={32} className="mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">No admin accounts found.</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {addModal && (
        <AddAdminModal
          onClose={() => setAddModal(false)}
          onSave={() => { setAddModal(false); qc.invalidateQueries(['admin-accounts']); refetch() }}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          admin={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteAdminModal
          admin={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  )
}
