// @v2-fixed-imports
import { useState } from 'react'
import { TableSkeleton, CardGridSkeleton, PageSkeleton } from '../../components/ui/Skeleton'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../api/client'
import toast from 'react-hot-toast'
import {
  GraduationCap, ArrowRight, AlertTriangle, CheckCircle,
  RefreshCw, Users, ChevronRight, Shield
} from 'lucide-react'

export default function PromotionPage() {
  const qc = useQueryClient()
  const [confirm,    setConfirm]    = useState(false)
  const [phrase,     setPhrase]     = useState('')
  const [promoting,  setPromoting]  = useState(false)
  const [done,       setDone]       = useState(null)

  const CONFIRM_PHRASE = 'PROMOTE SCHOOL YEAR'

  const { data: preview, isLoading } = useQuery({
    queryKey: ['promotion-preview'],
    queryFn:  () => api.get('/promotion/preview').then(r => r.data.data),
    staleTime: 0,
  })

  const handlePromote = async () => {
    if (phrase !== CONFIRM_PHRASE)
      return toast.error('Please type the confirmation phrase exactly.')
    setPromoting(true)
    try {
      const res = await api.post('/promotion/promote')
      setDone(res.data.data)
      setConfirm(false)
      setPhrase('')
      qc.invalidateQueries(['promotion-preview'])
      qc.invalidateQueries(['school-config'])
      qc.invalidateQueries(['students'])
      toast.success('School year promotion complete!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Promotion failed.')
    } finally {
      setPromoting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">School Year Promotion</h1>
        <p className="text-slate-500 text-sm mt-1">
          Advance to the next school year — promotes Grade 11 students to Grade 12 and graduates Grade 12 students.
        </p>
      </div>

      {/* Success state */}
      {done && (
        <div className="card p-8 text-center border-emerald-200 bg-emerald-50 mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600"/>
          </div>
          <h2 className="font-bold text-emerald-800 text-xl mb-2">Promotion Complete!</h2>
          <p className="text-emerald-700 text-sm mb-4">School year has been advanced to <strong>{done.newYear}</strong></p>
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div className="bg-white rounded-xl p-4 border border-emerald-200 text-center">
              <p className="text-2xl font-bold text-emerald-600">{done.promoted}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">Promoted to G12</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-emerald-200 text-center">
              <p className="text-2xl font-bold text-blue-600">{done.graduated}</p>
              <p className="text-xs text-blue-600 font-semibold mt-1">Graduated</p>
            </div>
          </div>
          <p className="text-xs text-emerald-600 mt-4">
            All sections have been cleared. Assign students to new sections and create new schedules for {done.newYear}.
          </p>
        </div>
      )}

      {/* Preview card */}
      {isLoading ? (
        <div className="flex justify-center py-12">
<PageSkeleton/>
        </div>
      ) : preview && (
        <div className="space-y-5">
          {/* Current vs Next year */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-800 text-lg">School Year Transition</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current</p>
                <p className="text-2xl font-bold text-slate-700">{preview.currentYear}</p>
              </div>
              <ArrowRight size={24} className="text-slate-300 flex-shrink-0"/>
              <div className="flex-1 p-4 bg-primary/5 rounded-xl border border-primary/20 text-center">
                <p className="text-xs font-bold text-primary/60 uppercase tracking-wider mb-1">Next</p>
                <p className="text-2xl font-bold text-primary">{preview.nextYear}</p>
              </div>
            </div>
          </div>

          {/* What will happen */}
          <div className="card p-6">
            <h3 className="font-bold text-slate-800 mb-4">What Will Happen</h3>
            <div className="space-y-3">
              {[
                {
                  icon: ArrowRight,
                  color: 'bg-blue-100 text-blue-600',
                  title: `${preview.willPromote} Grade 11 students → promoted to Grade 12`,
                  desc: 'Their grade level will be updated and section assignments cleared.',
                },
                {
                  icon: GraduationCap,
                  color: 'bg-emerald-100 text-emerald-600',
                  title: `${preview.willGraduate} Grade 12 students → marked as Graduated`,
                  desc: 'Their accounts remain accessible but status becomes "graduated".',
                },
                {
                  icon: RefreshCw,
                  color: 'bg-amber-100 text-amber-600',
                  title: 'All approved schedules will be archived',
                  desc: 'New schedules must be created for the upcoming school year.',
                },
                {
                  icon: Shield,
                  color: 'bg-purple-100 text-purple-600',
                  title: `School year config updated to ${preview.nextYear}`,
                  desc: 'Semester will reset to 1st Semester automatically.',
                },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={15}/>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5"/>
            <div className="text-sm">
              <p className="font-bold text-red-700">This action cannot be undone.</p>
              <p className="text-red-600 mt-0.5">
                Make sure all grades, attendance, and assignments for {preview.currentYear} are finalized before proceeding.
                Back up your data if needed.
              </p>
            </div>
          </div>

          {/* Promote button */}
          {!done && (
            <button onClick={() => setConfirm(true)} className="btn-danger w-full justify-center py-3">
              <GraduationCap size={16}/>
              Advance to {preview.nextYear}
            </button>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto flex flex-col items-center justify-start py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-red-500"/>
            </div>
            <h2 className="font-display font-bold text-slate-900 text-center text-xl mb-2">
              Confirm Promotion
            </h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              This will promote <strong>{preview?.willPromote}</strong> students and graduate{' '}
              <strong>{preview?.willGraduate}</strong> students. <strong>This cannot be reversed.</strong>
            </p>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-red-600">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                className="input-field font-mono"
                placeholder={CONFIRM_PHRASE}
                value={phrase}
                onChange={e => setPhrase(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setConfirm(false); setPhrase('') }}
                className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={promoting || phrase !== CONFIRM_PHRASE}
                className="btn-danger flex-1 justify-center"
                style={{ opacity: phrase !== CONFIRM_PHRASE ? 0.5 : 1 }}>
                {promoting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…</>
                  : <><GraduationCap size={15}/>Confirm Promotion</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
