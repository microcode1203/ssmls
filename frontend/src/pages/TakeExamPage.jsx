// TakeExamPage.jsx — students take an exam online (code -> rules -> exam -> done)
//
// The browser cannot BLOCK a student from switching tabs/apps. What this page does is:
// detect it, warn the student, report it to the server (which counts it), and let the
// server auto-submit after the teacher's violation limit. Time, count and grading live on the server.
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert, Clock, Maximize, CheckCircle2, Lock, KeyRound } from 'lucide-react'

const COUNTED = ['tab_hidden', 'window_blur', 'fullscreen_exit']
const WARN_TEXT = {
  tab_hidden: 'You left the exam tab or app.',
  window_blur: 'The exam window lost focus.',
  fullscreen_exit: 'You exited full screen.',
}
const DONE_TEXT = {
  violations: 'Your exam was submitted automatically because you left the exam screen too many times.',
  time_up: 'Time is up. Your exam was submitted automatically.',
  student: 'Your exam was submitted.',
}

const fsSupported = () => typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
const enterFs = () => document.documentElement.requestFullscreen({ navigationUI: 'hide' })
const exitFs = () => { try { if (document.fullscreenElement) document.exitFullscreen() } catch {} }
const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`
}
const withUnderline = (t) => String(t).split(/(\[\[.+?\]\])/g).map((p, i) =>
  /^\[\[.+\]\]$/.test(p) ? <u key={i} className="font-semibold">{p.slice(2, -2)}</u> : <span key={i}>{p}</span>)

const watermark = (text) => {
  const safe = text.replace(/[&<>"']/g, '')
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><text x='20' y='110' transform='rotate(-25 160 90)' font-size='15' font-family='sans-serif' fill='black'>${safe}</text></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const Btn = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`min-w-[44px] min-h-[44px] px-4 rounded-xl text-sm font-semibold border text-left ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}>
    {children}
  </button>
)

function Answer({ q, value, onChange }) {
  const inp = 'input-field w-full text-sm select-text'
  switch (q.type) {
    case 'mcq':
      return <div className="grid gap-2">{(q.choices || []).map((c, i) =>
        <Btn key={i} on={value === i} onClick={() => onChange(i)}>{String.fromCharCode(65 + i)}. {c}</Btn>)}</div>
    case 'tf':
      return <div className="flex gap-2"><Btn on={value === true} onClick={() => onChange(true)}>True</Btn>
        <Btn on={value === false} onClick={() => onChange(false)}>False</Btn></div>
    case 'mtf': {
      const v = value || {}
      return <div className="space-y-2">
        <div className="flex gap-2"><Btn on={v.value === true} onClick={() => onChange({ ...v, value: true })}>True</Btn>
          <Btn on={v.value === false} onClick={() => onChange({ ...v, value: false })}>False</Btn></div>
        {v.value === false && <input className={inp} placeholder="Write the word that replaces the underlined part"
          value={v.correction || ''} onChange={e => onChange({ ...v, correction: e.target.value })} />}
      </div>
    }
    case 'ident':
      return <input className={inp} placeholder="Your answer" value={value || ''} onChange={e => onChange(e.target.value)} />
    case 'enum':
      return <textarea className={inp} rows={Math.max(3, q.count || 3)} placeholder={`List ${q.count || ''} items, one per line`}
        value={value || ''} onChange={e => onChange(e.target.value)} />
    default:
      return <textarea className={inp} rows={6} placeholder="Type your answer here" value={value || ''} onChange={e => onChange(e.target.value)} />
  }
}

export default function TakeExamPage() {
  const { user } = useAuth()
  const [phase, setPhase] = useState('code')           // code | rules | exam | done
  const [code, setCode] = useState('')
  const [info, setInfo] = useState(null)
  const [session, setSession] = useState(null)
  const [answers, setAnswers] = useState({})
  const [violations, setViolations] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [overlay, setOverlay] = useState(null)         // violation warning
  const [confirming, setConfirming] = useState(false)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const sessionRef = useRef(null)
  const answersRef = useRef({})
  const dirty = useRef(false)
  const submitted = useRef(false)
  const submitting = useRef(false)
  const offset = useRef(0)                             // server clock - local clock
  const lastCounted = useRef(0)
  const lastInfo = useRef({})

  const finish = useCallback((d = {}) => {
    submitted.current = true
    exitFs()
    setOverlay(null); setConfirming(false)
    setDone({ reason: d.reason || 'student', showResult: d.showResult, score: d.score, total: d.total, pendingReview: d.pendingReview })
    setPhase('done')
  }, [])

  // ── server calls ──
  const report = useCallback(async (type, detail = '') => {
    if (!sessionRef.current || submitted.current) return
    const now = Date.now()
    if (COUNTED.includes(type)) {                     // blur + hidden fire together: count once
      if (now - lastCounted.current < 2000) return
      lastCounted.current = now
    } else {
      if (now - (lastInfo.current[type] || 0) < 1500) return
      lastInfo.current[type] = now
    }
    try {
      const d = (await api.post(`/exam-online/attempts/${sessionRef.current.attemptId}/event`, { type, detail })).data.data
      setViolations(d.violations)
      if (d.submitted) return finish(d)
      if (COUNTED.includes(type)) setOverlay({ type, violations: d.violations, max: d.maxViolations })
    } catch (e) { if (e.response?.data?.submitted) finish(e.response.data) }
  }, [finish])

  const save = useCallback(async () => {
    if (!sessionRef.current || submitted.current) return
    try { await api.put(`/exam-online/attempts/${sessionRef.current.attemptId}/answers`, { answers: answersRef.current }); dirty.current = false }
    catch (e) { if (e.response?.data?.submitted) finish(e.response.data) }
  }, [finish])

  const submit = useCallback(async (auto = false) => {
    if (!sessionRef.current || submitted.current || submitting.current) return
    submitting.current = true
    try {
      const r = await api.post(`/exam-online/attempts/${sessionRef.current.attemptId}/submit`, { answers: answersRef.current })
      finish({ ...r.data.data, reason: auto ? 'time_up' : 'student' })
    } catch (e) {
      if (e.response?.data?.submitted) finish(e.response.data)
      else {
        setError('Could not submit. Check your connection — retrying…')
        setTimeout(() => { submitting.current = false; submit(auto) }, 3000)
        return
      }
    }
    submitting.current = false
  }, [finish])

  const checkCode = async () => {
    setBusy(true); setError('')
    try {
      const d = (await api.post('/exam-online/preview', { code })).data.data
      if (d.attemptStatus && d.attemptStatus !== 'in_progress') setError('You already took this exam.')
      else { setInfo(d); setAgree(false); setPhase('rules') }
    } catch (e) { setError(e.response?.data?.message || 'Could not check the code.') }
    finally { setBusy(false) }
  }

  const begin = async () => {
    setBusy(true); setError('')
    try {
      if (info.rules.enforceFullscreen && fsSupported()) await enterFs()      // must run inside the click
    } catch { setBusy(false); setError('Please allow full screen to start the exam.'); return }
    try {
      const d = (await api.post('/exam-online/start', { code })).data.data
      offset.current = new Date(d.serverNow).getTime() - Date.now()
      sessionRef.current = d; answersRef.current = d.answers || {}
      submitted.current = false; submitting.current = false
      setSession(d); setAnswers(d.answers || {}); setViolations(d.violations || 0)
      setPhase('exam')
    } catch (e) {
      exitFs()
      setError(e.response?.data?.message || 'Could not start the exam.')
    } finally { setBusy(false) }
  }

  const setAnswer = (qid, v) => {
    dirty.current = true
    setAnswers(a => { const n = { ...a, [qid]: v }; answersRef.current = n; return n })
  }

  const returnToExam = async () => {
    try { if (session?.rules.enforceFullscreen && fsSupported() && !document.fullscreenElement) await enterFs() } catch {}
    setOverlay(null)
  }

  // ── lockdown listeners (exam phase only) ──
  useEffect(() => {
    if (phase !== 'exam') return
    const enforceFs = session?.rules.enforceFullscreen && fsSupported()
    const onVis = () => { if (document.hidden) report('tab_hidden') }
    const onBlur = () => report('window_blur')
    const onFs = () => { if (enforceFs && !document.fullscreenElement) report('fullscreen_exit') }
    const stop = (type, detail) => (e) => { e.preventDefault(); report(type, detail) }
    const onKey = (e) => {
      const k = String(e.key || '').toLowerCase(), c = e.ctrlKey || e.metaKey
      const bad = k === 'f12' || k === 'printscreen' || (c && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (c && ['u', 's', 'p'].includes(k))
      if (!bad) return
      e.preventDefault()
      if (k === 'printscreen') { try { navigator.clipboard.writeText('') } catch {} }
      report(k === 'p' ? 'print_attempt' : 'key_blocked', e.key)
    }
    const onUnload = (e) => { if (!submitted.current) { e.preventDefault(); e.returnValue = '' } }
    const onPop = () => { history.pushState(null, '', location.href); report('key_blocked', 'back button') }
    const onCopy = stop('clipboard', 'copy'), onCut = stop('clipboard', 'cut'), onPaste = stop('clipboard', 'paste')
    const onCtx = stop('right_click', ''), onDrag = (e) => e.preventDefault()

    history.pushState(null, '', location.href)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('copy', onCopy); document.addEventListener('cut', onCut); document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onCtx); document.addEventListener('dragstart', onDrag)
    window.addEventListener('beforeunload', onUnload); window.addEventListener('popstate', onPop)

    const hb = setInterval(async () => {                    // keep-alive; also lets the server notice the page froze
      try { await api.post(`/exam-online/attempts/${sessionRef.current.attemptId}/heartbeat`) }
      catch (e) { if (e.response?.data?.submitted) finish(e.response.data) }
    }, 10000)
    const tick = setInterval(() => {
      const dl = sessionRef.current?.deadlineAt
      if (!dl) return
      const left = new Date(dl).getTime() - (Date.now() + offset.current)
      setRemaining(left)
      if (left <= 0) submit(true)
    }, 500)
    const autosave = setInterval(() => { if (dirty.current) save() }, 4000)

    return () => {
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('copy', onCopy); document.removeEventListener('cut', onCut); document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onCtx); document.removeEventListener('dragstart', onDrag)
      window.removeEventListener('beforeunload', onUnload); window.removeEventListener('popstate', onPop)
      clearInterval(hb); clearInterval(tick); clearInterval(autosave)
    }
  }, [phase, session, report, save, submit, finish])

  // ── screens ──
  if (phase === 'code') return (
    <div className="max-w-md mx-auto p-6 mt-10 bg-white border border-slate-200 rounded-2xl space-y-4">
      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><KeyRound size={20} /></div>
        <div><h1 className="text-lg font-bold text-slate-900">Take an exam</h1><p className="text-xs text-slate-400">Enter the code from your teacher</p></div></div>
      <input className="input-field w-full text-center text-2xl font-mono tracking-[0.3em] uppercase" maxLength={12} placeholder="ABC123"
        value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && code && checkCode()} />
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      <button onClick={checkCode} disabled={busy || code.length < 4} className="w-full py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-40">{busy ? 'Checking…' : 'Continue'}</button>
    </div>
  )

  if (phase === 'rules') return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h1 className="text-lg font-bold text-slate-900">{info.title}</h1>
        <p className="text-xs text-slate-500">{[info.subject, info.section].filter(Boolean).join(' · ')} · {info.questionCount} questions · {info.totalPoints} pts
          {info.rules.durationMinutes ? ` · ${info.rules.durationMinutes} minutes` : ''}</p>
        {info.instructions && <p className="text-sm text-slate-700 italic">{info.instructions}</p>}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2 text-sm text-amber-900">
        <p className="font-bold flex items-center gap-2"><ShieldAlert size={16} /> Exam rules</p>
        <ul className="list-disc pl-5 space-y-1">
          {info.rules.enforceFullscreen && fsSupported() && <li>The exam runs in <b>full screen</b>. Leaving full screen is recorded.</li>}
          <li>Switching tabs, opening another app, or going to the home screen is recorded as a <b>violation</b>.</li>
          {info.rules.maxViolations > 0
            ? <li>After <b>{info.rules.maxViolations} violations</b> your exam is submitted automatically.</li>
            : <li>Violations are recorded and shown to your teacher.</li>}
          <li>Copy, paste, right-click, printing and screenshots shortcuts are disabled. Your name is shown on the screen.</li>
          <li>Your answers are saved automatically. You can only take this exam <b>once</b>.</li>
          {info.rules.durationMinutes && <li>The timer keeps running even if you close the page.</li>}
        </ul>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} />
        I understand the rules and will take this exam honestly.</label>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setPhase('code'); setError('') }} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600">Back</button>
        <button onClick={begin} disabled={!agree || busy} className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
          <Maximize size={16} /> {busy ? 'Starting…' : info.attemptStatus === 'in_progress' ? 'Resume exam' : 'Start exam'}</button>
      </div>
    </div>
  )

  if (phase === 'done') return (
    <div className="max-w-md mx-auto p-6 mt-10 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
      {done?.reason === 'violations' ? <Lock className="mx-auto text-red-500" size={40} /> : <CheckCircle2 className="mx-auto text-emerald-500" size={40} />}
      <h1 className="text-lg font-bold text-slate-900">Exam submitted</h1>
      <p className="text-sm text-slate-600">{DONE_TEXT[done?.reason] || DONE_TEXT.student}</p>
      {done?.showResult && done.score !== undefined && (
        <p className="text-3xl font-black text-primary">{done.score}<span className="text-base text-slate-400 font-semibold"> / {done.total}</span></p>)}
      {done?.showResult && done.pendingReview && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2">Written answers are still being checked, so your score may go up.</p>}
      {!done?.showResult && <p className="text-xs text-slate-400">Your teacher will share your score.</p>}
    </div>
  )

  // exam phase — covers the whole app so no menus are reachable
  const answered = session.questions.filter(q => {
    const v = answers[q.id]
    return q.type === 'mtf' ? v?.value !== undefined : v !== undefined && v !== ''
  }).length
  const max = session.rules.maxViolations
  const label = `${session.studentLabel || user?.firstName || 'Student'} · ${new Date().toLocaleDateString('en-PH')}`

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto select-none" style={{ WebkitTouchCallout: 'none' }}>
      <style>{`@media print { body * { visibility: hidden !important; } }`}</style>
      <div className="pointer-events-none fixed inset-0 z-[130] opacity-[0.07]" style={{ backgroundImage: watermark(label) }} />

      <div className="sticky top-0 z-[110] bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 text-sm">
        <p className="font-bold text-slate-800 truncate flex-1">{session.title}</p>
        <span className="text-xs text-slate-500">{answered}/{session.questions.length} answered</span>
        {max > 0 && <span className={`text-xs font-bold px-2 py-1 rounded-full ${violations ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>⚠ {violations}/{max}</span>}
        {remaining !== null && <span className={`flex items-center gap-1 font-mono font-bold ${remaining < 60000 ? 'text-red-600' : 'text-slate-800'}`}><Clock size={14} /> {fmt(remaining)}</span>}
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4 pb-28">
        {session.questions.map((q, i) => (
          <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-slate-800"><b>{i + 1}.</b> {withUnderline(q.prompt)}
              <span className="text-[10px] text-slate-400 ml-2">({q.points} pt{q.points === 1 ? '' : 's'})</span></p>
            <Answer q={q} value={answers[q.id]} onChange={v => setAnswer(q.id, v)} />
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-[110] bg-white/95 border-t border-slate-200 p-3 flex justify-center">
        <button onClick={() => setConfirming(true)} className="px-8 py-3 rounded-xl bg-primary text-white font-semibold">Submit exam</button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 text-center">
            <p className="font-bold text-slate-900">Submit your exam?</p>
            <p className="text-sm text-slate-600">{answered < session.questions.length ? `${session.questions.length - answered} question(s) are unanswered. ` : ''}You cannot change your answers after submitting.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600">Keep working</button>
              <button onClick={() => submit(false)} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold">Submit</button>
            </div>
          </div>
        </div>
      )}

      {overlay && (
        <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <ShieldAlert className="mx-auto text-red-500" size={44} />
            <h2 className="text-xl font-bold text-slate-900">Warning</h2>
            <p className="text-sm text-slate-700">{WARN_TEXT[overlay.type]} This was recorded and your teacher can see it.</p>
            {overlay.max > 0 && <p className="text-sm font-bold text-red-600">Violation {overlay.violations} of {overlay.max}. At {overlay.max} your exam is submitted automatically.</p>}
            <button onClick={returnToExam} className="w-full py-3 rounded-xl bg-primary text-white font-semibold">Return to exam</button>
          </div>
        </div>
      )}
    </div>
  )
}
