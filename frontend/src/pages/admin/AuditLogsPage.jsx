// @v2-fixed-imports
import { useQuery } from '@tanstack/react-query'
import { fullName, formalName, initials } from '../../utils/nameUtils'
import api from '../../api/client'
import { Shield } from 'lucide-react'

export default function AuditLogsPage() {
  const { data, isLoading } = useQuery({ queryKey:['audit'], queryFn:()=>api.get('/admin/audit-logs').then(r=>r.data.data) })
  const actionColor = (a) => a.includes('DELETE')||a.includes('DEACTIVATE') ? 'badge-red' : a.includes('UPDATE') ? 'badge-amber' : 'badge-blue'
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Shield className="text-primary" size={24}/>
        <h1 className="page-title">Audit Logs</h1>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>{['User','Action','Entity','IP Address','Timestamp'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(data||[]).map(l=>(
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{fullName(l.first_name, l.middle_name, l.last_name)}<p className="text-xs text-slate-400 capitalize">{l.role}</p></td>
                <td className="px-4 py-3"><span className={actionColor(l.action)}>{l.action}</span></td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{l.entity||'—'} {l.entity_id ? `#${l.entity_id}` : ''}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.ip_address||'—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(l.timestamp).toLocaleString('en-PH')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
