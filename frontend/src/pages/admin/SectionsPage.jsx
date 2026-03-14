import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, X, Users } from 'lucide-react'

export default function SectionsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ sectionName:'', gradeLevel:'Grade 11', strand:'STEM' })
  const { data } = useQuery({ queryKey:['sections'], queryFn:()=>api.get('/sections').then(r=>r.data.data) })
  const handleSave = async (e) => {
    e.preventDefault()
    try { await api.post('/sections', form); toast.success('Section created.'); setModal(false); qc.invalidateQueries(['sections']) }
    catch { toast.error('Failed to create section.') }
  }
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Sections</h1>
        <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={16}/>Add Section</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data||[]).map(s=>(
          <div key={s.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display font-bold text-slate-900">{s.section_name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{s.grade_level} · {s.strand}</p>
              </div>
              <span className="badge-blue">{s.strand}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Users size={14}/>
              <span>{s.student_count} students</span>
            </div>
            {(s.first_name) && <p className="text-xs text-slate-400 mt-1">Adviser: {s.first_name} {s.last_name}</p>}
          </div>
        ))}
      </div>
      {modal&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="font-display font-bold">Add Section</h2>
              <button onClick={()=>setModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {[['sectionName','Section Name'],].map(([n,l])=>(
                <div key={n}><label className="block text-sm font-semibold text-slate-700 mb-1">{l}</label><input className="input-field" value={form[n]} onChange={e=>setForm(p=>({...p,[n]:e.target.value}))} required /></div>
              ))}
              {[['gradeLevel','Grade Level',['Grade 11','Grade 12']],['strand','Strand',['STEM','HUMSS','ABM','TVL','GAS']]].map(([n,l,opts])=>(
                <div key={n}><label className="block text-sm font-semibold text-slate-700 mb-1">{l}</label><select className="input-field" value={form[n]} onChange={e=>setForm(p=>({...p,[n]:e.target.value}))}>{opts.map(o=><option key={o}>{o}</option>)}</select></div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Create Section</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
