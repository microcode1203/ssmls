import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ssmls_token')
  if (token) {
    // Basic client-side token expiry check (prevents pointless requests)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        localStorage.removeItem('ssmls_token')
        localStorage.removeItem('ssmls_user')
        window.location.href = '/login'
        return Promise.reject(new Error('Token expired'))
      }
    } catch (_) { /* invalid token — let server reject it */ }
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ssmls_token')
      localStorage.removeItem('ssmls_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// Keep-alive ping for Render free tier
if (import.meta.env.PROD) {
  setInterval(() => {
    api.get('/health').catch(() => {})
  }, 14 * 60 * 1000)
}

export default api
