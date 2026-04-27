import { useEffect, useRef, useState } from 'react'
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
    if (
      filas.length === rows
      && filas.every(f => f.length === cols && /^[#.]+$/.test(f))
    ) {
      return filas.map(f => [...f])
    }
  }
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => '#'))
}

function slugifyId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizarEnteroCelda(value) {
  const n = Math.round(Number(value) || 0)
  return Object.is(n, -0) ? 0 : n
}

function normalizarCelda(celda) {
  if (!Array.isArray(celda) || celda.length !== 2) return celda
  return [normalizarEnteroCelda(celda[0]), normalizarEnteroCelda(celda[1])]
}

function transicionesDe(loc) {
  return Array.isArray(loc?.mapa?.puntos_interes)
    ? loc.mapa.puntos_interes
      .filter(p => p?.tipo === 'transicion')
      .map(p => ({ ...p, celda: normalizarCelda(p.celda) }))
    : []
}

export default function TransitionPointsDialog({
  open,
  slug,
  loc,
  localizaciones = [],
  onClose,
  onAplicar,
}) {
  const mapa = configMapa(loc)
  const { tile_w: tileW, tile_h: tileH, cols, rows } = mapa
  const [origenX, origenY] = mapa.origen_px
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [puntos, setPuntos] = useState(() => transicionesDe(loc))
  const [draft, setDraft] = useState(null)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const mask = parseWalkmask(loc?.mapa?.pisable, cols, rows)
  const destinos = (loc?.conexiones || [])
    .map(id => localizaciones.find(l => l.id === id))
    .filter(Boolean)
    .filter(l => l.mapa?.imagen)

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
          ctx.fillStyle = 'rgba(239, 68, 68, 0.24)'
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)'
        ctx.lineWidth = grosor
        ctx.stroke()
      }
    }

    for (const punto of puntos) {
      if (!Array.isArray(punto.celda) || punto.celda.length !== 2) continue
      const { px, py } = celdaAPx(mapa, punto.celda[0], punto.celda[1])
      ctx.beginPath()
      ctx.arc(px, py, Math.max(8, tileH * 0.45), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.88)'
      ctx.fill()
      ctx.lineWidth = grosor * 2
      ctx.strokeStyle = 'rgba(255, 247, 237, 0.96)'
      ctx.stroke()
      ctx.fillStyle = '#1f1300'
      ctx.font = `bold ${Math.max(12, tileH * 0.5)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('⇢', px, py)
    }
  }, [cols, imgDims, mask, mapa, origenX, origenY, puntos, rows, tileH, tileW])

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

  const crearDraft = (celda) => {
    const destino = destinos[0]?.id || ''
    const idBase = slugifyId(destino ? `ir_${destino}` : `transicion_${puntos.length + 1}`)
    let id = idBase || `transicion_${puntos.length + 1}`
    let n = 2
    while (puntos.some(p => p.id === id)) {
      id = `${idBase}_${n}`
      n += 1
    }
    setDraft({
      id,
      tipo: 'transicion',
      celda,
      destino,
      etiqueta_ui: destino ? `Ir a ${destino}` : '',
      icono: 'salida',
      oculto: false,
    })
  }

  const errorDraft = (() => {
    if (!draft) return ''
    if (!String(draft.id || '').trim()) return 'Falta ID.'
    if (puntos.some(p => p.id === draft.id && p !== draft._original)) return 'ID duplicado.'
    if (!Array.isArray(draft.celda) || draft.celda.length !== 2) return 'Selecciona una celda.'
    const [x, y] = draft.celda
    if (x < 0 || y < 0 || x >= cols || y >= rows) return 'Celda fuera del tablero.'
    if (mask[y]?.[x] === '.') return 'La celda seleccionada está bloqueada en la walkmask.'
    if (!draft.destino) return 'Selecciona un destino.'
    if (!destinos.some(d => d.id === draft.destino)) return 'El destino debe estar conectado y tener mapa.'
    return ''
  })()

  const guardarDraft = () => {
    if (!draft || errorDraft) return
    const limpio = {
      id: String(draft.id).trim(),
      tipo: 'transicion',
      celda: normalizarCelda(draft.celda),
      destino: draft.destino,
      etiqueta_ui: String(draft.etiqueta_ui || '').trim() || `Ir a ${draft.destino}`,
      icono: draft.icono || 'salida',
      oculto: !!draft.oculto,
    }
    setPuntos(prev => [...prev.filter(p => p.id !== draft._original?.id), limpio])
    setDraft(null)
  }

  const aplicar = () => {
    const otros = Array.isArray(loc?.mapa?.puntos_interes)
      ? loc.mapa.puntos_interes.filter(p => p?.tipo !== 'transicion')
      : []
    onAplicar?.({ ...(loc.mapa || {}), puntos_interes: [...otros, ...puntos] })
    onClose?.()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog" style={{ maxWidth: 1180 }} onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Transiciones tácticas — <span className="av-cell-id">{loc.id}</span></h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="av-ia-body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div style={{ position: 'relative', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, overflow: 'hidden', minHeight: 300 }}>
            {urlImagen && (
              <img ref={imgRef} src={urlImagen} alt={`Mapa ${loc.id}`} onLoad={handleImgLoad} style={{ display: 'block', width: '100%', height: 'auto' }} draggable={false} />
            )}
            <canvas
              ref={canvasRef}
              onClick={e => {
                const celda = celdaDesdeEvento(e)
                if (celda) crearDraft(celda)
              }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong>Transiciones</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              Click sobre una celda pisable para crear una salida. Los destinos se limitan a conexiones con mapa.
            </p>
            {puntos.length === 0 ? (
              <p className="av-empty">Sin transiciones.</p>
            ) : puntos.map(punto => (
              <div key={punto.id} style={{ display: 'grid', gap: 4, padding: 8, border: '1px solid #334155', borderRadius: 4 }}>
                <strong style={{ fontSize: 12 }}>{punto.etiqueta_ui || punto.id}</strong>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  {punto.id} · {punto.destino} · [{punto.celda?.join(', ')}]
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn-secondary av-btn-small" onClick={() => setDraft({ ...punto, _original: punto })}>Editar</button>
                  <button type="button" className="av-btn-danger av-btn-small" onClick={() => setPuntos(prev => prev.filter(p => p.id !== punto.id))}>Eliminar</button>
                </div>
              </div>
            ))}

            {draft && (
              <div style={{ display: 'grid', gap: 8, marginTop: 6, padding: 10, border: '1px solid #f59e0b', borderRadius: 4 }}>
                <strong>Editar transición</strong>
                <label className="av-field">
                  <span className="av-field-label">ID</span>
                  <input className="av-input" value={draft.id} onChange={e => setDraft(d => ({ ...d, id: slugifyId(e.target.value) }))} />
                </label>
                <label className="av-field">
                  <span className="av-field-label">Etiqueta UI</span>
                  <input className="av-input" value={draft.etiqueta_ui} onChange={e => setDraft(d => ({ ...d, etiqueta_ui: e.target.value }))} />
                </label>
                <label className="av-field">
                  <span className="av-field-label">Destino</span>
                  <select className="av-input" value={draft.destino} onChange={e => setDraft(d => ({ ...d, destino: e.target.value }))}>
                    <option value="">Selecciona destino...</option>
                    {destinos.map(dest => (
                      <option key={dest.id} value={dest.id}>{dest.nombre || dest.id}</option>
                    ))}
                  </select>
                </label>
                <label className="av-field">
                  <span className="av-field-label">Icono</span>
                  <select className="av-input" value={draft.icono} onChange={e => setDraft(d => ({ ...d, icono: e.target.value }))}>
                    <option value="salida">Salida</option>
                    <option value="puerta">Puerta</option>
                    <option value="escalera_baja">Escalera baja</option>
                    <option value="escalera_sube">Escalera sube</option>
                    <option value="portal">Portal</option>
                  </select>
                </label>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Celda: [{draft.celda?.join(', ')}]</span>
                <label className="av-field-inline">
                  <input type="checkbox" checked={!!draft.oculto} onChange={e => setDraft(d => ({ ...d, oculto: e.target.checked }))} />
                  <span>Oculta</span>
                </label>
                {errorDraft && <div style={{ fontSize: 12, color: '#fca5a5' }}>{errorDraft}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn-primary av-btn-small" onClick={guardarDraft} disabled={!!errorDraft}>Guardar punto</button>
                  <button type="button" className="btn-secondary av-btn-small" onClick={() => setDraft(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="av-modal-footer">
          <button type="button" className="btn-primary" onClick={aplicar}>Aplicar transiciones</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
