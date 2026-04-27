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

export default function SpawnEntranceDialog({ open, slug, loc, onClose, onAplicar }) {
  const mapa = configMapa(loc)
  const { tile_w: tileW, tile_h: tileH, cols, rows } = mapa
  const [origenX, origenY] = mapa.origen_px
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [celda, setCelda] = useState(() => normalizarCelda(loc?.mapa?.spawn_entrada?.celda))
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const mask = parseWalkmask(loc?.mapa?.pisable, cols, rows)

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

    if (Array.isArray(celda)) {
      const { px, py } = celdaAPx(mapa, celda[0], celda[1])
      ctx.beginPath()
      ctx.arc(px, py, Math.max(10, tileH * 0.55), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)'
      ctx.fill()
      ctx.lineWidth = grosor * 2
      ctx.strokeStyle = 'rgba(240, 253, 244, 0.98)'
      ctx.stroke()
      ctx.fillStyle = '#052e16'
      ctx.font = `bold ${Math.max(12, tileH * 0.48)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('IN', px, py)
    }
  }, [celda, cols, imgDims, mask, mapa, rows, tileH, tileW])

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

  const warning = (() => {
    if (!celda) return 'Selecciona una celda de entrada.'
    const [x, y] = celda
    if (mask[y]?.[x] === '.') return 'Aviso: la celda seleccionada está bloqueada en la walkmask.'
    return ''
  })()

  const aplicar = () => {
    if (!celda) return
    onAplicar?.({
      ...(loc.mapa || {}),
      spawn_entrada: { ...(loc.mapa?.spawn_entrada || {}), celda },
    })
    onClose?.()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog" style={{ maxWidth: 1120 }} onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Spawn entrada — <span className="av-cell-id">{loc.id}</span></h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="av-ia-body" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <div style={{ position: 'relative', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, overflow: 'hidden', minHeight: 300 }}>
            {urlImagen && (
              <img ref={imgRef} src={urlImagen} alt={`Mapa ${loc.id}`} onLoad={handleImgLoad} style={{ display: 'block', width: '100%', height: 'auto' }} draggable={false} />
            )}
            <canvas
              ref={canvasRef}
              onClick={e => {
                const next = celdaDesdeEvento(e)
                if (next) setCelda(next)
              }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <strong>Entrada del grupo</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              Click sobre una celda para fijar dónde aparecen los PJs al entrar en esta localización.
            </p>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Celda actual: {celda ? `[${celda.join(', ')}]` : 'sin definir'}
            </span>
            {warning && <div style={{ fontSize: 12, color: celda ? '#fbbf24' : '#fca5a5' }}>{warning}</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              <button type="button" className="btn-primary av-btn-small" onClick={aplicar} disabled={!celda}>Guardar spawn</button>
              <button type="button" className="btn-secondary av-btn-small" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
