import { useEffect, useMemo, useRef, useState } from 'react'
import { urlMapaPublico } from '../../api/mapaIA.js'

const DEFAULTS = { tile_w: 64, tile_h: 32, cols: 10, rows: 10, origen_px: [0, 0] }

function configMapa(loc) {
  const m = loc?.mapa || {}
  return {
    tile_w: Number.isFinite(m.tile_w) ? m.tile_w : DEFAULTS.tile_w,
    tile_h: Number.isFinite(m.tile_h) ? m.tile_h : DEFAULTS.tile_h,
    cols: Number.isFinite(m.cols) ? m.cols : DEFAULTS.cols,
    rows: Number.isFinite(m.rows) ? m.rows : DEFAULTS.rows,
    origen_px: Array.isArray(m.origen_px) && m.origen_px.length === 2
      ? [m.origen_px[0], m.origen_px[1]]
      : [...DEFAULTS.origen_px],
  }
}

function celdaAPx(mapa, x, y) {
  const [ox, oy] = mapa.origen_px
  return {
    px: ox + (x - y) * (mapa.tile_w / 2),
    py: oy + (x + y) * (mapa.tile_h / 2),
  }
}

function parseWalkmask(pisable, cols, rows) {
  if (typeof pisable === 'string') {
    const filas = pisable.split(/\r?\n/)
    while (filas[0]?.trim() === '') filas.shift()
    while (filas[filas.length - 1]?.trim() === '') filas.pop()
    if (filas.length === rows && filas.every(f => f.length === cols && /^[#.]+$/.test(f))) {
      return filas.map(f => [...f])
    }
  }
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => '#'))
}

function normalizarEnteroCelda(value) {
  const n = Math.round(Number(value) || 0)
  return Object.is(n, -0) ? 0 : n
}

function normalizarCelda(celda) {
  if (!Array.isArray(celda) || celda.length !== 2) return null
  return [normalizarEnteroCelda(celda[0]), normalizarEnteroCelda(celda[1])]
}

function presenciasDe(loc) {
  return Array.isArray(loc?.mapa?.presencias_tacticas)
    ? loc.mapa.presencias_tacticas
      .filter(p => p && typeof p === 'object')
      .map(p => ({
        ...p,
        id: String(p.id || '').trim(),
        tipo: String(p.tipo || 'bestiario').trim(),
        ref: String(p.ref || '').trim(),
        celda: normalizarCelda(p.celda),
        cantidad: Math.max(1, Math.round(Number(p.cantidad) || 1)),
        visible: p.visible !== false,
      }))
      .filter(p => p.id && p.ref && p.tipo === 'bestiario')
    : []
}

function iniciales(nombre, id) {
  const raw = String(nombre || id || '?').trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return raw.slice(0, 2).toUpperCase()
}

function idPresencia(ref, existentes) {
  const base = String(ref || 'presencia').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'presencia'
  let n = 1
  let id = `${base}_01`
  while (existentes.has(id)) {
    n += 1
    id = `${base}_${String(n).padStart(2, '0')}`
  }
  return id
}

export default function PresenciasTacticasDialog({
  open,
  slug,
  loc,
  bestiario = [],
  onClose,
  onAplicar,
}) {
  const mapa = configMapa(loc)
  const { tile_w: tileW, tile_h: tileH, cols, rows } = mapa
  const [origenX, origenY] = mapa.origen_px
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [presencias, setPresencias] = useState(() => presenciasDe(loc))
  const bestiarioLoc = useMemo(
    () => bestiario.filter(b => String(b?.ubicacion || '').trim() === String(loc?.id || '').trim()),
    [loc?.id, bestiario],
  )
  const [refSel, setRefSel] = useState(() => bestiarioLoc[0]?.id || '')
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const mask = parseWalkmask(loc?.mapa?.pisable, cols, rows)

  useEffect(() => {
    if (!refSel && bestiarioLoc[0]?.id) setRefSel(bestiarioLoc[0].id)
  }, [refSel, bestiarioLoc])

  const urlImagen = open && slug && loc?.mapa?.imagen
    ? urlMapaPublico(slug, loc.mapa.imagen)
    : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgDims.w || !imgDims.h) return
    canvas.width = imgDims.w
    canvas.height = imgDims.h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grosor = Math.max(2, Math.round(canvas.width / 420))

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const { px, py } = celdaAPx(mapa, x, y)
        ctx.beginPath()
        ctx.moveTo(px, py - tileH / 2)
        ctx.lineTo(px + tileW / 2, py)
        ctx.lineTo(px, py + tileH / 2)
        ctx.lineTo(px - tileW / 2, py)
        ctx.closePath()
        if (mask[y]?.[x] === '.') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.22)'
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)'
        ctx.lineWidth = grosor
        ctx.stroke()
      }
    }

    for (const presencia of presencias) {
      if (!Array.isArray(presencia.celda)) continue
      const bestia = bestiarioLoc.find(b => b.id === presencia.ref)
      const { px, py } = celdaAPx(mapa, presencia.celda[0], presencia.celda[1])
      const seleccionado = presencia.ref === refSel
      ctx.beginPath()
      ctx.arc(px, py, Math.max(10, tileH * (seleccionado ? 0.66 : 0.52)), 0, Math.PI * 2)
      ctx.fillStyle = seleccionado ? 'rgba(248, 113, 113, 0.95)' : 'rgba(220, 38, 38, 0.9)'
      ctx.fill()
      ctx.lineWidth = grosor * 2
      ctx.strokeStyle = 'rgba(254, 242, 242, 0.98)'
      ctx.stroke()
      ctx.fillStyle = seleccionado ? '#450a0a' : '#fff1f2'
      ctx.font = `bold ${Math.max(11, tileH * 0.44)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(iniciales(presencia.etiqueta_ui || bestia?.nombre, presencia.ref), px, py)
    }
  }, [bestiarioLoc, cols, imgDims, mask, mapa, presencias, refSel, rows, tileH, tileW])

  if (!open || !loc) return null

  const handleImgLoad = () => {
    const img = imgRef.current
    if (img) setImgDims({ w: img.naturalWidth, h: img.naturalHeight })
  }

  const celdaDesdeEvento = (ev) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const px = (ev.clientX - rect.left) * (canvas.width / rect.width)
    const py = (ev.clientY - rect.top) * (canvas.height / rect.height)
    const a = (px - origenX) / (tileW / 2)
    const b = (py - origenY) / (tileH / 2)
    const x = normalizarEnteroCelda((a + b) / 2)
    const y = normalizarEnteroCelda((b - a) / 2)
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null
    return [x, y]
  }

  const asignarCelda = (celda) => {
    if (!refSel || !celda) return
    const bestia = bestiarioLoc.find(b => b.id === refSel)
    setPresencias(prev => {
      const actual = prev.find(p => p.ref === refSel)
      const ids = new Set(prev.map(p => p.id).filter(id => id !== actual?.id))
      const presencia = {
        id: actual?.id || idPresencia(refSel, ids),
        tipo: 'bestiario',
        ref: refSel,
        celda,
        cantidad: actual?.cantidad || 1,
        visible: actual?.visible !== false,
        etiqueta_ui: String(actual?.etiqueta_ui || bestia?.nombre || refSel),
      }
      return [...prev.filter(p => p.ref !== refSel), presencia]
    })
  }

  const presenciaSel = presencias.find(p => p.ref === refSel)
  const warning = (() => {
    if (!refSel) return 'Selecciona una criatura del bestiario para esta localización.'
    if (!presenciaSel?.celda) return 'Click sobre una celda para colocar la presencia táctica.'
    const [x, y] = presenciaSel.celda
    if (mask[y]?.[x] === '.') return 'Aviso: la celda seleccionada está bloqueada en la walkmask.'
    return ''
  })()

  const actualizarPresenciaSel = (patch) => {
    if (!refSel) return
    setPresencias(prev => prev.map(p => (p.ref === refSel ? { ...p, ...patch } : p)))
  }

  const aplicar = () => {
    const limpios = presencias
      .filter(p => p.id && p.ref && Array.isArray(p.celda))
      .map(p => ({
        id: String(p.id).trim(),
        tipo: 'bestiario',
        ref: String(p.ref).trim(),
        celda: normalizarCelda(p.celda),
        cantidad: Math.max(1, Math.round(Number(p.cantidad) || 1)),
        visible: p.visible !== false,
        ...(String(p.etiqueta_ui || '').trim() ? { etiqueta_ui: String(p.etiqueta_ui).trim() } : {}),
      }))
    onAplicar?.({ ...(loc.mapa || {}), presencias_tacticas: limpios })
    onClose?.()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog" style={{ maxWidth: 1180 }} onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Presencias tácticas — <span className="av-cell-id">{loc.id}</span></h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="av-ia-body" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <div style={{ position: 'relative', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, overflow: 'hidden', minHeight: 300 }}>
            {urlImagen && (
              <img ref={imgRef} src={urlImagen} alt={`Mapa ${loc.id}`} onLoad={handleImgLoad} style={{ display: 'block', width: '100%', height: 'auto' }} draggable={false} />
            )}
            <canvas
              ref={canvasRef}
              onClick={e => asignarCelda(celdaDesdeEvento(e))}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong>Criaturas de la localización</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              Selecciona una criatura y haz click sobre una celda. Son tokens pasivos: no activan combate.
            </p>
            {bestiarioLoc.length === 0 ? (
              <p className="av-empty">No hay bestiario con ubicación «{loc.id}».</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {bestiarioLoc.map(bestia => {
                  const presencia = presencias.find(p => p.ref === bestia.id)
                  const fichaUrl = slug && bestia.sprite?.imagen ? urlMapaPublico(slug, bestia.sprite.imagen) : ''
                  return (
                    <button
                      key={bestia.id}
                      type="button"
                      className={refSel === bestia.id ? 'btn-primary av-btn-small' : 'btn-secondary av-btn-small'}
                      onClick={() => setRefSel(bestia.id)}
                      style={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {fichaUrl && <img className="av-ficha-thumb" src={fichaUrl} alt="" />}
                        {bestia.nombre || bestia.id}
                      </span>
                      <span>{presencia?.celda ? `[${presencia.celda.join(', ')}]` : 'sin presencia'}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {presenciaSel && (
              <>
                <label className="av-field">
                  <span className="av-field-label">Cantidad</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    className="av-input"
                    value={presenciaSel.cantidad || 1}
                    onChange={e => actualizarPresenciaSel({ cantidad: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                  />
                </label>
                <label className="av-field-inline">
                  <input
                    type="checkbox"
                    checked={presenciaSel.visible !== false}
                    onChange={e => actualizarPresenciaSel({ visible: e.target.checked })}
                  />
                  <span>Visible en el mapa</span>
                </label>
              </>
            )}
            {warning && <div style={{ fontSize: 12, color: presenciaSel?.celda ? '#fbbf24' : '#fca5a5' }}>{warning}</div>}
            {presenciaSel && (
              <button
                type="button"
                className="av-btn-danger av-btn-small"
                onClick={() => setPresencias(prev => prev.filter(p => p.ref !== refSel))}
              >
                Quitar presencia seleccionada
              </button>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              <button type="button" className="btn-primary av-btn-small" onClick={aplicar}>Aplicar presencias</button>
              <button type="button" className="btn-secondary av-btn-small" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
