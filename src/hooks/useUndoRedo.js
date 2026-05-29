import { useCallback, useRef, useState } from 'react'

const MAX_HISTORY = 50

function flagsFromPtr(history, ptr) {
  return {
    canUndo: ptr > 0,
    canRedo: ptr >= 0 && ptr < history.length - 1,
  }
}

/**
 * Hook para undo/redo con historial de estados inmutables.
 *
 * - pushState(value | fn) — registra un nuevo estado (acepta función updater).
 * - resetState(value)     — nuevo estado, limpia historial.
 * - undo() / redo()       — navegan sin crear entradas nuevas.
 */
export default function useUndoRedo(initial = null) {
  const [state, _setState] = useState(initial)
  const history = useRef([])
  const ptr = useRef(-1)
  const [navFlags, setNavFlags] = useState(() => flagsFromPtr([], -1))

  const syncNavFlags = useCallback(() => {
    setNavFlags(flagsFromPtr(history.current, ptr.current))
  }, [])

  const pushState = useCallback((nextOrFn) => {
    _setState(prev => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn
      if (next === prev) return prev

      const cloned = structuredClone(next)
      if (ptr.current < history.current.length - 1) {
        history.current = history.current.slice(0, ptr.current + 1)
      }
      history.current.push(cloned)
      if (history.current.length > MAX_HISTORY) {
        history.current = history.current.slice(history.current.length - MAX_HISTORY)
      }
      ptr.current = history.current.length - 1
      setNavFlags(flagsFromPtr(history.current, ptr.current))
      return next
    })
  }, [])

  const resetState = useCallback((next) => {
    history.current = next != null ? [structuredClone(next)] : []
    ptr.current = next != null ? 0 : -1
    _setState(next)
    setNavFlags(flagsFromPtr(history.current, ptr.current))
  }, [])

  const undo = useCallback(() => {
    if (ptr.current <= 0) return
    ptr.current -= 1
    const restored = structuredClone(history.current[ptr.current])
    _setState(restored)
    syncNavFlags()
  }, [syncNavFlags])

  const redo = useCallback(() => {
    if (ptr.current >= history.current.length - 1) return
    ptr.current += 1
    const restored = structuredClone(history.current[ptr.current])
    _setState(restored)
    syncNavFlags()
  }, [syncNavFlags])

  return {
    state,
    pushState,
    resetState,
    undo,
    redo,
    canUndo: navFlags.canUndo,
    canRedo: navFlags.canRedo,
  }
}
