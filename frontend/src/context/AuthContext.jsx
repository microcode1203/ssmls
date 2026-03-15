import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

// Auto-logout after 2 hours of inactivity
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000
const INACTIVITY_WARN    = 5 * 60 * 1000 // warn 5 min before

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('ssmls_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const [sessionWarning, setSessionWarning] = useState(false)

  const inactivityTimer = useRef(null)
  const warnTimer       = useRef(null)

  // ── Session timeout logic ─────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    if (warnTimer.current)       clearTimeout(warnTimer.current)
  }, [])

  const doLogout = useCallback(async (reason = 'manual') => {
    clearTimers()
    setSessionWarning(false)
    try {
      if (localStorage.getItem('ssmls_token')) {
        await api.post('/auth/logout').catch(() => {})
      }
    } finally {
      localStorage.removeItem('ssmls_token')
      localStorage.removeItem('ssmls_user')
      setUser(null)
      if (reason === 'inactivity') {
        window.location.href = '/login?reason=inactivity'
      }
    }
  }, [clearTimers])

  const resetInactivityTimer = useCallback(() => {
    if (!localStorage.getItem('ssmls_token')) return
    clearTimers()
    setSessionWarning(false)

    // Warn 5 min before auto-logout
    warnTimer.current = setTimeout(() => {
      setSessionWarning(true)
    }, INACTIVITY_TIMEOUT - INACTIVITY_WARN)

    // Auto-logout after full timeout
    inactivityTimer.current = setTimeout(() => {
      doLogout('inactivity')
    }, INACTIVITY_TIMEOUT)
  }, [clearTimers, doLogout])

  // ── Track user activity ───────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    const handler = () => resetInactivityTimer()
    events.forEach(e => window.addEventListener(e, handler, { passive: true }))
    resetInactivityTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, handler))
      clearTimers()
    }
  }, [user, resetInactivityTimer, clearTimers])

  // ── Verify token on mount ─────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('ssmls_token')
    if (!token) { setLoading(false); return }

    api.get('/auth/me')
      .then(res => {
        const u = res.data.data
        setUser(u)
        localStorage.setItem('ssmls_user', JSON.stringify(u))
      })
      .catch(() => {
        localStorage.removeItem('ssmls_token')
        localStorage.removeItem('ssmls_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Login ─────────────────────────────────────────────────────
  const login = useCallback((token, userData) => {
    localStorage.setItem('ssmls_token', token)
    localStorage.setItem('ssmls_user',  JSON.stringify(userData))
    setUser(userData)
    resetInactivityTimer()
  }, [resetInactivityTimer])

  // ── Logout ────────────────────────────────────────────────────
  const logout = useCallback(() => doLogout('manual'), [doLogout])

  // ── Extend session (from warning banner) ──────────────────────
  const extendSession = useCallback(() => {
    setSessionWarning(false)
    resetInactivityTimer()
  }, [resetInactivityTimer])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, extendSession, sessionWarning, setUser }}>
      {children}
      {/* Session expiry warning banner */}
      {sessionWarning && user && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: 'white', padding: '12px 20px',
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,.3)', zIndex: 9999,
          fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,.1)'
        }}>
          <span>⚠️ Your session expires in 5 minutes.</span>
          <button
            onClick={extendSession}
            style={{
              background: '#2563eb', color: 'white', border: 'none',
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 700
            }}
          >
            Stay logged in
          </button>
          <button
            onClick={logout}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,.5)',
              border: '1px solid rgba(255,255,255,.15)',
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12
            }}
          >
            Logout now
          </button>
        </div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
