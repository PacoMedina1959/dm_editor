import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { urlMapaPublico } from '../../api/mapaIA.js'
import {
  issuesMapaParaLocalizacion,
  normalizarMapaACoordenadasLibres,
  parseIndicePunto,
} from '../../domain/aventura.js'

const TIPOS_EDITABLES = new Set(['objeto_canonico', 'transicion'])

function celdaAPorcentaje(celda) {
  if (!Array.isArray(celda) || celda.length < 2) return null
  const x = Number(celda[0])
  const y = Number(celda[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  }
}

/**
 * Modal F15b-A: visualizar puntos_interes sobre el mapa (solo lectura) y aplicar normalización Opción B.
 */
export default function ColocadorPuntosDialog({
  open,
  loc,
  serverSlug,
  validacionCanonica = null,
  onClose,
  onApply,
  readOnly = true,
}) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [mapBox, setMapBox] = useState({ left: 0, top: 0, width: 1, height: 1 })

  const inicial = useMemo(() => {
    if (!loc?.mapa) return { mapa: null, normalized: false }
    return normalizarMapaACoordenadasLibres(loc.mapa)
  }, [loc])

  const mapaTrabajo = inicial.mapa

  const imagen = String(mapaTrabajo?.imagen || '').trim()
  const urlImagen = imagen && serverSlug ? urlMapaPublico(serverSlug, imagen) : null

  const issuesCanonicos = validacionCanonica && Array.isArray(validacionCanonica.issues)
    ? validacionCanonica.issues
    : null
  const issuesMapa = useMemo(() => {
    if (issuesCanonicos === null || !loc?.id) return []
    return issuesMapaParaLocalizacion(issuesCanonicos, loc.id)
  }, [issuesCanonicos, loc])

  const indicesConError = useMemo(() => {
    const s = new Set()
    for (const issue of issuesMapa) {
      if (issue.severity !== 'error') continue
      const idx = parseIndicePunto(issue.path)
      if (idx !== null) s.add(idx)
    }
    return s
  }, [issuesMapa])

  const puntos = Array.isArray(mapaTrabajo?.puntos_interes) ? mapaTrabajo.puntos_interes : []

  const medirImagen = useCallback(() => {
    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img || !urlImagen) return
    const cRect = container.getBoundingClientRect()
    const iRect = img.getBoundingClientRect()
    if (iRect.width <= 0 || iRect.height <= 0) return
    setMapBox({
      left: iRect.left - cRect.left,
      top: iRect.top - cRect.top,
      width: iRect.width,
      height: iRect.height,
    })
  }, [urlImagen])

  useEffect(() => {
    if (!open) return undefined
    const onResize = () => medirImagen()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, medirImagen])

  if (!open || !loc) return null

  const handleAplicar = () => {
    if (typeof onApply === 'function' && mapaTrabajo) {
      onApply(mapaTrabajo)
    }
    onClose()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div
        className="av-ia-dialog"
        style={{ maxWidth: 960, width: '95vw' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="av-modal-header">
          <h3>
            Puntos del mapa — {loc.nombre || loc.id}
            {readOnly ? ' (solo lectura)' : ''}
          </h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="av-ia-body">
          {inicial.normalized && (
            <p style={{ fontSize: 12, color: '#fbbf24', margin: '0 0 8px' }}>
              Este mapa se ha normalizado a coordenadas libres (% 0–100). Los puntos y spawns conservan su
              posición visual; al aplicar, se eliminan cols/rows del YAML. Persiste al guardar en servidor (validación del motor).
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div
              ref={containerRef}
              style={{
                position: 'relative',
                flex: '1 1 520px',
                minHeight: 280,
                maxHeight: '60vh',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 4,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {urlImagen ? (
                <img
                  ref={imgRef}
                  src={urlImagen}
                  alt={`Mapa ${loc.id}`}
                  onLoad={medirImagen}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '60vh',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <span style={{ color: '#94a3b8', fontSize: 13 }}>Sin imagen de mapa.</span>
              )}

              {urlImagen && puntos.map((punto, idx) => {
                const pct = celdaAPorcentaje(punto?.celda)
                if (!pct) return null
                const tipo = String(punto?.tipo || '').trim()
                const editable = TIPOS_EDITABLES.has(tipo)
                const err = indicesConError.has(idx)
                return (
                  <div
                    key={punto.id || `pi-${idx}`}
                    title={`${punto.id || ''} (${tipo}) — ${pct.x.toFixed(1)}%, ${pct.y.toFixed(1)}%`}
                    style={{
                      position: 'absolute',
                      left: mapBox.left + (pct.x / 100) * mapBox.width,
                      top: mapBox.top + (pct.y / 100) * mapBox.height,
                      transform: 'translate(-50%, -50%)',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      border: '2px solid #0f172a',
                      background: err ? '#f87171' : editable ? '#60a5fa' : '#94a3b8',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  />
                )
              })}
            </div>

            <div style={{ flex: '1 1 240px', minWidth: 200, fontSize: 13 }}>
              <strong>Puntos de interés ({puntos.length})</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, maxHeight: '50vh', overflow: 'auto' }}>
                {puntos.length === 0 && (
                  <li style={{ color: '#94a3b8' }}>Sin puntos en este mapa.</li>
                )}
                {puntos.map((punto, idx) => {
                  const tipo = String(punto?.tipo || '').trim()
                  const editable = TIPOS_EDITABLES.has(tipo)
                  const pct = celdaAPorcentaje(punto?.celda)
                  const err = indicesConError.has(idx)
                  const issuesPunto = issuesMapa.filter(i => parseIndicePunto(i.path) === idx)
                  return (
                    <li key={punto.id || `row-${idx}`} style={{ marginBottom: 8, color: err ? '#fca5a5' : '#cbd5e1' }}>
                      <div>
                        <strong>{punto.id || `(sin id #${idx})`}</strong>
                        {' '}
                        <span style={{ color: '#94a3b8' }}>({tipo || '?'})</span>
                        {!editable && (
                          <span style={{ color: '#f59e0b' }}> — no editable en esta versión</span>
                        )}
                      </div>
                      {pct && (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          celda: [{pct.x.toFixed(2)}, {pct.y.toFixed(2)}] %
                        </div>
                      )}
                      {issuesPunto.map(issue => (
                        <div
                          key={`${issue.code}-${issue.path}`}
                          style={{
                            fontSize: 11,
                            color: issue.severity === 'error' ? '#fca5a5' : '#fbbf24',
                          }}
                        >
                          {issue.message}
                        </div>
                      ))}
                    </li>
                  )
                })}
              </ul>

              {issuesCanonicos === null && (
                <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
                  Sin validación canónica reciente. Guarda o valida la aventura para ver issues MAPA_* del motor.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="av-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar sin aplicar
          </button>
          <button type="button" className="btn-primary" onClick={handleAplicar}>
            Aplicar al mapa
          </button>
        </div>
      </div>
    </div>
  )
}
