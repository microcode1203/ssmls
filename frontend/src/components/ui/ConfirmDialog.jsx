/* @v2-fixed-imports */
import { AlertTriangle, Trash2, X } from 'lucide-react'

/**
 * Professional confirmation dialog replacing window.confirm()
 * Usage:
 *   const [confirm, setConfirm] = useState(null)
 *   <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />
 *   
 *   setConfirm({
 *     title: 'Delete assignment?',
 *     message: 'All submissions will be permanently deleted.',
 *     confirmLabel: 'Delete',
 *     variant: 'danger',
 *     onConfirm: () => handleDelete(id)
 *   })
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onClose }) {
  if (!title) return null

  const handleConfirm = () => {
    onConfirm?.()
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ border: '0.5px solid #e2e8f0' }}>
        <div className="p-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            variant === 'danger' ? 'bg-red-100' : 'bg-amber-100'
          }`}>
            {variant === 'danger'
              ? <Trash2 size={22} className="text-red-600"/>
              : <AlertTriangle size={22} className="text-amber-600"/>
            }
          </div>
          <h3 className="font-display font-bold text-slate-900 text-center text-lg">{title}</h3>
          {message && (
            <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">{message}</p>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 justify-center font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-[0.98] ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
