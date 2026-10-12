import { useState, useRef, useCallback } from 'react'
import ConfirmDialog from '../components/ui/ConfirmDialog'

/**
 * Promise-based replacement for window.confirm().
 *
 *   const [confirmDialog, ask] = useConfirm()
 *   ...
 *   const remove = async () => {
 *     if (!(await ask({ title: 'Delete this?', message: 'Cannot be undone.', confirmLabel: 'Delete' }))) return
 *     await api.delete(...)
 *   }
 *   return (<>...{confirmDialog}</>)         // render the element once in the component
 */
export function useConfirm() {
  const [opts, setOpts] = useState(null)
  const resolver = useRef(null)

  const ask = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve
    setOpts(options)
  }), [])

  const finish = (answer) => {
    const resolve = resolver.current
    resolver.current = null
    setOpts(null)
    resolve?.(answer)
  }

  const dialog = opts
    ? <ConfirmDialog {...opts} onConfirm={() => finish(true)} onClose={() => finish(false)} />
    : null

  return [dialog, ask]
}

export default useConfirm
