/* @v2-fixed-imports */
import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import Modal from './Modal'

/**
 * Confirmation dialog (replaces window.confirm).
 *
 *   const [confirm, setConfirm] = useState(null)
 *   <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />
 *   setConfirm({ title: 'Delete assignment?', message: '...', confirmLabel: 'Delete',
 *                variant: 'danger', onConfirm: () => handleDelete(id) })
 *
 * Improvements over the first version:
 *  - rendered through the shared Modal, so it always sits ABOVE any modal that opened it
 *    (it used to appear behind: z-index 9998 versus 9999), and gets Escape, backdrop click,
 *    scroll lock and a focus trap
 *  - onConfirm may return a promise: the buttons show a busy state, and the dialog cannot be
 *    dismissed or double-confirmed until it finishes
 *  - Cancel is focused first on danger dialogs so Enter cannot delete by accident
 */
export default function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', onConfirm, onClose,
}) {
  const [busy, setBusy] = useState(false)
  if (!title) return null

  const danger = variant === 'danger'

  const handleConfirm = async () => {
    if (busy) return
    const result = onConfirm?.()
    if (result && typeof result.then === 'function') {
      setBusy(true)
      try { await result } catch { /* the caller reports its own errors */ }
      setBusy(false)
    }
    onClose?.()
  }

  return (
    <Modal onClose={onClose} role="alertdialog" closeOnEscape={!busy} closeOnBackdrop={!busy}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden modal-card"
        style={{ border: '0.5px solid #e2e8f0' }}>
        <div className="p-6">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
            {danger ? <Trash2 size={22} className="text-red-600" /> : <AlertTriangle size={22} className="text-amber-600" />}
          </div>
          <h3 className="font-display font-bold text-slate-900 text-center text-lg">{title}</h3>
          {message && <p className="text-sm text-slate-500 text-center mt-2 leading-relaxed">{message}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button type="button" onClick={onClose} disabled={busy} data-autofocus={danger ? '' : undefined}
            className="btn-secondary flex-1 justify-center disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={handleConfirm} disabled={busy} data-autofocus={danger ? undefined : ''}
            className={`flex-1 justify-center font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
