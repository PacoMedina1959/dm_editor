import { useEffect, useMemo, useState } from 'react'
import { listarAssetsTacticos } from '../../api/aventuras.js'
import { urlMapaPublico } from '../../api/mapaIA.js'

const CATEGORIAS = ['suelos', 'paredes', 'puertas', 'escaleras', 'muebles', 'props', 'decoracion']
const PISABLE_DEFAULT = new Set(['suelos', 'decoracion'])
const BLOQUEA_VISION_DEFAULT = new Set(['paredes', 'puertas'])

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'asset'
}

function paresDesdeTexto(value, fallback = [[0, 0]]) {
  const texto = String(value || '').trim()
  if (!texto) return fallback
  try {
    const parsed = JSON.parse(texto)
    if (
      Array.isArray(parsed)
      && parsed.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger))
    ) {
      return parsed
    }
  } catch { /* texto libre inválido */ }
  return fallback
}

function offsetDesdeTexto(value, fallback = [0, 0]) {
  const texto = String(value || '').trim()
  if (!texto) return fallback
  try {
    const parsed = JSON.parse(texto)
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every(Number.isInteger)) {
      return parsed
    }
  } catch { /* texto libre inválido */ }
  return fallback
}

function textoPares(value, fallback = '[[0,0]]') {
  if (!Array.isArray(value)) return fallback
  return JSON.stringify(value)
}

function categoriaDesdeRuta(ruta) {
  const partes = String(ruta || '').split('/')
  return CATEGORIAS.includes(partes[2]) ? partes[2] : 'props'
}

function assetDesdeDetectado(item) {
  const categoria = item.categoria_sugerida || categoriaDesdeRuta(item.ruta)
  return {
    id: slugify(item.id_sugerido || item.ruta?.split('/').pop()?.replace(/\.[^.]+$/, '')),
    categoria,
    imagen: item.ruta,
    ocupa: [[0, 0]],
    pisable: PISABLE_DEFAULT.has(categoria),
    bloquea_vision: BLOQUEA_VISION_DEFAULT.has(categoria),
    offset_px: [0, 0],
  }
}

function assetManual() {
  return {
    id: 'asset_nuevo',
    categoria: 'props',
    imagen: 'assets/tacticos/props/asset_nuevo.png',
    ocupa: [[0, 0]],
    pisable: false,
    bloquea_vision: false,
    offset_px: [0, 0],
  }
}

function validarAsset(asset, assets) {
  const errores = []
  const id = String(asset?.id || '').trim()
  const imagen = String(asset?.imagen || '').trim()
  if (!id) errores.push('Falta id.')
  if (id && !/^[a-z0-9][a-z0-9_]*$/.test(id)) errores.push('ID inválido: usa snake_case.')
  if (id && assets.filter(a => a.id === id).length > 1) errores.push(`ID duplicado: ${id}.`)
  if (!CATEGORIAS.includes(asset?.categoria)) errores.push('Categoría inválida.')
  if (!imagen.startsWith('assets/tacticos/')) errores.push('La ruta debe empezar por assets/tacticos/.')
  if (!Array.isArray(asset?.ocupa) || !asset.ocupa.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger))) {
    errores.push('ocupa debe ser una lista de pares enteros, ej. [[0,0]].')
  }
  if (!Array.isArray(asset?.offset_px) || asset.offset_px.length !== 2 || !asset.offset_px.every(Number.isInteger)) {
    errores.push('offset_px debe ser [x,y].')
  }
  return errores
}

export default function CatalogoPiezasTacticasDialog({
  open,
  slug,
  assetsTacticos = [],
  onClose,
  onAplicar,
}) {
  const [assets, setAssets] = useState(() => assetsTacticos.map(a => ({ ...a })))
  const [seleccionId, setSeleccionId] = useState(() => assetsTacticos[0]?.id || '')
  const [detectados, setDetectados] = useState([])
  const [errorDetectar, setErrorDetectar] = useState('')
  const [cargando, setCargando] = useState(false)
  const [ocupaTexto, setOcupaTexto] = useState('[[0,0]]')
  const [offsetTexto, setOffsetTexto] = useState('[0,0]')

  const seleccion = assets.find(a => a.id === seleccionId) || assets[0] || null
  const errores = useMemo(
    () => assets.flatMap(a => validarAsset(a, assets).map(msg => `${a.id || '(sin id)'}: ${msg}`)),
    [assets],
  )

  useEffect(() => {
    setOcupaTexto(textoPares(seleccion?.ocupa))
    setOffsetTexto(textoPares(seleccion?.offset_px, '[0,0]'))
  }, [seleccion?.id, seleccion?.ocupa, seleccion?.offset_px])

  if (!open) return null

  const seleccionar = id => setSeleccionId(id)

  const updateSeleccion = patch => {
    if (!seleccion) return
    setAssets(prev => prev.map(a => (a === seleccion ? { ...a, ...patch } : a)))
  }

  const addAsset = asset => {
    let next = { ...asset, id: slugify(asset.id) }
    let base = next.id
    let n = 2
    const ids = new Set(assets.map(a => a.id))
    while (ids.has(next.id)) {
      next.id = `${base}_${n}`
      n += 1
    }
    setAssets(prev => [...prev, next])
    setSeleccionId(next.id)
  }

  const detectar = async () => {
    if (!slug) {
      setErrorDetectar('Guarda o carga la aventura desde servidor para detectar assets.')
      return
    }
    setCargando(true)
    setErrorDetectar('')
    try {
      const data = await listarAssetsTacticos(slug)
      setDetectados(Array.isArray(data.assets) ? data.assets : [])
    } catch (e) {
      setErrorDetectar(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }

  const borrar = () => {
    if (!seleccion) return
    setAssets(prev => prev.filter(a => a !== seleccion))
    setSeleccionId('')
  }

  const aplicar = () => {
    if (errores.length) return
    onAplicar?.(assets)
    onClose?.()
  }

  const aplicarOcupaTexto = () => {
    if (!seleccion) return
    const parsed = paresDesdeTexto(ocupaTexto, seleccion.ocupa)
    updateSeleccion({ ocupa: parsed })
    setOcupaTexto(textoPares(parsed))
  }

  const aplicarOffsetTexto = () => {
    if (!seleccion) return
    const parsed = offsetDesdeTexto(offsetTexto, seleccion.offset_px || [0, 0])
    updateSeleccion({ offset_px: parsed })
    setOffsetTexto(textoPares(parsed, '[0,0]'))
  }

  const previewUrl = seleccion?.imagen ? urlMapaPublico(slug, seleccion.imagen) : ''

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div
        className="av-ia-dialog"
        style={{ maxWidth: 1180, width: 'min(96vw, 1180px)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="av-modal-header">
          <h3>Catálogo de piezas tácticas</h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="av-ia-body" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 260px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="btn-secondary av-btn-small" onClick={() => addAsset(assetManual())}>
                Añadir manual
              </button>
              <button type="button" className="btn-secondary av-btn-small" onClick={detectar} disabled={cargando}>
                {cargando ? 'Detectando…' : 'Detectar assets'}
              </button>
            </div>
            {errorDetectar && <div style={{ fontSize: 12, color: '#fca5a5' }}>{errorDetectar}</div>}
            <strong style={{ fontSize: 12 }}>Catálogo ({assets.length})</strong>
            <div style={{ display: 'grid', gap: 4, maxHeight: 420, overflow: 'auto' }}>
              {assets.map(asset => (
                <button
                  key={asset.id}
                  type="button"
                  className="btn-secondary av-btn-small"
                  onClick={() => seleccionar(asset.id)}
                  style={{ textAlign: 'left', borderColor: asset.id === seleccion?.id ? '#facc15' : undefined }}
                >
                  {asset.id} · {asset.categoria}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            {seleccion ? (
              <>
                <label className="av-field">
                  <span className="av-field-label">ID</span>
                  <input
                    className="av-input"
                    value={seleccion.id || ''}
                    onChange={e => {
                      const nextId = slugify(e.target.value)
                      updateSeleccion({ id: nextId })
                      setSeleccionId(nextId)
                    }}
                  />
                </label>
                <label className="av-field">
                  <span className="av-field-label">Categoría</span>
                  <select className="av-input" value={seleccion.categoria || 'props'} onChange={e => updateSeleccion({ categoria: e.target.value })}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="av-field">
                  <span className="av-field-label">Imagen</span>
                  <input className="av-input" value={seleccion.imagen || ''} onChange={e => updateSeleccion({ imagen: e.target.value })} />
                </label>
                <div className="av-form-row2">
                  <label className="av-field-inline">
                    <input type="checkbox" checked={!!seleccion.pisable} onChange={e => updateSeleccion({ pisable: e.target.checked })} />
                    <span>Pisable</span>
                  </label>
                  <label className="av-field-inline">
                    <input type="checkbox" checked={!!seleccion.bloquea_vision} onChange={e => updateSeleccion({ bloquea_vision: e.target.checked })} />
                    <span>Bloquea visión</span>
                  </label>
                </div>
                <label className="av-field">
                  <span className="av-field-label">Estado default</span>
                  <input className="av-input" value={seleccion.estado_default || ''} onChange={e => updateSeleccion({ estado_default: e.target.value || undefined })} />
                </label>
                <label className="av-field">
                  <span className="av-field-label">Ocupa (JSON)</span>
                  <input
                    className="av-input"
                    value={ocupaTexto}
                    onChange={e => setOcupaTexto(e.target.value)}
                    onBlur={aplicarOcupaTexto}
                  />
                </label>
                <label className="av-field">
                  <span className="av-field-label">offset_px (JSON)</span>
                  <input
                    className="av-input"
                    value={offsetTexto}
                    onChange={e => setOffsetTexto(e.target.value)}
                    onBlur={aplicarOffsetTexto}
                  />
                </label>
                <button type="button" className="av-btn-danger av-btn-small" onClick={borrar}>
                  Borrar asset
                </button>
              </>
            ) : (
              <p className="av-empty">Sin asset seleccionado.</p>
            )}
            {errores.length > 0 && (
              <div style={{ fontSize: 12, color: '#fca5a5', background: '#3f1d1d', border: '1px solid #7f1d1d', padding: 8, borderRadius: 4 }}>
                <strong>Errores</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {errores.map((e, i) => <li key={`${e}-${i}`}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <strong style={{ fontSize: 12 }}>Preview</strong>
            <div style={{ minHeight: 180, background: '#020617', border: '1px solid #334155', borderRadius: 4, display: 'grid', placeItems: 'center', padding: 8 }}>
              {previewUrl ? (
                <img src={previewUrl} alt={seleccion?.id || 'asset'} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }} />
              ) : (
                <span style={{ color: '#94a3b8', fontSize: 12 }}>Sin imagen</span>
              )}
            </div>
            <strong style={{ fontSize: 12 }}>Detectados</strong>
            <div style={{ display: 'grid', gap: 4, maxHeight: 260, overflow: 'auto' }}>
              {detectados.length === 0 && <span style={{ color: '#94a3b8', fontSize: 12 }}>Sin detecciones cargadas.</span>}
              {detectados.map(item => (
                <button
                  key={item.ruta}
                  type="button"
                  className="btn-secondary av-btn-small"
                  onClick={() => addAsset(assetDesdeDetectado(item))}
                  style={{ textAlign: 'left' }}
                >
                  + {item.ruta}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="av-modal-footer">
          <button type="button" className="btn-primary" onClick={aplicar} disabled={errores.length > 0}>
            Aplicar catálogo
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
