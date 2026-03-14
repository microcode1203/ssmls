import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
  User, Lock, Camera, Save, Eye, EyeOff,
  GraduationCap, BookOpen, Phone, MapPin,
  Calendar, Users, Briefcase, FileText,
  Shield, BadgeCheck, Mail, Hash
} from 'lucide-react'

// ─── Avatar Upload Component ────────────────────────────────────────────────
function AvatarSection({ profile, onUpdate }) {
  const [uploading, setUploading] = useState(false)
  const [preview,   setPreview]   = useState(profile?.avatarUrl || null)
  const fileRef = useRef()

  const getInitials = () =>
    `${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase()

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024)
      return toast.error('Image must be under 2MB.')
    if (!file.type.startsWith('image/'))
      return toast.error('Please select an image file.')

    setUploading(true)
    // Convert to base64 data URL (no external upload service needed)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      setPreview(dataUrl)
      try {
        await api.put('/settings/avatar', { avatarUrl: dataUrl })
        toast.success('Profile photo updated!')
        onUpdate({ avatarUrl: dataUrl })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update photo.')
        setPreview(profile?.avatarUrl || null)
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const roleColors = {
    admin:   'from-purple-500 to-purple-700',
    teacher: 'from-blue-500 to-blue-700',
    student: 'from-green-500 to-green-600',
  }
  const roleLabels = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' }

  return (
    <div className="card p-6 flex flex-col items-center text-center gap-4">
      {/* Avatar */}
      <div className="relative">
        <div className={`w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden
          ${!preview ? `bg-gradient-to-br ${roleColors[profile?.role] || 'from-slate-400 to-slate-600'}` : ''}`}>
          {preview
            ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
            : <span className="text-white text-2xl font-display font-bold">{getInitials()}</span>
          }
        </div>
        {/* Camera button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary-700 transition-colors border-2 border-white"
        >
          {uploading
            ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Camera size={14} className="text-white" />
          }
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Name & role */}
      <div>
        <h2 className="font-display font-bold text-slate-900 text-lg">
          {profile?.firstName} {profile?.lastName}
        </h2>
        <span className={`text-xs font-bold px-3 py-1 rounded-full mt-1 inline-block
          ${profile?.role==='admin' ? 'bg-purple-100 text-purple-700'
          : profile?.role==='teacher' ? 'bg-blue-100 text-blue-700'
          : 'bg-green-100 text-green-700'}`}>
          {roleLabels[profile?.role]}
        </span>
      </div>

      <div className="w-full pt-2 border-t border-slate-100 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-500">
          <Mail size={14} className="flex-shrink-0 text-slate-400"/>
          <span className="truncate">{profile?.email}</span>
        </div>
        {profile?.role === 'student' && profile?.lrn && (
          <div className="flex items-center gap-2 text-slate-500">
            <Hash size={14} className="flex-shrink-0 text-slate-400"/>
            <span>LRN: {profile.lrn}</span>
          </div>
        )}
        {profile?.role === 'teacher' && profile?.employeeId && (
          <div className="flex items-center gap-2 text-slate-500">
            <BadgeCheck size={14} className="flex-shrink-0 text-slate-400"/>
            <span>ID: {profile.employeeId}</span>
          </div>
        )}
        {profile?.lastLogin && (
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Shield size={12} className="flex-shrink-0"/>
            <span>Last login: {new Date(profile.lastLogin).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">Click the camera icon to change your photo. Max 2MB.</p>
    </div>
  )
}

// ─── Password Change Section ─────────────────────────────────────────────────
function PasswordSection() {
  const [form,    setForm]    = useState({ currentPassword:'', newPassword:'', confirmPassword:'' })
  const [show,    setShow]    = useState({ current:false, new:false, confirm:false })
  const [saving,  setSaving]  = useState(false)

  const strength = (pw) => {
    if (!pw) return { score: 0, label: '', color: '' }
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    const map = [
      { label:'Too short', color:'bg-red-400' },
      { label:'Weak',      color:'bg-red-400' },
      { label:'Fair',      color:'bg-amber-400' },
      { label:'Good',      color:'bg-blue-400' },
      { label:'Strong',    color:'bg-green-500' },
    ]
    return { score, ...map[score] }
  }
  const pw = strength(form.newPassword)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword)
      return toast.error('New passwords do not match.')
    if (form.newPassword.length < 8)
      return toast.error('Password must be at least 8 characters.')
    setSaving(true)
    try {
      await api.put('/settings/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      toast.success('Password changed successfully!')
      setForm({ currentPassword:'', newPassword:'', confirmPassword:'' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.')
    } finally { setSaving(false) }
  }

  const PwInput = ({ name, label, showKey }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show[showKey] ? 'text' : 'password'}
          className="input-field pr-10"
          value={form[name]}
          onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          required
        />
        <button type="button" onClick={() => setShow(p => ({ ...p, [showKey]: !p[showKey] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {show[showKey] ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
          <Lock size={18} className="text-amber-600"/>
        </div>
        <div>
          <h3 className="font-display font-bold text-slate-900">Change Password</h3>
          <p className="text-xs text-slate-400">Keep your account secure</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PwInput name="currentPassword" label="Current Password" showKey="current"/>
        <PwInput name="newPassword"     label="New Password"     showKey="new"/>

        {/* Strength indicator */}
        {form.newPassword && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1,2,3,4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300
                  ${i <= pw.score ? pw.color : 'bg-slate-100'}`}/>
              ))}
            </div>
            <p className={`text-xs font-semibold
              ${pw.score <= 1 ? 'text-red-500' : pw.score === 2 ? 'text-amber-500'
              : pw.score === 3 ? 'text-blue-500' : 'text-green-600'}`}>
              {pw.label}
            </p>
          </div>
        )}

        <PwInput name="confirmPassword" label="Confirm New Password" showKey="confirm"/>

        {/* Match indicator */}
        {form.confirmPassword && (
          <p className={`text-xs font-semibold flex items-center gap-1 ${form.newPassword === form.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
            {form.newPassword === form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
          </p>
        )}

        <div className="pt-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-1">Password requirements:</p>
          {[
            [/.{8,}/, 'At least 8 characters'],
            [/[A-Z]/, 'One uppercase letter'],
            [/[0-9]/, 'One number'],
            [/[^A-Za-z0-9]/, 'One special character (@, #, !, etc.)'],
          ].map(([regex, label]) => (
            <div key={label} className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${regex.test(form.newPassword) ? 'bg-green-500' : 'bg-slate-200'}`}/>
              <span className={`text-xs ${regex.test(form.newPassword) ? 'text-green-700' : 'text-slate-400'}`}>{label}</span>
            </div>
          ))}
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5">
          {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : <><Save size={15}/>Update Password</>}
        </button>
      </form>
    </div>
  )
}

// ─── Student Info Section ─────────────────────────────────────────────────────
function StudentInfoSection({ profile, onUpdate }) {
  const [form, setForm] = useState({
    birthday:       profile?.birthday?.slice(0,10) || '',
    address:        profile?.address        || '',
    phone:          profile?.studentPhone   || '',
    guardianName:   profile?.guardianName   || '',
    guardianPhone:  profile?.guardianPhone  || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.put('/settings/student-profile', form)
      toast.success('Personal info updated!')
      onUpdate(form)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update.')
    } finally { setSaving(false) }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
          <User size={18} className="text-green-600"/>
        </div>
        <div>
          <h3 className="font-display font-bold text-slate-900">Personal Information</h3>
          <p className="text-xs text-slate-400">Your details visible to your adviser and admin</p>
        </div>
      </div>

      {/* Read-only academic info */}
      <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-100 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Grade Level</p>
          <p className="text-sm font-bold text-slate-800">{profile?.gradeLevel || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Section</p>
          <p className="text-sm font-bold text-slate-800">{profile?.sectionName || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Strand</p>
          <p className="text-sm font-bold text-slate-800">{profile?.strand || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">LRN</p>
          <p className="text-sm font-bold text-slate-800 font-mono">{profile?.lrn || '—'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Calendar size={13}/>Birthday</span>
          </label>
          <input type="date" className="input-field" value={form.birthday} onChange={e=>setForm(p=>({...p,birthday:e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Phone size={13}/>Phone Number</span>
          </label>
          <input type="tel" className="input-field" placeholder="09XX-XXX-XXXX" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5"><MapPin size={13}/>Home Address</span>
          </label>
          <textarea className="input-field h-20 resize-none" placeholder="Barangay, City, Province" value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}/>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Guardian Information</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Users size={13}/>Guardian Name</span>
              </label>
              <input className="input-field" placeholder="Full name" value={form.guardianName} onChange={e=>setForm(p=>({...p,guardianName:e.target.value}))}/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><Phone size={13}/>Guardian Phone</span>
              </label>
              <input type="tel" className="input-field" placeholder="09XX-XXX-XXXX" value={form.guardianPhone} onChange={e=>setForm(p=>({...p,guardianPhone:e.target.value}))}/>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5">
          {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : <><Save size={15}/>Save Personal Info</>}
        </button>
      </form>
    </div>
  )
}

// ─── Teacher Info Section ─────────────────────────────────────────────────────
function TeacherInfoSection({ profile, onUpdate }) {
  const [form, setForm] = useState({
    phone:      profile?.teacherPhone || '',
    department: profile?.department   || '',
    bio:        profile?.bio          || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await api.put('/settings/teacher-profile', form)
      toast.success('Profile updated!')
      onUpdate(form)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update.')
    } finally { setSaving(false) }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
          <Briefcase size={18} className="text-blue-600"/>
        </div>
        <div>
          <h3 className="font-display font-bold text-slate-900">Professional Information</h3>
          <p className="text-xs text-slate-400">Visible to school administration</p>
        </div>
      </div>

      {/* Read-only IDs */}
      <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-100 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Employee ID</p>
          <p className="text-sm font-bold text-slate-800 font-mono">{profile?.employeeId || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-0.5">Email</p>
          <p className="text-sm font-bold text-slate-800 truncate">{profile?.email || '—'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Briefcase size={13}/>Department</span>
          </label>
          <input className="input-field" placeholder="e.g. Senior High School" value={form.department} onChange={e=>setForm(p=>({...p,department:e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Phone size={13}/>Contact Number</span>
          </label>
          <input type="tel" className="input-field" placeholder="09XX-XXX-XXXX" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5"><FileText size={13}/>Short Bio</span>
          </label>
          <textarea
            className="input-field h-28 resize-none"
            placeholder="Brief introduction about yourself, your teaching experience, specializations…"
            value={form.bio}
            onChange={e=>setForm(p=>({...p,bio:e.target.value}))}
            maxLength={500}
          />
          <p className="text-xs text-slate-400 text-right mt-1">{form.bio.length}/500</p>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5">
          {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : <><Save size={15}/>Save Profile</>}
        </button>
      </form>
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth()
  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [activeTab, setActiveTab] = useState('profile')

  useEffect(() => {
    api.get('/settings/profile')
      .then(r => setProfile(r.data.data))
      .catch(() => toast.error('Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [])

  const updateProfile = (patch) => setProfile(p => ({ ...p, ...patch }))

  const tabs = {
    admin: [
      { id:'profile',  label:'Profile & Photo', icon: User },
      { id:'password', label:'Password',         icon: Lock },
    ],
    teacher: [
      { id:'profile',  label:'Profile & Photo',  icon: User },
      { id:'info',     label:'Personal Info',     icon: Briefcase },
      { id:'password', label:'Password',          icon: Lock },
    ],
    student: [
      { id:'profile',  label:'Profile & Photo',  icon: User },
      { id:'info',     label:'Personal Info',     icon: GraduationCap },
      { id:'password', label:'Password',          icon: Lock },
    ],
  }

  const currentTabs = tabs[user?.role] || tabs.student

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account settings and personal information.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — Avatar always visible */}
        <div className="lg:w-64 flex-shrink-0 space-y-4">
          {profile && (
            <AvatarSection profile={profile} onUpdate={updateProfile}/>
          )}

          {/* Tab nav */}
          <div className="card p-2">
            {currentTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all
                  ${activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <tab.icon size={16}/>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right column — Tab content */}
        <div className="flex-1 min-w-0">
          {/* Profile tab — same for all roles (just avatar info, handled in left col) */}
          {activeTab === 'profile' && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User size={18} className="text-primary"/>
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900">Account Overview</h3>
                  <p className="text-xs text-slate-400">Your account details</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label:'Full Name',  value:`${profile?.firstName} ${profile?.lastName}`, icon: User },
                  { label:'Email',      value: profile?.email,       icon: Mail },
                  { label:'Role',       value: profile?.role?.toUpperCase(), icon: Shield },
                  ...(profile?.lrn        ? [{ label:'LRN',         value: profile.lrn,        icon: Hash }] : []),
                  ...(profile?.employeeId ? [{ label:'Employee ID',  value: profile.employeeId, icon: BadgeCheck }] : []),
                  ...(profile?.gradeLevel ? [{ label:'Grade Level',  value: profile.gradeLevel, icon: GraduationCap }] : []),
                  ...(profile?.sectionName? [{ label:'Section',      value: profile.sectionName,icon: BookOpen }] : []),
                  ...(profile?.strand     ? [{ label:'Strand',       value: profile.strand,     icon: BookOpen }] : []),
                  ...(profile?.department ? [{ label:'Department',   value: profile.department, icon: Briefcase }] : []),
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <Icon size={15} className="text-slate-400 flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-medium">{label}</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{value || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs text-amber-700 font-semibold">
                  💡 Use the camera icon on your profile photo to update your picture. Click the tabs on the left to edit other settings.
                </p>
              </div>
            </div>
          )}

          {/* Info tab */}
          {activeTab === 'info' && user?.role === 'student' && (
            <StudentInfoSection profile={profile} onUpdate={updateProfile}/>
          )}
          {activeTab === 'info' && user?.role === 'teacher' && (
            <TeacherInfoSection profile={profile} onUpdate={updateProfile}/>
          )}

          {/* Password tab */}
          {activeTab === 'password' && <PasswordSection/>}
        </div>
      </div>
    </div>
  )
}
