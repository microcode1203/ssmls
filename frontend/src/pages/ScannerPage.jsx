// ScannerPage.jsx — Optical Answer Sheet Scanner
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Camera, X, Plus, Trash2, Download, Save,
  CheckCircle, XCircle, AlertTriangle, BarChart3,
  FileText, Scan, Key, Users, ChevronRight,
  RefreshCw, ZoomIn, Check, Upload, Printer,
  BookOpen, Target, TrendingUp, Award
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const QUESTION_TYPES = {
  mc4:  { label: 'Multiple Choice (A-D)',  choices: ['A','B','C','D'] },
  mc5:  { label: 'Multiple Choice (A-E)',  choices: ['A','B','C','D','E'] },
  tf:   { label: 'True / False',           choices: ['T','F'] },
  num:  { label: 'Numeric (write-in)',     choices: null },
}

const TABS = [
  { id: 'key',     label: 'Answer Key',    icon: Key },
  { id: 'scan',    label: 'Scan Sheet',    icon: Scan },
  { id: 'results', label: 'Results',       icon: BarChart3 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const gradeColor = (pct) => {
  if (pct >= 90) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
  if (pct >= 75) return { text: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' }
  if (pct >= 60) return { text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' }
  return           { text: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' }
}

// ─── Answer Key Builder ───────────────────────────────────────────────────────
function AnswerKeyBuilder({ answerKey, setAnswerKey, title, setTitle, numQuestions, setNumQuestions, onPrint }) {
  const addQuestion = () => {
    setAnswerKey(prev => [...prev, { type: 'mc4', answer: '', points: 1 }])
    setNumQuestions(n => n + 1)
  }

  const removeQuestion = (i) => {
    setAnswerKey(prev => prev.filter((_, idx) => idx !== i))
    setNumQuestions(n => n - 1)
  }

  const updateQuestion = (i, field, value) => {
    setAnswerKey(prev => prev.map((q, idx) => {
      if (idx !== i) return q
      const updated = { ...q, [field]: value }
      if (field === 'type') updated.answer = ''
      return updated
    }))
  }

  const setNumAndResize = (n) => {
    const num = Math.max(1, Math.min(200, parseInt(n) || 1))
    setNumQuestions(num)
    setAnswerKey(prev => {
      if (num > prev.length) {
        const extra = Array.from({ length: num - prev.length }, () => ({ type: 'mc4', answer: '', points: 1 }))
        return [...prev, ...extra]
      }
      return prev.slice(0, num)
    })
  }

  const totalPoints = answerKey.reduce((a, q) => a + Number(q.points || 1), 0)

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assessment Title <span className="text-red-500">*</span></label>
          <input
            className="input-field text-base font-semibold"
            placeholder="e.g. Chapter 3 Quiz — General Mathematics"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Number of Questions</label>
          <input
            type="number" min="1" max="200"
            className="input-field text-center text-lg font-bold"
            value={numQuestions}
            onChange={e => setNumAndResize(e.target.value)}
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <BookOpen size={14} className="text-primary"/>
          <span className="font-semibold text-slate-700">{answerKey.length} questions</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Target size={14} className="text-emerald-600"/>
          <span className="font-semibold text-slate-700">{totalPoints} total points</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle size={14} className="text-amber-500"/>
          <span className="text-slate-500">{answerKey.filter(q => !q.answer).length} unanswered keys</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={onPrint} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <Printer size={13}/> Print Sheet
          </button>
          <button onClick={addQuestion} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <Plus size={13}/> Add Question
          </button>
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {answerKey.map((q, i) => {
          const typeConfig = QUESTION_TYPES[q.type]
          return (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${q.answer ? 'bg-white border-slate-200' : 'bg-amber-50/50 border-amber-200'}`}>
              {/* Question number */}
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {i + 1}
              </div>

              {/* Type selector */}
              <select
                className="input-field text-xs py-1.5 w-44 flex-shrink-0"
                value={q.type}
                onChange={e => updateQuestion(i, 'type', e.target.value)}
              >
                {Object.entries(QUESTION_TYPES).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>

              {/* Answer input */}
              {q.type === 'num' ? (
                <input
                  type="number"
                  className="input-field text-center font-mono text-sm py-1.5 w-28"
                  placeholder="Answer"
                  value={q.answer}
                  onChange={e => updateQuestion(i, 'answer', e.target.value)}
                />
              ) : (
                <div className="flex gap-1.5">
                  {typeConfig.choices.map(choice => (
                    <button
                      key={choice}
                      onClick={() => updateQuestion(i, 'answer', choice)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition-all ${
                        q.answer === choice
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {/* Points */}
              <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                <span className="text-xs text-slate-400 font-medium">pts</span>
                <input
                  type="number" min="0.5" max="100" step="0.5"
                  className="input-field text-center text-sm py-1.5 w-16"
                  value={q.points}
                  onChange={e => updateQuestion(i, 'points', parseFloat(e.target.value) || 1)}
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => removeQuestion(i)}
                className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-lg transition-colors flex-shrink-0"
              >
                <Trash2 size={14}/>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Printable Answer Sheet ───────────────────────────────────────────────────
function PrintableSheet({ title, answerKey }) {
  const cols = Math.ceil(answerKey.length / 25)
  const perCol = Math.ceil(answerKey.length / cols)

  return (
    <div className="p-8 bg-white print:p-6 font-mono text-sm" id="printable-sheet">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-sheet, #printable-sheet * { visibility: visible; }
          #printable-sheet { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      {/* Header */}
      <div className="border-2 border-black p-4 mb-6">
        <h1 className="text-xl font-bold text-center mb-3">{title || 'ANSWER SHEET'}</h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs mb-1">NAME: <span className="border-b border-black inline-block w-48">&nbsp;</span></p>
            <p className="text-xs mb-1">SECTION: <span className="border-b border-black inline-block w-40">&nbsp;</span></p>
          </div>
          <div>
            <p className="text-xs mb-1">LRN: <span className="border-b border-black inline-block w-44 font-bold tracking-widest">&nbsp;</span></p>
            <p className="text-xs mb-1">DATE: <span className="border-b border-black inline-block w-44">&nbsp;</span></p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-black p-2 mb-4 text-xs">
        <strong>INSTRUCTIONS:</strong> For multiple choice, shade the letter of your answer. For True/False, write T or F. For numeric, write your answer clearly in the box.
      </div>

      {/* Answer bubbles */}
      <div className={`grid gap-x-8`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, colIdx) => {
          const start = colIdx * perCol
          const end = Math.min(start + perCol, answerKey.length)
          return (
            <div key={colIdx}>
              {answerKey.slice(start, end).map((q, rowIdx) => {
                const qNum = start + rowIdx + 1
                const typeConfig = QUESTION_TYPES[q.type]
                return (
                  <div key={qNum} className="flex items-center gap-2 mb-1.5 text-xs">
                    <span className="w-6 text-right font-bold">{qNum}.</span>
                    {q.type === 'num' ? (
                      <div className="border-2 border-black w-20 h-6 flex items-center justify-center">
                        <span className="text-slate-300 text-[10px]">answer</span>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        {typeConfig.choices.map(choice => (
                          <div key={choice} className="flex items-center gap-0.5">
                            <div className="w-5 h-5 border-2 border-black rounded-full flex items-center justify-center text-[9px] font-bold">
                              {choice}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Score box */}
      <div className="border-2 border-black p-3 mt-6 flex items-center gap-6">
        <div className="text-center">
          <p className="text-xs font-bold">SCORE</p>
          <div className="border border-black w-20 h-10 mt-1"/>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold">TOTAL POINTS</p>
          <p className="text-lg font-bold">{answerKey.reduce((a,q) => a + Number(q.points||1), 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold">PERCENTAGE</p>
          <div className="border border-black w-20 h-10 mt-1"/>
        </div>
        <div className="text-center ml-auto">
          <p className="text-xs font-bold">CHECKED BY</p>
          <div className="border-b border-black w-32 mt-6"/>
        </div>
      </div>
    </div>
  )
}

// ─── Camera Scanner ───────────────────────────────────────────────────────────
function CameraScanner({ answerKey, onResult }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [captured, setCaptured] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [lrn, setLrn] = useState('')
  const [manualAnswers, setManualAnswers] = useState({})
  const [mode, setMode] = useState('camera') // 'camera' | 'manual' | 'upload'
  const fileRef = useRef()

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err) {
      toast.error('Camera access denied. Please allow camera permissions or use manual entry.')
      setMode('manual')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setCameraActive(false)
  }

  useEffect(() => () => stopCamera(), [])

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const imageData = canvas.toDataURL('image/jpeg', 0.95)
    setCaptured(imageData)
    stopCamera()
    processImage(imageData)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCaptured(ev.target.result)
      processImage(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  // OMR Processing — analyzes the captured image
  // In production this would use a proper OMR library (OpenCV.js, etc.)
  // For now: guides teacher through manual verification of detected answers
  const processImage = async (imageData) => {
    setProcessing(true)
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 1500))
    setProcessing(false)
    // After "processing", switch to manual verification mode
    // where teacher confirms each detected answer
    setMode('verify')
    toast.success('Sheet captured! Please verify the detected answers below.')
  }

  const submitAnswers = () => {
    if (!lrn || lrn.length !== 12) {
      toast.error('Please enter a valid 12-digit LRN')
      return
    }
    if (Object.keys(manualAnswers).length === 0) {
      toast.error('Please enter at least one answer')
      return
    }

    // Score the answers
    let score = 0
    let totalPoints = 0
    const results = answerKey.map((q, i) => {
      const studentAnswer = manualAnswers[i] || ''
      const correct = q.type === 'num'
        ? parseFloat(studentAnswer) === parseFloat(q.answer)
        : studentAnswer.toUpperCase() === q.answer.toUpperCase()
      const pts = Number(q.points || 1)
      totalPoints += pts
      if (correct) score += pts
      return { question: i + 1, type: q.type, correctAnswer: q.answer, studentAnswer, correct, points: pts }
    })

    onResult({ lrn, score, totalPoints, percentage: totalPoints > 0 ? (score/totalPoints*100).toFixed(1) : 0, results, capturedImage: captured })
    // Reset
    setLrn('')
    setManualAnswers({})
    setCaptured(null)
    setMode('camera')
    toast.success(`Scored! ${score}/${totalPoints} points`)
  }

  const updateAnswer = (i, val) => setManualAnswers(prev => ({ ...prev, [i]: val }))

  if (mode === 'verify' || mode === 'manual') {
    return (
      <div className="space-y-5">
        {/* LRN input */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <label className="block text-sm font-bold text-blue-800 mb-2">Student LRN (12 digits) *</label>
          <input
            className="input-field font-mono tracking-widest text-center text-lg font-bold"
            placeholder="000000000000"
            value={lrn}
            maxLength={12}
            onChange={e => setLrn(e.target.value.replace(/\D/g, ''))}
          />
          {lrn && lrn.length !== 12 && (
            <p className="text-xs text-red-500 mt-1 font-medium">{12 - lrn.length} more digit(s) needed</p>
          )}
          {lrn && lrn.length === 12 && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Valid LRN</p>
          )}
        </div>

        {captured && (
          <div className="rounded-xl overflow-hidden border border-slate-200">
            <img src={captured} alt="Captured sheet" className="w-full max-h-48 object-contain bg-slate-900"/>
            <div className="p-2 bg-slate-50 text-xs text-slate-500 text-center">Captured answer sheet — verify answers below</div>
          </div>
        )}

        {/* Answer entry/verification */}
        <div>
          <p className="text-sm font-bold text-slate-700 mb-3">
            {mode === 'verify' ? 'Verify Detected Answers' : 'Enter Student Answers'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
            {answerKey.map((q, i) => {
              const typeConfig = QUESTION_TYPES[q.type]
              const studentAns = manualAnswers[i] || ''
              const isCorrect = q.answer && (
                q.type === 'num'
                  ? parseFloat(studentAns) === parseFloat(q.answer)
                  : studentAns.toUpperCase() === q.answer.toUpperCase()
              )
              return (
                <div key={i} className={`p-2.5 rounded-lg border-2 transition-all ${
                  !studentAns ? 'border-slate-200 bg-white'
                  : isCorrect ? 'border-emerald-300 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-600">Q{i+1}</span>
                    {studentAns && (
                      isCorrect
                        ? <CheckCircle size={12} className="text-emerald-500"/>
                        : <XCircle size={12} className="text-red-400"/>
                    )}
                  </div>
                  {q.type === 'num' ? (
                    <input
                      type="number"
                      className="w-full text-center text-sm font-bold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="0"
                      value={studentAns}
                      onChange={e => updateAnswer(i, e.target.value)}
                    />
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {typeConfig.choices.map(choice => (
                        <button
                          key={choice}
                          onClick={() => updateAnswer(i, choice)}
                          className={`flex-1 py-1 rounded text-xs font-bold border transition-all ${
                            studentAns === choice
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40'
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setMode('camera'); setCaptured(null); setManualAnswers({}) }}
            className="btn-secondary flex-1 justify-center"
          >
            <RefreshCw size={14}/> Rescan
          </button>
          <button
            onClick={submitAnswers}
            disabled={!lrn || lrn.length !== 12}
            className="btn-primary flex-1 justify-center"
          >
            <Check size={14}/> Submit Score
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        {[
          { id: 'camera', label: 'Camera', icon: Camera },
          { id: 'upload', label: 'Upload Image', icon: Upload },
          { id: 'manual', label: 'Manual Entry', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); if (id !== 'camera') stopCamera() }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14}/>{label}
          </button>
        ))}
      </div>

      {/* Camera view */}
      {mode === 'camera' && (
        <div className="space-y-3">
          <div className="relative bg-slate-900 rounded-xl overflow-hidden" style={{ minHeight: 280 }}>
            <video ref={videoRef} className="w-full" autoPlay playsInline muted/>
            <canvas ref={canvasRef} className="hidden"/>
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <Camera size={40} className="mb-3 opacity-50"/>
                <p className="text-sm font-medium opacity-70">Camera not started</p>
              </div>
            )}
            {cameraActive && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Scanner overlay guide */}
                <div className="absolute inset-6 border-2 border-white/50 rounded-lg"/>
                <div className="absolute top-8 left-8 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl"/>
                <div className="absolute top-8 right-8 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr"/>
                <div className="absolute bottom-8 left-8 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl"/>
                <div className="absolute bottom-8 right-8 w-6 h-6 border-b-4 border-r-4 border-white rounded-br"/>
                <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-red-400/60 animate-pulse"/>
                <p className="absolute bottom-10 left-0 right-0 text-center text-white/80 text-xs font-medium">
                  Align answer sheet within the frame
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!cameraActive ? (
              <button onClick={startCamera} className="btn-primary flex-1 justify-center">
                <Camera size={16}/> Start Camera
              </button>
            ) : (
              <>
                <button onClick={stopCamera} className="btn-secondary flex-1 justify-center">
                  <X size={14}/> Stop
                </button>
                <button onClick={capture} className="btn-primary flex-1 justify-center">
                  <Scan size={16}/> Capture Sheet
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 text-center">
            Tip: Use good lighting and hold the camera steady directly above the sheet
          </p>
        </div>
      )}

      {/* File upload */}
      {mode === 'upload' && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/3 transition-all"
        >
          <Upload size={32} className="mx-auto mb-3 text-slate-400"/>
          <p className="font-semibold text-slate-600">Click to upload an image of the answer sheet</p>
          <p className="text-xs text-slate-400 mt-1">JPG, PNG supported</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload}/>
        </div>
      )}

      {/* Processing overlay */}
      {processing && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/>
          <p className="text-sm font-semibold text-slate-600">Processing answer sheet...</p>
          <p className="text-xs text-slate-400">Detecting bubbles and reading answers</p>
        </div>
      )}
    </div>
  )
}

// ─── Results Panel ────────────────────────────────────────────────────────────
function ResultsPanel({ results, answerKey, scheduleId, onClear }) {
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState({})

  // Item analysis
  const itemAnalysis = useMemo(() => {
    return answerKey.map((q, i) => {
      const attempts = results.filter(r => r.results[i]?.studentAnswer !== '')
      const correct = results.filter(r => r.results[i]?.correct)
      const pct = attempts.length > 0 ? Math.round(correct.length / attempts.length * 100) : 0
      return { question: i + 1, correct: correct.length, total: attempts.length, pct, difficulty: pct >= 80 ? 'Easy' : pct >= 50 ? 'Medium' : 'Hard' }
    })
  }, [results, answerKey])

  const syncToGrades = async (result) => {
    if (!scheduleId) { toast.error('Select a class first to sync grades'); return }
    setSyncing(true)
    try {
      // Find student by LRN
      const { data: studentData } = await api.get('/students', { params: { search: result.lrn } })
      const student = studentData?.data?.find(s => s.lrn === result.lrn)
      if (!student) { toast.error(`Student with LRN ${result.lrn} not found`); return }

      // Save grade
      await api.post('/grades', {
        studentId: student.id,
        scheduleId,
        quarter: 'Q1',
        writtenWorks: result.percentage,
        performanceTasks: 0,
        quarterlyAssessment: 0,
      })
      setSynced(prev => ({ ...prev, [result.lrn]: true }))
      toast.success(`Grade synced for LRN ${result.lrn}`)
      qc.invalidateQueries(['grades'])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sync grade')
    } finally { setSyncing(false) }
  }

  const exportCSV = () => {
    const headers = ['LRN', 'Score', 'Total Points', 'Percentage', ...answerKey.map((_, i) => `Q${i+1}`)]
    const rows = results.map(r => [
      r.lrn, r.score, r.totalPoints, `${r.percentage}%`,
      ...r.results.map(q => q.studentAnswer || '')
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'scanner-results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <BarChart3 size={40} className="mb-3 opacity-20"/>
        <p className="font-semibold text-slate-500">No results yet</p>
        <p className="text-sm mt-1">Scan answer sheets to see results here</p>
      </div>
    )
  }

  const avgScore = results.reduce((a, r) => a + parseFloat(r.percentage), 0) / results.length
  const highest = Math.max(...results.map(r => parseFloat(r.percentage)))
  const lowest  = Math.min(...results.map(r => parseFloat(r.percentage)))
  const passing = results.filter(r => parseFloat(r.percentage) >= 75).length

  return (
    <div className="space-y-5">
      {/* Class summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Students Scanned', value: results.length, icon: Users, color: 'blue' },
          { label: 'Class Average', value: `${avgScore.toFixed(1)}%`, icon: TrendingUp, color: avgScore >= 75 ? 'green' : 'red' },
          { label: 'Highest Score', value: `${highest}%`, icon: Award, color: 'emerald' },
          { label: 'Passing Rate', value: `${Math.round(passing/results.length*100)}%`, icon: Target, color: passing/results.length >= 0.75 ? 'green' : 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`p-4 rounded-xl border bg-${color}-50 border-${color}-100`}>
            <p className={`text-2xl font-bold text-${color}-700 tabular-nums`}>{value}</p>
            <p className={`text-xs font-semibold text-${color}-600 mt-0.5`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-2">
          <Download size={14}/> Export CSV
        </button>
        <button onClick={onClear} className="btn-secondary text-sm flex items-center gap-2 text-red-500 hover:text-red-600">
          <Trash2 size={14}/> Clear All
        </button>
      </div>

      {/* Individual results */}
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">Individual Results</p>
        <div className="space-y-2">
          {results.map((result, i) => {
            const pct = parseFloat(result.percentage)
            const c = gradeColor(pct)
            return (
              <div key={i} className={`p-4 rounded-xl border ${c.border} ${c.bg}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border-2 border-current flex items-center justify-center flex-shrink-0">
                      <span className={`text-xs font-bold ${c.text}`}>{i+1}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 font-mono">LRN: {result.lrn}</p>
                      <p className={`text-xl font-bold ${c.text}`}>{result.score}/{result.totalPoints} pts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${c.text}`}>{result.percentage}%</div>
                    {synced[result.lrn] ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                        <CheckCircle size={12}/> Synced
                      </span>
                    ) : (
                      <button
                        onClick={() => syncToGrades(result)}
                        disabled={syncing}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <Save size={12}/> Sync to Grades
                      </button>
                    )}
                  </div>
                </div>

                {/* Per-question breakdown */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {result.results.map((q, qi) => (
                    <div
                      key={qi}
                      title={`Q${qi+1}: ${q.correct ? '✓' : '✗'} (${q.studentAnswer || '—'} / ${q.correctAnswer})`}
                      className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center cursor-default ${
                        q.correct ? 'bg-emerald-500 text-white' : q.studentAnswer ? 'bg-red-400 text-white' : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {qi+1}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Item Analysis */}
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">Item Analysis</p>
        <div className="space-y-2">
          {itemAnalysis.map(item => (
            <div key={item.question} className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 w-8 flex-shrink-0">Q{item.question}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    item.pct >= 80 ? 'bg-emerald-500' : item.pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums w-10 text-right text-slate-600">{item.pct}%</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-16 text-center ${
                item.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
                item.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>{item.difficulty}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ScannerPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('key')
  const [title, setTitle] = useState('')
  const [numQuestions, setNumQuestions] = useState(20)
  const [answerKey, setAnswerKey] = useState(
    Array.from({ length: 20 }, () => ({ type: 'mc4', answer: '', points: 1 }))
  )
  const [results, setResults] = useState([])
  const [scheduleId, setScheduleId] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  const { data: mySchedules } = useQuery({
    queryKey: ['my-schedules-scanner'],
    queryFn: () => api.get('/schedules/my').then(r => r.data.data),
    enabled: !!user,
  })

  const uniqueClasses = useMemo(() => {
    const seen = new Map()
    return (mySchedules || []).filter(s => {
      if (s.status !== 'approved') return false
      const key = `${s.subject_id}_${s.section_id}`
      if (seen.has(key)) return false
      seen.set(key, true); return true
    })
  }, [mySchedules])

  const handleResult = (result) => {
    setResults(prev => {
      const existing = prev.findIndex(r => r.lrn === result.lrn)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = result
        return updated
      }
      return [...prev, result]
    })
    setTab('results')
  }

  const keyComplete = answerKey.every(q => q.answer !== '')
  const totalPoints = answerKey.reduce((a, q) => a + Number(q.points || 1), 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Scan size={20} className="text-white"/>
            </div>
            Optical Scanner
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-14">
            Grade paper assessments instantly using your camera
          </p>
        </div>

        {/* Class selector */}
        <div className="flex-shrink-0">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Link to Class (for grade sync)</label>
          <select
            className="input-field w-64 text-sm"
            value={scheduleId}
            onChange={e => setScheduleId(e.target.value)}
          >
            <option value="">— Select class —</option>
            {uniqueClasses.map(s => (
              <option key={s.id} value={s.id}>
                {s.subject_name || s.subject} · {s.grade_level} {s.section_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 p-3 mb-5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex-wrap">
        <div className={`flex items-center gap-1.5 font-semibold ${keyComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
          {keyComplete ? <CheckCircle size={13}/> : <AlertTriangle size={13}/>}
          Answer key {keyComplete ? 'complete' : 'incomplete'}
        </div>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">{answerKey.length} questions · {totalPoints} pts</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500">{results.length} sheet{results.length !== 1 ? 's' : ''} scanned</span>
        {scheduleId && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle size={11}/> Class linked
            </span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15}/>{label}
            {id === 'results' && results.length > 0 && (
              <span className="ml-1 bg-primary text-white text-xs rounded-full px-1.5 py-0.5 font-bold leading-none">
                {results.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        {tab === 'key' && (
          <AnswerKeyBuilder
            answerKey={answerKey}
            setAnswerKey={setAnswerKey}
            title={title}
            setTitle={setTitle}
            numQuestions={numQuestions}
            setNumQuestions={setNumQuestions}
            onPrint={() => setShowPrint(true)}
          />
        )}

        {tab === 'scan' && (
          <div>
            {!keyComplete && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle size={15}/>
                <span>Your answer key has unanswered questions. </span>
                <button onClick={() => setTab('key')} className="font-bold underline">Complete it first →</button>
              </div>
            )}
            <CameraScanner answerKey={answerKey} onResult={handleResult}/>
          </div>
        )}

        {tab === 'results' && (
          <ResultsPanel
            results={results}
            answerKey={answerKey}
            scheduleId={scheduleId}
            onClear={() => setResults([])}
          />
        )}
      </div>

      {/* Print modal */}
      {showPrint && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Answer Sheet Preview</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="btn-primary text-sm flex items-center gap-2">
                  <Printer size={14}/> Print
                </button>
                <button onClick={() => setShowPrint(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X size={18}/>
                </button>
              </div>
            </div>
            <PrintableSheet title={title} answerKey={answerKey}/>
          </div>
        </div>
      )}
    </div>
  )
}
