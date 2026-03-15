import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'
import { Trophy, GraduationCap, AlertTriangle, TrendingDown } from 'lucide-react'

export default function RankingPage() {
  const [tab, setTab] = useState('ranking')
  const [sectionId, setSectionId] = useState('')

  const { data: sections } = useQuery({ queryKey:['sections'], queryFn:()=>api.get('/sections').then(r=>r.data.data) })
  const { data: ranking, isLoading: rankLoading } = useQuery({
    queryKey:['ranking', sectionId], enabled:!!sectionId, staleTime:0,
    queryFn:()=>api.get(`/reports/ranking/${sectionId}`).then(r=>r.data.data)
  })
  const { data: atRisk, isLoading: riskLoading } = useQuery({
    queryKey:['at-risk'], staleTime:0,
    queryFn:()=>api.get('/reports/at-risk').then(r=>r.data)
  })

  const rankBadge = r => {
    if (r===1) return 'bg-amber-100 text-amber-700 border-amber-300'
    if (r===2) return 'bg-slate-100 text-slate-600 border-slate-300'
    if (r===3) return 'bg-orange-100 text-orange-700 border-orange-300'
    return 'bg-white text-slate-500 border-slate-200'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Rankings & At-Risk</h1>
        <p className="text-slate-500 text-sm mt-1">Class rankings and students needing intervention</p>
      </div>

      <div className="flex gap-2 mb-5">
        {[['ranking','Class Ranking'],['at-risk','At-Risk Students']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab===id?'bg-primary text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab==='ranking' && (
        <>
          <div className="card p-4 mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Section</label>
            <select className="input-field max-w-sm" value={sectionId} onChange={e=>setSectionId(e.target.value)}>
              <option value="">— Select section —</option>
              {(sections||[]).map(s=><option key={s.id} value={s.id}>{s.grade_level} · {s.section_name} ({s.strand})</option>)}
            </select>
          </div>

          {rankLoading&&<div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>}

          {!sectionId&&!rankLoading&&(
            <div className="card p-14 text-center text-slate-400"><Trophy size={32} className="mx-auto mb-3 opacity-20"/><p>Select a section to view rankings.</p></div>
          )}

          {ranking&&!rankLoading&&(
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-bold text-slate-700">{ranking.length} students ranked by GWA</span>
              </div>
              <div className="divide-y divide-slate-50">
                {ranking.map(s=>(
                  <div key={s.id} className={`flex items-center gap-4 px-4 py-3.5 ${s.rank<=3?'bg-amber-50/30':''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${rankBadge(s.rank)}`}>
                      {s.rank<=3?['🥇','🥈','🥉'][s.rank-1]:s.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{s.last_name}, {s.first_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{s.lrn}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${parseFloat(s.gwa)>=75?'text-green-600':'text-red-500'}`}>{s.gwa}</p>
                      <p className="text-xs text-slate-400">{s.gradeCount} grades</p>
                    </div>
                  </div>
                ))}
                {!ranking.length&&<div className="p-8 text-center text-slate-400 text-sm">No grades recorded yet for this section.</div>}
              </div>
            </div>
          )}
        </>
      )}

      {tab==='at-risk' && (
        <>
          {riskLoading&&<div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-primary/20 border-t-primary rounded-full animate-spin"/></div>}
          {atRisk&&!riskLoading&&(
            <>
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 mb-5">
                <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
                <p className="text-sm text-red-700 font-medium">
                  {atRisk.data?.length||0} failing grade{atRisk.data?.length!==1?'s':''} detected (below {atRisk.passingGrade}). Immediate intervention recommended.
                </p>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>{['Student','Section','Subject','Quarter','Grade'].map(h=>(
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(atRisk.data||[]).map((r,i)=>(
                      <tr key={i} className="hover:bg-red-50/30">
                        <td className="px-4 py-3 font-semibold text-slate-800">{r.first_name} {r.last_name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{r.grade_level} · {r.section_name}</td>
                        <td className="px-4 py-3 text-slate-600">{r.subject_name}</td>
                        <td className="px-4 py-3"><span className="badge-amber">{r.quarter}</span></td>
                        <td className="px-4 py-3"><span className="font-bold text-red-600 text-base">{r.final_grade}</span></td>
                      </tr>
                    ))}
                    {!atRisk.data?.length&&<tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No at-risk students found. 🎉</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
