import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CalendarDays,
  ClipboardList, BarChart3, FileText, Bell, QrCode, Shield,
  LogOut, Menu, X, ChevronRight, School, Settings, BookMarked
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

const roleColors = { admin: 'bg-purple-100 text-purple-700', teacher: 'bg-blue-100 text-blue-700', student: 'bg-green-100 text-green-700' }

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = navByRole[user?.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-slate-900 text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
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
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
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
            <Icon size={17} />
            {label}
            <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
        >
          <LogOut size={17} />
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
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-60 flex flex-col">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Menu size={20} className="text-slate-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M9 18L12 12L15 18H9Z" fill="white"/>
              </svg>
            </div>
            <span className="font-display font-bold text-slate-900 text-sm">SSMLS</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
