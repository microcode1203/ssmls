/* @v2-fixed-imports */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/client'
import { Search, X, User, Users, BookOpen, GraduationCap, Calendar, Command } from 'lucide-react'

const RESULT_ICONS = {
  student: User,
  teacher: Users,
  subject: BookOpen,
  section: GraduationCap,
  schedule: Calendar,
}

const RESULT_COLORS = {
  student: 'text-blue-600 bg-blue-50',
  teacher: 'text-purple-600 bg-purple-50',
  subject: 'text-emerald-600 bg-emerald-50',
  section: 'text-amber-600 bg-amber-50',
  schedule:'text-rose-600 bg-rose-50',
}

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function GlobalSearch() {
  const { user }     = useAuth()
  const navigate     = useNavigate()
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef   = useRef(null)
  const debounceRef = useRef(null)

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(p => !p)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setActiveIdx(0)
    }
  }, [open])

  const doSearch = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await api.get('/search', { params: { q } })
      setResults(res.data.data || [])
      setActiveIdx(0)
    } catch {
      setResults([])
    } finally { setLoading(false) }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 250)
  }

  const handleSelect = (result) => {
    setOpen(false)
    setQuery('')
    switch (result.type) {
      case 'student':  navigate('/students'); break
      case 'teacher':  navigate('/teachers'); break
      case 'section':  navigate('/sections'); break
      case 'subject':  navigate('/subjects'); break
      case 'schedule': navigate('/schedules'); break
      default: break
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx(p => Math.min(p+1, results.length-1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx(p => Math.max(p-1, 0)) }
    if (e.key === 'Enter' && results[activeIdx]) handleSelect(results[activeIdx])
  }

  // Only show for admin and teacher
  if (!['admin','teacher'].includes(user?.role)) return null

  return (
    <>
      {/* Trigger button in sidebar */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '8px 12px',
          background: 'rgba(255,255,255,.06)',
          border: '0.5px solid rgba(255,255,255,.12)',
          borderRadius: 8, cursor: 'pointer',
          color: 'rgba(255,255,255,.5)',
          fontSize: 12, fontWeight: 500,
          transition: 'all .15s',
          margin: '0 8px 8px', width: 'calc(100% - 16px)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = 'rgba(255,255,255,.8)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = 'rgba(255,255,255,.5)' }}
      >
        <Search size={13}/>
        <span style={{ flex: 1, textAlign: 'left' }}>Search anything…</span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'rgba(255,255,255,.1)', borderRadius: 4,
          padding: '2px 5px', fontSize: 10,
        }}>
          <Command size={10}/> K
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(15,23,42,.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', paddingTop: '10vh',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, background: 'white',
              borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(15,23,42,.25), 0 4px 16px rgba(15,23,42,.1)',
              animation: 'searchIn .15s cubic-bezier(.32,.72,0,1)',
            }}
          >
            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <Search size={18} style={{ color: '#94a3b8', flexShrink: 0 }}/>
              <input
                ref={inputRef}
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Search students, teachers, subjects, sections…"
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  fontSize: 15, color: '#0f172a', background: 'transparent',
                }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                  <X size={15}/>
                </button>
              )}
              <kbd style={{
                background: '#f1f5f9', border: '1px solid #e2e8f0',
                borderRadius: 6, padding: '3px 7px', fontSize: 11, color: '#64748b',
                flexShrink: 0,
              }}>Esc</kbd>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Searching…
                </div>
              )}

              {!loading && query.length >= 2 && results.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>No results for "{query}"</p>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Try a different name, LRN, or section</p>
                </div>
              )}

              {!loading && results.length > 0 && (
                <>
                  {/* Group by type */}
                  {['student','teacher','section','subject'].map(type => {
                    const group = results.filter(r => r.type === type)
                    if (!group.length) return null
                    const Icon = RESULT_ICONS[type] || Search
                    return (
                      <div key={type}>
                        <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                          {type === 'student' ? 'Students' : type === 'teacher' ? 'Teachers' : type === 'section' ? 'Sections' : 'Subjects'}
                        </div>
                        {group.map((r, i) => {
                          const globalIdx = results.indexOf(r)
                          const isActive  = globalIdx === activeIdx
                          const colorCls  = RESULT_COLORS[type] || 'text-slate-600 bg-slate-50'
                          return (
                            <button
                              key={r.id + type}
                              onClick={() => handleSelect(r)}
                              onMouseEnter={() => setActiveIdx(globalIdx)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                width: '100%', padding: '9px 16px',
                                background: isActive ? '#f8fafc' : 'white',
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                transition: 'background .1s',
                              }}
                            >
                              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                className={colorCls.split(' ').filter(c=>c.startsWith('bg-')).join(' ')}>
                                <Icon size={14} className={colorCls.split(' ').filter(c=>c.startsWith('text-')).join(' ')}/>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {highlight(r.name, query)}
                                </p>
                                {r.sub && <p style={{ fontSize: 11, color: '#64748b', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</p>}
                              </div>
                              {isActive && <span style={{ fontSize: 11, color: '#94a3b8' }}>↵ open</span>}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </>
              )}

              {/* Empty / hint */}
              {!loading && query.length < 2 && (
                <div style={{ padding: '20px 16px' }}>
                  <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Quick navigation</p>
                  {[
                    { label: 'Students',   icon: User,          to: '/students' },
                    { label: 'Teachers',   icon: Users,         to: '/teachers' },
                    { label: 'Sections',   icon: GraduationCap, to: '/sections' },
                    { label: 'Schedules',  icon: Calendar,      to: '/schedules' },
                  ].map(({ label, icon: Icon, to }) => (
                    <button key={to} onClick={() => { setOpen(false); navigate(to) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 10px', borderRadius: 8,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#475569', fontSize: 13, fontWeight: 500,
                        transition: 'background .1s', textAlign: 'left',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Icon size={14} style={{ color: '#94a3b8' }}/> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 16, alignItems: 'center' }}>
              {[['↑↓','Navigate'],['↵','Select'],['Esc','Close']].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
                  <kbd style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>{key}</kbd>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes searchIn {
          from { opacity: 0; transform: scale(.96) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)  translateY(0); }
        }
      `}</style>
    </>
  )
}
