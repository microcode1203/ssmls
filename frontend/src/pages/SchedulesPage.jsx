import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
 Plus, X, AlertTriangle, CheckCircle, Trash2,
 Clock, CalendarDays, Zap, Search, Filter
} from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat' }
const DAY_COLOR = {
 Monday: 'bg-blue-100 text-blue-700 border-blue-200',
 Tuesday: 'bg-purple-100 text-purple-700 border-purple-200',
 Wednesday: 'bg-emerald-100 text-emerald-700 border-emerald-200',
 Thursday: 'bg-amber-100 text-amber-700 border-amber-200',
 Friday: 'bg-red-100 text-red-700 border-red-200',
 Saturday: 'bg-slate-100 text-slate-600 border-slate-200',
}

const TIME_PRESETS = [
 { label:'7:00–8:00', start:'07:00', end:'08:00' },
 { label:'8:00–9:00', start:'08:00', end:'09:00' },
 { label:'9:00–10:00', start:'09:00', end:'10:00' },
 { label:'10:00–11:00', start:'10:00', end:'11:00' },
 { label:'11:00–12:00', start:'11:00', end:'12:00' },
 { label:'1:00–2:00', start:'13:00', end:'14:00' },
 { label:'2:00–3:00', start:'14:00', end:'15:00' },
 { label:'3:00–4:00', start:'15:00', end:'16:00' },
 { label:'4:00–5:00', start:'16:00', end:'17:00' },
]

// ─── Schedule Modal ───────────────────────────────────────────────────────────
function ScheduleModal({ onClose, onSave, sections, subjects, teachers, userRole }) {
 const [step, setStep] = useState(1)
 const [form, setForm] = useState({ sectionId:'', subjectId:'', teacherId:'', room:'' })

 // Per-day time slots: { Monday: { start:'08:00', end:'09:00' }, ... }
 const [daySlots, setDaySlots] = useState({})

 // Active day being edited (for time picker)
 const [editingDay, setEditingDay] = useState(null)

 const [saving, setSaving] = useState(false)
 const [conflicts, setConflicts] = useState({}) // { day: message }
 const [saved, setSaved] = useState([])

 const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

 const selectedSection = (sections||[]).find(s => String(s.id) === String(form.sectionId))
 const filteredSubjects = (subjects||[]).filter(s =>
 !selectedSection || s.grade_level === 'Both' || s.grade_level === selectedSection.grade_level
 )

 const handleSectionChange = (e) => {
 const newId = e.target.value
 const newSec = (sections||[]).find(s => String(s.id) === String(newId))
 const curSub = (subjects||[]).find(s => String(s.id) === String(form.subjectId))
 const still = !curSub || !newSec || curSub.grade_level==='Both' || curSub.grade_level===newSec.grade_level
 setForm(p => ({ ...p, sectionId: newId, subjectId: still ? p.subjectId : '' }))
 }

 const selectedDays = Object.keys(daySlots)

 const toggleDay = (day) => {
 if (saved.includes(day)) return
 setDaySlots(p => {
 const next = { ...p }
 if (next[day]) {
 delete next[day]
 if (editingDay === day) setEditingDay(null)
 } else {
 // New day inherits the last-used time, or default
 const lastDay = selectedDays[selectedDays.length - 1]
 const inherit = lastDay ? p[lastDay] : { start:'08:00', end:'09:00' }
 next[day] = { ...inherit }
 setEditingDay(day) // auto-open time editor for new day
 }
 return next
 })
 // Clear conflict for that day
 setConflicts(p => { const n={...p}; delete n[day]; return n })
 }

 // Apply preset to a specific day (or ALL days if no editingDay)
 const applyPreset = (preset, targetDay) => {
 const day = targetDay || editingDay
 if (day) {
 setDaySlots(p => ({ ...p, [day]: { start: preset.start, end: preset.end } }))
 } else {
 // Apply to all selected days
 setDaySlots(p => {
 const next = { ...p }
 Object.keys(next).forEach(d => { next[d] = { start: preset.start, end: preset.end } })
 return next
 })
 }
 }

 const setDayTime = (day, field, val) => {
 setDaySlots(p => ({ ...p, [day]: { ...p[day], [field]: val } }))
 }

 // Apply one time to all days at once
 const applyToAll = () => {
 if (!editingDay || !daySlots[editingDay]) return
 const slot = daySlots[editingDay]
 setDaySlots(p => {
 const next = { ...p }
 Object.keys(next).forEach(d => { next[d] = { ...slot } })
 return next
 })
 toast.success(`${daySlots[editingDay].start}–${daySlots[editingDay].end} applied to all days`)
 }

 const addQuickPattern = (days) => {
 const last = selectedDays[selectedDays.length-1]
 const inherit = last ? daySlots[last] : { start:'08:00', end:'09:00' }
 setDaySlots(p => {
 const next = { ...p }
 days.filter(d => !saved.includes(d)).forEach(d => {
 if (!next[d]) next[d] = { ...inherit }
 })
 return next
 })
 }

 const clearAll = () => { setDaySlots({}); setEditingDay(null) }

 const step1Valid = form.sectionId && form.subjectId && form.room &&
 (userRole !== 'admin' || form.teacherId)

 const handleSubmit = async () => {
 setSaving(true)
 const newConflicts = {}
 const newSaved = []

 for (const day of selectedDays) {
 const slot = daySlots[day]
 try {
 await api.post('/schedules', {
 subjectId: form.subjectId,
 sectionId: form.sectionId,
 teacherId: form.teacherId || undefined,
 room: form.room,
 dayOfWeek: day,
 startTime: slot.start,
 endTime: slot.end,
 })
 newSaved.push(day)
 } catch (err) {
 newConflicts[day] = err.response?.status === 409
 ? (err.response.data?.message || 'Schedule conflict')
 : (err.response?.data?.message || 'Failed')
 }
 }

 setSaved(p => [...p, ...newSaved])
 setConflicts(newConflicts)
 setSaving(false)

 if (newSaved.length) {
 toast.success(
 userRole === 'admin'
 ? `${newSaved.length} schedule${newSaved.length>1?'s':''} created!`
 : `${newSaved.length} schedule${newSaved.length>1?'s':''} submitted for approval.`
 )
 // Remove saved days from slots
 setDaySlots(p => {
 const next = { ...p }
 newSaved.forEach(d => delete next[d])
 return next
 })
 onSave()
 }
 if (Object.keys(newConflicts).length) {
 toast.error(`${Object.keys(newConflicts).length} conflict${Object.keys(newConflicts).length>1?'s':''} — fix and retry.`)
 }
 }

 return (
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm px-4">
 <div className="relative mx-auto my-8 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col">

 {/* Header */}
 <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
 <CalendarDays size={18} className="text-primary"/>
 </div>
 <div>
 <h2 className="font-display font-bold text-slate-900">Add Schedule</h2>
 <p className="text-xs text-slate-400">
 {step===1 ? 'Fill class info first' : 'Pick days — each can have its own time'}
 </p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>

 {/* Step pills */}
 <div className="flex items-center gap-2 px-5 pt-4 flex-shrink-0">
 {[['1','Class Info'],['2','Days & Times']].map(([n, label]) => (
 <button
 key={n}
 onClick={() => (n==='1' || step1Valid) && setStep(Number(n))}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all
 ${step===Number(n)
 ? 'bg-primary text-white'
 : (n==='1'||step1Valid)
 ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
 : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
 >
 <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${step===Number(n)?'bg-white/20':'bg-white/60 text-slate-500'}`}>{n}</span>
 {label}
 </button>
 ))}
 {step1Valid && step===1 && (
 <span className="ml-auto text-xs text-primary font-semibold flex items-center gap-1">
 <Zap size={11}/> Ready for step 2
 </span>
 )}
 </div>

 {/* Body */}
 <div className="flex-1 overflow-y-auto p-5 space-y-4">

 {/* ── STEP 1 ── */}
 {step === 1 && (
 <>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Section <span className="text-red-500">*</span></label>
 <select className="input-field"value={form.sectionId} onChange={handleSectionChange} autoFocus>
 <option value="">— Select Section —</option>
 {['Grade 11','Grade 12'].map(g => {
 const grp = (sections||[]).filter(s => s.grade_level === g)
 if (!grp.length) return null
 return <optgroup key={g} label={g}>
 {grp.map(s => <option key={s.id} value={s.id}>{s.section_name} ({s.strand})</option>)}
 </optgroup>
 })}
 </select>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">
 Subject <span className="text-red-500">*</span>
 {selectedSection && <span className="ml-1.5 text-xs font-normal text-primary">filtered for {selectedSection.grade_level}</span>}
 </label>
 <select className="input-field"value={form.subjectId} onChange={set('subjectId')}>
 <option value="">— Select Subject —</option>
 {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
 </select>
 </div>
 {userRole === 'admin' && (
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teacher <span className="text-red-500">*</span></label>
 <select className="input-field"value={form.teacherId} onChange={set('teacherId')}>
 <option value="">— Select Teacher —</option>
 {(teachers||[]).map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
 </select>
 </div>
 )}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Room <span className="text-red-500">*</span></label>
 <input className="input-field"placeholder="e.g. Room 201, Lab 3, AVR"value={form.room} onChange={set('room')}/>
 </div>
 {step1Valid && (
 <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
 <div className="flex-1 min-w-0 text-xs">
 <p className="font-bold text-slate-800">{filteredSubjects.find(s=>String(s.id)===form.subjectId)?.name}</p>
 <p className="text-slate-500">{selectedSection?.grade_level} · {selectedSection?.section_name} · {form.room}</p>
 </div>
 <button type="button"onClick={() => setStep(2)} className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
 Next →
 </button>
 </div>
 )}
 </>
 )}

 {/* ── STEP 2 ── */}
 {step === 2 && (
 <>
 {/* Day buttons */}
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-2">
 Select Days <span className="text-red-500">*</span>
 <span className="ml-1.5 text-xs font-normal text-slate-400">— each day can have its own time</span>
 </label>
 <div className="grid grid-cols-6 gap-2 mb-2">
 {DAYS.map(day => {
 const slot = daySlots[day]
 const isSelected = !!slot
 const hasConflict = !!conflicts[day]
 const wasSaved = saved.includes(day)
 const isEditing = editingDay === day
 return (
 <button
 key={day}
 type="button"
 onClick={() => !wasSaved && toggleDay(day)}
 disabled={wasSaved}
 className={`py-2 px-1 rounded-xl border-2 text-center transition-all
 ${wasSaved ? 'bg-green-100 border-green-300 text-green-700 cursor-default'
 : hasConflict ? 'bg-red-100 border-red-300 text-red-600'
 : isEditing ? 'bg-primary border-primary text-white ring-2 ring-primary/30'
 : isSelected ? 'bg-primary/10 border-primary text-primary'
 : 'bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:bg-primary/5'}`}
 >
 <span className="text-xs font-bold block">{DAY_SHORT[day]}</span>
 {slot && <span className="text-[9px] font-mono leading-tight block mt-0.5 opacity-80">{slot.start}</span>}
 {wasSaved && <span className="text-[8px] font-bold text-green-600 block">✓</span>}
 {hasConflict && <span className="text-[8px] font-bold text-red-500 block">⚠</span>}
 </button>
 )
 })}
 </div>
 {/* Quick patterns */}
 <div className="flex gap-1.5 flex-wrap">
 {[
 { label:'MWF', days:['Monday','Wednesday','Friday'] },
 { label:'TTh', days:['Tuesday','Thursday'] },
 { label:'M–F', days:['Monday','Tuesday','Wednesday','Thursday','Friday'] },
 { label:'Daily',days:DAYS },
 ].map(({ label, days }) => (
 <button key={label} type="button"
 onClick={() => addQuickPattern(days)}
 className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary border border-slate-200 transition-colors">
 {label}
 </button>
 ))}
 {selectedDays.length > 0 && (
 <button type="button"onClick={clearAll}
 className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
 Clear all
 </button>
 )}
 </div>
 </div>

 {/* Per-day time editor */}
 {selectedDays.length > 0 && (
 <div className="border border-slate-200 rounded-xl overflow-hidden">
 <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
 <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
 <Clock size={12}/> Time per Day
 </span>
 <span className="text-xs text-slate-400">Click a day below to edit</span>
 </div>

 {/* Day rows */}
 <div className="divide-y divide-slate-100">
 {DAYS.filter(d => daySlots[d]).map(day => {
 const slot = daySlots[day]
 const isEditing = editingDay === day
 const hasErr = !!conflicts[day]
 return (
 <div key={day}
 onClick={() => setEditingDay(isEditing ? null : day)}
 className={`px-4 py-3 cursor-pointer transition-colors
 ${isEditing ? 'bg-primary/5' : 'hover:bg-slate-50'}`}>
 <div className="flex items-center gap-3">
 {/* Day badge */}
 <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${DAY_COLOR[day]}`}>
 {day}
 </span>
 {/* Time display */}
 <span className="font-mono text-sm font-semibold text-slate-700 flex-1">
 {slot.start} – {slot.end}
 </span>
 {hasErr && <span className="text-xs text-red-500 font-semibold">⚠ Conflict</span>}
 <span className={`text-xs text-slate-400 transition-transform ${isEditing ? 'rotate-180' : ''}`}>▾</span>
 </div>

 {/* Expanded editor */}
 {isEditing && (
 <div className="mt-3 space-y-3"onClick={e => e.stopPropagation()}>
 {hasErr && (
 <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
 ⚠ {conflicts[day]}
 </div>
 )}
 {/* Preset chips for this day */}
 <div className="flex flex-wrap gap-1.5">
 {TIME_PRESETS.map(p => (
 <button key={p.label} type="button"
 onClick={() => applyPreset(p, day)}
 className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all
 ${slot.start===p.start && slot.end===p.end
 ? 'bg-primary text-white border-primary'
 : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50'}`}>
 {p.label}
 </button>
 ))}
 </div>
 {/* Manual inputs */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs text-slate-500 mb-1">Start</label>
 <input type="time"className="input-field font-mono text-sm"
 value={slot.start}
 onChange={e => setDayTime(day, 'start', e.target.value)}/>
 </div>
 <div>
 <label className="block text-xs text-slate-500 mb-1">End</label>
 <input type="time"className="input-field font-mono text-sm"
 value={slot.end}
 onChange={e => setDayTime(day, 'end', e.target.value)}/>
 </div>
 </div>
 {/* Apply to all */}
 {selectedDays.length > 1 && (
 <button type="button"onClick={applyToAll}
 className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
 ↕ Apply {slot.start}–{slot.end} to all days
 </button>
 )}
 </div>
 )}
 </div>
 )
 })}
 </div>
 </div>
 )}

 {/* Summary */}
 {selectedDays.length > 0 && (
 <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
 <p className="font-bold text-slate-700 mb-1.5">
 Creating {selectedDays.length} schedule{selectedDays.length>1?'s':''}:
 </p>
 <div className="space-y-0.5">
 {DAYS.filter(d => daySlots[d]).map(d => (
 <div key={d} className="flex items-center gap-2">
 <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${DAY_COLOR[d]}`}>{DAY_SHORT[d]}</span>
 <span className="font-mono text-slate-600">{daySlots[d].start} – {daySlots[d].end}</span>
 {conflicts[d] && <span className="text-red-500">⚠</span>}
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 )}
 </div>

 {/* Footer */}
 <div className="flex gap-3 p-5 border-t border-slate-100 flex-shrink-0">
 {step === 2 && <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>}
 <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
 {step === 1
 ? <button onClick={() => setStep(2)} disabled={!step1Valid} className="btn-primary flex-1 justify-center">
 Next: Pick Days →
 </button>
 : <button onClick={handleSubmit} disabled={saving || !selectedDays.length} className="btn-primary flex-1 justify-center">
 {saving
 ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
 : <><CalendarDays size={15}/>Create {selectedDays.length > 1 ? `${selectedDays.length} Schedules` : 'Schedule'}</>
 }
 </button>
 }
 </div>
 </div>
 </div>
 )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
 const { user } = useAuth()
 const qc = useQueryClient()
 const [modal, setModal] = useState(false)
 const [confirm, setConfirm] = useState(null)
 const [filter, setFilter] = useState({ day:'', subject:'', section:'' })
 const [statusFilter, setStatusFilter] = useState('all')

 const { data: sections } = useQuery({ queryKey:['sections'], queryFn:()=>api.get('/sections').then(r=>r.data.data) })
 const { data: subjects } = useQuery({ queryKey:['subjects'], queryFn:()=>api.get('/subjects').then(r=>r.data.data) })
 const { data: teachers } = useQuery({ queryKey:['teachers'], queryFn:()=>api.get('/teachers').then(r=>r.data.data), enabled: user?.role==='admin' })

 const { data: schedules, isLoading } = useQuery({
 queryKey: ['schedules', user?.role, user?.teacherId, user?.sectionId],
 queryFn: async () => {
 if (user?.role === 'teacher' && user?.teacherId)
 return api.get(`/schedules/teacher/${user.teacherId}`).then(r => r.data.data)
 if (user?.role === 'student' && user?.sectionId)
 return api.get(`/schedules/section/${user.sectionId}`).then(r => r.data.data)
 if (user?.role === 'admin')
 return api.get('/schedules/pending').then(r => r.data.data)
 return []
 },
 staleTime: 0,
 })

 const approveMut = async (id, action) => {
 try { await api.patch(`/schedules/${id}/approve`, { action }); toast.success(`Schedule ${action}.`); qc.invalidateQueries(['schedules']) }
 catch { toast.error('Failed.') }
 }
 const deleteMut = async (id) => {
 setConfirm({
 title: 'Delete Schedule?',
 message: 'This schedule will be permanently removed.',
 confirmLabel: 'Delete', variant: 'danger',
 onConfirm: async () => {
 try { await api.delete(`/schedules/${id}`); toast.success('Deleted.'); qc.invalidateQueries(['schedules']) }
 catch { toast.error('Failed.') }
 }
 })
 }

 // Build unique subject/section options from loaded schedules
 const subjectOptions = useMemo(() => {
 const map = new Map()
 ;(schedules||[]).forEach(s => {
 const name = s.subject_name || s.subject
 if (name && !map.has(name)) map.set(name, name)
 })
 return [...map.keys()].sort()
 }, [schedules])

 const sectionOptions = useMemo(() => {
 const map = new Map()
 ;(schedules||[]).forEach(s => {
 const key = `${s.grade_level}||${s.section_name}`
 if (s.section_name && !map.has(key)) map.set(key, { key, label:`${s.grade_level} · ${s.section_name}` })
 })
 return [...map.values()].sort((a,b) => a.label.localeCompare(b.label))
 }, [schedules])

 // Apply filters
 // For admin: apply status filter on top of other filters
 const statusFiltered = useMemo(() => {
 if (user?.role !== 'admin' || statusFilter === 'all') return schedules || []
 return (schedules || []).filter(s => s.status === statusFilter)
 }, [schedules, statusFilter, user?.role])

 const filtered = useMemo(() => (statusFiltered||[]).filter(s => {
 const subjectName = s.subject_name || s.subject
 if (filter.day && s.day_of_week !== filter.day) return false
 if (filter.subject && subjectName !== filter.subject) return false
 if (filter.section && `${s.grade_level}||${s.section_name}` !== filter.section) return false
 return true
 }), [schedules, filter])

 const hasFilter = filter.day || filter.subject || filter.section

 // Group by day for weekly view
 const byDay = useMemo(() => DAYS.reduce((acc, day) => {
 // Weekly view shows only approved schedules
 acc[day] = (schedules||[]).filter(s => s.day_of_week === day && s.status === 'approved')
 return acc
 }, {}), [schedules])

 const statusBadge = { approved:'badge-green', pending:'badge-amber', rejected:'badge-red' }

 return (
 <div className="p-6 lg:p-8 max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Schedules</h1>
 <p className="text-slate-500 text-sm mt-1">
 {user?.role==='admin'
 ? (() => {
 const approved = (schedules||[]).filter(s=>s.status==='approved').length
 const pending = (schedules||[]).filter(s=>s.status==='pending').length
 return `${approved} approved · ${pending} pending`
 })()
 : `${schedules?.length||0} class${schedules?.length!==1?'es':''} this semester`}
 </p>
 </div>
 {(user?.role==='teacher'||user?.role==='admin') && (
 <button onClick={() => setModal(true)} className="btn-primary">
 <Plus size={16}/> Add Schedule
 </button>
 )}
 </div>

 {/* Weekly grid */}
 {user?.role !== 'admin' && (
 <div className="card mb-6 overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
 <CalendarDays size={14} className="text-slate-400"/>
 <span className="text-sm font-bold text-slate-700">Weekly View</span>
 </div>
 <div className="overflow-x-auto">
 <div className="grid min-w-[600px]"style={{gridTemplateColumns:`repeat(5,1fr)`}}>
 {DAYS.slice(0,5).map(day => (
 <div key={day} className="border-r border-slate-100 last:border-r-0">
 <div className={`px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-b border-slate-100 ${DAY_COLOR[day].split(' ').slice(0,2).join(' ')}`}>
 {day.slice(0,3)}
 </div>
 <div className="p-2 space-y-1.5 min-h-28">
 {byDay[day].map(s => (
 <div key={s.id} className="rounded-lg p-2 bg-primary/5 border border-primary/15 text-xs">
 <p className="font-bold text-primary truncate text-[11px]">{s.subject_name||s.subject}</p>
 <p className="text-slate-400 font-mono text-[10px] mt-0.5">{s.start_time}–{s.end_time}</p>
 <p className="text-slate-400 text-[10px] truncate">{s.room}</p>
 </div>
 ))}
 {!byDay[day].length && <p className="text-center text-slate-200 text-[10px] pt-4">Free</p>}
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Filters */}
 <div className="card p-4 mb-5 flex gap-3 flex-wrap items-center">
 <Filter size={14} className="text-slate-400 flex-shrink-0"/>

 {/* Day */}
 {user?.role === 'admin' && (
 <select className="input-field w-36 text-sm"value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
 <option value="all">All Status</option>
 <option value="approved">Approved</option>
 <option value="pending">Pending</option>
 <option value="rejected">Rejected</option>
 </select>
 )}
 <select className="input-field w-36 text-sm"value={filter.day} onChange={e=>setFilter(p=>({...p,day:e.target.value}))}>
 <option value="">All Days</option>
 {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
 </select>

 {/* Subject — available for teacher and admin */}
 {(user?.role==='teacher'||user?.role==='admin') && subjectOptions.length > 0 && (
 <select className="input-field flex-1 min-w-40 text-sm"value={filter.subject} onChange={e=>setFilter(p=>({...p,subject:e.target.value}))}>
 <option value="">All Subjects</option>
 {subjectOptions.map(s=><option key={s} value={s}>{s}</option>)}
 </select>
 )}

 {/* Section — available for teacher and admin */}
 {(user?.role==='teacher'||user?.role==='admin') && sectionOptions.length > 0 && (
 <select className="input-field flex-1 min-w-44 text-sm"value={filter.section} onChange={e=>setFilter(p=>({...p,section:e.target.value}))}>
 <option value="">All Sections</option>
 {sectionOptions.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
 </select>
 )}

 {hasFilter && (
 <button onClick={()=>setFilter({day:'',subject:'',section:''})} className="btn-ghost text-xs flex-shrink-0">
 <X size={12}/> Clear
 </button>
 )}

 <span className="ml-auto text-xs text-slate-400 flex-shrink-0">
 {filtered.length}{schedules?.length!==filtered.length?` / ${schedules?.length}`:''} schedule{filtered.length!==1?'s':''}
 </span>
 </div>

 {/* Table */}
 <div className="card overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-100">
 <span className="text-sm font-bold text-slate-700">
 {user?.role==='admin' ? 'All Schedules' : 'All Schedules'}
 </span>
 </div>
 {isLoading ? <TableSkeleton cols={6} rows={8}/> : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-slate-50/80 border-b border-slate-100">
 <tr>
 {['Subject','Section','Day','Time','Room','Teacher','Status',''].map(h=>(
 <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-50">
 {filtered.map(s => (
 <tr key={s.id} className="hover:bg-slate-50/60 group transition-colors">
 <td className="px-4 py-3 font-semibold text-slate-800">{s.subject_name||s.subject}</td>
 <td className="px-4 py-3 text-slate-600 text-xs">{s.grade_level} · {s.section_name}</td>
 <td className="px-4 py-3">
 <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${DAY_COLOR[s.day_of_week]||'bg-slate-100 text-slate-500 border-slate-200'}`}>
 {DAY_SHORT[s.day_of_week]||s.day_of_week}
 </span>
 </td>
 <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{s.start_time}–{s.end_time}</td>
 <td className="px-4 py-3 text-slate-500 text-xs">{s.room}</td>
 <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{s.first_name} {s.last_name}</td>
 <td className="px-4 py-3"><span className={statusBadge[s.status]||'badge-slate'}>{s.status}</span></td>
 <td className="px-4 py-3">
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 {user?.role==='admin' && s.status==='pending' && (
 <>
 <button onClick={()=>approveMut(s.id,'approved')} className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg"title="Approve"><CheckCircle size={14}/></button>
 <button onClick={()=>approveMut(s.id,'rejected')} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"title="Reject"><X size={14}/></button>
 </>
 )}
 {(user?.role==='admin'||user?.role==='teacher') && (
 <button onClick={()=>deleteMut(s.id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg"title="Delete"><Trash2 size={13}/></button>
 )}
 </div>
 </td>
 </tr>
 ))}
 {!filtered.length && (
 <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400">
 <CalendarDays size={28} className="mx-auto mb-2 opacity-20"/>
 <p>{hasFilter ? 'No schedules match your filters.' : 'No schedules found.'}</p>
 </td></tr>
 )}
 </tbody>
 </table>
 </div>
 )}
 </div>

 <ConfirmDialog {...confirm} onClose={() => setConfirm(null)}/>
 {modal && (
 <ScheduleModal
 userRole={user?.role}
 sections={sections}
 subjects={subjects}
 teachers={teachers}
 onClose={() => setModal(false)}
 onSave={() => qc.invalidateQueries(['schedules'])}
 />
 )}
 </div>
 )
}
