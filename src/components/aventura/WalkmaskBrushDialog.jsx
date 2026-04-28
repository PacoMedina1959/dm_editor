import { useEffect, useRef, useState } from 'react'
import { urlMapaPublico } from '../../api/mapaIA.js'
import OrientacionNorteMapa from './OrientacionNorteMapa.jsx'

const DEFAULTS = { tile_w: 64, tile_h: 32, cols: 10, rows: 10, origen_px: [0, 0] }
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

function clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor))
}

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

function serializarWalkmask(mask) {
  return mask.map(fila => fila.join('')).join('\n')
}

export default function WalkmaskBrushDialog({ open, slug, loc, onClose, onAplicar }) {
  const mapa = configMapa(loc)
  const { tile_w: tileW, tile_h: tileH, cols, rows } = mapa
  const [origenX, origenY] = mapa.origen_px
  const [modo, setModo] = useState('.')
  const [mask, setMask] = useState(() => parseWalkmask(loc?.mapa?.pisable, cols, rows))
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [atenuarBloqueadas, setAtenuarBloqueadas] = useState(false)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const pintandoRef = useRef(false)

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
    const grosor = Math.max(2, Math.round(canvas.width / 400))

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const { px, py } = celdaAPx(mapa, x, y)
        ctx.beginPath()
        ctx.moveTo(px, py - tileH / 2)
        ctx.lineTo(px + tileW / 2, py)
        ctx.lineTo(px, py + tileH / 2)
        ctx.lineTo(px - tileW / 2, py)
        ctx.closePath()
        const bloqueada = mask[y]?.[x] === '.'
        if (bloqueada) {
          ctx.fillStyle = atenuarBloqueadas
            ? 'rgba(15, 23, 42, 0.68)'
            : 'rgba(239, 68, 68, 0.42)'
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'
        ctx.lineWidth = grosor * 2
        ctx.stroke()
        ctx.strokeStyle = bloqueada
          ? 'rgba(248, 113, 113, 0.95)'
          : 'rgba(253, 224, 71, 0.9)'
        ctx.lineWidth = grosor
        ctx.stroke()
      }
    }
  }, [atenuarBloqueadas, cols, imgDims, mask, mapa, origenX, origenY, rows, tileH, tileW])

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
    const x = Math.round((a + b) / 2)
    const y = Math.round((b - a) / 2)
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null
    return { x, y }
  }

  const pintar = (ev) => {
    const celda = celdaDesdeEvento(ev)
    if (!celda) return
    setMask(prev => {
      if (prev[celda.y]?.[celda.x] === modo) return prev
      const next = prev.map(f => [...f])
      next[celda.y][celda.x] = modo
      return next
    })
  }

  const setZoomPaso = dir => {
    const idx = ZOOMS.indexOf(zoom)
    const actual = idx >= 0 ? idx : ZOOMS.indexOf(1)
    setZoom(ZOOMS[clamp(actual + dir, 0, ZOOMS.length - 1)])
  }

  const totalBloqueadas = mask.reduce(
    (total, fila) => total + fila.filter(celda => celda === '.').length,
    0,
  )
  const totalCeldas = cols * rows

  const aplicar = () => {
    onAplicar?.({ ...(loc.mapa || {}), pisable: serializarWalkmask(mask) })
    onClose?.()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div
        className="av-ia-dialog"
        style={{ maxWidth: 1440, width: 'min(96vw, 1440px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="av-modal-header">
          <h3>Pintar walkmask — <span className="av-cell-id">{loc.id}</span></h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="av-ia-body" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <div
            style={{
              position: 'relative',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 4,
              overflow: 'auto',
              minHeight: 300,
              maxHeight: '72vh',
            }}
          >
            <OrientacionNorteMapa />
            <div
              style={{
                position: 'relative',
                width: imgDims.w ? imgDims.w * zoom : '100%',
                minWidth: '100%',
              }}
            >
              {urlImagen && (
                <img
                  ref={imgRef}
                  src={urlImagen}
                  alt={`Mapa ${loc.id}`}
                  onLoad={handleImgLoad}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                  draggable={false}
                />
              )}
              <canvas
                ref={canvasRef}
                onPointerDown={e => { pintandoRef.current = true; pintar(e) }}
                onPointerMove={e => { if (pintandoRef.current && e.buttons === 1) pintar(e) }}
                onPointerUp={() => { pintandoRef.current = false }}
                onPointerLeave={() => { pintandoRef.current = false }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary av-btn-small" onClick={() => setZoomPaso(-1)}>
                -
              </button>
              <span style={{ minWidth: 48, textAlign: 'center', fontSize: 12 }}>
                {Math.round(zoom * 100)}%
              </span>
              <button type="button" className="btn-secondary av-btn-small" onClick={() => setZoomPaso(1)}>
                +
              </button>
              <button type="button" className="btn-secondary av-btn-small" onClick={() => setZoom(1)}>
                100%
              </button>
            </div>
            <strong>Herramienta</strong>
            <label className="av-field-inline">
              <input type="radio" checked={modo === '#'} onChange={() => setModo('#')} />
              <span>Pisable (#)</span>
            </label>
            <label className="av-field-inline">
              <input type="radio" checked={modo === '.'} onChange={() => setModo('.')} />
              <span>Bloqueado (.)</span>
            </label>
            <label className="av-field-inline">
              <input
                type="checkbox"
                checked={atenuarBloqueadas}
                onChange={e => setAtenuarBloqueadas(e.target.checked)}
              />
              <span>Atenuar bloqueadas</span>
            </label>
            <button type="button" className="btn-secondary av-btn-small" onClick={() => setMask(parseWalkmask(null, cols, rows))}>
              Rellenar todo pisable
            </button>
            <div style={{ fontSize: 11, color: '#cbd5e1' }}>
              {totalBloqueadas} bloqueadas / {totalCeldas} celdas
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', background: '#0f172a', border: '1px dashed #334155', padding: '6px 8px', borderRadius: 4 }}>
              Click o arrastra sobre la rejilla. Rojo/oscuro = bloqueado. Usa
              zoom y scroll para pintar con precisión en mapas grandes. Se
              guarda como string multiline <code>#</code>/<code>.</code>.
            </div>
          </div>
        </div>
        <div className="av-modal-footer">
          <button type="button" className="btn-primary" onClick={aplicar}>Aplicar walkmask</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
