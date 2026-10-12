// @v3-personal-qr-badges
import { useQuery } from '@tanstack/react-query'
import api from '../../api/client'
import { QrCode, Download, ShieldCheck } from 'lucide-react'

export default function QRScannerPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-qr-badge'],
    queryFn: () => api.get('/attendance/my-qr').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  })

  const download = () => {
    if (!data?.qrImage) return
    const a = document.createElement('a')
    a.href = data.qrImage
    a.download = `${data.student?.lrn || 'my'}-attendance-qr.png`
    a.click()
  }

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="page-title">My QR Code</h1>
        <p className="text-slate-500 text-sm mt-1">
          Your personal, permanent attendance badge. Show this to your teacher — they'll scan it to mark you present.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="p-8 flex flex-col items-center gap-5 bg-slate-50/60">
          {isLoading ? (
            <div className="w-64 h-64 rounded-2xl bg-slate-100 animate-pulse"/>
          ) : (
            <div className="p-4 bg-white rounded-2xl border-2 border-primary/20 shadow-lg">
              <img src={data?.qrImage} alt="My attendance QR code" className="w-56 h-56"/>
            </div>
          )}

          {data?.student && (
            <div className="text-center">
              <p className="font-bold text-slate-800">
                {[data.student.firstName, data.student.middleName, data.student.lastName].filter(Boolean).join(' ')}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">LRN: {data.student.lrn}</p>
              {data.student.sectionName && (
                <p className="text-xs text-slate-400">{data.student.gradeLevel} · {data.student.sectionName}</p>
              )}
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <button
            onClick={download}
            disabled={!data?.qrImage}
            className="btn-primary w-full justify-center py-3"
          >
            <Download size={18}/> Save to Photos
          </button>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-600 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-0.5">This code doesn't change</p>
              <p className="text-xs text-blue-600">
                It's uniquely yours and never expires — save it once and it works for every class, every day.
                Your teacher scans it at the start of class instead of you scanning anything yourself.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-center text-xs text-slate-400">
            <QrCode size={13}/> Keep it private — anyone with this image can be marked present as you.
          </div>
        </div>
      </div>
    </div>
  )
}
