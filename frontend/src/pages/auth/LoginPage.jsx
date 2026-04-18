// LoginPage.jsx — Redesigned v3
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowRight, Zap, Shield, BarChart2, Users } from 'lucide-react'

const STATS = [
  { value: '500+', label: 'Students managed' },
  { value: '99.9%', label: 'Uptime guaranteed' },
  { value: '4.9★', label: 'Teacher rating' },
]

const FEATURES = [
  { icon: Zap,      label: 'QR Attendance',    desc: 'Instant scanning' },
  { icon: BarChart2, label: 'Grade Analytics',  desc: 'DepEd formula' },
  { icon: Shield,   label: 'Anti-Cheat Exams', desc: 'Fullscreen locked' },
  { icon: Users,    label: 'Parent Portal',     desc: 'Real-time alerts' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) return toast.error('Please fill in all fields.')
    setLoading(true)
    try {
      const user = await login(form.email.trim(), form.password)
      toast.success(`Welcome back, ${user.firstName}!`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials.')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-root">
      {/* ── Left — Brand Panel ── */}
      <div className="login-left">
        {/* Top bar */}
        <div className="login-topbar">
          <div className="login-logo-mark">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="login-brand-text">S.S.M.L.S</span>
          <span className="login-version-badge">v3.0</span>
        </div>

        {/* Main content */}
        <div className="login-left-content">
          <div className="login-eyebrow">
            <span className="login-eyebrow-dot"/>
            Philippine Senior High School Platform
          </div>

          <h1 className="login-headline">
            The smarter way to<br/>
            <span className="login-headline-accent">run your school.</span>
          </h1>

          <p className="login-subheadline">
            Attendance, grades, schedules, and learning — unified in one platform built for DepEd.
          </p>

          {/* Stats row */}
          <div className="login-stats">
            {STATS.map(({ value, label }) => (
              <div key={label} className="login-stat">
                <span className="login-stat-value">{value}</span>
                <span className="login-stat-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Feature grid */}
          <div className="login-features">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="login-feature">
                <div className="login-feature-icon">
                  <Icon size={14}/>
                </div>
                <div>
                  <p className="login-feature-label">{label}</p>
                  <p className="login-feature-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="login-left-footer">© 2026 S.S.M.L.S · Capstone Project</p>
      </div>

      {/* ── Right — Form Panel ── */}
      <div className="login-right">
        <div className="login-form-card">
          {/* Mobile logo */}
          <div className="login-mobile-logo">
            <div className="login-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>S.S.M.L.S</span>
          </div>

          <div className="login-form-header">
            <h2 className="login-form-title">Sign in</h2>
            <p className="login-form-sub">Enter your school credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {/* Email */}
            <div className={`login-field ${focused === 'email' ? 'focused' : ''}`}>
              <label className="login-label">Email</label>
              <input
                type="email"
                className="login-input"
                placeholder="you@school.edu.ph"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused('')}
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div className={`login-field ${focused === 'password' ? 'focused' : ''}`}>
              <label className="login-label">Password</label>
              <div className="login-input-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="login-input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="login-eye" onClick={() => setShowPw(p => !p)}>
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} className="login-submit">
              {loading ? (
                <><span className="login-spinner"/>Signing in…</>
              ) : (
                <>Sign In <ArrowRight size={16}/></>
              )}
            </button>
          </form>

          <p className="login-form-footer">
            S.S.M.L.S © 2026 · Senior High School Capstone Project
          </p>
        </div>
      </div>

      <style>{`
        /* Login page — scoped styles */
        .login-root {
          min-height: 100vh;
          display: flex;
          background: #fafafa;
          font-family: 'Inter', system-ui, sans-serif;
        }

        /* ── Left panel ── */
        .login-left {
          display: none;
          flex-direction: column;
          width: 48%;
          background: #09090b;
          padding: 28px 40px 32px;
          position: relative;
          overflow: hidden;
        }
        @media (min-width: 1024px) { .login-left { display: flex; } }

        /* Subtle noise texture via SVG filter */
        .login-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(79,70,229,.12) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(99,102,241,.08) 0%, transparent 50%);
          pointer-events: none;
        }

        /* Grid lines */
        .login-left::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        .login-topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          z-index: 1;
          margin-bottom: 60px;
        }
        .login-logo-mark {
          width: 30px; height: 30px;
          background: #4f46e5;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 0 0 1px rgba(79,70,229,.5);
        }
        .login-brand-text {
          font-size: 14px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.2px;
        }
        .login-version-badge {
          margin-left: 2px;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255,255,255,.35);
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.1);
          padding: 2px 7px;
          border-radius: 100px;
        }

        .login-left-content {
          flex: 1;
          position: relative;
          z-index: 1;
        }

        .login-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,.45);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 20px;
        }
        .login-eyebrow-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #4f46e5;
          box-shadow: 0 0 6px rgba(79,70,229,.8);
          flex-shrink: 0;
        }

        .login-headline {
          font-size: 40px;
          font-weight: 800;
          color: white;
          line-height: 1.1;
          letter-spacing: -0.04em;
          margin: 0 0 16px;
        }
        .login-headline-accent {
          color: transparent;
          background: linear-gradient(135deg, #818cf8, #c4b5fd);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .login-subheadline {
          font-size: 14px;
          color: rgba(255,255,255,.45);
          line-height: 1.7;
          max-width: 300px;
          margin: 0 0 36px;
        }

        /* Stats */
        .login-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 40px;
          padding-bottom: 36px;
          border-bottom: 1px solid rgba(255,255,255,.07);
        }
        .login-stat {}
        .login-stat-value {
          display: block;
          font-size: 22px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.03em;
          line-height: 1;
          margin-bottom: 3px;
        }
        .login-stat-label {
          font-size: 11px;
          color: rgba(255,255,255,.35);
          font-weight: 500;
        }

        /* Features */
        .login-features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .login-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 10px;
          transition: background .15s;
        }
        .login-feature:hover { background: rgba(255,255,255,.07); }
        .login-feature-icon {
          width: 28px; height: 28px;
          border-radius: 7px;
          background: rgba(79,70,229,.25);
          border: 1px solid rgba(79,70,229,.3);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: #818cf8;
        }
        .login-feature-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255,255,255,.8);
          margin: 0 0 1px;
          line-height: 1;
        }
        .login-feature-desc {
          font-size: 11px;
          color: rgba(255,255,255,.3);
          margin: 0;
        }

        .login-left-footer {
          position: relative;
          z-index: 1;
          font-size: 11px;
          color: rgba(255,255,255,.2);
          margin: 0;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,.06);
        }

        /* ── Right panel ── */
        .login-right {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
          background: #fafafa;
        }

        .login-form-card {
          width: 100%;
          max-width: 380px;
        }

        .login-mobile-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 36px;
        }
        @media (min-width: 1024px) { .login-mobile-logo { display: none; } }

        .login-form-header { margin-bottom: 28px; }
        .login-form-title {
          font-size: 26px;
          font-weight: 800;
          color: #09090b;
          letter-spacing: -0.04em;
          margin: 0 0 6px;
        }
        .login-form-sub {
          font-size: 13px;
          color: #71717a;
          margin: 0;
        }

        .login-form { display: flex; flex-direction: column; gap: 18px; }

        .login-field {}
        .login-field.focused .login-label { color: #4f46e5; }

        .login-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #27272a;
          margin-bottom: 7px;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          transition: color .15s;
        }
        .login-input {
          width: 100%;
          padding: 11px 14px;
          font-size: 14px;
          font-weight: 500;
          color: #09090b;
          background: white;
          border: 1.5px solid #e4e4e7;
          border-radius: 8px;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .login-input::placeholder { color: #a1a1aa; font-weight: 400; }
        .login-input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79,70,229,.1);
        }

        .login-input-wrap { position: relative; }
        .login-eye {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: #a1a1aa;
          display: flex; align-items: center;
          padding: 4px;
          transition: color .15s;
        }
        .login-eye:hover { color: #71717a; }

        .login-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          background: #4f46e5;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background .15s, transform .1s, box-shadow .15s;
          margin-top: 4px;
          box-shadow: 0 1px 2px rgba(79,70,229,.3), 0 0 0 1px rgba(79,70,229,.7) inset;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .login-submit:hover:not(:disabled) {
          background: #4338ca;
          box-shadow: 0 4px 12px rgba(79,70,229,.35);
        }
        .login-submit:active:not(:disabled) { transform: scale(0.98); }
        .login-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .login-spinner {
          width: 15px; height: 15px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin .6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-form-footer {
          text-align: center;
          font-size: 11px;
          color: #d4d4d8;
          margin-top: 36px;
        }
      `}</style>
    </div>
  )
}
