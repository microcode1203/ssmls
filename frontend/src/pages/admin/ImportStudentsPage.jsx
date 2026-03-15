/* @v2-fixed-imports */
import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import {
  Upload, Download, CheckCircle, XCircle,
  AlertTriangle, FileText, Users, X, ChevronRight
} from 'lucide-react'

const TEMPLATE_HEADERS = ['first_name','middle_name','last_name','email','lrn','grade_level','strand','phone']
const TEMPLATE_ROWS = [
  ['Juan','Dela','Cruz','juan.dela@student.school.edu.ph','123456789012','Grade 11','STEM','09171234567'],
  ['Maria','Santos','Reyes','maria.reyes@student.school.edu.ph','123456789013','Grade 12','HUMSS',''],
]

const downloadTemplate = () => {
  const allRows = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS]
  const lines = allRows.map(row => row.map(v => '"' + v + '"').join(','))
  const csv = lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = 'ssmls_student_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const parseCSV = (text) => {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase().replace(/ /g, '_'))
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',')
    const obj  = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/"/g, '').trim() })
    return obj
  })
}

const STRAND_COLOR = {
  STEM:  'bg-blue-100 text-blue-700',
  HUMSS: 'bg-purple-100 text-purple-700',
  ABM:   'bg-amber-100 text-amber-700',
  TVL:   'bg-green-100 text-green-700',
  GAS:   'bg-slate-100 text-slate-600',
}

export default function ImportStudentsPage() {
  const qc      = useQueryClient()
  const fileRef = useRef()
  const [step,      setStep]      = useState(1)
  const [rows,      setRows]      = useState([])
  const [fileName,  setFileName]  = useState('')
  const [importing, setImporting] = useState(false)
  const [results,   setResults]   = useState(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) return toast.error('Please upload a .csv file.')
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result)
      if (!parsed.length) return toast.error('No data found. Check the CSV format.')
      setRows(parsed)
      setStep(2)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await api.post('/import/students', { students: rows })
      setResults(res.data.results)
      setStep(3)
      qc.invalidateQueries(['students'])
      if (res.data.results.created > 0)
        toast.success(res.data.results.created + ' student(s) imported!')
      if (res.data.results.skipped > 0)
        toast.error(res.data.results.skipped + ' row(s) skipped.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setStep(1); setRows([]); setFileName(''); setResults(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Bulk Student Import</h1>
          <p className="text-slate-500 text-sm mt-1">Upload a CSV file to create multiple student accounts at once</p>
        </div>
        <button onClick={downloadTemplate} className="btn-secondary">
          <Download size={15}/> Download Template
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[['1','Upload CSV'],['2','Preview'],['3','Results']].map(([n, label], i) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all
              ${step === Number(n) ? 'bg-primary text-white'
                : step > Number(n) ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-400'}`}>
              {step > Number(n)
                ? <CheckCircle size={12}/>
                : <span className="w-4 text-center">{n}</span>}
              {label}
            </div>
            {i < 2 && <ChevronRight size={14} className="text-slate-300"/>}
          </div>
        ))}
      </div>

      {/* STEP 1 — Upload */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileText size={16} className="text-primary"/> CSV Format Requirements
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Column','Required','Example','Notes'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    ['first_name',  '✅ Yes', 'Juan',                    'Student first name'],
                    ['middle_name', '— No',  'Dela',                    'Optional'],
                    ['last_name',   '✅ Yes', 'Cruz',                    'Student last name'],
                    ['email',       '✅ Yes', 'juan@school.edu.ph',      'Must be unique'],
                    ['lrn',         '✅ Yes', '123456789012',            'Exactly 12 digits'],
                    ['grade_level', '✅ Yes', 'Grade 11',                '"Grade 11" or "Grade 12"'],
                    ['strand',      '✅ Yes', 'STEM',                    'STEM / HUMSS / ABM / TVL / GAS'],
                    ['phone',       '— No',  '09171234567',             'Optional'],
                  ].map(([col, req, ex, note]) => (
                    <tr key={col} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono font-bold text-primary">{col}</td>
                      <td className="px-3 py-2">{req}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{ex}</td>
                      <td className="px-3 py-2 text-slate-500">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              <strong>Default password:</strong> All imported students get <span className="font-mono font-bold">Student@2026</span> as their initial password.
            </div>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="card p-12 border-2 border-dashed border-slate-200 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/3 transition-all group">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center mx-auto mb-4 transition-colors">
              <Upload size={24} className="text-slate-400 group-hover:text-primary transition-colors"/>
            </div>
            <p className="font-semibold text-slate-700 mb-1">Click to upload CSV file</p>
            <p className="text-xs text-slate-400">Maximum 200 students per import · .csv files only</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden"/>
          </div>
        </div>
      )}

      {/* STEP 2 — Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users size={16} className="text-primary"/>
              </div>
              <div>
                <p className="font-bold text-slate-800">{rows.length} student{rows.length !== 1 ? 's' : ''} ready to import</p>
                <p className="text-xs text-slate-400">{fileName}</p>
              </div>
            </div>
            <button onClick={reset} className="btn-ghost text-xs"><X size={12}/> Cancel</button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    {['#','Name','Email','LRN','Grade','Strand','Phone'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{i + 2}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">
                        {r.last_name}, {r.first_name}{r.middle_name ? ' ' + r.middle_name[0] + '.' : ''}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{r.email}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.lrn}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{r.grade_level}</td>
                      <td className="px-4 py-2.5">
                        <span className={'text-xs font-bold px-2 py-0.5 rounded-full ' + (STRAND_COLOR[r.strand?.toUpperCase()] || 'bg-slate-100 text-slate-500')}>
                          {r.strand?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400">{r.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={reset} className="btn-secondary flex-1 justify-center">Back</button>
            <button onClick={handleImport} disabled={importing} className="btn-primary flex-1 justify-center">
              {importing
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Importing…</>
                : <><Upload size={15}/>Import {rows.length} Student{rows.length !== 1 ? 's' : ''}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Results */}
      {step === 3 && results && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5 text-center border-emerald-200 bg-emerald-50">
              <p className="text-3xl font-bold text-emerald-600">{results.created}</p>
              <p className="text-xs font-semibold text-emerald-600 mt-1">Created</p>
            </div>
            <div className="card p-5 text-center border-red-200 bg-red-50">
              <p className="text-3xl font-bold text-red-500">{results.skipped}</p>
              <p className="text-xs font-semibold text-red-500 mt-1">Skipped</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-3xl font-bold text-slate-700">{results.created + results.skipped}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Total</p>
            </div>
          </div>

          {results.errors?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500"/> Skipped Rows
              </h3>
              <div className="space-y-2" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {results.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 bg-red-50 rounded-lg border border-red-100">
                    <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-xs">
                      <span className="font-bold text-red-700">Row {e.row}</span>
                      {e.lrn && <span className="text-red-500 font-mono ml-1">({e.lrn})</span>}
                      <span className="text-red-600 ml-1">— {e.message}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.created > 0 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <CheckCircle size={18} className="text-emerald-600 flex-shrink-0"/>
              <p className="text-sm text-emerald-700">
                <strong>{results.created} account{results.created !== 1 ? 's' : ''}</strong> created. Default password: <span className="font-mono font-bold">Student@2026</span>
              </p>
            </div>
          )}

          <button onClick={reset} className="btn-primary w-full justify-center">
            <Upload size={15}/> Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
