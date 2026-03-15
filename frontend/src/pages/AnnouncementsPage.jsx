import { useEffect, useState } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Bell, Plus, X } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { formatDistanceToNow } from 'date-fns'

export default function AnnouncementsPage() {
 const { user } = useAuth()
 const qc = useQueryClient()
 const [modal, setModal] = useState(false)
 const [form, setForm] = useState({ title:'', content:'', targetRole:'all' })
 const [saving, setSaving] = useState(false)

 const { data, isLoading } = useQuery({ queryKey:['announcements'], queryFn:()=>api.get('/announcements').then(r=>r.data.data) })

 const handleSave = async (e) => {
 e.preventDefault(); setSaving(true)
 try { await api.post('/announcements', form); toast.success('Announcement posted.'); setModal(false); qc.invalidateQueries(['announcements']) }
 catch (err) { toast.error(err.response?.data?.message||'Failed.') }
 finally { setSaving(false) }
 }

 const targetColor = { all:'badge-blue', student:'badge-green', teacher:'badge-purple' }

 return (
 <div className="p-6 lg:p-8 max-w-3xl mx-auto">
 <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
 <div>
 <h1 className="page-title">Announcements</h1>
 <p className="text-slate-500 text-sm mt-1">School-wide notices and updates.</p>
 </div>
 {(user?.role==='admin'||user?.role==='teacher') && (
 <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={16}/>Post Announcement</button>
 )}
 </div>

 {isLoading ? <CardGridSkeleton count={6}/> : (
 <div className="space-y-4">
 {(data||[]).map(a=>(
 <div key={a.id} className="card p-5 hover:shadow-md transition-shadow">
 <div className="flex items-start gap-4">
 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Bell size={18} className="text-primary"/>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <h3 className="font-bold text-slate-900">{a.title}</h3>
 <span className={targetColor[a.target_role]||'badge-slate'}>{a.target_role}</span>
 </div>
 <p className="text-sm text-slate-600 leading-relaxed">{a.content}</p>
 <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
 <span className="font-semibold">{a.first_name} {a.last_name}</span>
 <span>·</span>
 <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
 </div>
 </div>
 </div>
 </div>
 ))}
 {!data?.length && (
 <div className="card p-16 text-center text-slate-400">
 <Bell size={36} className="mx-auto mb-3 opacity-30"/>
 <p className="font-semibold">No announcements yet.</p>
 </div>
 )}
 </div>
 )}

 {modal && (
 <Modal onClose={()=>setModal(false)}>
 <div className="modal-card bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <h2 className="font-display font-bold text-slate-900">Post Announcement</h2>
 <button onClick={()=>setModal(false)}><X size={18}/></button>
 </div>
 <form onSubmit={handleSave} className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
 <input className="input-field"value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} required/>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Content</label>
 <textarea className="input-field h-32 resize-none"value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} required/>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Audience</label>
 <select className="input-field"value={form.targetRole} onChange={e=>setForm(p=>({...p,targetRole:e.target.value}))}>
 <option value="all">Everyone</option>
 <option value="student">Students Only</option>
 <option value="teacher">Teachers Only</option>
 </select>
 </div>
 <div className="flex gap-3 pt-2">
 <button type="button"onClick={()=>setModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button type="submit"disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Posting…':'Post Announcement'}</button>
 </div>
 </form>
 </div>
 </Modal>
 )}
 </div>
 )
}
