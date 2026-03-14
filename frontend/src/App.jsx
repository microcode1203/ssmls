import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import LoginPage       from './pages/auth/LoginPage'
import DashboardPage   from './pages/DashboardPage'
import StudentsPage    from './pages/admin/StudentsPage'
import TeachersPage    from './pages/admin/TeachersPage'
import SectionsPage    from './pages/admin/SectionsPage'
import SchedulesPage   from './pages/SchedulesPage'
import AttendancePage  from './pages/AttendancePage'
import QRScannerPage   from './pages/student/QRScannerPage'
import AssignmentsPage from './pages/AssignmentsPage'
import GradesPage      from './pages/GradesPage'
import MaterialsPage   from './pages/MaterialsPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AuditLogsPage   from './pages/admin/AuditLogsPage'
import SettingsPage    from './pages/SettingsPage'
import NotFoundPage    from './pages/NotFoundPage'

// Layout
import AppLayout from './components/layout/AppLayout'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>
  if (!user)   return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/dashboard" replace />
  return children
}

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-slate-500 font-medium">Loading SSMLS…</p>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard"     element={<DashboardPage />} />
        <Route path="/schedules"     element={<SchedulesPage />} />
        <Route path="/attendance"    element={<AttendancePage />} />
        <Route path="/assignments"   element={<AssignmentsPage />} />
        <Route path="/grades"        element={<GradesPage />} />
        <Route path="/materials"     element={<MaterialsPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />

        {/* Student only */}
        <Route path="/scan-qr" element={
          <ProtectedRoute allowedRoles={['student']}><QRScannerPage /></ProtectedRoute>
        } />

        {/* Admin only */}
        <Route path="/students"  element={<ProtectedRoute allowedRoles={['admin','teacher']}><StudentsPage /></ProtectedRoute>} />
        <Route path="/teachers"  element={<ProtectedRoute allowedRoles={['admin']}><TeachersPage /></ProtectedRoute>} />
        <Route path="/sections"  element={<ProtectedRoute allowedRoles={['admin']}><SectionsPage /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogsPage /></ProtectedRoute>} />
        <Route path="/settings"   element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
