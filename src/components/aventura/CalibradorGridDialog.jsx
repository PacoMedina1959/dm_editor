import { useEffect, useRef, useState } from 'react'
import { urlMapaPublico } from '../../api/mapaIA.js'

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
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

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

    // Origen destacado: anillo oscuro + punto amarillo, del mismo grosor.
    const radioOrigen = grosorBase * 3
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
    ctx.lineWidth = grosorBase
    ctx.beginPath()
    ctx.arc(ox, oy, radioOrigen, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(ox, oy, radioOrigen - grosorBase, 0, Math.PI * 2)
    ctx.fill()
  }, [tileW, tileH, cols, rows, ox, oy, imgDims])

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
        style={{ maxWidth: 1100 }}
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
              overflow: 'hidden',
              minHeight: 300,
            }}
          >
            {urlImagen && (
              <img
                ref={imgRef}
                src={urlImagen}
                alt={`Mapa ${loc.id}`}
                onLoad={handleImgLoad}
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            )}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              El punto amarillo es <b>origen_px</b>: posición en píxeles de la
              celda <code>(0,0)</code>. Muévelo para que el grid coincida con
              el suelo dibujado por la IA.
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
