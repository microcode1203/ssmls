/* @v2-fixed-imports */
import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import {
  Users, CheckSquare, Square, ChevronDown,
  ChevronUp, Search, UserCheck, Filter, X
} from 'lucide-react'

const STRAND_COLOR = {
  STEM:  'bg-blue-100 text-blue-700',
  HUMSS: 'bg-purple-100 text-purple-700',
  ABM:   'bg-amber-100 text-amber-700',
  TVL:   'bg-green-100 text-green-700',
  GAS:   'bg-slate-100 text-slate-600',
}

export default function SectionAssignmentPage() {
  const qc = useQueryClient()
  const [selectedIds,  setSelectedIds]  = useState([])
  const [targetSection, setTargetSection] = useState('')
  const [gradeFilter,  setGradeFilter]  = useState('')
  const [strandFilter, setStrandFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [assigning,    setAssigning]    = useState(false)

  // Fetch unassigned students
  const { data: unassigned, isLoading: loadingStudents } = useQuery({
    queryKey: ['unassigned-students'],
    queryFn:  () => api.get('/promotion/unassigned').then(r => r.data.data),
    staleTime: 0,
  })

  // Fetch sections
  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn:  () => api.get('/sections').then(r => r.data.data),
  })

  // Filter students
  const filtered = useMemo(() => {
    return (unassigned || []).filter(s => {
      if (gradeFilter  && s.grade_level !== gradeFilter)  return false
      if (strandFilter && s.strand      !== strandFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const name = (s.last_name + ' ' + s.first_name).toLowerCase()
        if (!name.includes(q) && !s.lrn.includes(q)) return false
      }
      return true
    })
  }, [unassigned, gradeFilter, strandFilter, search])

  // Selected section info
  const selectedSec = (sections || []).find(s => String(s.id) === String(targetSection))

  // Filter sections to match grade filter
  const filteredSections = (sections || []).filter(s =>
    !gradeFilter || s.grade_level === gradeFilter
  )

  const toggleStudent = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(s => s.id))
    }
  }

  const handleAssign = async () => {
    if (!selectedIds.length) return toast.error('Select at least one student.')
    if (!targetSection)      return toast.error('Select a target section.')
    setAssigning(true)
    try {
      const res = await api.post('/promotion/assign-section', {
        studentIds: selectedIds,
        sectionId:  targetSection,
      })
      toast.success(res.data.message)
      setSelectedIds([])
      setTargetSection('')
      qc.invalidateQueries(['unassigned-students'])
      qc.invalidateQueries(['students'])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed.')
    } finally {
      setAssigning(false)
    }
  }

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length
  const someSelected = selectedIds.length > 0 && !allSelected

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Section Assignment</h1>
        <p className="text-slate-500 text-sm mt-1">
          Assign promoted or new students to their sections for the new school year.
        </p>
      </div>

      {/* Summary banner */}
      {!loadingStudents && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 mb-6 ${
          (unassigned || []).length === 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <Users size={18} className={(unassigned || []).length === 0 ? 'text-emerald-600' : 'text-amber-600'}/>
          <div>
            {(unassigned || []).length === 0 ? (
              <p className="text-sm font-semibold text-emerald-700">
                All students are assigned to sections.
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-700">
                  {(unassigned || []).length} student{(unassigned || []).length !== 1 ? 's' : ''} need section assignment
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  These are typically Grade 12 students promoted from last year, or newly enrolled students.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left — Student list */}
        <div className="lg:col-span-2 space-y-3">

          {/* Filters */}
          <div className="card p-4 flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-40">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input
                className="input-field pl-9 text-sm"
                placeholder="Search name or LRN…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input-field w-36 text-sm" value={gradeFilter}
              onChange={e => { setGradeFilter(e.target.value); setTargetSection('') }}>
              <option value="">All Grades</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
            <select className="input-field w-32 text-sm" value={strandFilter}
              onChange={e => setStrandFilter(e.target.value)}>
              <option value="">All Strands</option>
              {['STEM','HUMSS','ABM','TVL','GAS'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(gradeFilter || strandFilter || search) && (
              <button onClick={() => { setGradeFilter(''); setStrandFilter(''); setSearch('') }}
                className="btn-ghost text-xs">
                <X size={12}/> Clear
              </button>
            )}
          </div>

          {/* Student table */}
          <div className="card overflow-hidden">
            {/* Table header with select-all */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
              <button onClick={toggleAll}
                className="text-slate-400 hover:text-primary transition-colors flex-shrink-0">
                {allSelected
                  ? <CheckSquare size={18} className="text-primary"/>
                  : someSelected
                  ? <CheckSquare size={18} className="text-primary/50"/>
                  : <Square size={18}/>
                }
              </button>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex-1">
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected`
                  : `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`
                }
              </span>
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                  Clear selection
                </button>
              )}
            </div>

            {loadingStudents ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"/>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users size={28} className="mx-auto mb-3 opacity-20"/>
                <p className="font-medium">
                  {(unassigned || []).length === 0
                    ? 'All students have been assigned.'
                    : 'No students match your filters.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                {filtered.map(s => {
                  const isSelected = selectedIds.includes(s.id)
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                        ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50'}`}
                    >
                      {/* Checkbox */}
                      <div className="flex-shrink-0 text-slate-400">
                        {isSelected
                          ? <CheckSquare size={16} className="text-primary"/>
                          : <Square size={16}/>
                        }
                      </div>

                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                      }`}>
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>

                      {/* Name + LRN */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {s.last_name}, {s.first_name}
                          {s.middle_name ? ' ' + s.middle_name[0] + '.' : ''}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">{s.lrn}</p>
                      </div>

                      {/* Grade + Strand badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-500 font-medium hidden sm:block">
                          {s.grade_level}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STRAND_COLOR[s.strand] || 'bg-slate-100 text-slate-500'}`}>
                          {s.strand}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right — Assignment panel */}
        <div className="space-y-4">
          <div className="card p-5 sticky top-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserCheck size={16} className="text-primary"/> Assign to Section
            </h3>

            {/* Selected count */}
            <div className={`p-3 rounded-xl mb-4 text-center ${
              selectedIds.length > 0 ? 'bg-primary/10' : 'bg-slate-50'
            }`}>
              <p className={`text-2xl font-bold ${selectedIds.length > 0 ? 'text-primary' : 'text-slate-300'}`}>
                {selectedIds.length}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                student{selectedIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Section picker */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Target Section <span className="text-red-500">*</span>
              </label>
              <select
                className="input-field"
                value={targetSection}
                onChange={e => setTargetSection(e.target.value)}
              >
                <option value="">— Select section —</option>
                {['Grade 11', 'Grade 12'].map(grade => {
                  const grp = filteredSections.filter(s => s.grade_level === grade)
                  if (!grp.length) return null
                  return (
                    <optgroup key={grade} label={grade}>
                      {grp.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.section_name} ({s.strand})
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            {/* Section preview */}
            {selectedSec && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs">
                <p className="font-bold text-slate-700">{selectedSec.section_name}</p>
                <p className="text-slate-500 mt-0.5">
                  {selectedSec.grade_level} · {selectedSec.strand}
                </p>
              </div>
            )}

            {/* Assign button */}
            <button
              onClick={handleAssign}
              disabled={assigning || !selectedIds.length || !targetSection}
              className="btn-primary w-full justify-center py-3"
              style={{ opacity: (!selectedIds.length || !targetSection) ? 0.5 : 1 }}
            >
              {assigning
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Assigning…</>
                : <><UserCheck size={15}/>Assign {selectedIds.length > 0 ? selectedIds.length + ' Student' + (selectedIds.length !== 1 ? 's' : '') : 'Students'}</>
              }
            </button>

            {/* Tips */}
            <div className="mt-4 space-y-2 text-xs text-slate-400">
              <p>• Select students from the list then pick a section</p>
              <p>• Use filters to show only a specific grade or strand</p>
              <p>• You can assign in batches — run multiple times for different sections</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
