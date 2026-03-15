// @v2-fixed-imports
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, LogIn, BookOpen, GraduationCap, QrCode, CalendarDays, BarChart3 } from 'lucide-react'

// Logo matching the favicon (open book + graduation cap)
function SSMLSLogo({ size = 40 }) {
 return (
 <svg viewBox="0 0 64 64"fill="none"xmlns="http://www.w3.org/2000/svg"
 style={{ width: size, height: size }}>
 <rect width="64"height="64"rx="14"fill="#2563eb"/>
 <rect width="64"height="32"rx="14"fill="white"fillOpacity="0.08"/>
 {/* Open book */}
 <path d="M10 44 C10 44 18 40 32 41 L32 20 C18 19 10 23 10 23 Z"fill="white"fillOpacity="0.9"/>
 <path d="M54 44 C54 44 46 40 32 41 L32 20 C46 19 54 23 54 23 Z"fill="white"fillOpacity="0.65"/>
 <line x1="32"y1="20"x2="32"y2="41"stroke="white"strokeWidth="1.2"strokeOpacity="0.5"/>
 <path d="M10 44 C10 44 18 42 32 43 C46 42 54 44 54 44"stroke="white"strokeWidth="1.5"strokeLinecap="round"fill="none"strokeOpacity="0.6"/>
 {/* Graduation cap */}
 <path d="M32 11 L44 16.5 L32 22 L20 16.5 Z"fill="white"/>
 <path d="M32 11 L44 16.5 L38 19.2 L32 16.5 Z"fill="white"fillOpacity="0.6"/>
 <line x1="44"y1="16.5"x2="44"y2="23"stroke="white"strokeWidth="1.5"strokeLinecap="round"strokeOpacity="0.8"/>
 <circle cx="44"cy="24.5"r="1.5"fill="white"fillOpacity="0.8"/>
 {/* Book lines */}
 <line x1="14"y1="31"x2="29"y2="30.5"stroke="white"strokeWidth="1.2"strokeLinecap="round"strokeOpacity="0.35"/>
 <line x1="14"y1="35"x2="27"y2="34.5"stroke="white"strokeWidth="1.2"strokeLinecap="round"strokeOpacity="0.25"/>
 <line x1="50"y1="31"x2="35"y2="30.5"stroke="white"strokeWidth="1.2"strokeLinecap="round"strokeOpacity="0.25"/>
 </svg>
 )
}

const FEATURES = [
 { icon: QrCode, title: 'QR Attendance', desc: 'Real-time scanning with 60s rotating codes' },
 { icon: CalendarDays, title: 'Smart Scheduling', desc: 'Conflict detection and multi-day setup' },
 { icon: GraduationCap,title: 'Grade Management', desc: 'DepEd formula with report card export' },
 { icon: BarChart3, title: 'Analytics & Reports', desc: 'Rankings, at-risk alerts, and insights' },
]

export default function LoginPage() {
 const { login } = useAuth()
 const navigate = useNavigate()
 const [form, setForm] = useState({ email: '', password: '' })
 const [showPw, setShowPw] = useState(false)
 const [loading, setLoading] = useState(false)

 const handleSubmit = async (e) => {
 e.preventDefault()
 if (!form.email || !form.password) return toast.error('Please enter your email and password.')
 setLoading(true)
 try {
 const user = await login(form.email.trim(), form.password)
 toast.success(`Welcome back, ${user.firstName}!`)
 navigate('/dashboard', { replace: true })
 } catch (err) {
 toast.error(err.response?.data?.message || 'Invalid credentials. Please try again.')
 } finally {
 setLoading(false)
 }
 }

 return (
 <div style={{ minHeight:'100vh', display:'flex', background:'#f8fafc' }}>

 {/* ── Left Panel ── */}
 <div style={{
 display:'none', width:'52%', flexDirection:'column',
 background:'linear-gradient(145deg, #0f172a 0%, #1e3a5f 50%, #1d4ed8 100%)',
 padding:'48px', position:'relative', overflow:'hidden',
 }} className="lg-flex">

 {/* Subtle grid pattern */}
 <div style={{
 position:'absolute', inset:0, opacity:0.04,
 backgroundImage:'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
 backgroundSize:'40px 40px',
 }}/>

 {/* Glow orbs */}
 <div style={{ position:'absolute', top:'-80px', right:'-80px', width:'360px', height:'360px',
 borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)' }}/>
 <div style={{ position:'absolute', bottom:'-60px', left:'-60px', width:'280px', height:'280px',
 borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)' }}/>

 {/* Logo */}
 <div style={{ position:'relative', display:'flex', alignItems:'center', gap:'14px', marginBottom:'56px' }}>
 <SSMLSLogo size={44}/>
 <div>
 <p style={{ fontWeight:700, color:'#fff', fontSize:'18px', letterSpacing:'-0.02em', margin:0 }}>S.S.M.L.S</p>
 <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'11px', margin:0, fontWeight:500 }}>Smart School Management & Learning System</p>
 </div>
 </div>

 {/* Headline */}
 <div style={{ position:'relative', flex:1 }}>
 <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'rgba(59,130,246,0.2)',
 border:'1px solid rgba(59,130,246,0.35)', borderRadius:'100px', padding:'5px 14px', marginBottom:'24px' }}>
 <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#60a5fa' }}/>
 <span style={{ color:'#93c5fd', fontSize:'12px', fontWeight:600 }}>Senior High School Platform</span>
 </div>

 <h1 style={{ color:'#fff', fontSize:'38px', fontWeight:800, lineHeight:1.15,
 letterSpacing:'-0.03em', margin:'0 0 20px', maxWidth:'340px' }}>
 One platform for<br/>
 <span style={{ background:'linear-gradient(135deg, #60a5fa, #a78bfa)',
 WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
 smarter schools
 </span>
 </h1>

 <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'15px', lineHeight:1.7,
 maxWidth:'320px', margin:'0 0 48px' }}>
 Built for Philippine Senior High Schools — manage attendance, grades, schedules, and communication in one place.
 </p>

 {/* Feature list */}
 <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
 {FEATURES.map(({ icon: Icon, title, desc }) => (
 <div key={title} style={{ display:'flex', alignItems:'center', gap:'16px' }}>
 <div style={{ width:'38px', height:'38px', borderRadius:'10px', flexShrink:0,
 background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)',
 display:'flex', alignItems:'center', justifyContent:'center' }}>
 <Icon size={16} color="rgba(255,255,255,0.7)"/>
 </div>
 <div>
 <p style={{ color:'rgba(255,255,255,0.9)', fontSize:'13px', fontWeight:600, margin:0 }}>{title}</p>
 <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'12px', margin:0, marginTop:'1px' }}>{desc}</p>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Footer */}
 <div style={{ position:'relative', paddingTop:'32px',
 borderTop:'1px solid rgba(255,255,255,0.08)', marginTop:'32px' }}>
 <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'12px', margin:0 }}>
 © 2026 S.S.M.L.S · Senior High School Capstone Project
 </p>
 </div>
 </div>

 {/* ── Right Panel — Form ── */}
 <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px' }}>
 <div style={{ width:'100%', maxWidth:'400px' }}>

 {/* Mobile logo */}
 <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'40px' }}
 className="lg-hide">
 <SSMLSLogo size={36}/>
 <div>
 <p style={{ fontWeight:700, color:'#0f172a', fontSize:'16px', margin:0 }}>S.S.M.L.S</p>
 <p style={{ color:'#94a3b8', fontSize:'11px', margin:0 }}>Smart School Management & Learning System</p>
 </div>
 </div>

 {/* Heading */}
 <div style={{ marginBottom:'32px' }}>
 <h2 style={{ fontSize:'28px', fontWeight:800, color:'#0f172a',
 letterSpacing:'-0.03em', margin:'0 0 8px' }}>
 Welcome back
 </h2>
 <p style={{ color:'#64748b', fontSize:'14px', margin:0, lineHeight:1.6 }}>
 Sign in to your school account to continue.
 </p>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

 <div>
 <label style={{ display:'block', fontSize:'13px', fontWeight:600,
 color:'#374151', marginBottom:'8px' }}>
 Email Address
 </label>
 <input
 type="email"
 className="input-field"
 placeholder="you@school.edu.ph"
 value={form.email}
 onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
 autoComplete="email"
 required
 />
 </div>

 <div>
 <label style={{ display:'block', fontSize:'13px', fontWeight:600,
 color:'#374151', marginBottom:'8px' }}>
 Password
 </label>
 <div style={{ position:'relative' }}>
 <input
 type={showPw ? 'text' : 'password'}
 className="input-field"
 style={{ paddingRight:'44px' }}
 placeholder="Enter your password"
 value={form.password}
 onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
 autoComplete="current-password"
 required
 />
 <button
 type="button"
 onClick={() => setShowPw(p => !p)}
 style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)',
 background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:'4px',
 display:'flex', alignItems:'center' }}>
 {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
 </button>
 </div>
 </div>

 <button
 type="submit"
 disabled={loading}
 className="btn-primary"
 style={{ width:'100%', justifyContent:'center', padding:'13px 24px',
 fontSize:'15px', fontWeight:600, marginTop:'4px',
 opacity: loading ? 0.8 : 1 }}>
 {loading
 ? <><div style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)',
 borderTopColor:'white', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
 Signing in…</>
 : <><LogIn size={17}/> Sign In</>
 }
 </button>
 </form>

 {/* Footer */}
 <p style={{ textAlign:'center', fontSize:'12px', color:'#cbd5e1', marginTop:'40px' }}>
 S.S.M.L.S © 2026 · Senior High School Capstone Project
 </p>
 </div>
 </div>

 <style>{`
 @media (min-width: 1024px) {
 .lg-flex { display: flex !important; }
 .lg-hide { display: none !important; }
 }
 @keyframes spin { to { transform: rotate(360deg); } }
 `}</style>
 </div>
 )
}
