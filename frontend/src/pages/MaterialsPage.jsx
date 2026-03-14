import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Upload, FileText, Link, X, Plus, ExternalLink } from 'lucide-react'

export default function MaterialsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ scheduleId:'', title:'', description:'', fileUrl:'', fileType:'PDF' })
  const [saving, setSaving] = useState(false)

  const { data: materials, isLoading } = useQuery({ queryKey:['materials'], queryFn:()=>api.get('/materials').then(r=>r.data.data) })
  const { data: mySchedules } = useQuery({
    queryKey:['my-schedules-mat'],
    queryFn:()=>api.get(`/schedules/teacher/${user.teacherId}`).then(r=>r.data.data),
    enabled:!!user?.teacherId
  })

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await api.post('/materials', form); toast.success('Material uploaded.'); setModal(false); qc.invalidateQueries(['materials']) }
    catch (err) { toast.error(err.response?.data?.message||'Failed.') }
    finally { setSaving(false) }
  }

  const typeIcon = { PDF:'📄', DOCX:'📝', PPTX:'📊', VIDEO:'🎬', LINK:'🔗' }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Learning Materials</h1>
          <p className="text-slate-500 text-sm mt-1">{materials?.length||0} materials uploaded</p>
        </div>
        {user?.role==='teacher' && (
          <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={16}/>Upload Material</button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(materials||[]).map(m=>(
            <div key={m.id} className="card p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
                  {typeIcon[m.file_type]||'📁'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{m.title}</h3>
                  <p className="text-xs text-primary font-semibold mt-0.5">{m.subject_name}</p>
                </div>
              </div>
              {m.description && <p className="text-xs text-slate-500 line-clamp-2">{m.description}</p>}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400">{m.first_name} {m.last_name}</p>
                {m.file_url && (
                  <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    <ExternalLink size={12}/>Open
                  </a>
                )}
              </div>
            </div>
          ))}
          {!materials?.length && (
            <div className="col-span-3 card p-16 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-3 opacity-30"/>
              <p className="font-semibold">No materials uploaded yet.</p>
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-display font-bold text-slate-900">Upload Material</h2>
              <button onClick={()=>setModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Class</label>
                <select className="input-field" value={form.scheduleId} onChange={e=>setForm(p=>({...p,scheduleId:e.target.value}))} required>
                  <option value="">— Select Class —</option>
                  {(mySchedules||[]).map(s=><option key={s.id} value={s.id}>{s.subject} · {s.grade_level} {s.section_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
                <input className="input-field" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} required/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea className="input-field h-20 resize-none" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">File URL (Google Drive, OneDrive, etc.)</label>
                <input type="url" className="input-field" placeholder="https://drive.google.com/…" value={form.fileUrl} onChange={e=>setForm(p=>({...p,fileUrl:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">File Type</label>
                <select className="input-field" value={form.fileType} onChange={e=>setForm(p=>({...p,fileType:e.target.value}))}>
                  {['PDF','DOCX','PPTX','VIDEO','LINK'].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Saving…':'Upload Material'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
