// @v2-fixed-imports
import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import GlobalSearch from './GlobalSearch'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarDays,
  ClipboardList, BarChart3, FileText, Bell, BellDot, QrCode, Shield, Search,
  LogOut, Menu, X, School, Settings, BookMarked, Crown, ChevronRight,
  MessageSquare, Trophy, Printer, MessageCircle, Cog, Upload, Layers, LayoutList,
  Brain, Scan
} from 'lucide-react'

const NAV = {
  admin: [
    { group: 'Overview',
      items: [
        { label: 'Dashboard',      icon: LayoutDashboard, to: '/dashboard' },
      ]
    },
    { group: 'Management',
      items: [
        { label: 'Students',       icon: GraduationCap,   to: '/students' },
        { label: 'Teachers',       icon: Users,            to: '/teachers' },
        { label: 'Sections',       icon: School,           to: '/sections' },
        { label: 'Subjects',       icon: BookMarked,       to: '/subjects' },
      ]
    },
    { group: 'Academic',
      items: [
        { label: 'Schedules',      icon: CalendarDays,     to: '/schedules' },
        { label: 'Attendance',     icon: ClipboardList,    to: '/attendance' },
        { label: 'Assignments',    icon: BookOpen,         to: '/assignments' },
        { label: 'Grades',         icon: BarChart3,        to: '/grades' },
        { label: 'Materials',      icon: FileText,         to: '/materials' },
        { label: 'Learning Hub',   icon: Brain,            to: '/learn' },
        { label: 'Scanner',        icon: Scan,             to: '/scanner' },
      ]
    },
    { group: 'Communication',
      items: [
        { label: 'Announcements',  icon: Bell,            to: '/announcements' },
        { label: 'Messages',       icon: MessageSquare,   to: '/messages' },
        { label: 'Calendar',       icon: CalendarDays,    to: '/calendar' },
      ]
    },
    { group: 'Reports',
      items: [
        { label: 'Report Card',    icon: Printer,         to: '/report-card' },
        { label: 'Rankings',       icon: Trophy,          to: '/rankings' },
        { label: 'Grade Appeals',  icon: MessageCircle,   to: '/appeals' },
      ]
    },
    { group: 'System',
      items: [
        { label: 'School Config',    icon: Cog,      to: '/school-config' },
        { label: 'Import Students',  icon: Upload,   to: '/import-students' },
        { label: 'Year Promotion',      icon: Layers,      to: '/promotion' },
        { label: 'Assign Sections',      icon: LayoutList,  to: '/section-assignment' },
        { label: 'Admin Accounts',   icon: Crown,    to: '/admin-accounts' },
        { label: 'Audit Logs',       icon: Shield,   to: '/audit-logs' },
        { label: 'Settings',         icon: Settings, to: '/settings' },
      ]
    },
  ],
  teacher: [
    { group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' }]
    },
    { group: 'Classes',
      items: [
        { label: 'Students',      icon: GraduationCap, to: '/students' },
        { label: 'Schedules',     icon: CalendarDays,  to: '/schedules' },
        { label: 'Attendance',    icon: ClipboardList, to: '/attendance' },
      ]
    },
    { group: 'Academic',
      items: [
        { label: 'Assignments',   icon: BookOpen,  to: '/assignments' },
        { label: 'Grades',        icon: BarChart3, to: '/grades' },
        { label: 'Materials',     icon: FileText,  to: '/materials' },
        { label: 'Learning Hub',  icon: Brain,     to: '/learn' },
        { label: 'Scanner',       icon: Scan,      to: '/scanner' },
      ]
    },
    { group: 'Communication',
      items: [
        { label: 'Announcements', icon: Bell,           to: '/announcements' },
        { label: 'Messages',      icon: MessageSquare,  to: '/messages' },
        { label: 'Calendar',      icon: CalendarDays,   to: '/calendar' },
      ]
    },
    { group: 'Reports',
      items: [
        { label: 'Report Card',   icon: Printer,        to: '/report-card' },
        { label: 'Rankings',      icon: Trophy,         to: '/rankings' },
        { label: 'Grade Appeals', icon: MessageCircle,  to: '/appeals' },
      ]
    },
    { group: 'Other',
      items: [
        { label: 'Settings',      icon: Settings,       to: '/settings' },
      ]
    },
  ],
  student: [
    { group: 'Overview',
      items: [{ label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' }]
    },
    { group: 'Attendance',
      items: [
        { label: 'Scan QR',   icon: QrCode,      to: '/scan-qr' },
        { label: 'Attendance',icon: ClipboardList,to: '/attendance' },
      ]
    },
    { group: 'Learning',
      items: [
        { label: 'Schedule',      icon: CalendarDays, to: '/schedules' },
        { label: 'Assignments',   icon: BookOpen,     to: '/assignments' },
        { label: 'Grades',        icon: BarChart3,    to: '/grades' },
        { label: 'Materials',     icon: FileText,     to: '/materials' },
        { label: 'Learning Hub',  icon: Brain,        to: '/learn' },
      ]
    },
    { group: 'Communication',
      items: [
        { label: 'Announcements', icon: Bell,          to: '/announcements' },
        { label: 'Messages',      icon: MessageSquare, to: '/messages' },
        { label: 'Calendar',      icon: CalendarDays,  to: '/calendar' },
      ]
    },
    { group: 'Academic',
      items: [
        { label: 'Report Card',   icon: Printer,       to: '/report-card' },
        { label: 'Grade Appeals', icon: MessageCircle, to: '/appeals' },
      ]
    },
    { group: 'Other',
      items: [
        { label: 'Settings',      icon: Settings,      to: '/settings' },
      ]
    },
  ],
}

const BOTTOM_NAV = {
  admin:   [
    { label:'Home',       icon: LayoutDashboard, to: '/dashboard' },
    { label:'Students',   icon: GraduationCap,   to: '/students' },
    { label:'Schedules',  icon: CalendarDays,    to: '/schedules' },
    { label:'Attendance', icon: ClipboardList,   to: '/attendance' },
    { label:'More',       icon: Menu,            to: null },
  ],
  teacher: [
    { label:'Home',       icon: LayoutDashboard, to: '/dashboard' },
    { label:'Attendance', icon: ClipboardList,   to: '/attendance' },
    { label:'Schedules',  icon: CalendarDays,    to: '/schedules' },
    { label:'Grades',     icon: BarChart3,       to: '/grades' },
    { label:'More',       icon: Menu,            to: null },
  ],
  student: [
    { label:'Home',    icon: LayoutDashboard, to: '/dashboard' },
    { label:'Scan QR', icon: QrCode,          to: '/scan-qr' },
    { label:'Schedule',icon: CalendarDays,    to: '/schedules' },
    { label:'Grades',  icon: BarChart3,       to: '/grades' },
    { label:'More',    icon: Menu,            to: null },
  ],
}

// ─── Notification Bell Component ─────────────────────────────────────────────
function NotificationBell() {
  const [open,   setOpen]   = useState(false)
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const ref      = useRef(null)
  const btnRef   = useRef(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  const fetchNotifs = async () => {
    try {
      const res = await api.get('/notifications')
      setNotifs(res.data.data || [])
      setUnread(res.data.unread || 0)
    } catch {}
  }

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setUnread(0)
      setNotifs(p => p.map(n => ({ ...n, is_read: 1 })))
    } catch {}
  }

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: 1 } : n))
      setUnread(p => Math.max(0, p - 1))
    } catch {}
  }

  const TYPE_ICON = {
    grade:       '📊',
    attendance:  '📋',
    assignment:  '📝',
    announcement:'📢',
    alert:       '⚠️',
    message:     '💬',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => {
          if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect()
            // Place dropdown to the right of sidebar, below the button
            setDropPos({
              top:  rect.bottom + 8,
              left: rect.left + rect.width + 8,
            })
          }
          setOpen(p => !p)
          if (!open) fetchNotifs()
        }}
        ref={btnRef}
        style={{
          position: 'relative', background: 'rgba(255,255,255,.08)',
          border: 'none', borderRadius: 8, width: 32, height: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'rgba(255,255,255,.7)',
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'}
        title="Notifications"
      >
        {unread > 0 ? <BellDot size={16}/> : <Bell size={16}/>}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: 'white',
            fontSize: 9, fontWeight: 800,
            minWidth: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', border: '1.5px solid #0f172a',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top:  dropPos.top,
          left: dropPos.left,
          zIndex: 9999,
          background: 'white', borderRadius: 12, width: 320,
          boxShadow: '0 12px 40px rgba(15,23,42,.22), 0 2px 8px rgba(15,23,42,.08)',
          border: '0.5px solid #e2e8f0',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - ' + dropPos.top + 'px - 16px)',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '0.5px solid #f1f5f9',
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
              Notifications {unread > 0 && <span style={{ color: '#ef4444' }}>({unread})</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{
                fontSize: 11, color: '#2563eb', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600,
              }}>
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                <p style={{ fontSize: 13, fontWeight: 600 }}>No notifications yet</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>You're all caught up!</p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    display: 'flex', gap: 10, padding: '10px 14px',
                    cursor: 'pointer', transition: 'background .1s',
                    background: n.is_read ? 'white' : '#eff6ff',
                    borderBottom: '0.5px solid #f8fafc',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'white' : '#eff6ff'}
                >
                  <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                    {TYPE_ICON[n.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: n.is_read ? 500 : 700,
                      color: '#1e293b', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{n.title}</p>
                    {n.body && (
                      <p style={{
                        fontSize: 11, color: '#64748b', margin: '2px 0 0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{n.body}</p>
                    )}
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0' }}>
                      {new Date(n.created_at).toLocaleString('en-PH', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#2563eb', flexShrink: 0, marginTop: 4,
                    }}/>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const ROLE_BADGE = {
  admin:   { label: 'Admin',   bg: 'bg-violet-500' },
  teacher: { label: 'Teacher', bg: 'bg-blue-500' },
  student: { label: 'Student', bg: 'bg-emerald-500' },
}

function SidebarContent({ user, onClose, onLogout }) {
  const groups = NAV[user?.role] || []
  const badge  = ROLE_BADGE[user?.role] || { label: user?.role, bg: 'bg-slate-500' }

  return (
    <div className="sidebar h-full overflow-y-auto flex-col flex">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <svg viewBox="0 0 64 64" fill="none" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            {/* Open book */}
            <path d="M10 44 C10 44 18 40 32 41 L32 20 C18 19 10 23 10 23 Z" fill="white" fillOpacity="0.9"/>
            <path d="M54 44 C54 44 46 40 32 41 L32 20 C46 19 54 23 54 23 Z" fill="white" fillOpacity="0.65"/>
            <line x1="32" y1="20" x2="32" y2="41" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
            {/* Graduation cap */}
            <path d="M32 11 L44 16.5 L32 22 L20 16.5 Z" fill="white"/>
            <line x1="44" y1="16.5" x2="44" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8"/>
            <circle cx="44" cy="24.5" r="1.5" fill="white" fillOpacity="0.8"/>
          </svg>
        </div>
        <div>
          <div className="sidebar-brand-name">S.S.M.L.S</div>
          <div className="sidebar-brand-sub">Smart School Management &amp; Learning System</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors lg:hidden">
            <X size={16}/>
          </button>
        )}
      </div>

      {/* User */}
      <div style={{padding:'8px'}}>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="sidebar-user-name">{user?.firstName} {user?.lastName}</div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm text-white ${badge.bg} mt-0.5 inline-block`}>
              {badge.label.toUpperCase()}
            </span>
          </div>
          <NotificationBell/>
        </div>
      </div>

      {/* Global search */}
      <GlobalSearch/>

      {/* Nav groups */}
      <nav className="flex-1 pb-4 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="nav-item-divider"/>}
            <div className="sidebar-section">{group.group}</div>
            {group.items.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={15}/>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{padding:'8px', borderTop:'1px solid rgba(255,255,255,.06)'}}>
        <button
          onClick={onLogout}
          className="nav-item w-full text-left"
          style={{margin:0, color:'rgba(255,255,255,.4)'}}
          onMouseEnter={e=>{e.currentTarget.style.color='#f87171';e.currentTarget.style.background='rgba(239,68,68,.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,.4)';e.currentTarget.style.background=''}}
        >
          <LogOut size={15}/>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const bottomItems = BOTTOM_NAV[user?.role] || []

  const handleLogout = () => { logout(); navigate('/login') }

  // Lock main scroll container when any modal is open
  useEffect(() => {
    const mainEl = document.querySelector('main.page-transition')
    if (!mainEl) return

    const observer = new MutationObserver(() => {
      const hasModal = document.querySelector('.modal-active') !== null
      mainEl.style.overflow = hasModal ? 'hidden' : ''
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'var(--surface-2)'}}>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0" style={{width:'var(--sidebar-width)'}}>
        <SidebarContent user={user} onLogout={handleLogout}/>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{background:'rgba(15,23,42,.6)',backdropFilter:'blur(4px)'}}/>
          <div className="relative flex flex-col shadow-2xl animate-slide-in" style={{width:'260px',maxWidth:'85vw'}} onClick={e=>e.stopPropagation()}>
            <SidebarContent user={user} onClose={()=>setOpen(false)} onLogout={handleLogout}/>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile topbar */}
        <header className="lg:hidden topbar">
          <button onClick={()=>setOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 -ml-1 transition-colors">
            <Menu size={20} className="text-slate-600"/>
          </button>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'k', bubbles: true }))}
            className="search-trigger topbar-search">
            <Search size={13}/>
            <span>Search…</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="sidebar-logo" style={{width:28,height:28,borderRadius:8}}>
              <svg viewBox="0 0 64 64" fill="none" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 44 C10 44 18 40 32 41 L32 20 C18 19 10 23 10 23 Z" fill="white" fillOpacity="0.9"/>
                <path d="M54 44 C54 44 46 40 32 41 L32 20 C46 19 54 23 54 23 Z" fill="white" fillOpacity="0.65"/>
                <path d="M32 11 L44 16.5 L32 22 L20 16.5 Z" fill="white"/>
                <line x1="44" y1="16.5" x2="44" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="44" cy="24.5" r="1.5" fill="white"/>
              </svg>
            </div>
            <span style={{fontWeight:800,fontSize:14,color:'var(--text-1)',letterSpacing:'-0.3px'}}>S.S.M.L.S</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationBell/>
            <button onClick={()=>navigate('/settings')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{background:'var(--primary)'}}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </button>
          </div>
        </header>

        {/* Content */}
        <main id="ssmls-main" className="flex-1 overflow-y-auto page-transition">
          <div className="page-transition">
            <Outlet/>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        {bottomItems.map(({ label, icon: Icon, to }) => {
          if (!to) return (
            <button key={label} onClick={()=>setOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Icon size={20}/>
              <span style={{fontSize:10,fontWeight:600}}>{label}</span>
            </button>
          )
          return (
            <NavLink key={to} to={to}
              className={({isActive})=>`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${isActive?'text-primary':'text-slate-400'}`}>
              {({isActive})=>(
                <>
                  <div className={`p-1.5 rounded-xl transition-all ${isActive?'bg-primary/10':''}`}>
                    <Icon size={19} strokeWidth={isActive?2.5:2}/>
                  </div>
                  <span style={{fontSize:10,fontWeight:isActive?700:600}}>{label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>

  )
}
