import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal — renders via createPortal into document.body.
 * Usage: conditionally render this component (no `open` prop needed).
 *
 *   {showModal && (
 *     <Modal onClose={() => setShowModal(false)}>
 *       <div className="modal-card ...">...</div>
 *     </Modal>
 *   )}
 */
export default function Modal({ onClose, children }) {
  // Lock scroll on mount, restore on unmount
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape key
  const onKey = useCallback((e) => {
    if (e.key === 'Escape') onClose?.()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: 'calc(100dvh - 2rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'ssmls-modal-in .18s cubic-bezier(0.34,1.4,0.64,1)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      <style>{`
        @keyframes ssmls-modal-in {
          from { opacity: 0; transform: scale(.95) translateY(6px) }
          to   { opacity: 1; transform: scale(1)  translateY(0)    }
        }
      `}</style>
    </div>,
    document.body
  )
}
