// AITutorPage.jsx — AI-powered Student & Teacher Tutor
import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Send, Bot, User, Sparkles, BookOpen,
  RefreshCw, Copy, Check, ChevronDown,
  Lightbulb, GraduationCap, Brain, X,
  FileText, Trash2, Plus, History
} from 'lucide-react'

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false)
  const isAI = msg.role === 'assistant'

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Simple markdown-like rendering
  const renderContent = (text) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-slate-800 mt-3 mb-1">{line.slice(4)}</h3>
        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-slate-900 mt-4 mb-1">{line.slice(3)}</h2>
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-slate-800">{line.slice(2,-2)}</p>
        if (line.startsWith('- ') || line.startsWith('• ')) return (
          <div key={i} className="flex items-start gap-2 ml-2">
            <span className="text-primary mt-1 flex-shrink-0">•</span>
            <span>{line.slice(2)}</span>
          </div>
        )
        if (line.match(/^\d+\. /)) return (
          <div key={i} className="flex items-start gap-2 ml-2">
            <span className="text-primary font-bold flex-shrink-0">{line.match(/^\d+/)[0]}.</span>
            <span>{line.replace(/^\d+\. /, '')}</span>
          </div>
        )
        if (line.startsWith('`') && line.endsWith('`') && line.length > 2) return (
          <code key={i} className="bg-slate-100 text-primary px-2 py-0.5 rounded font-mono text-sm block my-1">{line.slice(1,-1)}</code>
        )
        if (line === '') return <div key={i} className="h-2"/>
        return <p key={i} className="leading-relaxed">{line}</p>
      })
  }

  return (
    <div className={`flex gap-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 ${
        isAI ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
      }`}>
        {isAI ? <Bot size={16}/> : <User size={16}/>}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] group ${isAI ? '' : 'items-end flex flex-col'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isAI
            ? 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-sm'
            : 'bg-primary text-white rounded-tr-sm'
        }`}>
          {isAI ? (
            <div className="space-y-0.5">{renderContent(msg.content)}</div>
          ) : (
            <p>{msg.content}</p>
          )}
        </div>

        {/* Actions */}
        {isAI && (
          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              {copied ? <Check size={11} className="text-emerald-500"/> : <Copy size={11}/>}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        <p className={`text-[10px] mt-1 ${isAI ? 'text-slate-400' : 'text-slate-400'}`}>
          {new Date(msg.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ─── Suggested Prompts ────────────────────────────────────────────────────────
const GENERAL_PROMPTS = [
  { icon: '📚', text: 'Explain photosynthesis in simple terms' },
  { icon: '🔢', text: 'How do I solve quadratic equations?' },
  { icon: '📝', text: 'Help me write an essay outline' },
  { icon: '🌍', text: 'What caused World War II?' },
  { icon: '🧪', text: 'Explain the periodic table' },
  { icon: '💡', text: 'What is the Pythagorean theorem?' },
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AITutorPage() {
  const { user } = useAuth()
  const isStudent = user?.role === 'student'
  const isTeacher = user?.role === 'teacher'

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [mode, setMode] = useState('general') // 'general' | 'lesson'
  const [sessions, setSessions] = useState([]) // chat history
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Fetch materials/lessons for context
  const { data: materials } = useQuery({
    queryKey: ['materials-tutor'],
    queryFn: () => api.get('/materials').then(r => r.data.data),
    staleTime: 60000,
  })

  // Fetch student grades for personalized tutoring
  const { data: grades } = useQuery({
    queryKey: ['grades-tutor'],
    queryFn: () => api.get('/grades', { params: { studentId: user?.studentId } }).then(r => r.data.data),
    enabled: isStudent && !!user?.studentId,
    staleTime: 60000,
  })

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tutor_sessions') || '[]')
      setSessions(saved)
    } catch {}
  }, [])

  const saveSession = (msgs) => {
    if (msgs.length < 2) return
    const session = {
      id: Date.now(),
      title: msgs[0]?.content?.slice(0, 50) + '...' || 'Chat session',
      messages: msgs,
      timestamp: new Date().toISOString(),
      mode,
      material: selectedMaterial?.title,
    }
    const updated = [session, ...sessions].slice(0, 20)
    setSessions(updated)
    try { localStorage.setItem('tutor_sessions', JSON.stringify(updated)) } catch {}
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build system prompt based on mode and context
  const buildSystemPrompt = () => {
    const role = user?.role || 'student'
    const name = `${user?.firstName} ${user?.lastName}`

    let base = `You are an intelligent AI tutor for S.S.M.L.S (Smart School Management & Learning System), a Senior High School in the Philippines. You are helping ${name}, a ${role}.

Your teaching style:
- Use clear, simple language appropriate for Senior High School students
- Break down complex concepts into digestible steps
- Use examples relevant to Philippine context when possible
- Encourage critical thinking with follow-up questions
- Be supportive and patient
- Use bullet points and numbered lists for clarity
- Format math equations clearly

Curriculum: Philippine Senior High School (DepEd K-12)
Strands: STEM, HUMSS, ABM, TVL, GAS`

    if (mode === 'lesson' && selectedMaterial) {
      base += `\n\nCURRENT LESSON CONTEXT:
Title: ${selectedMaterial.title}
Subject: ${selectedMaterial.subject_name || 'General'}
Grade: ${selectedMaterial.grade_level || 'SHS'}
Content: ${selectedMaterial.description || 'No description available'}

Answer questions specifically about this lesson. Help the student understand the material thoroughly.`
    }

    if (isStudent && grades?.length) {
      const weakSubjects = grades
        .filter(g => parseFloat(g.final_grade) < 80)
        .map(g => g.subject_name)
        .filter(Boolean)
        .slice(0, 3)
      if (weakSubjects.length) {
        base += `\n\nSTUDENT PERFORMANCE NOTE: This student needs extra support in: ${weakSubjects.join(', ')}. Be especially patient and thorough when these subjects come up.`
      }
    }

    if (isTeacher) {
      base += `\n\nThis is a TEACHER. Help them with:
- Lesson planning and teaching strategies
- Creating quiz questions and rubrics
- Explaining difficult concepts in teachable ways
- Classroom management tips
- DepEd curriculum guidance`
    }

    return base
  }

  const sendMessage = async (text = input) => {
    const userText = text.trim()
    if (!userText || loading) return

    setInput('')
    const userMsg = { role: 'user', content: userText, timestamp: new Date() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const response = await api.post('/ai/chat', {
        system: buildSystemPrompt(),
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      })

      const aiText = response.data?.reply || 'Sorry, I could not generate a response. Please try again.'
      const aiMsg = { role: 'assistant', content: aiText, timestamp: new Date() }
      const finalMessages = [...newMessages, aiMsg]
      setMessages(finalMessages)
      saveSession(finalMessages)
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Sorry, I encountered an error. Please try again.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errMsg,
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat = () => {
    if (messages.length > 0) saveSession(messages)
    setMessages([])
  }

  const loadSession = (session) => {
    setMessages(session.messages)
    setMode(session.mode || 'general')
    setShowHistory(false)
  }

  const weakSubjects = useMemo(() => {
    if (!grades?.length) return []
    return grades.filter(g => parseFloat(g.final_grade) < 80).map(g => g.subject_name).filter(Boolean).slice(0, 3)
  }, [grades])

  return (
    <div className="flex flex-col h-full max-h-screen overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100 bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-md shadow-primary/30">
              <Brain size={20} className="text-white"/>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">AI Tutor</h1>
              <p className="text-xs text-slate-400">
                {mode === 'lesson' && selectedMaterial
                  ? `📖 ${selectedMaterial.title}`
                  : 'Ask me anything about your studies'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => { setMode('general'); setSelectedMaterial(null) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'general' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                <Sparkles size={12}/> General
              </button>
              <button
                onClick={() => setMode('lesson')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'lesson' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                <BookOpen size={12}/> Lesson
              </button>
            </div>

            {/* History */}
            <button
              onClick={() => setShowHistory(s => !s)}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors relative"
              title="Chat history"
            >
              <History size={16}/>
              {sessions.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {sessions.length > 9 ? '9+' : sessions.length}
                </span>
              )}
            </button>

            {/* Clear */}
            {messages.length > 0 && (
              <button onClick={clearChat} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-400 rounded-xl transition-colors" title="Clear chat">
                <Trash2 size={16}/>
              </button>
            )}
          </div>
        </div>

        {/* Lesson selector */}
        {mode === 'lesson' && (
          <div className="max-w-4xl mx-auto mt-3">
            <select
              className="input-field text-sm"
              value={selectedMaterial?.id || ''}
              onChange={e => {
                const mat = (materials || []).find(m => String(m.id) === e.target.value)
                setSelectedMaterial(mat || null)
              }}
            >
              <option value="">— Select a lesson to study —</option>
              {(materials || []).map(m => (
                <option key={m.id} value={m.id}>
                  {m.subject_name} · {m.title}
                </option>
              ))}
            </select>
            {selectedMaterial && (
              <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs text-slate-600">
                <span className="font-bold text-primary">📖 Lesson loaded:</span> {selectedMaterial.title}
                {selectedMaterial.description && <p className="mt-1 text-slate-500 line-clamp-2">{selectedMaterial.description}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden max-w-4xl w-full mx-auto relative">
        {/* History sidebar */}
        {showHistory && (
          <div className="absolute right-0 top-0 z-20 w-72 h-full bg-white border-l border-slate-200 shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <p className="font-bold text-slate-800 text-sm">Chat History</p>
              <button onClick={() => setShowHistory(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X size={15}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sessions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No saved sessions yet</p>
              ) : sessions.map(s => (
                <button key={s.id} onClick={() => loadSession(s)}
                  className="w-full text-left p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors">
                  <p className="text-xs font-semibold text-slate-700 line-clamp-2">{s.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.mode === 'lesson' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                      {s.mode}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(s.timestamp).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-auto">{s.messages.length} msgs</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => { setSessions([]); localStorage.removeItem('tutor_sessions') }}
                className="w-full text-xs text-red-400 hover:text-red-600 font-semibold py-2"
              >
                Clear all history
              </button>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-violet-200 flex items-center justify-center mb-5">
                <Brain size={36} className="text-primary"/>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">
                Hello{user?.firstName ? `, ${user.firstName}` : ''}! 👋
              </h2>
              <p className="text-slate-500 text-sm mb-1 max-w-sm">
                {isTeacher
                  ? "I'm your AI teaching assistant. Ask me about lesson plans, teaching strategies, quiz creation, or curriculum guidance."
                  : "I'm your personal AI tutor. Ask me anything about your lessons, homework, or any subject you're studying."}
              </p>

              {/* At-risk subject alert */}
              {weakSubjects.length > 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl max-w-sm w-full text-left">
                  <p className="text-xs font-bold text-amber-700 mb-1.5">💡 Subjects that need attention:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {weakSubjects.map(s => (
                      <button key={s} onClick={() => sendMessage(`Help me improve in ${s}. What are the key concepts I should focus on?`)}
                        className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold hover:bg-amber-200 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested prompts */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg w-full">
                {(mode === 'lesson' && selectedMaterial ? [
                  { icon: '❓', text: `Explain the key concepts of ${selectedMaterial.title}` },
                  { icon: '📝', text: `Give me a quiz about ${selectedMaterial.title}` },
                  { icon: '🔍', text: `What are the important terms in ${selectedMaterial.title}?` },
                  { icon: '💡', text: `Summarize ${selectedMaterial.title} in simple terms` },
                  { icon: '🧠', text: `How does ${selectedMaterial.title} apply in real life?` },
                  { icon: '📊', text: `What should I memorize from ${selectedMaterial.title}?` },
                ] : isTeacher ? [
                  { icon: '📋', text: 'Create a lesson plan for General Mathematics' },
                  { icon: '❓', text: 'Generate 10 quiz questions about the water cycle' },
                  { icon: '📊', text: 'Suggest teaching strategies for struggling students' },
                  { icon: '✍️', text: 'Write a grading rubric for an essay' },
                  { icon: '🎯', text: 'How do I make lessons more engaging?' },
                  { icon: '📚', text: 'Explain the DepEd grading system' },
                ] : GENERAL_PROMPTS).map(({ icon, text }) => (
                  <button key={text} onClick={() => sendMessage(text)}
                    className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/3 transition-all text-left group">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <span className="text-xs text-slate-600 group-hover:text-slate-800 leading-relaxed">{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => <MessageBubble key={i} msg={msg}/>)}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white"/>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef}/>
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                className="w-full input-field resize-none pr-12 min-h-[44px] max-h-32 py-3 leading-relaxed"
                placeholder={
                  mode === 'lesson' && !selectedMaterial
                    ? 'Select a lesson above to ask lesson-specific questions...'
                    : loading
                    ? 'AI is thinking...'
                    : 'Ask me anything... (Press Enter to send, Shift+Enter for new line)'
                }
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                disabled={loading}
                rows={1}
                style={{ height: 'auto' }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 flex items-center justify-center bg-primary hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all flex-shrink-0 shadow-md shadow-primary/30"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                : <Send size={16}/>
              }
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            AI Tutor powered by Claude · Responses may not always be 100% accurate · Always verify with your teacher
          </p>
        </div>
      </div>
    </div>
  )
}
