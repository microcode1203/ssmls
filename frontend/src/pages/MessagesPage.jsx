// @v2-fixed-imports
import { useState } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../components/ui/Skeleton'
import { fullName, formalName, initials } from '../utils/nameUtils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Send, Inbox, Mail, X, Reply, ChevronRight } from 'lucide-react'

function ComposeModal({ onClose, onSent, contacts }) {
 const [form, setForm] = useState({ receiverId:'', subject:'', body:'' })
 const [saving, setSaving] = useState(false)
 const set = k => e => setForm(p=>({...p,[k]:e.target.value}))
 const handleSubmit = async e => {
 e.preventDefault(); setSaving(true)
 try { await api.post('/messages', form); toast.success('Message sent!'); onSent() }
 catch(err) { toast.error(err.response?.data?.message||'Failed to send.') }
 finally { setSaving(false) }
 }
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm modal-active">
 <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <h2 className="font-display font-bold text-slate-900">New Message</h2>
 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>
 <form onSubmit={handleSubmit} className="p-5 space-y-4">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">To <span className="text-red-500">*</span></label>
 <select className="input-field"value={form.receiverId} onChange={set('receiverId')} required>
 <option value="">— Select recipient —</option>
 {(contacts||[]).map(c=>(
 <option key={c.id} value={c.id}>{formalName(c.first_name, c.middle_name, c.last_name)} ({c.role})</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
 <input className="input-field"placeholder="Optional subject"value={form.subject} onChange={set('subject')}/>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Message <span className="text-red-500">*</span></label>
 <textarea className="input-field h-32 resize-none"placeholder="Write your message…"value={form.body} onChange={set('body')} required/>
 </div>
 <div className="flex gap-3">
 <button type="button"onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button type="submit"disabled={saving} className="btn-primary flex-1 justify-center">
 {saving?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending…</>:<><Send size={15}/>Send</>}
 </button>
 </div>
 </form>
 </div>
 </div>
 )
}

export default function MessagesPage() {
 const { user } = useAuth()
 const qc = useQueryClient()
 const [tab, setTab] = useState('inbox')
 const [compose, setCompose] = useState(false)
 const [selected, setSelected] = useState(null)

 const { data: inbox } = useQuery({ queryKey:['inbox'], queryFn:()=>api.get('/messages/inbox').then(r=>r.data), staleTime:0 })
 const { data: sent } = useQuery({ queryKey:['sent'], queryFn:()=>api.get('/messages/sent').then(r=>r.data.data), staleTime:0 })
 const { data: contacts } = useQuery({ queryKey:['contacts'], queryFn:()=>api.get('/messages/contacts').then(r=>r.data.data) })

 const markRead = async id => {
 await api.patch(`/messages/${id}/read`).catch(()=>{})
 qc.invalidateQueries(['inbox'])
 }

 const messages = tab==='inbox' ? (inbox?.data||[]) : (sent||[])

 return (
 <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Messages</h1>
 <p className="text-slate-500 text-sm mt-1">{inbox?.unread||0} unread</p>
 </div>
 <button onClick={()=>setCompose(true)} className="btn-primary"><Send size={15}/>Compose</button>
 </div>

 <div className="flex gap-4 flex-col md:flex-row">
 {/* Sidebar */}
 <div className="md:w-56 flex-shrink-0">
 <div className="card p-2 space-y-1">
 {[['inbox','Inbox',inbox?.unread],['sent','Sent',null]].map(([id,label,badge])=>(
 <button key={id} onClick={()=>{setTab(id);setSelected(null)}}
 className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all
 ${tab===id?'bg-primary text-white':'text-slate-600 hover:bg-slate-50'}`}>
 <span className="flex items-center gap-2">
 {id==='inbox'?<Inbox size={15}/>:<Send size={15}/>}{label}
 </span>
 {badge>0&&<span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{badge}</span>}
 </button>
 ))}
 </div>
 </div>

 {/* Message list */}
 <div className="flex-1 min-w-0">
 {selected ? (
 <div className="card p-5">
 <button onClick={()=>setSelected(null)} className="text-xs text-primary mb-4 flex items-center gap-1 hover:underline">← Back</button>
 <h3 className="font-bold text-slate-900 text-lg">{selected.subject}</h3>
 <p className="text-xs text-slate-400 mt-1 mb-4">
 {tab==='inbox'?`From: ${fullName(selected.first_name, selected.middle_name, selected.last_name)}`:`To: ${fullName(selected.first_name, selected.middle_name, selected.last_name)}`}
 {' · '}{new Date(selected.created_at).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
 </p>
 <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
 {selected.body}
 </div>
 <button onClick={()=>{setCompose(true);setSelected(null)}} className="btn-secondary mt-4">
 <Reply size={14}/> Reply
 </button>
 </div>
 ) : (
 <div className="card overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-100">
 <span className="text-sm font-bold text-slate-700">{messages.length} message{messages.length!==1?'s':''}</span>
 </div>
 {messages.length===0 ? (
 <div className="p-12 text-center text-slate-400">
 <Mail size={32} className="mx-auto mb-3 opacity-20"/>
 <p>No messages yet.</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-50">
 {messages.map(m=>(
 <div key={m.id}
 onClick={()=>{setSelected(m);if(tab==='inbox'&&!m.is_read)markRead(m.id)}}
 className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors
 ${tab==='inbox'&&!m.is_read?'bg-blue-50/50':''}`}>
 <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
 {initials(m.first_name, m.last_name)}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <p className={`text-sm truncate ${!m.is_read&&tab==='inbox'?'font-bold text-slate-900':'font-medium text-slate-700'}`}>
 {fullName(m.first_name, m.middle_name, m.last_name)}
 </p>
 <p className="text-xs text-slate-400 flex-shrink-0">{new Date(m.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric'})}</p>
 </div>
 <p className="text-xs text-slate-500 truncate">{m.subject}</p>
 <p className="text-xs text-slate-400 truncate mt-0.5">{m.body?.slice(0,60)}…</p>
 </div>
 {!m.is_read&&tab==='inbox'&&<div className="w-2 h-2 rounded-full bg-primary flex-shrink-0"/>}
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {compose&&<ComposeModal contacts={contacts} onClose={()=>setCompose(false)} onSent={()=>{setCompose(false);qc.invalidateQueries(['inbox','sent'])}}/>}
 </div>
 )
}
