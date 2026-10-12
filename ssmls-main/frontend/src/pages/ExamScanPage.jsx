// ExamScanPage.jsx — scan the answer-sheet QR, key in the student's answers, auto-grade, save
// Needs:  npm i html5-qrcode   (already used by your QR scanner pages)
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../api/client'
import { ArrowLeft, ScanLine, CameraOff, Check, X, CircleDot, Save, RotateCcw } from 'lucide-react'

const statusStyle = {
  correct: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  wrong:   'bg-red-50 text-red-700 border-red-200',
  review:  'bg-blue-50 text-blue-700 border-blue-200',
}
const studentName = (s) =>
  s.name || [s.first_name || s.firstName, s.last_name || s.lastName].filter(Boolean).join(' ') || s.email || `#${s.id}`

const Pick = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`min-w-[34px] h-9 px-2 rounded-lg text-sm font-bold border ${on ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200'}`}>
    {children}
  </button>
)

// one input per question type
function AnswerInput({ q, value, onChange }) {
  switch (q.type) {
    case 'mcq':
      return <div className="flex gap-1.5 flex-wrap">{(q.choices || []).map((_, i) =>
        <Pick key={i} on={value === i} onClick={() => onChange(value === i ? undefined : i)}>{String.fromCharCode(65 + i)}</Pick>)}</div>
    case 'tf':
      return <div className="flex gap-1.5">
        <Pick on={value === true} onClick={() => onChange(true)}>T</Pick>
        <Pick on={value === false} onClick={() => onChange(false)}>F</Pick></div>
    case 'mtf': {
      const v = value || {}
      return <div className="flex gap-1.5 items-center flex-wrap">
        <Pick on={v.value === true} onClick={() => onChange({ ...v, value: true })}>T</Pick>
        <Pick on={v.value === false} onClick={() => onChange({ ...v, value: false })}>F</Pick>
        {v.value === false && <input className="input-field !py-1.5 text-sm flex-1 min-w-[140px]" placeholder="Student's correction word"
          value={v.correction || ''} onChange={e => onChange({ ...v, correction: e.target.value })} />}
      </div>
    }
    case 'ident':
      return <input className="input-field !py-1.5 text-sm w-full" placeholder="What the student wrote"
        value={value || ''} onChange={e => onChange(e.target.value)} />
    case 'enum':
      return <textarea className="input-field text-sm w-full" rows={Math.max(2, (q.answer?.items || []).length)}
        placeholder="One item per line" value={value || ''} onChange={e => onChange(e.target.value)} />
    default:
      return <div className="flex items-center gap-2">
        <input type="number" min="0" max={Number(q.points)} step="0.5" className="input-field !py-1.5 text-sm w-24" placeholder="Score"
          value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)} />
        <span className="text-xs text-slate-400">out of {Number(q.points)}</span></div>
  }
}

export default function ExamScanPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const examId = params.get('exam') || ''

  const [camOn, setCamOn] = useState(false)
  const [camError, setCamError] = useState('')
  const scannerRef = useRef(null)

  const [name, setName] = useState('')
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState([])

  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: () => api.get('/exams').then(r => r.data.data) })
  const { data: exam } = useQuery({
    queryKey: ['exam', examId], enabled: !!examId,
    queryFn: () => api.get(`/exams/${examId}`).then(r => r.data.data),
  })
  const { data: students } = useQuery({
    queryKey: ['students-for-exam'], enabled: !!examId, retry: false, staleTime: 60000,
    queryFn: () => api.get('/students').then(r => r.data.data),
  })

  const matched = (students || []).find(s => studentName(s).toLowerCase() === name.trim().toLowerCase())

  // ── camera ──
  const stopCam = async () => {
    const s = scannerRef.current
    scannerRef.current = null
    if (s) { try { await s.stop() } catch {} try { s.clear() } catch {} }
    setCamOn(false)
  }
  const startCam = async () => {
    setCamError('')
    setCamOn(true)
    await new Promise(r => setTimeout(r, 50)) // let the box render
    try {
      const s = new Html5Qrcode('exam-qr-reader')
      scannerRef.current = s
      await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
        const m = /^SSMLS-EXAM:(\d+)$/.exec(text.trim())
        if (!m) return
        stopCam()
        setParams({ exam: m[1] })
        resetSheet()
      }, () => {})
    } catch {
      scannerRef.current = null
      setCamOn(false)
      setCamError('Camera not available. Allow camera access (HTTPS or localhost) or choose the exam from the list.')
    }
  }
  useEffect(() => () => { stopCam() }, [])

  const resetSheet = () => { setName(''); setAnswers({}); setResult(null); setOverrides({}); setError('') }
  const setAnswer = (qid, v) => { setAnswers(a => ({ ...a, [qid]: v })); setResult(null) }

  const payload = (save) => ({ answers, overrides, save, studentName: name, studentId: matched?.id })

  const check = async () => {
    setBusy(true); setError('')
    try { setResult((await api.post(`/exams/${examId}/grade`, payload(false))).data.data) }
    catch (e) { setError(e.response?.data?.message || 'Could not grade.') }
    finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true); setError('')
    try {
      const r = (await api.post(`/exams/${examId}/grade`, payload(true))).data.data
      setSession(s => [{ name: name.trim() || matched && studentName(matched), score: r.score, total: r.total, review: r.needsReview }, ...s])
      qc.invalidateQueries({ queryKey: ['exams'] })
      resetSheet()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setError(e.response?.data?.message || 'Could not save.') }
    finally { setBusy(false) }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { stopCam(); nav('/exams') }} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowLeft size={18} /></button>
        <div><h1 className="text-lg font-bold text-slate-900">Scan & grade</h1>
          <p className="text-xs text-slate-400">Scan the answer sheet's QR, enter the student's answers, and it grades against your key</p></div>
      </div>

      {/* step 1: exam */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <select className="input-field text-sm flex-1 min-w-[200px]" value={examId}
            onChange={e => { setParams(e.target.value ? { exam: e.target.value } : {}); resetSheet() }}>
            <option value="">— Choose an exam —</option>
            {(exams || []).map(e => <option key={e.id} value={e.id}>{e.title}{e.section_label ? ` · ${e.section_label}` : ''}</option>)}
          </select>
          <button onClick={camOn ? stopCam : startCam}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 flex items-center gap-2">
            {camOn ? <><CameraOff size={15} /> Stop camera</> : <><ScanLine size={15} /> Scan sheet QR</>}
          </button>
        </div>
        {camOn && <div id="exam-qr-reader" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden" />}
        {camError && <p className="text-xs text-red-600">{camError}</p>}
      </div>

      {exam && (
        <>
          {/* step 2: student */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-slate-800">{exam.title} <span className="font-normal text-slate-400">· {Number(exam.total_points)} pts</span></p>
            <input className="input-field text-sm w-full" list="exam-students" placeholder="Student name (type or pick)"
              value={name} onChange={e => setName(e.target.value)} />
            <datalist id="exam-students">{(students || []).map(s => <option key={s.id} value={studentName(s)} />)}</datalist>
            <p className="text-[11px] text-slate-400">
              {matched ? `Linked to student record #${matched.id}.` : 'Not linked to a student record — the result is saved under this name.'}
            </p>
          </div>

          {/* step 3: answers */}
          <div className="space-y-2">
            {exam.questions.map((q, i) => (
              <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-2"><b className="text-slate-800">{i + 1}.</b>{' '}
                  <span className="text-[10px] uppercase tracking-wide font-bold text-primary">{q.type}</span>{' '}
                  {q.prompt.replace(/\[\[|\]\]/g, '').slice(0, 90)}{q.prompt.length > 90 ? '…' : ''}</p>
                <AnswerInput q={q} value={answers[q.id]} onChange={v => setAnswer(q.id, v)} />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}

          {/* step 4: result */}
          {result && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-end justify-between">
                <p className="text-sm font-bold text-slate-800">Result</p>
                <p className="text-3xl font-black text-primary">{result.score}<span className="text-base text-slate-400 font-semibold"> / {result.total}</span></p>
              </div>
              {result.needsReview && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2">Some essay items have no score yet. Enter them above, then press Check again.</p>}
              <div className="space-y-1.5">
                {result.items.map(it => (
                  <div key={it.questionId} className={`border rounded-lg px-3 py-2 text-xs flex items-center gap-3 ${statusStyle[it.status]}`}>
                    <span className="w-5 flex-shrink-0 font-bold">{it.number}</span>
                    {it.status === 'correct' ? <Check size={14} /> : it.status === 'wrong' ? <X size={14} /> : <CircleDot size={14} />}
                    <span className="flex-1 min-w-0 truncate" title={it.expected}>Key: {it.expected}</span>
                    <input type="number" min="0" max={it.max} step="0.5" title="Adjust the score if needed"
                      className="w-16 text-right rounded-md border border-current/30 bg-white/70 px-1.5 py-0.5"
                      value={overrides[it.questionId] ?? it.score}
                      onChange={e => { setOverrides(o => ({ ...o, [it.questionId]: e.target.value })); setResult(null) }} />
                    <span className="w-8 flex-shrink-0">/ {it.max}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">Fix any score with the box on the right (for example an acceptable answer the key missed), then press Check again.</p>
            </div>
          )}

          <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-slate-100 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex gap-2 justify-end">
            <button onClick={resetSheet} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 flex items-center gap-2"><RotateCcw size={14} /> Clear</button>
            <button onClick={check} disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold disabled:opacity-40">{busy ? '…' : 'Check'}</button>
            <button onClick={save} disabled={busy || !result || !(name.trim() || matched)}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2"><Save size={15} /> Save result</button>
          </div>
        </>
      )}

      {session.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-slate-800 mb-2">Graded this session ({session.length})</p>
          <div className="divide-y divide-slate-100">
            {session.map((s, i) => (
              <div key={i} className="flex justify-between py-1.5 text-sm">
                <span className="text-slate-700">{s.name}</span>
                <span className="font-semibold text-slate-800">{s.score} / {s.total}{s.review ? ' ⚠' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
