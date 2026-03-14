import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('ssmls_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  // Re-validate token on mount
  useEffect(() => {
    const token = localStorage.getItem('ssmls_token')
    if (!token) { setLoading(false); return }
    api.get('/auth/me')
      .then(res => setUser(res.data.data))
      .catch(() => { localStorage.removeItem('ssmls_token'); localStorage.removeItem('ssmls_user'); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { token, user: u } = res.data.data
    localStorage.setItem('ssmls_token', token)
    localStorage.setItem('ssmls_user', JSON.stringify(u))
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ssmls_token')
    localStorage.removeItem('ssmls_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
