// @v2-fixed-imports
import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarDays,
  ClipboardList, BarChart3, FileText, Bell, QrCode, Shield,
  LogOut, Menu, X, School, Settings, BookMarked, Crown, ChevronRight,
  MessageSquare, Trophy, Printer, MessageCircle, Cog, Upload, Layers, LayoutList
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
        </div>
      </div>

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
          <button onClick={()=>navigate('/settings')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{background:'var(--primary)'}}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet/>
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
