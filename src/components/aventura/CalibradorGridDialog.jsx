import { useEffect, useRef, useState } from 'react'
import { urlMapaPublico } from '../../api/mapaIA.js'
import OrientacionNorteMapa from './OrientacionNorteMapa.jsx'

/**
 * Modal de calibrado visual del grid isométrico (proyección dimétrica 2:1,
 * estilo Diablo). Se abre desde la fila de una localización que ya tiene
 * `loc.mapa.imagen`. Permite mover sliders para ajustar `tile_w`, `tile_h`,
 * `cols`, `rows` y `origen_px`, y ver el grid superpuesto en vivo sobre la
 * imagen.
 *
 * No llama al backend. Al "Aplicar", fusiona los nuevos valores con el
 * `loc.mapa` existente y lo propaga vía `onAplicar(mapaNuevo)`; el DM debe
 * luego "Guardar en servidor" para persistir en `aventura.yaml`.
 */

const DEFAULTS = {
  tile_w: 64,
  tile_h: 32,
  cols: 10,
  rows: 10,
  origen_px: [0, 0],
}

// Límites alineados con F3.0a/F3.0b (validador backend).
const LIM = {
  tile_w: { min: 8, max: 128 },
  tile_h: { min: 8, max: 128 },
  cols: { min: 1, max: 64 },
  rows: { min: 1, max: 64 },
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

function clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor))
}

/**
 * Conversión lógica → píxeles (dimétrico 2:1). Copia literal de la fórmula
 * usada en el runtime; si algún día se reutiliza en tres sitios, se extrae.
 */
function celdaAPx(mapa, x, y) {
  const [ox, oy] = mapa.origen_px
  return {
    px: ox + (x - y) * (mapa.tile_w / 2),
    py: oy + (x + y) * (mapa.tile_h / 2),
  }
}

/**
 * Calcula los valores de precarga desde `loc.mapa`; los campos ausentes
 * caen a DEFAULTS. Se usa una sola vez (lazy init de los useState); el
 * padre debe dar al componente un `key` que cambie al abrir una localización
 * distinta, para forzar remount.
 */
function calcularInicial(loc) {
  const m = loc?.mapa || {}
  const tw = Number.isFinite(m.tile_w) ? m.tile_w : DEFAULTS.tile_w
  const th = Number.isFinite(m.tile_h) ? m.tile_h : DEFAULTS.tile_h
  const c = Number.isFinite(m.cols) ? m.cols : DEFAULTS.cols
  const r = Number.isFinite(m.rows) ? m.rows : DEFAULTS.rows
  const o = Array.isArray(m.origen_px) && m.origen_px.length === 2
    ? [m.origen_px[0], m.origen_px[1]]
    : [...DEFAULTS.origen_px]
  const preset = !m.tile_h || th === Math.round(tw / 2)
  return { tw, th, c, r, o, preset }
}

export default function CalibradorGridDialog({
  open,
  slug,
  loc,
  onClose,
  onAplicar,
}) {
  const [tileW, setTileW] = useState(() => calcularInicial(loc).tw)
  // tileHManual guarda el valor libre del slider. Cuando el preset 2:1 está
  // activo, el tile_h efectivo se deriva de tileW (sin setState en efecto).
  const [tileHManual, setTileHManual] = useState(() => calcularInicial(loc).th)
  const [cols, setCols] = useState(() => calcularInicial(loc).c)
  const [rows, setRows] = useState(() => calcularInicial(loc).r)
  const [ox, setOx] = useState(() => calcularInicial(loc).o[0])
  const [oy, setOy] = useState(() => calcularInicial(loc).o[1])
  const [preset21, setPreset21] = useState(() => calcularInicial(loc).preset)

  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const dragRef = useRef(null)

  const urlImagen = open && slug && loc?.mapa?.imagen
    ? urlMapaPublico(slug, loc.mapa.imagen)
    : null

  const tileH = preset21
    ? Math.max(
        LIM.tile_h.min,
        Math.min(LIM.tile_h.max, Math.round(tileW / 2)),
      )
    : tileHManual

  const handleImgLoad = () => {
    const img = imgRef.current
    if (!img) return
    setImgDims({ w: img.naturalWidth, h: img.naturalHeight })
  }

  // Redibujo del grid en vivo.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgDims.w || !imgDims.h) return
    canvas.width = imgDims.w
    canvas.height = imgDims.h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const mapa = { tile_w: tileW, tile_h: tileH, cols, rows, origen_px: [ox, oy] }

    // El canvas se renderiza a resolución natural de la imagen (p. ej. 1024 px)
    // y se escala con CSS al ancho del contenedor (~580 px). Si usáramos
    // lineWidth=1 nativo, se vería como ~0.5 px visuales, casi invisible. Por
    // eso escalamos el grosor a la resolución real y dibujamos en dos pasadas
    // (halo oscuro + línea cálida) para que el grid se lea sobre cualquier
    // fondo que devuelva la IA (empedrado, césped, tejas...).
    const grosorBase = Math.max(2, Math.round(canvas.width / 400))
    const rombos = []
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const { px, py } = celdaAPx(mapa, x, y)
        rombos.push({ px, py })
      }
    }

    const pintarRombos = (stroke, fill, lineWidth) => {
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      if (fill) ctx.fillStyle = fill
      for (const { px, py } of rombos) {
        ctx.beginPath()
        ctx.moveTo(px, py - tileH / 2)
        ctx.lineTo(px + tileW / 2, py)
        ctx.lineTo(px, py + tileH / 2)
        ctx.lineTo(px - tileW / 2, py)
        ctx.closePath()
        if (fill) ctx.fill()
        ctx.stroke()
      }
    }

    // Pasada 1: halo oscuro (ensancha la línea, asegura contraste sobre
    // cualquier textura clara).
    pintarRombos('rgba(0, 0, 0, 0.85)', null, grosorBase * 2)
    // Pasada 2: línea cálida con un toque de relleno apenas perceptible
    // para que el rombo se intuya sin tapar detalle del arte.
    pintarRombos(
      'rgba(253, 224, 71, 0.95)',
      'rgba(253, 224, 71, 0.08)',
      grosorBase,
    )

    const origen = celdaAPx(mapa, 0, 0)
    const ejeX = celdaAPx(mapa, 1, 0)
    const ejeY = celdaAPx(mapa, 0, 1)

    const pintarLineaControl = (a, b, color) => {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
      ctx.lineWidth = grosorBase * 4
      ctx.beginPath()
      ctx.moveTo(a.px, a.py)
      ctx.lineTo(b.px, b.py)
      ctx.stroke()
      ctx.strokeStyle = color
      ctx.lineWidth = grosorBase * 2
      ctx.beginPath()
      ctx.moveTo(a.px, a.py)
      ctx.lineTo(b.px, b.py)
      ctx.stroke()
    }

    const pintarHandle = ({ px, py }, fill, texto) => {
      const radio = Math.max(grosorBase * 4, 9)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
      ctx.lineWidth = grosorBase * 2
      ctx.beginPath()
      ctx.arc(px, py, radio, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.arc(px, py, radio - grosorBase, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `${Math.max(12, grosorBase * 5)}px ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#020617'
      ctx.fillText(texto, px, py)
    }

    pintarLineaControl(origen, ejeX, 'rgba(56, 189, 248, 0.98)')
    pintarLineaControl(origen, ejeY, 'rgba(52, 211, 153, 0.98)')
    pintarHandle(origen, '#fbbf24', 'O')
    pintarHandle(ejeX, '#38bdf8', 'X')
    pintarHandle(ejeY, '#34d399', 'Y')

    ctx.font = `${Math.max(12, grosorBase * 5)}px system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)'
    ctx.fillRect(Math.max(0, ox + 12), Math.max(0, oy - 34), 182, 24)
    ctx.fillStyle = '#f8fafc'
    ctx.fillText('Arrastra O, X o Y', Math.max(4, ox + 18), Math.max(4, oy - 30))
  }, [tileW, tileH, cols, rows, ox, oy, imgDims])

  const setZoomPaso = dir => {
    const idx = ZOOMS.indexOf(zoom)
    const actual = idx >= 0 ? idx : ZOOMS.indexOf(1)
    setZoom(ZOOMS[clamp(actual + dir, 0, ZOOMS.length - 1)])
  }

  const puntoImagenDesdeEvento = ev => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      px: clamp((ev.clientX - rect.left) * (canvas.width / rect.width), 0, imgDims.w || canvas.width),
      py: clamp((ev.clientY - rect.top) * (canvas.height / rect.height), 0, imgDims.h || canvas.height),
    }
  }

  const detectarHandle = punto => {
    const mapa = { tile_w: tileW, tile_h: tileH, cols, rows, origen_px: [ox, oy] }
    const handles = [
      ['origin', celdaAPx(mapa, 0, 0)],
      ['axisX', celdaAPx(mapa, 1, 0)],
      ['axisY', celdaAPx(mapa, 0, 1)],
    ]
    const radio = Math.max(22, Math.min(tileW, tileH) * 0.9)
    for (const [tipo, handle] of handles) {
      const dx = punto.px - handle.px
      const dy = punto.py - handle.py
      if (Math.hypot(dx, dy) <= radio) return tipo
    }
    return 'origin'
  }

  const ajustarEjeDesdePunto = punto => {
    const nextW = clamp(Math.round(Math.abs(punto.px - ox) * 2), LIM.tile_w.min, LIM.tile_w.max)
    const nextH = clamp(Math.round(Math.abs(punto.py - oy) * 2), LIM.tile_h.min, LIM.tile_h.max)
    setTileW(nextW)
    if (!preset21) setTileHManual(nextH)
  }

  const handlePointerDown = ev => {
    const punto = puntoImagenDesdeEvento(ev)
    if (!punto) return
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
    dragRef.current = detectarHandle(punto)
    if (dragRef.current === 'origin') {
      setOx(Math.round(punto.px))
      setOy(Math.round(punto.py))
    } else {
      ajustarEjeDesdePunto(punto)
    }
  }

  const handlePointerMove = ev => {
    if (!dragRef.current || ev.buttons !== 1) return
    const punto = puntoImagenDesdeEvento(ev)
    if (!punto) return
    if (dragRef.current === 'origin') {
      setOx(Math.round(punto.px))
      setOy(Math.round(punto.py))
    } else {
      ajustarEjeDesdePunto(punto)
    }
  }

  const handlePointerEnd = ev => {
    dragRef.current = null
    ev.currentTarget.releasePointerCapture?.(ev.pointerId)
  }

  const ajustarSueloVisible = () => {
    if (!imgDims.w || !imgDims.h) return
    const nextCols = imgDims.w >= 1536 ? 36 : 24
    const nextRows = imgDims.w >= 1536 ? 26 : 18
    const nextTileW = clamp(
      Math.round((imgDims.w * 1.42) / (nextCols + nextRows)),
      LIM.tile_w.min,
      LIM.tile_w.max,
    )
    const nextTileH = clamp(Math.round(nextTileW / 2), LIM.tile_h.min, LIM.tile_h.max)
    setCols(clamp(nextCols, LIM.cols.min, LIM.cols.max))
    setRows(clamp(nextRows, LIM.rows.min, LIM.rows.max))
    setTileW(nextTileW)
    setTileHManual(nextTileH)
    setPreset21(true)
    setOx(Math.round(imgDims.w * 0.5 - ((nextCols - nextRows) * nextTileW) / 4))
    setOy(Math.round(imgDims.h * 0.32))
  }

  const cubrirImagenCompleta = () => {
    if (!imgDims.w || !imgDims.h) return
    const nextCols = imgDims.w >= 1536 ? 48 : 32
    const nextRows = imgDims.w >= 1536 ? 36 : 24
    const nextTileW = clamp(
      Math.round((imgDims.w * 1.9) / (nextCols + nextRows)),
      LIM.tile_w.min,
      LIM.tile_w.max,
    )
    const nextTileH = clamp(Math.round(nextTileW / 2), LIM.tile_h.min, LIM.tile_h.max)
    setCols(clamp(nextCols, LIM.cols.min, LIM.cols.max))
    setRows(clamp(nextRows, LIM.rows.min, LIM.rows.max))
    setTileW(nextTileW)
    setTileHManual(nextTileH)
    setPreset21(true)
    setOx(Math.round(imgDims.w * 0.5 - ((nextCols - nextRows) * nextTileW) / 4))
    setOy(Math.round(imgDims.h * 0.12))
  }

  if (!open || !loc) return null

  const handleAplicar = () => {
    const mapaBase = loc.mapa || {}
    const mapaNuevo = {
      ...mapaBase,
      tile_w: tileW,
      tile_h: tileH,
      cols,
      rows,
      origen_px: [ox, oy],
    }
    onAplicar?.(mapaNuevo)
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
          <h3>
            Calibrar grid — <span className="av-cell-id">{loc.id}</span>
          </h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>

        <div
          className="av-ia-body"
          style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}
        >
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
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'grab',
                  touchAction: 'none',
                }}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button type="button" className="btn-secondary av-btn-small" onClick={ajustarSueloVisible}>
                Cubrir suelo visible
              </button>
              <button type="button" className="btn-secondary av-btn-small" onClick={cubrirImagenCompleta}>
                Cubrir imagen completa
              </button>
            </div>
            <SliderField
              label="tile_w (ancho celda)"
              value={tileW}
              min={LIM.tile_w.min}
              max={LIM.tile_w.max}
              onChange={setTileW}
            />
            <SliderField
              label="tile_h (alto celda)"
              value={tileH}
              min={LIM.tile_h.min}
              max={LIM.tile_h.max}
              onChange={setTileHManual}
              disabled={preset21}
              hint={preset21 ? 'Bloqueado por preset 2:1' : null}
            />
            <label className="av-field-inline">
              <input
                type="checkbox"
                checked={preset21}
                onChange={e => setPreset21(e.target.checked)}
              />
              <span>Preset dimétrico 2:1 (Diablo)</span>
            </label>

            <SliderField
              label="cols"
              value={cols}
              min={LIM.cols.min}
              max={LIM.cols.max}
              onChange={setCols}
            />
            <SliderField
              label="rows"
              value={rows}
              min={LIM.rows.min}
              max={LIM.rows.max}
              onChange={setRows}
            />

            <SliderField
              label="origen_px X"
              value={ox}
              min={0}
              max={Math.max(imgDims.w, 1)}
              onChange={setOx}
              hint={imgDims.w ? `0..${imgDims.w} px` : null}
            />
            <SliderField
              label="origen_px Y"
              value={oy}
              min={0}
              max={Math.max(imgDims.h, 1)}
              onChange={setOy}
              hint={imgDims.h ? `0..${imgDims.h} px` : null}
            />

            <div
              style={{
                fontSize: 11,
                color: '#94a3b8',
                background: '#0f172a',
                border: '1px dashed #334155',
                padding: '6px 8px',
                borderRadius: 4,
              }}
            >
              Arrastra <b>O</b> para mover <code>origen_px</code>. Arrastra
              <b> X</b> o <b>Y</b> para ajustar escala/ejes de la rejilla. Usa
              zoom y scroll para trabajar con precisión en mapas grandes.
            </div>
          </div>
        </div>

        <div className="av-modal-footer">
          <button type="button" className="btn-primary" onClick={handleAplicar}>
            Aplicar a la localización
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function SliderField({ label, value, min, max, onChange, disabled, hint }) {
  return (
    <label
      className="av-ia-label"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: '#cbd5e1' }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
      />
      {hint && <span style={{ fontSize: 10, color: '#64748b' }}>{hint}</span>}
    </label>
  )
}
