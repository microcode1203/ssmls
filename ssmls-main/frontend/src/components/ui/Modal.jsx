import { useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'

/**
 * Shared dialog behaviour for every modal, confirm box and drawer in the app.
 *
 * What it fixes compared with ad-hoc overlays:
 *  - stacked dialogs: only the top-most one reacts to Escape / Tab (one Escape closes one dialog)
 *  - the page is scroll-locked once (reference counted) and keeps its scrollbar gutter
 *  - keyboard focus moves into the dialog, is trapped there, and returns to the opener on close
 *  - optional: hides the page behind from screen readers (aria-hidden on #root)
 */
const stack = []
let lockCount = 0
let savedStyle = null

function lockPage(hideRoot) {
  if (lockCount++ === 0) {
    const b = document.body
    const gutter = window.innerWidth - document.documentElement.clientWidth
    savedStyle = { overflow: b.style.overflow, paddingRight: b.style.paddingRight }
    b.style.overflow = 'hidden'
    if (gutter > 0) b.style.paddingRight = `${gutter}px`
  }
  if (hideRoot) document.getElementById('root')?.setAttribute('aria-hidden', 'true')
}

function unlockPage(hideRoot) {
  lockCount = Math.max(0, lockCount - 1)
  if (hideRoot && !stack.some(t => t.hideRoot)) document.getElementById('root')?.removeAttribute('aria-hidden')
  if (lockCount === 0 && savedStyle) {
    document.body.style.overflow = savedStyle.overflow
    document.body.style.paddingRight = savedStyle.paddingRight
    savedStyle = null
  }
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

function visibleFocusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(el => {
    if (el.hidden) return false
    const s = window.getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden'
  })
}

/**
 * Attach dialog behaviour to any element (used by Modal, and by drawers that render their own markup).
 * ref: element that contains the dialog content.
 */
export function useDialogBehavior(ref, { active = true, onClose, closeOnEscape = true, hideRoot = false, autoFocus = true } = {}) {
  const onCloseRef = useRef(onClose)
  const escapeRef = useRef(closeOnEscape)
  onCloseRef.current = onClose
  escapeRef.current = closeOnEscape

  useEffect(() => {
    if (!active) return undefined
    const node = ref.current
    const token = { hideRoot }
    const opener = document.activeElement
    stack.push(token)
    lockPage(hideRoot)

    if (autoFocus && node) {
      // Focus the dialog itself (not the first input) so phones do not pop the keyboard open.
      // Anything marked data-autofocus / autofocus wins.
      const target = node.querySelector('[data-autofocus],[autofocus]') || node
      if (target === node && !node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    }

    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return          // not the top-most dialog
      if (e.key === 'Escape') {
        if (escapeRef.current && !e.isComposing && !e.defaultPrevented) {
          e.preventDefault()
          onCloseRef.current?.()
        }
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = visibleFocusables(node)
      if (!items.length) { e.preventDefault(); node.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const cur = document.activeElement
      const inside = node.contains(cur) && cur !== node
      if (e.shiftKey && (!inside || cur === first)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (!inside || cur === last)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(token)
      if (i >= 0) stack.splice(i, 1)
      unlockPage(hideRoot)
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
    }
  }, [active, autoFocus, hideRoot, ref])
}

/**
 * Modal - renders through a portal into document.body.
 * Usage (conditionally render it; no `open` prop):
 *
 *   {show && (
 *     <Modal onClose={() => setShow(false)}>
 *       <div className="modal-card bg-white rounded-2xl w-full max-w-md">...</div>
 *     </Modal>
 *   )}
 *
 * Props
 *   onClose          called on Escape and on backdrop click
 *   closeOnEscape    default true  (pass false while saving / busy)
 *   closeOnBackdrop  default true  (pass false while saving / busy)
 *   backdrop         CSS colour of the overlay (default dark slate)
 *   role             'dialog' (default) or 'alertdialog'
 *   ariaLabel        accessible name; if omitted the first heading inside is used
 */
export default function Modal({
  onClose, children, closeOnEscape = true, closeOnBackdrop = true,
  backdrop = 'rgba(15,23,42,0.5)', role = 'dialog', ariaLabel,
}) {
  const dialogRef = useRef(null)
  const downOnBackdrop = useRef(false)
  const uid = useId()

  useDialogBehavior(dialogRef, { onClose, closeOnEscape, hideRoot: true })

  // Name the dialog after its first heading when no explicit label is given.
  useEffect(() => {
    const node = dialogRef.current
    if (!node || ariaLabel) return
    const h = node.querySelector('h1,h2,h3,h4')
    if (h) {
      if (!h.id) h.id = `modal-title-${uid.replace(/:/g, '')}`
      node.setAttribute('aria-labelledby', h.id)
    }
  }, [ariaLabel, uid])

  return createPortal(
    <div
      className="modal-active"
      // A click only closes when it BOTH started and ended on the backdrop,
      // so dragging a text selection out of an input no longer closes the form.
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (closeOnBackdrop && downOnBackdrop.current && e.target === e.currentTarget) onClose?.()
        downOnBackdrop.current = false
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        overflowY: 'auto',                 // tall dialogs scroll instead of being cut off on small phones
        overscrollBehavior: 'contain',
        padding: 'max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))',
        background: backdrop,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        className="ssmls-modal-wrap"
        style={{
          position: 'relative',
          width: '100%',
          margin: 'auto',                  // centres short dialogs, lets tall ones scroll from the top
          display: 'flex',
          justifyContent: 'center',
          outline: 'none',
          pointerEvents: 'none',           // clicks beside the card fall through to the backdrop
          animation: 'ssmls-modal-fade .15s ease-out',
        }}
      >
        {children}
      </div>
      <style>{`
        .ssmls-modal-wrap > * { pointer-events: auto; }
        @keyframes ssmls-modal-fade { from { opacity: 0 } to { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .ssmls-modal-wrap, .ssmls-modal-wrap .modal-card { animation: none !important; } }
      `}</style>
    </div>,
    document.body
  )
}
