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

function spawnsDe(loc) {
  return Array.isArray(loc?.mapa?.spawns_npc)
    ? loc.mapa.spawns_npc
      .filter(s => s && typeof s === 'object')
      .map(s => ({ ...s, npc_id: String(s.npc_id || '').trim(), celda: normalizarCelda(s.celda) }))
      .filter(s => s.npc_id)
    : []
}

function iniciales(nombre, id) {
  const raw = String(nombre || id || '?').trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return raw.slice(0, 2).toUpperCase()
}

export default function NpcSpawnsDialog({ open, slug, loc, npcs = [], onClose, onAplicar }) {
  const mapa = configMapa(loc)
  const { tile_w: tileW, tile_h: tileH, cols, rows } = mapa
  const [origenX, origenY] = mapa.origen_px
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [spawns, setSpawns] = useState(() => spawnsDe(loc))
  const npcsLoc = useMemo(
    () => npcs.filter(npc => String(npc?.ubicacion || '').trim() === String(loc?.id || '').trim()),
    [loc?.id, npcs],
  )
  const [npcSel, setNpcSel] = useState(() => npcsLoc[0]?.id || '')
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const mask = parseWalkmask(loc?.mapa?.pisable, cols, rows)

  useEffect(() => {
    if (!npcSel && npcsLoc[0]?.id) setNpcSel(npcsLoc[0].id)
  }, [npcSel, npcsLoc])

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

    for (const spawn of spawns) {
      if (!Array.isArray(spawn.celda)) continue
      const npc = npcsLoc.find(n => n.id === spawn.npc_id)
      const { px, py } = celdaAPx(mapa, spawn.celda[0], spawn.celda[1])
      const seleccionado = spawn.npc_id === npcSel
      ctx.beginPath()
      ctx.arc(px, py, Math.max(10, tileH * (seleccionado ? 0.62 : 0.5)), 0, Math.PI * 2)
      ctx.fillStyle = seleccionado ? 'rgba(96, 165, 250, 0.94)' : 'rgba(168, 85, 247, 0.9)'
      ctx.fill()
      ctx.lineWidth = grosor * 2
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.98)'
      ctx.stroke()
      ctx.fillStyle = seleccionado ? '#082f49' : '#faf5ff'
      ctx.font = `bold ${Math.max(11, tileH * 0.44)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(iniciales(npc?.nombre, spawn.npc_id), px, py)
    }
  }, [cols, imgDims, mask, mapa, npcSel, npcsLoc, rows, spawns, tileH, tileW])

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
    if (!npcSel || !celda) return
    const npc = npcsLoc.find(n => n.id === npcSel)
    setSpawns(prev => [
      ...prev.filter(s => s.npc_id !== npcSel),
      {
        npc_id: npcSel,
        celda,
        etiqueta_ui: String(npc?.nombre || npcSel),
      },
    ])
  }

  const spawnSel = spawns.find(s => s.npc_id === npcSel)
  const warning = (() => {
    if (!npcSel) return 'Selecciona un NPC de esta localización.'
    if (!spawnSel?.celda) return 'Click sobre una celda para asignar el spawn del NPC.'
    const [x, y] = spawnSel.celda
    if (mask[y]?.[x] === '.') return 'Aviso: la celda seleccionada está bloqueada en la walkmask.'
    return ''
  })()

  const aplicar = () => {
    const limpios = spawns
      .filter(s => s.npc_id && Array.isArray(s.celda))
      .map(s => ({
        npc_id: s.npc_id,
        celda: normalizarCelda(s.celda),
        ...(String(s.etiqueta_ui || '').trim() ? { etiqueta_ui: String(s.etiqueta_ui).trim() } : {}),
      }))
    onAplicar?.({ ...(loc.mapa || {}), spawns_npc: limpios })
    onClose?.()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog" style={{ maxWidth: 1180 }} onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Spawns NPC — <span className="av-cell-id">{loc.id}</span></h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="av-ia-body" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
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
            <strong>NPCs de la localización</strong>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              Selecciona un NPC y haz click sobre una celda para fijar su posición inicial.
            </p>
            {npcsLoc.length === 0 ? (
              <p className="av-empty">No hay NPCs con ubicación «{loc.id}».</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {npcsLoc.map(npc => {
                  const spawn = spawns.find(s => s.npc_id === npc.id)
                  return (
                    <button
                      key={npc.id}
                      type="button"
                      className={npcSel === npc.id ? 'btn-primary av-btn-small' : 'btn-secondary av-btn-small'}
                      onClick={() => setNpcSel(npc.id)}
                      style={{ justifyContent: 'space-between' }}
                    >
                      <span>{npc.nombre || npc.id}</span>
                      <span>{spawn?.celda ? `[${spawn.celda.join(', ')}]` : 'sin spawn'}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {warning && <div style={{ fontSize: 12, color: spawnSel?.celda ? '#fbbf24' : '#fca5a5' }}>{warning}</div>}
            {spawnSel && (
              <button
                type="button"
                className="av-btn-danger av-btn-small"
                onClick={() => setSpawns(prev => prev.filter(s => s.npc_id !== npcSel))}
              >
                Quitar spawn seleccionado
              </button>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
              <button type="button" className="btn-primary av-btn-small" onClick={aplicar}>Aplicar NPCs</button>
              <button type="button" className="btn-secondary av-btn-small" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
