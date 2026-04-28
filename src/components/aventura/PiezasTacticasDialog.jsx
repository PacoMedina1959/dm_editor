import { useEffect, useMemo, useRef, useState } from 'react'
import { urlMapaPublico } from '../../api/mapaIA.js'
import OrientacionNorteMapa from './OrientacionNorteMapa.jsx'

const DEFAULTS = { tile_w: 64, tile_h: 32, cols: 10, rows: 10, origen_px: [0, 0] }
const ROTACIONES = ['norte', 'este', 'sur', 'oeste']

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

function objetos(loc) {
  return Array.isArray(loc?.mapa?.objetos_tacticos) ? loc.mapa.objetos_tacticos : []
}

function urlAssetTactico(slug, ruta) {
  if (!slug || !ruta) return ''
  const limpia = String(ruta).replace(/^\//, '')
  return `/api/campanas/${encodeURIComponent(slug)}/${limpia}`
}

function anchoPiezaPorHuella(mapa, ocupa) {
  if (!Array.isArray(ocupa) || ocupa.length === 0) return mapa.tile_w * 1.1
  const xs = ocupa.map((c) => (Array.isArray(c) ? Number(c[0]) : 0)).filter(Number.isFinite)
  const ys = ocupa.map((c) => (Array.isArray(c) ? Number(c[1]) : 0)).filter(Number.isFinite)
  if (!xs.length || !ys.length) return mapa.tile_w * 1.1
  const spanX = Math.max(...xs) - Math.min(...xs) + 1
  const spanY = Math.max(...ys) - Math.min(...ys) + 1
  return mapa.tile_w * Math.max(1.1, ((spanX + spanY) / 2) * 1.18)
}

function offsetRotado(dx, dy, rotacion) {
  if (rotacion === 'este') return [dy, -dx]
  if (rotacion === 'sur') return [-dx, -dy]
  if (rotacion === 'oeste') return [-dy, dx]
  return [dx, dy]
}

function celdasOcupadasPieza(pieza, asset) {
  if (!Array.isArray(pieza?.celda) || pieza.celda.length !== 2) return []
  const ocupa = Array.isArray(asset?.ocupa) && asset.ocupa.length ? asset.ocupa : [[0, 0]]
  return ocupa
    .filter(c => Array.isArray(c) && c.length === 2)
    .map(([dx, dy]) => {
      const [rx, ry] = offsetRotado(Number(dx) || 0, Number(dy) || 0, pieza.rotacion || 'norte')
      return [pieza.celda[0] + rx, pieza.celda[1] + ry]
    })
}

function anguloRotacion(rotacion) {
  if (rotacion === 'este') return Math.PI / 2
  if (rotacion === 'sur') return Math.PI
  if (rotacion === 'oeste') return -Math.PI / 2
  return 0
}

function piezaEnCelda(piezas, catalogo, celda) {
  return [...piezas].reverse().find((pieza) => {
    const asset = catalogo.get(pieza.asset_id)
    return celdasOcupadasPieza(pieza, asset).some(([x, y]) => x === celda[0] && y === celda[1])
  }) || null
}

function boundsVisualPieza(mapa, pieza, asset, img) {
  if (!Array.isArray(pieza?.celda) || pieza.celda.length !== 2) return null
  const { px, py } = celdaAPx(mapa, pieza.celda[0], pieza.celda[1])
  const offset = Array.isArray(asset?.offset_px) ? asset.offset_px : [0, 0]
  const ancho = anchoPiezaPorHuella(mapa, asset?.ocupa)
  const ratio = img && img !== false && img.complete && img.naturalWidth > 0
    ? img.naturalHeight / Math.max(1, img.naturalWidth)
    : 1
  const alto = ancho * ratio
  return {
    left: px - ancho / 2 + (offset[0] || 0),
    top: py - alto + (offset[1] || 0),
    right: px + ancho / 2 + (offset[0] || 0),
    bottom: py + (offset[1] || 0),
    ancho,
    alto,
    cx: px + (offset[0] || 0),
    cy: py - alto / 2 + (offset[1] || 0),
    angle: anguloRotacion(pieza.rotacion),
  }
}

function puntoEnBoundsVisual(bounds, punto) {
  const dx = punto.px - bounds.cx
  const dy = punto.py - bounds.cy
  const cos = Math.cos(-bounds.angle)
  const sin = Math.sin(-bounds.angle)
  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos
  const margen = 6
  return Math.abs(localX) <= bounds.ancho / 2 + margen
    && Math.abs(localY) <= bounds.alto / 2 + margen
}

function piezaEnPuntoVisual(piezas, catalogo, mapa, slug, imagenes, punto) {
  return [...piezas].reverse().find((pieza) => {
    const asset = catalogo.get(pieza.asset_id)
    const url = urlAssetTactico(slug, asset?.imagen)
    const img = url ? imagenes.get(url) : null
    const bounds = boundsVisualPieza(mapa, pieza, asset, img)
    if (!bounds) return false
    return puntoEnBoundsVisual(bounds, punto)
  }) || null
}

function idUnicoPieza(base, piezas) {
  let id = base
  let n = 2
  const usados = new Set(piezas.map(p => p.id))
  while (usados.has(id)) {
    id = `${base}_${n}`
    n += 1
  }
  return id
}

export default function PiezasTacticasDialog({
  open,
  slug,
  loc,
  localizaciones = [],
  assetsTacticos = [],
  onClose,
  onAplicar,
}) {
  const mapa = configMapa(loc)
  const { tile_w: tileW, tile_h: tileH, cols, rows } = mapa
  const [origenX, origenY] = mapa.origen_px
  const [piezas, setPiezas] = useState(() => objetos(loc))
  const [assetSel, setAssetSel] = useState(() => assetsTacticos[0]?.id || '')
  const [rotacion, setRotacion] = useState('norte')
  const [estado, setEstado] = useState('')
  const [destinoTransicion, setDestinoTransicion] = useState('')
  const [seleccionId, setSeleccionId] = useState('')
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [spritesTick, setSpritesTick] = useState(0)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const piezasImgRef = useRef(new Map())

  const catalogo = useMemo(() => new Map(assetsTacticos.map(a => [a.id, a])), [assetsTacticos])
  const maskBase = parseWalkmask(loc?.mapa?.pisable, cols, rows)
  const urlImagen = open && slug && loc?.mapa?.imagen ? urlMapaPublico(slug, loc.mapa.imagen) : ''
  const piezaSeleccionada = piezas.find(p => p.id === seleccionId) || null
  const visorDims = urlImagen ? imgDims : { w: imgDims.w || 960, h: imgDims.h || 620 }
  const destinos = (loc?.conexiones || [])
    .map(id => localizaciones.find(l => l.id === id))
    .filter(Boolean)
    .filter(l => l.mapa?.imagen)

  useEffect(() => {
    const urls = assetsTacticos
      .map((asset) => urlAssetTactico(slug, asset?.imagen))
      .filter(Boolean)
    for (const url of [...new Set(urls)]) {
      if (piezasImgRef.current.has(url)) continue
      const img = new Image()
      img.onload = () => setSpritesTick((v) => v + 1)
      img.onerror = () => {
        piezasImgRef.current.set(url, false)
        setSpritesTick((v) => v + 1)
      }
      piezasImgRef.current.set(url, img)
      img.src = url
    }
  }, [assetsTacticos, slug])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !visorDims.w || !visorDims.h) return
    canvas.width = visorDims.w
    canvas.height = visorDims.h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const grosor = Math.max(2, Math.round(canvas.width / 500))

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const { px, py } = celdaAPx(mapa, x, y)
        const bloqueadaBase = maskBase[y]?.[x] === '.'
        ctx.beginPath()
        ctx.moveTo(px, py - tileH / 2)
        ctx.lineTo(px + tileW / 2, py)
        ctx.lineTo(px, py + tileH / 2)
        ctx.lineTo(px - tileW / 2, py)
        ctx.closePath()
        if (bloqueadaBase) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)'
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
        ctx.lineWidth = grosor * 2
        ctx.stroke()
        ctx.strokeStyle = bloqueadaBase ? 'rgba(248, 113, 113, 0.75)' : 'rgba(253, 224, 71, 0.6)'
        ctx.lineWidth = grosor
        ctx.stroke()
      }
    }

    for (const pieza of piezas) {
      if (!Array.isArray(pieza.celda)) continue
      const [x, y] = pieza.celda
      const asset = catalogo.get(pieza.asset_id)
      const { px, py } = celdaAPx(mapa, x, y)
      const url = urlAssetTactico(slug, asset?.imagen)
      const img = url ? piezasImgRef.current.get(url) : null
      const offset = Array.isArray(asset?.offset_px) ? asset.offset_px : [0, 0]
      if (img && img !== false && img.complete && img.naturalWidth > 0) {
        const ratio = img.naturalHeight / Math.max(1, img.naturalWidth)
        const ancho = anchoPiezaPorHuella(mapa, asset?.ocupa)
        const alto = ancho * ratio
        const cxImg = px + (offset[0] || 0)
        const cyImg = py - alto / 2 + (offset[1] || 0)
        const angle = anguloRotacion(pieza.rotacion)
        ctx.save()
        ctx.translate(cxImg, cyImg)
        ctx.rotate(angle)
        ctx.drawImage(img, -ancho / 2, -alto / 2, ancho, alto)
        if (pieza.id === seleccionId) {
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = Math.max(2, grosor)
          ctx.strokeRect(-ancho / 2, -alto / 2, ancho, alto)
        }
        ctx.restore()
      } else {
        ctx.beginPath()
        ctx.arc(px, py, Math.max(8, tileH * 0.35), 0, Math.PI * 2)
        ctx.fillStyle = pieza.id === seleccionId
          ? '#facc15'
          : asset?.pisable === false
            ? '#64748b'
            : '#38bdf8'
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)'
        ctx.stroke()
        ctx.fillStyle = '#f8fafc'
        ctx.font = `${Math.max(10, grosor * 4)}px ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((asset?.id || pieza.asset_id || '?').slice(0, 2).toUpperCase(), px, py)
      }
    }
  }, [catalogo, cols, maskBase, mapa, piezas, rows, seleccionId, slug, spritesTick, tileH, tileW, visorDims.h, visorDims.w])

  if (!open || !loc) return null

  const puntoCanvasDesdeEvento = (ev) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      px: (ev.clientX - rect.left) * (canvas.width / rect.width),
      py: (ev.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const celdaDesdePunto = (punto) => {
    if (!punto) return null
    const a = (punto.px - origenX) / (tileW / 2)
    const b = (punto.py - origenY) / (tileH / 2)
    const x = Math.round((a + b) / 2)
    const y = Math.round((b - a) / 2)
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null
    return [x, y]
  }

  const colocar = (ev) => {
    const punto = puntoCanvasDesdeEvento(ev)
    const piezaVisual = punto
      ? piezaEnPuntoVisual(piezas, catalogo, mapa, slug, piezasImgRef.current, punto)
      : null
    if (piezaVisual) {
      seleccionarPieza(piezaVisual)
      return
    }
    const celda = celdaDesdePunto(punto)
    if (!celda || !assetSel) return
    const existente = piezaEnCelda(piezas, catalogo, celda)
    if (existente) {
      seleccionarPieza(existente)
      return
    }
    const asset = catalogo.get(assetSel)
    const id = idUnicoPieza(`${assetSel}_${celda[0]}_${celda[1]}`, piezas)
    const pieza = {
      id,
      asset_id: assetSel,
      celda,
      rotacion,
      estado: estado || asset?.estado_default || undefined,
      destino: destinoTransicion || undefined,
      tipo_interaccion: destinoTransicion ? 'transicion' : undefined,
      etiqueta_ui: destinoTransicion ? `Ir a ${destinoTransicion}` : undefined,
    }
    setPiezas(prev => [...prev, pieza])
    seleccionarPieza(pieza)
  }

  const seleccionarPieza = (pieza) => {
    if (!pieza) return
    setSeleccionId(pieza.id)
    setAssetSel(pieza.asset_id || assetsTacticos[0]?.id || '')
    setRotacion(pieza.rotacion || 'norte')
    setEstado(pieza.estado || '')
    setDestinoTransicion(pieza.destino || '')
  }

  const borrarSeleccion = () => {
    if (!seleccionId) return
    setPiezas(prev => prev.filter(p => p.id !== seleccionId))
    setSeleccionId('')
  }

  const actualizarSeleccion = (patch) => {
    if (!seleccionId) return
    setPiezas(prev => prev.map(p => (p.id === seleccionId ? { ...p, ...patch } : p)))
  }

  const aplicar = () => {
    onAplicar?.({
      ...(loc.mapa || {}),
      modo_render: loc.mapa?.modo_render || (loc.mapa?.imagen ? loc.mapa.modo_render : 'piezas'),
      objetos_tacticos: piezas,
    })
    onClose?.()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog" style={{ maxWidth: 1280, width: 'min(96vw, 1280px)' }} onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Piezas tácticas — <span className="av-cell-id">{loc.id}</span></h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="av-ia-body" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <div style={{ position: 'relative', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, overflow: 'auto', maxHeight: '72vh', minHeight: 360 }}>
            <OrientacionNorteMapa />
            <div style={{ position: 'relative', width: visorDims.w || '100%', minWidth: '100%' }}>
              {urlImagen ? (
                <img
                  ref={imgRef}
                  src={urlImagen}
                  alt={`Mapa ${loc.id}`}
                  onLoad={() => {
                    const img = imgRef.current
                    if (img) setImgDims({ w: img.naturalWidth, h: img.naturalHeight })
                  }}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                  draggable={false}
                />
              ) : (
                <div style={{ width: visorDims.w, height: visorDims.h }} />
              )}
              <canvas
                ref={canvasRef}
                onClick={colocar}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="av-field">
              <span className="av-field-label">Asset</span>
              <select
                className="av-input"
                value={assetSel}
                onChange={e => {
                  setAssetSel(e.target.value)
                  actualizarSeleccion({ asset_id: e.target.value })
                }}
              >
                {assetsTacticos.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id} · {asset.categoria || 'asset'}
                  </option>
                ))}
              </select>
            </label>
            <label className="av-field">
              <span className="av-field-label">Rotación</span>
              <select
                className="av-input"
                value={rotacion}
                onChange={e => {
                  setRotacion(e.target.value)
                  actualizarSeleccion({ rotacion: e.target.value })
                }}
              >
                {ROTACIONES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="av-field">
              <span className="av-field-label">Estado inicial</span>
              <input
                className="av-input"
                value={estado}
                onChange={e => {
                  setEstado(e.target.value)
                  actualizarSeleccion({ estado: e.target.value || undefined })
                }}
                placeholder="cerrada / abierta / ..."
              />
            </label>
            <label className="av-field">
              <span className="av-field-label">Destino transición (opcional)</span>
              <select
                className="av-input"
                value={destinoTransicion}
                onChange={e => {
                  const destino = e.target.value
                  setDestinoTransicion(destino)
                  actualizarSeleccion({
                    destino: destino || undefined,
                    tipo_interaccion: destino ? 'transicion' : undefined,
                    etiqueta_ui: destino ? (piezaSeleccionada?.etiqueta_ui || `Ir a ${destino}`) : undefined,
                  })
                }}
              >
                <option value="">Sin transición</option>
                {destinos.map(dest => (
                  <option key={dest.id} value={dest.id}>
                    {dest.nombre || dest.id}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="av-btn-danger av-btn-small" onClick={borrarSeleccion} disabled={!seleccionId}>
              Borrar seleccionada
            </button>
            <div style={{ fontSize: 11, color: '#94a3b8', background: '#0f172a', border: '1px dashed #334155', padding: '6px 8px', borderRadius: 4 }}>
              Click en una pieza para seleccionarla; click en una celda libre para colocar una nueva. Las piezas con destino funcionan como transiciones tácticas.
            </div>
            <strong style={{ fontSize: 12 }}>Objetos: {piezas.length}</strong>
            <div style={{ overflow: 'auto', maxHeight: 260, display: 'grid', gap: 4 }}>
              {piezas.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="btn-secondary av-btn-small"
                  onClick={() => seleccionarPieza(p)}
                  style={{ textAlign: 'left', borderColor: p.id === seleccionId ? '#facc15' : undefined }}
                >
                  {p.id} · {p.asset_id} · [{p.celda?.join(', ')}]{p.destino ? ` → ${p.destino}` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="av-modal-footer">
          <button type="button" className="btn-primary" onClick={aplicar}>Aplicar piezas</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
