// @v2-fixed-imports
import { useState } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../components/ui/Skeleton'
import { fullName, formalName, initials } from '../utils/nameUtils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { X, MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react'

const STATUS_BADGE = { pending:'badge-amber', reviewed:'badge-blue', resolved:'badge-green', rejected:'badge-red' }
const STATUS_ICON = { pending:<Clock size={14} className="text-amber-500"/>, resolved:<CheckCircle size={14} className="text-green-500"/>, rejected:<XCircle size={14} className="text-red-500"/> }

export default function AppealsPage() {
 const { user } = useAuth()
 const qc = useQueryClient()
 const [respondingTo, setRespondingTo] = useState(null)
 const [response, setResponse] = useState('')
 const [status, setStatus] = useState('resolved')
 const [saving, setSaving] = useState(false)

 const { data: appeals, isLoading } = useQuery({
 queryKey: ['appeals'], queryFn: ()=>api.get('/appeals').then(r=>r.data.data), staleTime:0
 })

 const handleRespond = async () => {
 setSaving(true)
 try {
 await api.patch(`/appeals/${respondingTo.id}`, { status, response })
 toast.success('Response submitted.')
 setRespondingTo(null)
 setResponse('')
 qc.invalidateQueries(['appeals'])
 } catch(err) { toast.error(err.response?.data?.message||'Failed.') }
 finally { setSaving(false) }
 }

 return (
 <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
 <div className="mb-6">
 <h1 className="page-title">Grade Appeals</h1>
 <p className="text-slate-500 text-sm mt-1">
 {user?.role==='student' ? 'Submit a query or appeal for any grade you want to dispute.' : 'Review and respond to student grade appeals.'}
 </p>
 </div>

 {isLoading ? <TableSkeleton cols={6} rows={8}/> : (appeals||[]).length===0 ? (
 <div className="card p-14 text-center text-slate-400">
 <MessageSquare size={32} className="mx-auto mb-3 opacity-20"/>
 <p>No appeals yet.</p>
 {user?.role==='student'&&<p className="text-xs mt-1">Go to Grades page to appeal a grade.</p>}
 </div>
 ) : (
 <div className="space-y-3">
 {(appeals||[]).map(a=>(
 <div key={a.id} className="card p-5">
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div className="flex-1">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 {user?.role!=='student'&&<span className="font-bold text-slate-800">{fullName(a.first_name, a.middle_name, a.last_name)}</span>}
 <span className="text-slate-500 text-sm">{a.subject_name} · {a.quarter}</span>
 <span className="font-mono font-bold text-red-600">{a.final_grade}</span>
 <span className={STATUS_BADGE[a.status]||'badge-slate'}>{a.status}</span>
 </div>
 <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200 mt-2">{a.reason}</p>
 {a.teacher_response&&(
 <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
 <p className="text-xs font-bold text-blue-600 mb-1">Teacher Response:</p>
 <p className="text-sm text-blue-800">{a.teacher_response}</p>
 </div>
 )}
 </div>
 {(user?.role==='teacher'||user?.role==='admin')&&a.status==='pending'&&(
 <button onClick={()=>{setRespondingTo(a);setResponse('');setStatus('resolved')}} className="btn-secondary text-xs flex-shrink-0">
 Respond
 </button>
 )}
 </div>
 <p className="text-xs text-slate-400 mt-2">{new Date(a.created_at).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'})}</p>
 </div>
 ))}
 </div>
 )}

 {respondingTo&&(
 <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm px-4">
 <div className="relative mx-auto my-8 bg-white rounded-2xl shadow-2xl w-full max-w-md">
 <div className="flex items-center justify-between p-5 border-b border-slate-100">
 <h2 className="font-display font-bold text-slate-900">Respond to Appeal</h2>
 <button onClick={()=>setRespondingTo(null)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
 </div>
 <div className="p-5 space-y-4">
 <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700">{respondingTo.reason}</div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Decision</label>
 <select className="input-field"value={status} onChange={e=>setStatus(e.target.value)}>
 <option value="resolved">Resolved (grade corrected)</option>
 <option value="reviewed">Reviewed (noted, no change)</option>
 <option value="rejected">Rejected</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-semibold text-slate-700 mb-1.5">Response to student</label>
 <textarea className="input-field h-24 resize-none"placeholder="Explain your decision…"value={response} onChange={e=>setResponse(e.target.value)}/>
 </div>
 <div className="flex gap-3">
 <button onClick={()=>setRespondingTo(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
 <button onClick={handleRespond} disabled={saving} className="btn-primary flex-1 justify-center">
 {saving?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>:'Submit Response'}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
