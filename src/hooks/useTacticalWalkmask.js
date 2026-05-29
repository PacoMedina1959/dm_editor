import { useEffect, useState } from 'react'
import {
  matrizTodoPisable,
  matrizWalkmaskDesdeYaml,
  obtenerMatrizWalkmaskEfectiva,
  tieneDeclaracionTiledJson,
} from '../domain/tiledWalkmask.js'

/**
 * Matriz de overlay para diálogos tácticos (# pisable, . bloqueado).
 * Misma prioridad que dm_virtual: TMJ si cargable, luego YAML, luego todo «#».
 */
export function useTacticalWalkmask(slug, loc, open) {
  const mapa = loc?.mapa || {}
  const cols = Number.isFinite(mapa.cols) ? mapa.cols : 0
  const rows = Number.isFinite(mapa.rows) ? mapa.rows : 0
  const [mask, setMask] = useState(() => {
    if (cols > 0 && rows > 0) {
      const y = matrizWalkmaskDesdeYaml(mapa.pisable, cols, rows)
      if (y) return y
      return matrizTodoPisable(cols, rows)
    }
    return []
  })
  const [cargandoTiled, setCargandoTiled] = useState(false)

  useEffect(() => {
    if (!open || !loc || cols <= 0 || rows <= 0) return undefined

    let cancel = false
    const debeBuscarTiled = !!(slug && tieneDeclaracionTiledJson(mapa))

    const run = async () => {
      if (debeBuscarTiled) {
        setCargandoTiled(true)
        try {
          const m = await obtenerMatrizWalkmaskEfectiva(slug, mapa)
          if (!cancel) setMask(m)
        } finally {
          if (!cancel) setCargandoTiled(false)
        }
      } else {
        setCargandoTiled(false)
        const y = matrizWalkmaskDesdeYaml(mapa.pisable, cols, rows)
        if (!cancel) setMask(y ?? matrizTodoPisable(cols, rows))
      }
    }

    void run()

    return () => { cancel = true }
  }, [
    open,
    slug,
    loc?.id,
    cols,
    rows,
    mapa.pisable,
    mapa.tiled?.json,
    mapa.tiled?.capa_pisable,
    mapa.cols,
    mapa.rows,
  ])

  return { mask, cargandoTiled }
}
