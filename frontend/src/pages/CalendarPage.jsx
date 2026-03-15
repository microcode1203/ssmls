// @v2-fixed-imports
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

const TYPE_COLOR = {
  exam:     'bg-red-100 text-red-700 border-red-200',
  holiday:  'bg-green-100 text-green-700 border-green-200',
  activity: 'bg-blue-100 text-blue-700 border-blue-200',
  deadline: 'bg-amber-100 text-amber-700 border-amber-200',
  other:    'bg-slate-100 text-slate-600 border-slate-200',
}
const DAYS_OF_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const today = new Date()
  const [current, setCurrent] = useState({ month: today.getMonth()+1, year: today.getFullYear() })
  const [adding,  setAdding]   = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [form, setForm]       = useState({ title:'', description:'', eventDate:'', endDate:'', type:'activity', targetRole:'all' })

  const { data: events } = useQuery({
    queryKey: ['calendar', current.month, current.year],
    queryFn: () => api.get('/calendar', { params: { month: current.month, year: current.year } }).then(r=>r.data.data),
    staleTime: 0,
  })

  const set = k => e => setForm(p=>({...p,[k]:e.target.value}))

  const addEvent = async e => {
    e.preventDefault()
    try {
      await api.post('/calendar', form)
      toast.success('Event added!')
      setAdding(false)
      setForm({ title:'', description:'', eventDate:'', endDate:'', type:'activity', targetRole:'all' })
      qc.invalidateQueries(['calendar'])
    } catch(err) { toast.error(err.response?.data?.message||'Failed.') }
  }

  const deleteEvent = async id => {
    setConfirm({
      title: 'Delete Event?',
      message: 'This calendar event will be permanently removed.',
      confirmLabel: 'Delete', variant: 'danger',
      onConfirm: async () => {
        await api.delete(`/calendar/${id}`).catch(()=>{})
        qc.invalidateQueries(['calendar'])
        toast.success('Event deleted.')
      }
    })
  }

  // Build calendar grid
  const firstDay = new Date(current.year, current.month-1, 1).getDay()
  const daysInMonth = new Date(current.year, current.month, 0).getDate()
  const cells = []
  for (let i=0; i<firstDay; i++) cells.push(null)
  for (let d=1; d<=daysInMonth; d++) cells.push(d)

  const getEventsForDay = d => {
    if (!d) return []
    const dateStr = `${current.year}-${String(current.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return (events||[]).filter(e => e.event_date?.slice(0,10) === dateStr)
  }

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">School Calendar</h1>
          <p className="text-slate-500 text-sm mt-1">Events, exams, and school activities</p>
        </div>
        {(user?.role==='admin'||user?.role==='teacher') && (
          <button onClick={()=>setAdding(true)} className="btn-primary"><Plus size={15}/>Add Event</button>
        )}
      </div>

      {/* Month nav */}
      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={()=>setCurrent(p=>{ const d=new Date(p.year,p.month-2,1); return {month:d.getMonth()+1,year:d.getFullYear()} })}
            className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={18}/></button>
          <h2 className="font-display font-bold text-slate-900">{monthNames[current.month-1]} {current.year}</h2>
          <button onClick={()=>setCurrent(p=>{ const d=new Date(p.year,p.month,1); return {month:d.getMonth()+1,year:d.getFullYear()} })}
            className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={18}/></button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_OF_WEEK.map(d=><div key={d} className="text-center text-xs font-bold text-slate-400 py-1">{d}</div>)}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d,i)=>{
            const evs = getEventsForDay(d)
            const isToday = d===today.getDate()&&current.month===today.getMonth()+1&&current.year===today.getFullYear()
            return (
              <div key={i} className={`min-h-16 p-1 rounded-lg border ${d?'border-slate-100':'border-transparent'} ${isToday?'bg-primary/5 border-primary/30':''}`}>
                {d&&<p className={`text-xs font-semibold mb-0.5 w-5 h-5 flex items-center justify-center rounded-full
                  ${isToday?'bg-primary text-white':'text-slate-600'}`}>{d}</p>}
                <div className="space-y-0.5">
                  {evs.slice(0,2).map(e=>(
                    <div key={e.id} className={`text-[9px] font-semibold px-1 py-0.5 rounded truncate border ${TYPE_COLOR[e.type]}`}>
                      {e.title}
                    </div>
                  ))}
                  {evs.length>2&&<div className="text-[9px] text-slate-400">+{evs.length-2} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      <div className="card p-5">
        <h3 className="font-bold text-slate-800 mb-4">Events this Month</h3>
        {(events||[]).length===0 ? (
          <p className="text-center text-slate-400 py-8 text-sm">No events this month.</p>
        ) : (
          <div className="space-y-2">
            {(events||[]).map(e=>(
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 group">
                <div className={`text-xs font-bold px-2 py-1 rounded-lg border flex-shrink-0 ${TYPE_COLOR[e.type]}`}>
                  {e.type.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{e.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(e.event_date).toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'})}
                    {e.description&&` · ${e.description}`}
                  </p>
                </div>
                {(user?.role==='admin'||(user?.role==='teacher'&&e.first_name)) && (
                  <button onClick={()=>deleteEvent(e.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                    <X size={13}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add event modal */}
      {adding&&(
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-display font-bold text-slate-900">Add Event</h2>
              <button onClick={()=>setAdding(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
            </div>
            <form onSubmit={addEvent} className="p-5 space-y-4">
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Title <span className="text-red-500">*</span></label>
                <input className="input-field" value={form.title} onChange={set('title')} required/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                  <input type="date" className="input-field" value={form.eventDate} onChange={set('eventDate')} required/></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">End Date</label>
                  <input type="date" className="input-field" value={form.endDate} onChange={set('endDate')}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
                  <select className="input-field" value={form.type} onChange={set('type')}>
                    {['exam','holiday','activity','deadline','other'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Visible to</label>
                  <select className="input-field" value={form.targetRole} onChange={set('targetRole')}>
                    {['all','student','teacher','admin'].map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                  </select></div>
              </div>
              <div><label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea className="input-field h-20 resize-none" value={form.description} onChange={set('description')}/></div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setAdding(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center"><Plus size={15}/>Add Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ConfirmDialog rendered at bottom
