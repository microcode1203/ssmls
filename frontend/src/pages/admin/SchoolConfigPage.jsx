import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Save, Settings } from 'lucide-react'

export default function SchoolConfigPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey:['school-config'],
    queryFn:()=>api.get('/config').then(r=>r.data.data),
    staleTime: 0
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const set = k => e => setForm(p=>({...p,[k]:e.target.value}))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/config', form)
      toast.success('School configuration saved.')
      qc.invalidateQueries(['school-config'])
    } catch(err) { toast.error('Failed to save.') }
    finally { setSaving(false) }
  }

  const fields = [
    { group:'School Information', items:[
      { key:'school_name',    label:'School Name',    type:'text', placeholder:'e.g. Bagong Senior High School' },
      { key:'school_address', label:'School Address', type:'text', placeholder:'Municipality, Province' },
    ]},
    { group:'Academic Year', items:[
      { key:'school_year',  label:'School Year',  type:'text', placeholder:'e.g. 2025-2026' },
      { key:'semester',     label:'Semester',     type:'select', options:['1st Semester','2nd Semester','Summer'] },
    ]},
    { group:'Grading Rules', items:[
      { key:'grade_passing', label:'Passing Grade', type:'number', placeholder:'75' },
      { key:'attendance_threshold', label:'Max Absences Before Alert', type:'number', placeholder:'3' },
    ]},
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">School Configuration</h1>
          <p className="text-slate-500 text-sm mt-1">System-wide settings for the school year</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving?<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</>:<><Save size={15}/>Save All</>}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-6">
          {fields.map(group=>(
            <div key={group.group} className="card p-6">
              <h3 className="font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Settings size={16} className="text-primary"/>{group.group}
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {group.items.map(f=>(
                  <div key={f.key}>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{f.label}</label>
                    {f.type==='select' ? (
                      <select className="input-field" value={form[f.key]||''} onChange={set(f.key)}>
                        {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type} className="input-field" placeholder={f.placeholder}
                        value={form[f.key]||''} onChange={set(f.key)}/>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
