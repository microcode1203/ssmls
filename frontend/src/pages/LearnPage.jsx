// LearnPage.jsx — AI-Supported Learning Platform
import { useState, useMemo, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import Modal from '../components/ui/Modal'
import {
  Plus, X, BookOpen, Zap, Layers, Video,
  FileText, Star, Users, Clock, ChevronRight,
  Play, RotateCcw, Check, Trophy, Flame,
  Sparkles, Edit2, Trash2, Send, Brain,
  BarChart3, Grid, List, Filter, Search,
  Youtube, Hash, ArrowRight, CheckCircle,
  XCircle, AlertCircle, Shuffle, Eye
} from 'lucide-react'

// ─── Content Types ─────────────────────────────────────────────────────────────
const CONTENT_TYPES = {
  quiz:      { label: 'Gamified Quiz',      icon: Zap,       color: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700' },
  lesson:    { label: 'Interactive Lesson', icon: BookOpen,  color: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700' },
  flashcard: { label: 'Flashcards',         icon: Layers,    color: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700' },
  video:     { label: 'Video Lesson',       icon: Youtube,   color: 'bg-red-500',     badge: 'bg-red-100 text-red-700' },
  reading:   { label: 'Reading Passage',    icon: FileText,  color: 'bg-green-500',   badge: 'bg-green-100 text-green-700' },
}

// ─── AI Question Generator ────────────────────────────────────────────────────
function AIGeneratorModal({ onClose, onGenerated }) {
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState('medium')
  const [type, setType] = useState('multiple_choice')
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    if (!topic.trim()) return toast.error('Enter a topic first')
    setGenerating(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `Generate ${count} ${difficulty} difficulty ${type === 'multiple_choice' ? 'multiple choice (4 options A-D)' : type === 'true_false' ? 'true/false' : 'identification'} questions about: "${topic}".

Return ONLY valid JSON array, no markdown, no explanation:
[
  {
    "question": "...",
    "type": "${type}",
    "options": ${type === 'multiple_choice' ? '["A. ...", "B. ...", "C. ...", "D. ..."]' : type === 'true_false' ? '["True", "False"]' : 'null'},
    "answer": "correct answer here",
    "explanation": "brief explanation"
  }
]`
          }]
        })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const questions = JSON.parse(clean)
      onGenerated(questions)
      toast.success(`Generated ${questions.length} questions!`)
      onClose()
    } catch (err) {
      toast.error('AI generation failed. Please try again.')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Sparkles size={18} className="text-violet-600"/>
            </div>
            <div>
              <h2 className="font-bold text-slate-900">AI Question Generator</h2>
              <p className="text-xs text-slate-400">Powered by Claude AI</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Topic / Subject *</label>
            <input
              className="input-field"
              placeholder="e.g. Photosynthesis, World War II, Quadratic Equations"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Question Type</label>
              <select className="input-field" value={type} onChange={e => setType(e.target.value)}>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
                <option value="identification">Identification</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Difficulty</label>
              <select className="input-field" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Number of Questions: {count}</label>
            <input type="range" min="5" max="50" step="5" value={count}
              onChange={e => setCount(parseInt(e.target.value))}
              className="w-full accent-primary"/>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>5</span><span>50</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={generate} disabled={generating} className="btn-primary flex-1 justify-center">
              {generating
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating…</>
                : <><Sparkles size={15}/> Generate</>
              }
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Content Creator Modal ────────────────────────────────────────────────────
function CreateContentModal({ onClose, onSave, schedules }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    type: 'quiz', title: '', description: '', scheduleId: '',
    questions: [], videoUrl: '', content: '', timeLimit: 30,
    isPublished: false, allowRetake: true
  })
  const [showAI, setShowAI] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = k => v => setForm(p => ({ ...p, [k]: typeof v === 'object' && v?.target ? v.target.value : v }))

  const addQuestion = () => {
    setForm(p => ({
      ...p,
      questions: [...p.questions, {
        question: '', type: 'multiple_choice',
        options: ['', '', '', ''], answer: '', explanation: '', points: 1
      }]
    }))
  }

  const updateQuestion = (i, field, val) => {
    setForm(p => {
      const qs = [...p.questions]
      qs[i] = { ...qs[i], [field]: val }
      return { ...p, questions: qs }
    })
  }

  const updateOption = (qi, oi, val) => {
    setForm(p => {
      const qs = [...p.questions]
      const opts = [...qs[qi].options]
      opts[oi] = val
      qs[qi] = { ...qs[qi], options: opts }
      return { ...p, questions: qs }
    })
  }

  const removeQuestion = i => setForm(p => ({ ...p, questions: p.questions.filter((_, idx) => idx !== i) }))

  const handleAIGenerated = (questions) => {
    setForm(p => ({ ...p, questions: [...p.questions, ...questions] }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Enter a title')
    if (!form.scheduleId) return toast.error('Select a class')
    if ((form.type === 'quiz' || form.type === 'flashcard') && form.questions.length === 0)
      return toast.error('Add at least one question')
    setSaving(true)
    try {
      await api.post('/learn/content', form)
      toast.success('Content created!')
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create content')
    } finally { setSaving(false) }
  }

  return (
    <>
      {showAI && <AIGeneratorModal onClose={() => setShowAI(false)} onGenerated={handleAIGenerated}/>}
      <Modal onClose={onClose}>
        <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
            <h2 className="font-bold text-slate-900">Create Learning Content</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
          </div>

          {/* Step indicator */}
          <div className="flex px-5 pt-4 gap-2 flex-shrink-0">
            {['Basic Info', 'Content', 'Settings'].map((label, i) => (
              <div key={i} className={`flex-1 flex items-center gap-2`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {step > i + 1 ? <Check size={12}/> : i + 1}
                </div>
                <span className={`text-xs font-semibold ${step === i + 1 ? 'text-primary' : 'text-slate-400'}`}>{label}</span>
                {i < 2 && <div className="flex-1 h-px bg-slate-200 mx-1"/>}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-4">
                {/* Type selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Content Type</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {Object.entries(CONTENT_TYPES).map(([val, cfg]) => (
                      <button key={val} type="button"
                        onClick={() => set('type')(val)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          form.type === val ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg ${cfg.color} flex items-center justify-center`}>
                          <cfg.icon size={16} className="text-white"/>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-600 text-center leading-tight">{cfg.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title *</label>
                  <input className="input-field" placeholder="e.g. Chapter 3 Review Quiz" value={form.title} onChange={set('title')}/>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                  <textarea className="input-field h-20 resize-none" placeholder="What will students learn or practice?" value={form.description} onChange={set('description')}/>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign to Class *</label>
                  <select className="input-field" value={form.scheduleId} onChange={set('scheduleId')}>
                    <option value="">— Select class —</option>
                    {(schedules || []).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name || s.subject} · {s.grade_level} {s.section_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Content */}
            {step === 2 && (
              <div className="space-y-4">

                {/* Quiz / Flashcard */}
                {(form.type === 'quiz' || form.type === 'flashcard') && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700">
                        {form.questions.length} question{form.questions.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAI(true)} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50">
                          <Sparkles size={13}/> Generate with AI
                        </button>
                        <button onClick={addQuestion} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                          <Plus size={13}/> Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {form.questions.map((q, i) => (
                        <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Q{i+1}</span>
                            <div className="flex items-center gap-2">
                              <select className="input-field text-xs py-1 w-36"
                                value={q.type} onChange={e => updateQuestion(i, 'type', e.target.value)}>
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="true_false">True / False</option>
                                <option value="identification">Identification</option>
                              </select>
                              <button onClick={() => removeQuestion(i)} className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-lg">
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          </div>
                          <textarea className="input-field h-16 resize-none text-sm" placeholder="Question text..."
                            value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)}/>
                          {q.type === 'multiple_choice' && (
                            <div className="grid grid-cols-2 gap-2">
                              {['A','B','C','D'].map((letter, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-500 w-4">{letter}</span>
                                  <input className="input-field text-sm py-1.5 flex-1" placeholder={`Option ${letter}`}
                                    value={q.options[oi] || ''} onChange={e => updateOption(i, oi, e.target.value)}/>
                                </div>
                              ))}
                            </div>
                          )}
                          {q.type === 'true_false' && (
                            <div className="flex gap-2">
                              {['True','False'].map(opt => (
                                <button key={opt} type="button"
                                  onClick={() => updateQuestion(i, 'answer', opt)}
                                  className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                                    q.answer === opt ? 'bg-primary border-primary text-white' : 'border-slate-200 text-slate-600 hover:border-primary/40'
                                  }`}>{opt}</button>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Correct Answer</label>
                              <input className="input-field text-sm py-1.5" placeholder="e.g. A or True or Paris"
                                value={q.answer} onChange={e => updateQuestion(i, 'answer', e.target.value)}/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-slate-500 mb-1 block">Points</label>
                              <input type="number" min="1" className="input-field text-sm py-1.5 text-center"
                                value={q.points} onChange={e => updateQuestion(i, 'points', parseInt(e.target.value)||1)}/>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Explanation (shown after answer)</label>
                            <input className="input-field text-sm py-1.5" placeholder="Why is this the correct answer?"
                              value={q.explanation} onChange={e => updateQuestion(i, 'explanation', e.target.value)}/>
                          </div>
                        </div>
                      ))}
                      {form.questions.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                          <Brain size={32} className="mx-auto mb-2 opacity-30"/>
                          <p className="text-sm font-medium">No questions yet</p>
                          <p className="text-xs mt-1">Add manually or generate with AI</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Video */}
                {form.type === 'video' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">YouTube URL *</label>
                      <div className="relative">
                        <Youtube size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500"/>
                        <input className="input-field pl-9" placeholder="https://youtube.com/watch?v=..."
                          value={form.videoUrl} onChange={set('videoUrl')}/>
                      </div>
                      {form.videoUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
                          <iframe
                            src={`https://www.youtube.com/embed/${form.videoUrl.match(/[?&]v=([^&]+)/)?.[1] || form.videoUrl.split('/').pop()}`}
                            className="w-full" height="200" allowFullScreen title="Preview"/>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Video Notes / Guide Questions</label>
                      <textarea className="input-field h-32 resize-none" placeholder="Add notes or questions for students to answer while watching..."
                        value={form.content} onChange={set('content')}/>
                    </div>
                  </div>
                )}

                {/* Lesson / Reading */}
                {(form.type === 'lesson' || form.type === 'reading') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-semibold text-slate-700">
                        {form.type === 'lesson' ? 'Lesson Content' : 'Reading Passage'} *
                      </label>
                      <button onClick={() => setShowAI(true)} className="text-xs text-violet-600 font-semibold flex items-center gap-1 hover:underline">
                        <Sparkles size={11}/> AI Assist
                      </button>
                    </div>
                    <textarea
                      className="input-field resize-none"
                      style={{ minHeight: 300 }}
                      placeholder={form.type === 'lesson' ? 'Write your lesson content here. You can use paragraphs, lists, etc.' : 'Paste or write the reading passage here...'}
                      value={form.content} onChange={set('content')}/>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Settings */}
            {step === 3 && (
              <div className="space-y-4">
                {(form.type === 'quiz') && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time Limit (seconds per question)</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="10" max="120" step="10" value={form.timeLimit}
                        onChange={e => set('timeLimit')(parseInt(e.target.value))}
                        className="flex-1 accent-primary"/>
                      <span className="text-lg font-bold text-primary w-14 text-center">{form.timeLimit}s</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {[
                    { key: 'isPublished', label: 'Publish immediately', sub: 'Students can see and play this content right away' },
                    { key: 'allowRetake', label: 'Allow retakes', sub: 'Students can attempt this multiple times' },
                  ].map(({ key, label, sub }) => (
                    <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
                      </div>
                      <button
                        onClick={() => setForm(p => ({ ...p, [key]: !p[key] }))}
                        className={`w-12 h-6 rounded-full transition-colors ${form[key] ? 'bg-primary' : 'bg-slate-300'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform mx-0.5 ${form[key] ? 'translate-x-6' : 'translate-x-0'}`}/>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Summary</p>
                  <div className="space-y-1.5 text-sm">
                    <p><span className="text-slate-500">Type:</span> <span className="font-semibold text-slate-800">{CONTENT_TYPES[form.type]?.label}</span></p>
                    <p><span className="text-slate-500">Title:</span> <span className="font-semibold text-slate-800">{form.title || '—'}</span></p>
                    {form.questions.length > 0 && (
                      <p><span className="text-slate-500">Questions:</span> <span className="font-semibold text-slate-800">{form.questions.length}</span></p>
                    )}
                    <p><span className="text-slate-500">Status:</span> <span className={`font-semibold ${form.isPublished ? 'text-emerald-600' : 'text-amber-600'}`}>{form.isPublished ? 'Published' : 'Draft'}</span></p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 border-t border-slate-100 flex-shrink-0">
            {step > 1 && <button onClick={() => setStep(s => s-1)} className="btn-secondary">← Back</button>}
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            {step < 3 ? (
              <button onClick={() => {
                if (step === 1 && !form.title.trim()) return toast.error('Enter a title')
                if (step === 1 && !form.scheduleId) return toast.error('Select a class')
                setStep(s => s+1)
              }} className="btn-primary flex-1 justify-center">
                Next →
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : <><Check size={15}/> Create Content</>}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Quiz Player (Wayground-style) ────────────────────────────────────────────
function QuizPlayer({ content, onClose, onComplete }) {
  const [phase, setPhase] = useState('lobby') // lobby | playing | results
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(content.timeLimit || 30)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState([])
  const [streak, setStreak] = useState(0)
  const [showExplanation, setShowExplanation] = useState(false)
  const timerRef = useRef(null)

  const questions = content.questions || []
  const q = questions[currentQ]
  const totalPoints = questions.reduce((a, q) => a + (q.points || 1), 0)

  // Timer
  const startTimer = () => {
    clearInterval(timerRef.current)
    setTimeLeft(content.timeLimit || 30)
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          if (!answered) handleAnswer(null) // time up = wrong
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const handleAnswer = (choice) => {
    clearInterval(timerRef.current)
    setSelected(choice)
    setAnswered(true)
    setShowExplanation(true)

    const isCorrect = choice !== null &&
      choice.toLowerCase().replace(/^[a-d]\.\s*/i, '') === q.answer.toLowerCase().replace(/^[a-d]\.\s*/i, '') ||
      choice === q.answer

    const pts = isCorrect ? (q.points || 1) : 0
    const timeBonus = isCorrect ? Math.floor((timeLeft / (content.timeLimit || 30)) * 5) : 0

    if (isCorrect) {
      setScore(s => s + pts + timeBonus)
      setStreak(s => s + 1)
      toast.success(`+${pts + timeBonus} pts${timeBonus > 0 ? ` (${timeBonus} time bonus!)` : ''}`, { duration: 1500 })
    } else {
      setStreak(0)
      if (choice !== null) toast.error('Incorrect!', { duration: 1000 })
      else toast('Time\'s up!', { icon: '⏰', duration: 1000 })
    }

    setAnswers(prev => [...prev, { question: q.question, selected: choice, correct: q.answer, isCorrect, points: pts }])
  }

  const next = () => {
    setAnswered(false)
    setSelected(null)
    setShowExplanation(false)
    if (currentQ + 1 >= questions.length) {
      setPhase('results')
      onComplete?.({ score, totalPoints, answers })
    } else {
      setCurrentQ(c => c + 1)
      startTimer()
    }
  }

  const getOptionStyle = (opt) => {
    if (!answered) return 'bg-white border-slate-200 hover:border-primary/50 hover:bg-primary/3 cursor-pointer'
    const optText = opt.toLowerCase().replace(/^[a-d]\.\s*/i, '')
    const ansText = q.answer.toLowerCase().replace(/^[a-d]\.\s*/i, '')
    const isThis = opt === selected
    const isCorrectOpt = optText === ansText || opt === q.answer
    if (isCorrectOpt) return 'bg-emerald-50 border-emerald-400 text-emerald-800 cursor-default'
    if (isThis && !isCorrectOpt) return 'bg-red-50 border-red-400 text-red-700 cursor-default'
    return 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
  }

  // Lobby
  if (phase === 'lobby') return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 flex items-center justify-center p-6">
      <div className="text-center text-white max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-6">
          <Zap size={40} className="text-white"/>
        </div>
        <h1 className="text-3xl font-bold mb-2">{content.title}</h1>
        <p className="text-blue-200 mb-2">{content.description}</p>
        <div className="flex items-center justify-center gap-6 my-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold">{questions.length}</p>
            <p className="text-blue-200">Questions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{content.timeLimit || 30}s</p>
            <p className="text-blue-200">Per Question</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalPoints}</p>
            <p className="text-blue-200">Total Points</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/20 text-white font-bold hover:bg-white/30 transition-colors">
            Back
          </button>
          <button onClick={() => { setPhase('playing'); startTimer() }}
            className="flex-1 py-3 rounded-xl bg-white text-primary font-bold hover:bg-blue-50 transition-colors">
            Start Quiz! 🚀
          </button>
        </div>
      </div>
    </div>
  )

  // Results
  if (phase === 'results') {
    const pct = totalPoints > 0 ? Math.round(score / totalPoints * 100) : 0
    const correct = answers.filter(a => a.isCorrect).length
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary via-blue-600 to-indigo-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 text-center">
          <Trophy size={56} className="mx-auto mb-4 text-amber-400"/>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Quiz Complete!</h2>
          <p className="text-slate-500 mb-6">{content.title}</p>
          <div className={`text-6xl font-bold mb-2 ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
            {pct}%
          </div>
          <p className="text-slate-500 text-sm mb-6">{score}/{totalPoints} points · {correct}/{questions.length} correct</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Score', value: score },
              { label: 'Correct', value: `${correct}/${questions.length}` },
              { label: 'Accuracy', value: `${pct}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          {/* Answer review */}
          <div className="text-left space-y-2 max-h-40 overflow-y-auto mb-5">
            {answers.map((a, i) => (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${a.isCorrect ? 'bg-emerald-50' : 'bg-red-50'}`}>
                {a.isCorrect ? <CheckCircle size={12} className="text-emerald-500 flex-shrink-0"/> : <XCircle size={12} className="text-red-400 flex-shrink-0"/>}
                <p className="flex-1 truncate text-slate-700">{a.question}</p>
                {!a.isCorrect && <span className="text-red-500 font-semibold flex-shrink-0">→ {a.correct}</span>}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-full btn-primary justify-center">Done</button>
        </div>
      </div>
    )
  }

  // Playing
  const progress = ((currentQ) / questions.length) * 100
  const timerPct = (timeLeft / (content.timeLimit || 30)) * 100
  const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E']

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={18}/>
          </button>
          <span className="text-sm font-semibold text-slate-300">Q{currentQ+1}/{questions.length}</span>
        </div>
        <div className="flex items-center gap-4">
          {streak >= 2 && (
            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold">
              <Flame size={14}/> {streak}x streak
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm">
            <Star size={14} className="text-amber-400"/>
            <span className="font-bold text-white">{score} pts</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 flex-shrink-0">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}/>
      </div>

      {/* Timer bar */}
      <div className="h-1.5 bg-white/10 flex-shrink-0">
        <div className={`h-full transition-all duration-1000 ${timerPct > 50 ? 'bg-emerald-400' : timerPct > 25 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${timerPct}%` }}/>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl">
          {/* Timer number */}
          <div className="text-center mb-4">
            <span className={`text-4xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {timeLeft}
            </span>
          </div>

          {/* Question text */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6 text-center">
            <p className="text-white text-xl font-semibold leading-relaxed">{q.question}</p>
          </div>

          {/* Options */}
          {q.type === 'identification' ? (
            <div className="flex flex-col items-center gap-3">
              <input
                className="input-field text-center text-lg font-bold bg-white"
                placeholder="Type your answer..."
                onKeyDown={e => { if (e.key === 'Enter' && !answered) handleAnswer(e.target.value) }}
                disabled={answered}
                autoFocus
              />
              {!answered && (
                <button onClick={(e) => {
                  const val = e.target.closest('.flex').querySelector('input').value
                  if (val) handleAnswer(val)
                }} className="btn-primary">Submit Answer</button>
              )}
            </div>
          ) : (
            <div className={`grid gap-3 ${q.type === 'true_false' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {(q.options || (q.type === 'true_false' ? ['True','False'] : [])).map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => !answered && handleAnswer(opt)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${getOptionStyle(opt)}`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    !answered ? 'bg-slate-100 text-slate-600' :
                    (opt === q.answer || opt.toLowerCase().replace(/^[a-d]\.\s*/i,'') === q.answer.toLowerCase()) ? 'bg-emerald-100 text-emerald-700' :
                    opt === selected ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {OPTION_LABELS[oi] || (opt === 'True' ? 'T' : 'F')}
                  </span>
                  <span className="text-sm font-semibold text-left">{opt}</span>
                  {answered && (
                    (opt === q.answer || opt.toLowerCase().replace(/^[a-d]\.\s*/i,'') === q.answer.toLowerCase())
                      ? <CheckCircle size={16} className="text-emerald-500 ml-auto"/>
                      : opt === selected ? <XCircle size={16} className="text-red-400 ml-auto"/> : null
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Explanation + Next */}
          {answered && (
            <div className="mt-4 space-y-3">
              {q.explanation && (
                <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-4">
                  <p className="text-blue-200 text-sm"><span className="font-bold text-white">Explanation:</span> {q.explanation}</p>
                </div>
              )}
              <button onClick={next} className="w-full bg-white text-primary font-bold py-3 rounded-xl hover:bg-blue-50 transition-colors">
                {currentQ + 1 >= questions.length ? 'See Results 🏆' : 'Next Question →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Flashcard Player ─────────────────────────────────────────────────────────
function FlashcardPlayer({ content, onClose }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState([])
  const [shuffled, setShuffled] = useState(false)
  const [cards, setCards] = useState(content.questions || [])

  const current = cards[index]
  const progress = ((index + 1) / cards.length) * 100

  const markKnown = (val) => {
    setKnown(prev => [...prev, { index, known: val }])
    setFlipped(false)
    setTimeout(() => {
      if (index + 1 < cards.length) setIndex(i => i + 1)
      else toast.success(`Done! ${val ? known.filter(k=>k.known).length+1 : known.filter(k=>k.known).length}/${cards.length} known`)
    }, 200)
  }

  const doShuffle = () => {
    setCards(c => [...c].sort(() => Math.random() - 0.5))
    setIndex(0); setFlipped(false); setKnown([])
    setShuffled(true); toast.success('Cards shuffled!')
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-900 to-indigo-900 flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 text-white flex-shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X size={18}/></button>
        <span className="font-bold">{content.title}</span>
        <button onClick={doShuffle} className="p-2 hover:bg-white/10 rounded-lg" title="Shuffle">
          <Shuffle size={18}/>
        </button>
      </div>

      <div className="h-1 bg-white/20"><div className="h-full bg-purple-400 transition-all" style={{ width: `${progress}%` }}/></div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <p className="text-purple-300 text-sm mb-6">{index + 1} / {cards.length}</p>

        {/* Flashcard */}
        <div
          className="w-full max-w-md cursor-pointer"
          style={{ perspective: 1000 }}
          onClick={() => setFlipped(f => !f)}
        >
          <div style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            position: 'relative',
            height: 240,
          }}>
            {/* Front */}
            <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
              className="bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 text-center">
              <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4">Question</p>
              <p className="text-slate-800 text-xl font-semibold leading-relaxed">{current?.question}</p>
              <p className="text-slate-400 text-xs mt-6">Tap to reveal answer</p>
            </div>
            {/* Back */}
            <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0, transform: 'rotateY(180deg)' }}
              className="bg-purple-600 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8 text-center">
              <p className="text-xs font-bold text-purple-300 uppercase tracking-widest mb-4">Answer</p>
              <p className="text-white text-xl font-bold leading-relaxed">{current?.answer}</p>
              {current?.explanation && <p className="text-purple-200 text-xs mt-4">{current.explanation}</p>}
            </div>
          </div>
        </div>

        {flipped && (
          <div className="flex gap-3 mt-6 w-full max-w-md">
            <button onClick={() => markKnown(false)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 font-bold hover:bg-red-500/30 transition-colors">
              <XCircle size={18}/> Still Learning
            </button>
            <button onClick={() => markKnown(true)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold hover:bg-emerald-500/30 transition-colors">
              <CheckCircle size={18}/> Got It!
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={() => { setIndex(Math.max(0, index-1)); setFlipped(false) }}
            disabled={index === 0}
            className="p-3 rounded-xl bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors">
            ←
          </button>
          <button onClick={() => { setIndex(Math.min(cards.length-1, index+1)); setFlipped(false) }}
            disabled={index === cards.length - 1}
            className="p-3 rounded-xl bg-white/10 text-white disabled:opacity-30 hover:bg-white/20 transition-colors">
            →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Content Card ─────────────────────────────────────────────────────────────
function ContentCard({ content, onPlay, onDelete, isTeacher }) {
  const cfg = CONTENT_TYPES[content.type] || CONTENT_TYPES.lesson
  const Icon = cfg.icon
  const questions = content.questions || []

  return (
    <div className="card p-5 flex flex-col gap-4 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-11 h-11 rounded-xl ${cfg.color} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className="text-white"/>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
          {!content.isPublished && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Draft</span>
          )}
          {isTeacher && (
            <button onClick={() => onDelete(content.id)}
              className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
              <Trash2 size={13}/>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-bold text-slate-900 text-sm leading-snug">{content.title}</h3>
        {content.description && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{content.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
          {questions.length > 0 && (
            <span className="flex items-center gap-1"><Hash size={10}/>{questions.length} items</span>
          )}
          {content.timeLimit && content.type === 'quiz' && (
            <span className="flex items-center gap-1"><Clock size={10}/>{content.timeLimit}s/q</span>
          )}
          {content.playCount > 0 && (
            <span className="flex items-center gap-1"><Users size={10}/>{content.playCount} plays</span>
          )}
        </div>
      </div>

      <button
        onClick={() => onPlay(content)}
        className="btn-primary w-full justify-center text-sm"
      >
        <Play size={14}/> {isTeacher ? 'Preview' : 'Start'}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function LearnPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin'
  const isStudent = user?.role === 'student'

  const [showCreate, setShowCreate] = useState(false)
  const [playing, setPlaying] = useState(null)
  const [filter, setFilter] = useState({ type: '', search: '' })
  const [viewMode, setViewMode] = useState('grid')

  const { data: contents, isLoading } = useQuery({
    queryKey: ['learn-content'],
    queryFn: () => api.get('/learn/content').then(r => r.data.data),
    staleTime: 0,
  })

  const { data: schedules } = useQuery({
    queryKey: ['my-schedules-learn'],
    queryFn: () => api.get('/schedules/my').then(r => r.data.data),
    enabled: isTeacher || isAdmin,
  })

  const uniqueClasses = useMemo(() => {
    const seen = new Map()
    return (schedules || []).filter(s => {
      if (s.status !== 'approved') return false
      const key = `${s.subject_id}_${s.section_id}`
      if (seen.has(key)) return false
      seen.set(key, true); return true
    })
  }, [schedules])

  const filtered = useMemo(() => (contents || []).filter(c => {
    if (filter.type && c.type !== filter.type) return false
    if (filter.search && !c.title.toLowerCase().includes(filter.search.toLowerCase())) return false
    if (isStudent && !c.isPublished) return false
    return true
  }), [contents, filter, isStudent])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/learn/content/${id}`)
      toast.success('Content deleted')
      qc.invalidateQueries(['learn-content'])
    } catch { toast.error('Failed to delete') }
  }

  const handlePlay = (content) => setPlaying(content)

  const handleComplete = async (result) => {
    try {
      await api.post(`/learn/content/${playing.id}/complete`, result)
      qc.invalidateQueries(['learn-content'])
    } catch (err) { console.error(err) }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Brain size={20} className="text-white"/>
            </div>
            Learning Hub
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-14">
            Interactive lessons, quizzes, flashcards & more
          </p>
        </div>
        {(isTeacher || isAdmin) && (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16}/> Create Content
          </button>
        )}
      </div>

      {/* Stats for teachers */}
      {(isTeacher || isAdmin) && (contents || []).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Object.entries(CONTENT_TYPES).map(([type, cfg]) => {
            const count = (contents || []).filter(c => c.type === type).length
            return (
              <div key={type} className="card p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${cfg.color} flex items-center justify-center flex-shrink-0`}>
                  <cfg.icon size={16} className="text-white"/>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{count}</p>
                  <p className="text-xs text-slate-500 font-medium">{cfg.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-5 flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input className="input-field pl-9 text-sm" placeholder="Search content…"
            value={filter.search} onChange={e => setFilter(p => ({ ...p, search: e.target.value }))}/>
        </div>
        <select className="input-field w-40 text-sm" value={filter.type}
          onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}>
          <option value="">All Types</option>
          {Object.entries(CONTENT_TYPES).map(([val, cfg]) => (
            <option key={val} value={val}>{cfg.label}</option>
          ))}
        </select>
        {(filter.type || filter.search) && (
          <button onClick={() => setFilter({ type: '', search: '' })} className="btn-ghost text-xs">
            <X size={12}/> Clear
          </button>
        )}
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode==='grid'?'bg-primary text-white':'hover:bg-slate-100 text-slate-500'}`}><Grid size={15}/></button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode==='list'?'bg-primary text-white':'hover:bg-slate-100 text-slate-500'}`}><List size={15}/></button>
        </div>
        <span className="text-xs text-slate-400">{filtered.length} item{filtered.length!==1?'s':''}</span>
      </div>

      {/* Content grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({length:8}).map((_,i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="w-11 h-11 bg-slate-200 rounded-xl mb-4"/>
              <div className="h-4 bg-slate-200 rounded mb-2"/>
              <div className="h-3 bg-slate-100 rounded w-2/3 mb-4"/>
              <div className="h-9 bg-slate-100 rounded-xl"/>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center text-slate-400">
          <Brain size={40} className="mx-auto mb-3 opacity-20"/>
          <p className="font-semibold text-slate-500">
            {(isTeacher||isAdmin) ? 'No content yet — create your first!' : 'No content assigned yet'}
          </p>
          {(isTeacher||isAdmin) && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 mx-auto">
              <Plus size={14}/> Create Content
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-3'}>
          {filtered.map(c => (
            <ContentCard
              key={c.id} content={c}
              onPlay={handlePlay}
              onDelete={handleDelete}
              isTeacher={isTeacher || isAdmin}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateContentModal
          onClose={() => setShowCreate(false)}
          onSave={() => { setShowCreate(false); qc.invalidateQueries(['learn-content']) }}
          schedules={uniqueClasses}
        />
      )}

      {/* Players */}
      {playing && playing.type === 'quiz' && (
        <QuizPlayer content={playing} onClose={() => setPlaying(null)} onComplete={handleComplete}/>
      )}
      {playing && playing.type === 'flashcard' && (
        <FlashcardPlayer content={playing} onClose={() => setPlaying(null)}/>
      )}
      {playing && playing.type === 'video' && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl">
            <div className="flex justify-end mb-2">
              <button onClick={() => setPlaying(null)} className="text-white p-2 hover:bg-white/10 rounded-lg"><X size={20}/></button>
            </div>
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${playing.videoUrl?.match(/[?&]v=([^&]+)/)?.[1] || playing.videoUrl?.split('/').pop()}`}
                className="w-full h-full" allowFullScreen title={playing.title}/>
            </div>
            {playing.content && (
              <div className="mt-4 p-4 bg-white/10 rounded-xl text-white text-sm">{playing.content}</div>
            )}
          </div>
        </div>
      )}
      {playing && (playing.type === 'lesson' || playing.type === 'reading') && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">{playing.title}</h2>
              <button onClick={() => setPlaying(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
            </div>
            <div className="p-6 prose prose-slate max-w-none text-sm leading-relaxed">
              {playing.content?.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
