import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'

function TeacherModal({ onClose, onSave }) {
  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', employeeId:'', department:'', phone:'' })
  const [saving, setSaving] = useState(false)
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await api.post('/teachers', form); toast.success('Teacher created. Default password: Teacher@2026'); onSave() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed.') }
    finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-display font-bold text-slate-900">Add Teacher</h2>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
          {[['firstName','First Name'],['lastName','Last Name'],['email','Email'],['employeeId','Employee ID'],['department','Department'],['phone','Phone']].map(([n,l])=>(
            <div key={n}>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{l}</label>
              <input className="input-field" value={form[n]} onChange={e=>setForm(p=>({...p,[n]:e.target.value}))} required={['firstName','lastName','email','employeeId'].includes(n)} />
            </div>
          ))}
          <div className="col-span-2 flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving?'Saving…':'Add Teacher'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TeachersPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const { data, isLoading } = useQuery({ queryKey:['teachers'], queryFn:()=>api.get('/teachers').then(r=>r.data.data) })
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Teachers</h1>
        <button onClick={()=>setModal(true)} className="btn-primary"><Plus size={16}/>Add Teacher</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['Name','Employee ID','Department','Email','Status'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(data||[]).map(t=>(
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700">{t.first_name?.[0]}{t.last_name?.[0]}</div><p className="font-semibold text-slate-800">{t.first_name} {t.last_name}</p></div></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.employee_id}</td>
                <td className="px-4 py-3 text-slate-600">{t.department||'—'}</td>
                <td className="px-4 py-3 text-slate-500">{t.email}</td>
                <td className="px-4 py-3"><span className={t.is_active?'badge-green':'badge-slate'}>{t.is_active?'Active':'Inactive'}</span></td>
              </tr>
            ))}
            {!isLoading&&!data?.length&&<tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No teachers found.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal&&<TeacherModal onClose={()=>setModal(false)} onSave={()=>{setModal(false);qc.invalidateQueries(['teachers'])}} />}
    </div>
  )
}
