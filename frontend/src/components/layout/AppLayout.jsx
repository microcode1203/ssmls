import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarDays,
  ClipboardList, BarChart3, FileText, Bell, QrCode, Shield,
  LogOut, Menu, X, ChevronRight, School, Settings, BookMarked, Crown
} from 'lucide-react'

const navByRole = {
  admin: [
    { label: 'Dashboard',     icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Students',      icon: GraduationCap,   to: '/students' },
    { label: 'Teachers',      icon: Users,            to: '/teachers' },
    { label: 'Sections',      icon: School,           to: '/sections' },
    { label: 'Subjects',      icon: BookMarked,       to: '/subjects' },
    { label: 'Schedules',     icon: CalendarDays,     to: '/schedules' },
    { label: 'Attendance',    icon: ClipboardList,    to: '/attendance' },
    { label: 'Assignments',   icon: BookOpen,         to: '/assignments' },
    { label: 'Grades',        icon: BarChart3,        to: '/grades' },
    { label: 'Materials',     icon: FileText,         to: '/materials' },
    { label: 'Announcements', icon: Bell,             to: '/announcements' },
    { label: 'Audit Logs',    icon: Shield,           to: '/audit-logs' },
    { label: 'Admin Accounts', icon: Crown,           to: '/admin-accounts' },
    { label: 'Settings',      icon: Settings,         to: '/settings' },
  ],
  teacher: [
    { label: 'Dashboard',     icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Students',      icon: GraduationCap,   to: '/students' },
    { label: 'Schedules',     icon: CalendarDays,    to: '/schedules' },
    { label: 'Attendance',    icon: ClipboardList,   to: '/attendance' },
    { label: 'Assignments',   icon: BookOpen,        to: '/assignments' },
    { label: 'Grades',        icon: BarChart3,       to: '/grades' },
    { label: 'Materials',     icon: FileText,        to: '/materials' },
    { label: 'Announcements', icon: Bell,            to: '/announcements' },
    { label: 'Settings',      icon: Settings,        to: '/settings' },
  ],
  student: [
    { label: 'Dashboard',     icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Scan QR',       icon: QrCode,          to: '/scan-qr' },
    { label: 'Schedule',      icon: CalendarDays,    to: '/schedules' },
    { label: 'Attendance',    icon: ClipboardList,   to: '/attendance' },
    { label: 'Assignments',   icon: BookOpen,        to: '/assignments' },
    { label: 'Grades',        icon: BarChart3,       to: '/grades' },
    { label: 'Materials',     icon: FileText,        to: '/materials' },
    { label: 'Announcements', icon: Bell,            to: '/announcements' },
    { label: 'Settings',      icon: Settings,        to: '/settings' },
  ],
}

// Bottom nav items (most important 5 for mobile)
const bottomNavByRole = {
  admin:   [
    { label: 'Home',       icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Students',   icon: GraduationCap,   to: '/students' },
    { label: 'Schedule',   icon: CalendarDays,    to: '/schedules' },
    { label: 'Attendance', icon: ClipboardList,   to: '/attendance' },
    { label: 'More',       icon: Menu,            to: null }, // opens sidebar
  ],
  teacher: [
    { label: 'Home',       icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Attendance', icon: ClipboardList,   to: '/attendance' },
    { label: 'Schedule',   icon: CalendarDays,    to: '/schedules' },
    { label: 'Grades',     icon: BarChart3,       to: '/grades' },
    { label: 'More',       icon: Menu,            to: null },
  ],
  student: [
    { label: 'Home',       icon: LayoutDashboard, to: '/dashboard' },
    { label: 'Scan QR',    icon: QrCode,          to: '/scan-qr' },
    { label: 'Schedule',   icon: CalendarDays,    to: '/schedules' },
    { label: 'Grades',     icon: BarChart3,       to: '/grades' },
    { label: 'More',       icon: Menu,            to: null },
  ],
}

const roleColors = {
  admin:   'bg-purple-100 text-purple-700',
  teacher: 'bg-blue-100 text-blue-700',
  student: 'bg-green-100 text-green-700',
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems    = navByRole[user?.role]    || []
  const bottomItems = bottomNavByRole[user?.role] || []

  const handleLogout = () => { logout(); navigate('/login') }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-slate-900 text-white">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path d="M5 18L12 6L19 18H5Z" fill="white" fillOpacity="0.2"/>
              <path d="M9 18L12 12L15 18H9Z" fill="white"/>
              <circle cx="12" cy="6" r="2" fill="#60a5fa"/>
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-sm leading-none">SSMLS</p>
            <p className="text-xs text-white/40 mt-0.5">Smart School System</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg"
        >
          <X size={18} className="text-white/60"/>
        </button>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleColors[user?.role]}`}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group
               ${isActive ? 'bg-primary text-white' : 'text-white/60 hover:text-white hover:bg-white/8'}`
            }
          >
            <Icon size={17}/>
            {label}
            <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity"/>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
        >
          <LogOut size={17}/>
          Sign Out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-60 flex-col flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)}/>
          <div className="relative w-72 max-w-[85vw] flex flex-col shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar — mobile only */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-slate-100 -ml-1"
            aria-label="Open menu"
          >
            <Menu size={22} className="text-slate-700"/>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M9 18L12 12L15 18H9Z" fill="white"/>
              </svg>
            </div>
            <span className="font-display font-bold text-slate-900 text-sm">SSMLS</span>
          </div>
          {/* User avatar top right on mobile */}
          <button
            onClick={() => navigate('/settings')}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          >
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom Navigation Bar (mobile only) ── */}
      <nav className="mobile-nav">
        {bottomItems.map(({ label, icon: Icon, to }) => {
          if (!to) {
            // "More" button opens sidebar
            return (
              <button
                key={label}
                onClick={() => setSidebarOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-slate-400 hover:text-primary transition-colors"
              >
                <Icon size={20}/>
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            )
          }
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors
                 ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2}/>
                  </div>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : ''}`}>{label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
