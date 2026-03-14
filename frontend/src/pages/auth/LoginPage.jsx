import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) return toast.error('Please enter email and password.')
    setLoading(true)
    try {
      const user = await login(form.email.trim(), form.password)
      toast.success(`Welcome back, ${user.firstName}!`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (role) => {
    const creds = {
      admin:   { email: 'admin@ssmls.edu.ph',         password: 'Admin@2026' },
      teacher: { email: 'mlcruz@ssmls.edu.ph',        password: 'Teacher@2026' },
      student: { email: 'juan.dela@student.ssmls.edu.ph', password: 'Student@2026' },
    }
    setForm(creds[role])
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/80 to-slate-900" />
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/20 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                <path d="M5 18L12 6L19 18H5Z" fill="white" fillOpacity="0.2"/>
                <path d="M9 18L12 12L15 18H9Z" fill="white"/>
                <circle cx="12" cy="6" r="2" fill="#60a5fa"/>
              </svg>
            </div>
            <div>
              <p className="font-display font-bold text-white text-lg">SSMLS</p>
              <p className="text-white/40 text-xs">Smart School Management System</p>
            </div>
          </div>

          <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
            Empowering<br />Senior High School
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-sm">
            A complete platform for QR attendance, smart scheduling, and digital learning management — all in one place.
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-4">
          {[
            { num: '1,248', lbl: 'Students Enrolled' },
            { num: '94.2%', lbl: 'Attendance Rate' },
            { num: '38',    lbl: 'Active Classes' },
            { num: '60s',   lbl: 'QR Refresh Rate' },
          ].map(({ num, lbl }) => (
            <div key={lbl} className="bg-white/8 rounded-xl p-4 border border-white/10">
              <p className="font-display text-2xl font-bold text-white">{num}</p>
              <p className="text-white/50 text-xs mt-1 font-medium">{lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M9 18L12 12L15 18H9Z" fill="white"/>
              </svg>
            </div>
            <span className="font-display font-bold text-slate-900">SSMLS</span>
          </div>

          <h2 className="font-display text-3xl font-bold text-slate-900 mb-2">Sign in</h2>
          <p className="text-slate-500 text-sm mb-8">Enter your school credentials to access the system.</p>

          {/* Demo credentials */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">Quick Demo Access</p>
            <div className="flex gap-2 flex-wrap">
              {['admin','teacher','student'].map(role => (
                <button
                  key={role}
                  onClick={() => fillDemo(role)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 capitalize transition-all"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@ssmls.edu.ph"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2 text-base"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
                : <><LogIn size={18} /> Sign In</>
              }
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            SSMLS © 2026 · Senior High School Capstone Project
          </p>
        </div>
      </div>
    </div>
  )
}
