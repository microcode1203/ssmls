import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ open, onClose, size = 'md', children }) {
  const maxW = { sm:'28rem', md:'36rem', lg:'42rem', xl:'52rem', '2xl':'56rem' }[size] ?? '36rem'

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const onKey = useCallback((e) => { if (e.key === 'Escape') onClose?.() }, [onClose])
  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onKey])

  if (!open) return null

  return createPortal(
    <div
      style={{
        position:'fixed', inset:0, zIndex:9999,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'1rem',
        background:'rgba(15,23,42,0.5)',
        backdropFilter:'blur(4px)',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        style={{
          position:'relative', width:'100%', maxWidth:maxW,
          maxHeight:'calc(100dvh - 2rem)',
          background:'#fff', borderRadius:'1.25rem',
          boxShadow:'0 20px 60px -10px rgba(0,0,0,0.3),0 0 0 1px rgba(0,0,0,0.05)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          animation:'ssmls-modal-in .18s cubic-bezier(0.34,1.4,0.64,1)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      <style>{`@keyframes ssmls-modal-in{from{opacity:0;transform:scale(.95) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>,
    document.body
  )
}
