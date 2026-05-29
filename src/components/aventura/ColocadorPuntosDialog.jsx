import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { urlMapaPublico } from '../../api/mapaIA.js'
import { cargarCatalogoObjetos } from '../../api/aventuras.js'
import {
  destinosTransicionValidos,
  issuesMapaParaLocalizacion,
  normalizarMapaACoordenadasLibres,
  nuevoPuntoInteres,
  parseIndicePunto,
} from '../../domain/aventura.js'

const TIPOS_EDITABLES = new Set(['objeto_canonico', 'transicion'])

function round2(n) {
  return Math.round(n * 100) / 100
}

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
 * Modal F15b-B: editar `puntos_interes` sobre el mapa libre.
 * Estado de edición local; persiste en un único commit (replace) al «Aplicar».
 * Se monta con `key` por sesión (parent), así el estado se siembra al montar.
 */
export default function ColocadorPuntosDialog({
  loc,
  localizaciones = [],
  serverSlug,
  validacionCanonica = null,
  onClose,
  onApply,
  readOnly = false,
}) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const [mapBox, setMapBox] = useState({ left: 0, top: 0, width: 1, height: 1 })

  // Copia de trabajo editable, sembrada (una vez, al montar) desde el mapa
  // ya normalizado a coordenadas libres (Opción B).
  const [estadoInicial] = useState(() => normalizarMapaACoordenadasLibres(loc?.mapa || {}))
  const [mapaTrabajo, setMapaTrabajo] = useState(estadoInicial.mapa)
  const seNormalizo = estadoInicial.normalized
  const [selIdx, setSelIdx] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [modoAñadir, setModoAñadir] = useState(null) // null | 'objeto_canonico' | 'transicion'

  // Catálogo F14 para el picker `item_id` (solo con slug). setState solo en callback async.
  useEffect(() => {
    if (!serverSlug) return undefined
    let cancelado = false
    cargarCatalogoObjetos(serverSlug)
      .then((d) => { if (!cancelado) setCatalogo(d?.catalogo || {}) })
      .catch(() => { if (!cancelado) setCatalogo(null) })
    return () => { cancelado = true }
  }, [serverSlug])

  const imagen = String(mapaTrabajo?.imagen || '').trim()
  const urlImagen = imagen && serverSlug ? urlMapaPublico(serverSlug, imagen) : null

  const puntos = useMemo(
    () => (Array.isArray(mapaTrabajo?.puntos_interes) ? mapaTrabajo.puntos_interes : []),
    [mapaTrabajo],
  )

  const itemsCanonicos = useMemo(() => {
    if (!catalogo || typeof catalogo !== 'object') return null
    return Object.entries(catalogo)
      .filter(([, v]) => v && v.canonico === true)
      .map(([id, v]) => ({ id, nombre: String(v?.nombre || id) }))
  }, [catalogo])

  const destinosValidos = useMemo(
    () => destinosTransicionValidos(loc, localizaciones),
    [loc, localizaciones],
  )

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

  // Remedir mapBox: zoom del navegador, redimensionar ventana, panel lateral, object-fit.
  useEffect(() => {
    if (!urlImagen) return undefined
    const container = containerRef.current
    const img = imgRef.current
    if (!container) return undefined

    const schedule = () => {
      requestAnimationFrame(() => medirImagen())
    }

    schedule()

    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(container)
      if (img) ro.observe(img)
    }

    window.addEventListener('resize', schedule)
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', schedule)
      vv.addEventListener('scroll', schedule)
    }

    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', schedule)
      if (vv) {
        vv.removeEventListener('resize', schedule)
        vv.removeEventListener('scroll', schedule)
      }
    }
  }, [medirImagen, urlImagen])

  // Al abrir/cerrar el panel de edición el lienzo cambia de ancho.
  useEffect(() => {
    if (!urlImagen) return undefined
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => medirImagen())
    })
    return () => cancelAnimationFrame(id)
  }, [selIdx, urlImagen, medirImagen])

  // ---- Mutaciones sobre la copia de trabajo ----
  const setPuntos = useCallback((updater) => {
    setMapaTrabajo((m) => {
      if (!m) return m
      const prev = Array.isArray(m.puntos_interes) ? m.puntos_interes : []
      return { ...m, puntos_interes: updater(prev) }
    })
  }, [])

  const updatePunto = useCallback((idx, patch) => {
    setPuntos((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }, [setPuntos])

  const moverPuntoPct = useCallback((idx, x, y) => {
    updatePunto(idx, {
      celda: [round2(Math.max(0, Math.min(100, x))), round2(Math.max(0, Math.min(100, y)))],
    })
  }, [updatePunto])

  const eliminarPunto = useCallback((idx) => {
    setPuntos((prev) => prev.filter((_, i) => i !== idx))
    setSelIdx(null)
  }, [setPuntos])

  // Click-to-place: tras pulsar «+ …», el siguiente clic en el mapa fija la celda.
  const colocarEn = useCallback((clientX, clientY) => {
    if (!modoAñadir) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const px = ((clientX - rect.left - mapBox.left) / Math.max(1, mapBox.width)) * 100
    const py = ((clientY - rect.top - mapBox.top) / Math.max(1, mapBox.height)) * 100
    const x = round2(Math.max(0, Math.min(100, px)))
    const y = round2(Math.max(0, Math.min(100, py)))
    setSelIdx(puntos.length)
    setPuntos((prev) => [...prev, nuevoPuntoInteres(modoAñadir, prev, [x, y])])
    setModoAñadir(null)
  }, [modoAñadir, mapBox, puntos.length, setPuntos])

  // Esc cancela el modo de colocación.
  useEffect(() => {
    if (!modoAñadir) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setModoAñadir(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modoAñadir])

  const pctDesdeEvento = useCallback((clientX, clientY) => {
    const container = containerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    const x = ((clientX - rect.left - mapBox.left) / Math.max(1, mapBox.width)) * 100
    const y = ((clientY - rect.top - mapBox.top) / Math.max(1, mapBox.height)) * 100
    return { x, y }
  }, [mapBox])

  // Drag de marcadores (pointer events a nivel window mientras se arrastra).
  useEffect(() => {
    if (draggingIdx === null) return undefined
    const onMove = (e) => {
      const pct = pctDesdeEvento(e.clientX, e.clientY)
      if (pct) moverPuntoPct(draggingIdx, pct.x, pct.y)
    }
    const onUp = () => setDraggingIdx(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [draggingIdx, pctDesdeEvento, moverPuntoPct])

  if (!loc) return null

  const handleAplicar = () => {
    if (typeof onApply === 'function' && mapaTrabajo) onApply(mapaTrabajo)
    onClose()
  }

  const sel = selIdx !== null && selIdx >= 0 && selIdx < puntos.length ? puntos[selIdx] : null
  const selTipo = sel ? String(sel.tipo || '').trim() : ''
  const selEditable = sel && !readOnly && TIPOS_EDITABLES.has(selTipo)
  const selPct = sel ? celdaAPorcentaje(sel.celda) : null

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog" style={{ maxWidth: 960, width: '95vw' }} onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Puntos del mapa — {loc.nombre || loc.id}{readOnly ? ' (solo lectura)' : ''}</h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="av-ia-body">
          {seNormalizo && (
            <p style={{ fontSize: 12, color: '#fbbf24', margin: '0 0 8px' }}>
              Este mapa se ha normalizado a coordenadas libres (% 0–100). Los puntos y spawns conservan su
              posición; al aplicar se eliminan cols/rows del YAML. Persiste al guardar en servidor (validación del motor).
            </p>
          )}

          {!readOnly && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ fontSize: 12 }}>Añadir:</strong>
              <button
                type="button"
                className={modoAñadir === 'objeto_canonico' ? 'btn-primary av-btn-small' : 'btn-secondary av-btn-small'}
                onClick={() => setModoAñadir(t => (t === 'objeto_canonico' ? null : 'objeto_canonico'))}
              >
                + Objeto canónico
              </button>
              <button
                type="button"
                className={modoAñadir === 'transicion' ? 'btn-primary av-btn-small' : 'btn-secondary av-btn-small'}
                onClick={() => setModoAñadir(t => (t === 'transicion' ? null : 'transicion'))}
              >
                + Transición
              </button>
              <span style={{ fontSize: 11, color: modoAñadir ? '#fbbf24' : '#94a3b8' }}>
                {modoAñadir
                  ? 'Haz clic en el mapa para colocar el nuevo punto (Esc cancela).'
                  : 'Arrastra los marcadores para moverlos.'}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div
              ref={containerRef}
              style={{
                position: 'relative', flex: '1 1 520px', minHeight: 280, maxHeight: '60vh',
                background: '#0f172a', border: '1px solid #334155', borderRadius: 4,
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {urlImagen ? (
                <img
                  ref={imgRef}
                  src={urlImagen}
                  alt={`Mapa ${loc.id}`}
                  onLoad={medirImagen}
                  draggable={false}
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }}
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
                const arrastrable = !readOnly && editable
                const seleccionado = idx === selIdx
                return (
                  <div
                    key={punto.id || `pi-${idx}`}
                    title={`${punto.id || ''} (${tipo}) — ${pct.x.toFixed(1)}%, ${pct.y.toFixed(1)}%`}
                    onPointerDown={(e) => {
                      if (readOnly) return
                      setSelIdx(idx)
                      if (arrastrable) { e.preventDefault(); setDraggingIdx(idx) }
                    }}
                    style={{
                      position: 'absolute',
                      left: mapBox.left + (pct.x / 100) * mapBox.width,
                      top: mapBox.top + (pct.y / 100) * mapBox.height,
                      transform: 'translate(-50%, -50%)',
                      width: seleccionado ? 16 : 12,
                      height: seleccionado ? 16 : 12,
                      borderRadius: '50%',
                      border: seleccionado ? '2px solid #e2e8f0' : '2px solid #0f172a',
                      background: err ? '#f87171' : editable ? '#60a5fa' : '#94a3b8',
                      cursor: arrastrable ? (draggingIdx === idx ? 'grabbing' : 'grab') : 'default',
                      pointerEvents: readOnly ? 'none' : 'auto',
                      touchAction: 'none',
                      zIndex: seleccionado ? 3 : 2,
                    }}
                  />
                )
              })}

              {urlImagen && modoAñadir && (
                <div
                  onClick={(e) => colocarEn(e.clientX, e.clientY)}
                  title="Clic para colocar el nuevo punto"
                  style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 4 }}
                />
              )}
            </div>

            <div style={{ flex: '1 1 260px', minWidth: 220, fontSize: 13 }}>
              <strong>Puntos de interés ({puntos.length})</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 0, listStyle: 'none', maxHeight: '32vh', overflow: 'auto' }}>
                {puntos.length === 0 && <li style={{ color: '#94a3b8' }}>Sin puntos en este mapa.</li>}
                {puntos.map((punto, idx) => {
                  const tipo = String(punto?.tipo || '').trim()
                  const editable = TIPOS_EDITABLES.has(tipo)
                  const err = indicesConError.has(idx)
                  const issuesPunto = issuesMapa.filter(i => parseIndicePunto(i.path) === idx)
                  return (
                    <li
                      key={punto.id || `row-${idx}`}
                      onClick={() => setSelIdx(idx)}
                      style={{
                        marginBottom: 4, padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
                        background: idx === selIdx ? '#1e293b' : 'transparent',
                        color: err ? '#fca5a5' : '#cbd5e1',
                      }}
                    >
                      <strong>{punto.id || `(sin id #${idx})`}</strong>{' '}
                      <span style={{ color: '#94a3b8' }}>({tipo || '?'})</span>
                      {!editable && <span style={{ color: '#f59e0b' }}> — no editable</span>}
                      {issuesPunto.map(issue => (
                        <div key={`${issue.code}-${issue.path}`} style={{ fontSize: 11, color: issue.severity === 'error' ? '#fca5a5' : '#fbbf24' }}>
                          {issue.message}
                        </div>
                      ))}
                    </li>
                  )
                })}
              </ul>

              {sel && (
                <div style={{ marginTop: 10, borderTop: '1px solid #334155', paddingTop: 8 }}>
                  <strong style={{ fontSize: 12 }}>Editar «{sel.id}»</strong>
                  {!selEditable && (
                    <p style={{ fontSize: 11, color: '#f59e0b' }}>Tipo «{selTipo || '?'}»: no editable en esta versión.</p>
                  )}
                  {selEditable && (
                    <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                      <Campo label="Etiqueta UI" value={sel.etiqueta_ui ?? ''} onChange={v => updatePunto(selIdx, { etiqueta_ui: v })} />
                      <Campo label="Icono" value={sel.icono ?? ''} onChange={v => updatePunto(selIdx, { icono: v })} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <CampoNum label="x %" value={selPct?.x ?? 0} onChange={v => moverPuntoPct(selIdx, v, selPct?.y ?? 0)} />
                        <CampoNum label="y %" value={selPct?.y ?? 0} onChange={v => moverPuntoPct(selIdx, selPct?.x ?? 0, v)} />
                      </div>

                      {selTipo === 'objeto_canonico' && (
                        <>
                          {itemsCanonicos ? (
                            <label className="av-field">
                              <span className="av-field-label">item_id (canónico)</span>
                              <select className="av-input" value={sel.item_id ?? ''} onChange={e => updatePunto(selIdx, { item_id: e.target.value })}>
                                <option value="">— elegir —</option>
                                {itemsCanonicos.map(it => <option key={it.id} value={it.id}>{it.id} · {it.nombre}</option>)}
                              </select>
                            </label>
                          ) : (
                            <Campo
                              label="item_id (catálogo no disponible — entrada manual)"
                              value={sel.item_id ?? ''}
                              onChange={v => updatePunto(selIdx, { item_id: v })}
                            />
                          )}
                          <Campo label="evento_al_recoger (opcional)" value={sel.evento_al_recoger ?? ''} onChange={v => updatePunto(selIdx, { evento_al_recoger: v })} />
                          <label className="av-field-inline">
                            <input type="checkbox" checked={sel.requiere_confirmacion !== false} onChange={e => updatePunto(selIdx, { requiere_confirmacion: e.target.checked })} />
                            <span>Requiere confirmación</span>
                          </label>
                        </>
                      )}

                      {selTipo === 'transicion' && (
                        <label className="av-field">
                          <span className="av-field-label">destino</span>
                          <select className="av-input" value={sel.destino ?? ''} onChange={e => updatePunto(selIdx, { destino: e.target.value })}>
                            <option value="">— elegir —</option>
                            {destinosValidos.map(d => <option key={d} value={d}>{d}</option>)}
                            {sel.destino && !destinosValidos.includes(sel.destino) && (
                              <option value={sel.destino}>{sel.destino} (no conectado / sin mapa válido)</option>
                            )}
                          </select>
                        </label>
                      )}

                      <button type="button" className="av-btn-danger av-btn-small" onClick={() => eliminarPunto(selIdx)}>
                        Eliminar punto
                      </button>
                    </div>
                  )}
                </div>
              )}

              {issuesCanonicos === null && (
                <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
                  Cambios sin validar. Guarda la aventura para ver los issues MAPA_* del motor.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="av-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar sin aplicar</button>
          <button type="button" className="btn-primary" onClick={handleAplicar}>Aplicar al mapa</button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <input type="text" className="av-input" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function CampoNum({ label, value, onChange }) {
  return (
    <label className="av-field" style={{ flex: 1 }}>
      <span className="av-field-label">{label}</span>
      <input
        type="number" min="0" max="100" step="0.5" className="av-input"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
    </label>
  )
}
