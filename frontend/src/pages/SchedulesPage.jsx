import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, X, AlertTriangle, CheckCircle, Trash2,
  Clock, CalendarDays, Copy, ChevronDown, Zap
} from 'lucide-react'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAY_SHORT = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat' }
const DAY_COLOR = {
  Monday:    'bg-blue-100 text-blue-700 border-blue-200',
  Tuesday:   'bg-purple-100 text-purple-700 border-purple-200',
  Wednesday: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Thursday:  'bg-amber-100 text-amber-700 border-amber-200',
  Friday:    'bg-red-100 text-red-700 border-red-200',
  Saturday:  'bg-slate-100 text-slate-600 border-slate-200',
}

// Common time presets for quick selection
const TIME_PRESETS = [
  { label:'7:00–8:00',   start:'07:00', end:'08:00' },
  { label:'8:00–9:00',   start:'08:00', end:'09:00' },
  { label:'9:00–10:00',  start:'09:00', end:'10:00' },
  { label:'10:00–11:00', start:'10:00', end:'11:00' },
  { label:'11:00–12:00', start:'11:00', end:'12:00' },
  { label:'1:00–2:00',   start:'13:00', end:'14:00' },
  { label:'2:00–3:00',   start:'14:00', end:'15:00' },
  { label:'3:00–4:00',   start:'15:00', end:'16:00' },
  { label:'4:00–5:00',   start:'16:00', end:'17:00' },
]

// ─── Fast Schedule Modal ──────────────────────────────────────────────────────
function ScheduleModal({ onClose, onSave, sections, subjects, teachers, userRole }) {
  const [step, setStep]         = useState(1) // 1=who/where  2=when
  const [form, setForm]         = useState({
    sectionId: '', subjectId: '', teacherId: '', room: ''
  })
  const [selectedDays, setSelectedDays]   = useState([])
  const [timePreset,   setTimePreset]     = useState(null)
  const [startTime,    setStartTime]      = useState('08:00')
  const [endTime,      setEndTime]        = useState('09:00')
  const [saving,       setSaving]         = useState(false)
  const [conflicts,    setConflicts]      = useState([])
  const [saved,        setSaved]          = useState([]) // successfully saved days

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const selectedSection = (sections||[]).find(s => String(s.id) === String(form.sectionId))
  const filteredSubjects = (subjects||[]).filter(s =>
    !selectedSection || s.grade_level === 'Both' || s.grade_level === selectedSection.grade_level
  )

  const handleSectionChange = (e) => {
    const newId = e.target.value
    const newSec = (sections||[]).find(s => String(s.id) === String(newId))
    const curSub = (subjects||[]).find(s => String(s.id) === String(form.subjectId))
    const stillValid = !curSub || !newSec ||
      curSub.grade_level === 'Both' || curSub.grade_level === newSec.grade_level
    setForm(p => ({ ...p, sectionId: newId, subjectId: stillValid ? p.subjectId : '' }))
  }

  const toggleDay = (day) => {
    setSelectedDays(p => p.includes(day) ? p.filter(d => d !== day) : [...p, day])
    setConflicts(p => p.filter(c => c.day !== day)) // clear conflict for toggled day
  }

  const applyPreset = (preset) => {
    setTimePreset(preset.label)
    setStartTime(preset.start)
    setEndTime(preset.end)
  }

  const step1Valid = form.sectionId && form.subjectId && form.room &&
    (userRole !== 'admin' || form.teacherId)
  const step2Valid = selectedDays.length > 0

  // Submit — one API call per selected day
  const handleSubmit = async () => {
    if (!step1Valid || !step2Valid) return
    setSaving(true)
    setConflicts([])

    const newConflicts = []
    const newSaved     = []

    for (const day of selectedDays) {
      try {
        await api.post('/schedules', {
          subjectId:  form.subjectId,
          sectionId:  form.sectionId,
          teacherId:  form.teacherId || undefined,
          room:       form.room,
          dayOfWeek:  day,
          startTime,
          endTime,
        })
        newSaved.push(day)
      } catch (err) {
        if (err.response?.status === 409) {
          newConflicts.push({
            day,
            message: err.response.data?.message || 'Conflict',
            details: err.response.data?.conflicts || [],
          })
        } else {
          newConflicts.push({ day, message: err.response?.data?.message || 'Failed' })
        }
      }
    }

    setSaved(newSaved)
    setConflicts(newConflicts)
    setSaving(false)

    if (newSaved.length > 0) {
      const msg = userRole === 'admin'
        ? `${newSaved.length} schedule${newSaved.length>1?'s':''} created!`
        : `${newSaved.length} schedule${newSaved.length>1?'s':''} submitted for approval.`
      toast.success(msg)
      // Remove saved days from selection
      setSelectedDays(p => p.filter(d => !newSaved.includes(d)))
      onSave()
    }
    if (newConflicts.length > 0) {
      toast.error(`${newConflicts.length} conflict${newConflicts.length>1?'s':''} detected.`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarDays size={18} className="text-primary"/>
            </div>
            <div>
              <h2 className="font-display font-bold text-slate-900">Add Schedule</h2>
              <p className="text-xs text-slate-400">Select multiple days at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {[['1', 'Class Info'], ['2', 'Days & Time']].map(([n, label]) => (
            <button
              key={n}
              onClick={() => step1Valid || n==='1' ? setStep(Number(n)) : null}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                step === Number(n)
                  ? 'bg-primary text-white'
                  : step1Valid || n==='1'
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                  : 'bg-slate-50 text-slate-300 cursor-not-allowed'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === Number(n) ? 'bg-white/20' : 'bg-slate-300 text-white'
              }`}>{n}</span>
              {label}
            </button>
          ))}
          <div className="flex-1 h-px bg-slate-100 mx-1"/>
          {step1Valid && (
            <div className="text-xs text-primary font-semibold flex items-center gap-1">
              <Zap size={11}/> Ready for step 2
            </div>
          )}
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* ── STEP 1: Class Info ── */}
          {step === 1 && (
            <>
              {/* Section */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Section <span className="text-red-500">*</span></label>
                <select className="input-field" value={form.sectionId} onChange={handleSectionChange} required autoFocus>
                  <option value="">— Select Section —</option>
                  {['Grade 11','Grade 12'].map(g => {
                    const grp = (sections||[]).filter(s => s.grade_level === g)
                    if (!grp.length) return null
                    return (
                      <optgroup key={g} label={g}>
                        {grp.map(s => (
                          <option key={s.id} value={s.id}>{s.section_name} ({s.strand})</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                  {selectedSection && (
                    <span className="ml-2 text-xs font-normal text-primary">filtered for {selectedSection.grade_level}</span>
                  )}
                </label>
                <select className="input-field" value={form.subjectId} onChange={set('subjectId')} required>
                  <option value="">— Select Subject —</option>
                  {filteredSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              {/* Teacher (admin only) */}
              {userRole === 'admin' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teacher <span className="text-red-500">*</span></label>
                  <select className="input-field" value={form.teacherId} onChange={set('teacherId')} required>
                    <option value="">— Select Teacher —</option>
                    {(teachers||[]).map(t => (
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Room */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Room <span className="text-red-500">*</span></label>
                <input
                  className="input-field"
                  placeholder="e.g. Room 201, Lab 3, AVR"
                  value={form.room}
                  onChange={set('room')}
                  required
                />
              </div>

              {/* Summary preview */}
              {step1Valid && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CalendarDays size={14} className="text-primary"/>
                  </div>
                  <div className="text-xs text-slate-600 min-w-0">
                    <p className="font-bold text-slate-800 truncate">
                      {filteredSubjects.find(s=>String(s.id)===form.subjectId)?.name}
                    </p>
                    <p className="text-slate-500">
                      {selectedSection?.grade_level} · {selectedSection?.section_name} · {form.room}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="ml-auto btn-primary text-xs py-1.5 px-3 flex-shrink-0"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: Days & Time ── */}
          {step === 2 && (
            <>
              {/* Day multi-select */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Days <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-slate-400">select one or more</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {DAYS.map(day => {
                    const isSelected  = selectedDays.includes(day)
                    const hasConflict = conflicts.find(c => c.day === day)
                    const wasSaved    = saved.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => !wasSaved && toggleDay(day)}
                        disabled={wasSaved}
                        className={`py-2.5 px-1 rounded-xl text-xs font-bold border-2 transition-all text-center
                          ${wasSaved
                            ? 'bg-green-100 border-green-300 text-green-700 cursor-default'
                            : hasConflict
                            ? 'bg-red-100 border-red-300 text-red-600'
                            : isSelected
                            ? 'bg-primary border-primary text-white shadow-sm shadow-primary/30'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                      >
                        {DAY_SHORT[day]}
                        {wasSaved && <div className="text-[9px] mt-0.5">✓ Saved</div>}
                        {hasConflict && <div className="text-[9px] mt-0.5">⚠ Conflict</div>}
                      </button>
                    )
                  })}
                </div>
                {/* Quick selects */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    { label: 'MWF', days: ['Monday','Wednesday','Friday'] },
                    { label: 'TTh', days: ['Tuesday','Thursday'] },
                    { label: 'M–F', days: ['Monday','Tuesday','Wednesday','Thursday','Friday'] },
                    { label: 'Daily', days: DAYS },
                  ].map(({ label, days }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSelectedDays(days.filter(d => !saved.includes(d)))}
                      className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-colors border border-slate-200"
                    >
                      {label}
                    </button>
                  ))}
                  {selectedDays.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDays([])}
                      className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Time presets */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Time Slot <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-slate-400">or set manually below</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {TIME_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-center
                        ${timePreset === p.label
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-primary/5'
                        }`}
                    >
                      <Clock size={10} className="inline mb-0.5 mr-0.5 opacity-70"/>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label>
                  <input
                    type="time"
                    className="input-field font-mono"
                    value={startTime}
                    onChange={e => { setStartTime(e.target.value); setTimePreset(null) }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label>
                  <input
                    type="time"
                    className="input-field font-mono"
                    value={endTime}
                    onChange={e => { setEndTime(e.target.value); setTimePreset(null) }}
                  />
                </div>
              </div>

              {/* Conflict details */}
              {conflicts.length > 0 && (
                <div className="space-y-2">
                  {conflicts.map(c => (
                    <div key={c.day} className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2">
                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5"/>
                      <div className="text-xs">
                        <p className="font-bold text-red-700">{c.day}: {c.message}</p>
                        {c.details?.map((d,i) => (
                          <p key={i} className="text-red-500 mt-0.5">↳ {d.day} {d.start}–{d.end}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {selectedDays.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <p className="font-bold text-slate-800 mb-1">
                    Will create {selectedDays.length} schedule{selectedDays.length>1?'s':''}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDays.map(d => (
                      <span key={d} className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${DAY_COLOR[d]}`}>
                        {DAY_SHORT[d]} {startTime}–{endTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-100">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="btn-secondary">
              ← Back
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="btn-primary flex-1 justify-center"
            >
              Next: Pick Days →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving || !step2Valid}
              className="btn-primary flex-1 justify-center"
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>
                : <><CalendarDays size={15}/>Create {selectedDays.length > 1 ? `${selectedDays.length} Schedules` : 'Schedule'}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const { user } = useAuth()
  const qc       = useQueryClient()
  const [modal,  setModal]  = useState(false)
  const [filter, setFilter] = useState({ day: '', status: '' })

  const { data: sections } = useQuery({ queryKey:['sections'], queryFn:()=>api.get('/sections').then(r=>r.data.data) })
  const { data: subjects  } = useQuery({ queryKey:['subjects'],  queryFn:()=>api.get('/subjects').then(r=>r.data.data) })
  const { data: teachers  } = useQuery({ queryKey:['teachers'],  queryFn:()=>api.get('/teachers').then(r=>r.data.data), enabled: user?.role==='admin' })

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['schedules', user?.teacherId, user?.sectionId],
    queryFn: async () => {
      if (user?.role === 'teacher' && user?.teacherId)
        return api.get(`/schedules/teacher/${user.teacherId}`).then(r=>r.data.data)
      if (user?.role === 'student' && user?.sectionId)
        return api.get(`/schedules/section/${user.sectionId}`).then(r=>r.data.data)
      if (user?.role === 'admin')
        return api.get('/schedules/pending').then(r=>r.data.data)
      return []
    },
    staleTime: 0,
  })

  const approveMut = async (id, action) => {
    try {
      await api.patch(`/schedules/${id}/approve`, { action })
      toast.success(`Schedule ${action}.`)
      qc.invalidateQueries(['schedules'])
    } catch { toast.error('Failed.') }
  }

  const deleteMut = async (id) => {
    if (!confirm('Delete this schedule?')) return
    try { await api.delete(`/schedules/${id}`); toast.success('Deleted.'); qc.invalidateQueries(['schedules']) }
    catch { toast.error('Failed.') }
  }

  // Filtered schedules
  const filtered = useMemo(() => {
    return (schedules||[]).filter(s => {
      if (filter.day    && s.day_of_week !== filter.day)    return false
      if (filter.status && s.status      !== filter.status) return false
      return true
    })
  }, [schedules, filter])

  // Group by day for weekly view
  const byDay = useMemo(() => DAYS.reduce((acc, day) => {
    acc[day] = (schedules||[]).filter(s => s.day_of_week === day)
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
              ? `${schedules?.length||0} pending approvals`
              : `${schedules?.length||0} class${schedules?.length!==1?'es':''} this semester`
            }
          </p>
        </div>
        {(user?.role==='teacher'||user?.role==='admin') && (
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus size={16}/> Add Schedule
          </button>
        )}
      </div>

      {/* Weekly grid — non-admin */}
      {user?.role !== 'admin' && (
        <div className="card mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <CalendarDays size={15} className="text-slate-400"/>
            <span className="text-sm font-bold text-slate-700">Weekly View</span>
          </div>
          <div className="overflow-x-auto">
            <div className="grid min-w-[600px]" style={{gridTemplateColumns:`repeat(${DAYS.slice(0,5).length}, 1fr)`}}>
              {DAYS.slice(0,5).map(day => (
                <div key={day} className="border-r border-slate-100 last:border-r-0">
                  <div className={`px-3 py-2 text-center text-xs font-bold uppercase tracking-wider border-b border-slate-100 ${DAY_COLOR[day].replace('border-','').split(' ').slice(0,2).join(' ')}`}>
                    {day.slice(0,3)}
                  </div>
                  <div className="p-2 space-y-1.5 min-h-28">
                    {byDay[day].map(s => (
                      <div key={s.id} className="rounded-lg p-2 bg-primary/5 border border-primary/15 text-xs hover:bg-primary/10 transition-colors">
                        <p className="font-bold text-primary truncate text-[11px]">{s.subject_name||s.subject}</p>
                        <p className="text-slate-500 mt-0.5 font-mono text-[10px]">{s.start_time}–{s.end_time}</p>
                        <p className="text-slate-400 text-[10px] truncate">{s.room}</p>
                      </div>
                    ))}
                    {!byDay[day].length && (
                      <p className="text-center text-slate-300 text-[10px] pt-4">Free</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {schedules?.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          <select
            className="input-field w-36 text-sm"
            value={filter.day}
            onChange={e => setFilter(p => ({ ...p, day: e.target.value }))}
          >
            <option value="">All Days</option>
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {user?.role === 'admin' && (
            <select
              className="input-field w-36 text-sm"
              value={filter.status}
              onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
          {(filter.day || filter.status) && (
            <button onClick={() => setFilter({ day:'', status:'' })} className="btn-ghost text-xs">
              <X size={12}/> Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400 self-center">
            {filtered.length} of {schedules?.length} showing
          </span>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700">
            {user?.role==='admin' ? 'Pending Approvals' : 'All Schedules'}
          </span>
        </div>
        {isLoading ? (
          <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"/></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  {['Subject','Section','Day','Time','Room','Teacher','Status',''].map(h => (
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
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {s.start_time}–{s.end_time}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.room}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{s.first_name} {s.last_name}</td>
                    <td className="px-4 py-3">
                      <span className={statusBadge[s.status]||'badge-slate'}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {user?.role==='admin' && s.status==='pending' && (
                          <>
                            <button onClick={()=>approveMut(s.id,'approved')} className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg" title="Approve">
                              <CheckCircle size={14}/>
                            </button>
                            <button onClick={()=>approveMut(s.id,'rejected')} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg" title="Reject">
                              <X size={14}/>
                            </button>
                          </>
                        )}
                        {(user?.role==='admin'||user?.role==='teacher') && (
                          <button onClick={()=>deleteMut(s.id)} className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg" title="Delete">
                            <Trash2 size={13}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-400">
                    <CalendarDays size={28} className="mx-auto mb-2 opacity-20"/>
                    <p>No schedules found.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
