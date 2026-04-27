import { useEffect, useRef, useState } from 'react'
import { subirImagenMapaMundo, urlMapaPublico } from '../../api/mapaIA.js'

function locLabel(loc) {
  return loc?.nombre || loc?.id || '(sin nombre)'
}

function iniciales(loc) {
  const base = locLabel(loc).trim()
  if (!base) return '?'
  const words = base.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function MapaMundoDialog({
  aventura,
  localizaciones,
  onUpdate,
  serverSlug,
}) {
  const fileInputRef = useRef(null)
  const imageRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [selectedLocId, setSelectedLocId] = useState(localizaciones?.[0]?.id || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(100)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const mapa = aventura?.mapa_mundo || {}
  const posiciones = mapa.posiciones_localizaciones || {}
  const locs = localizaciones || []
  const selectedLoc = locs.find(loc => loc.id === selectedLocId) || null
  const imagenUrl = serverSlug && mapa.imagen ? urlMapaPublico(serverSlug, mapa.imagen) : ''
  const colocadas = locs.filter(loc => posiciones[loc.id]).length

  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
  }, [imagenUrl])

  const updateMapa = (patch) => {
    const nextMapa = {
      ...mapa,
      ...patch,
    }
    if (!nextMapa.posiciones_localizaciones) nextMapa.posiciones_localizaciones = {}
    onUpdate?.({
      ...aventura,
      mapa_mundo: nextMapa,
    })
  }

  const handleChooseFile = () => {
    if (!serverSlug || uploading) return
    fileInputRef.current?.click()
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const subido = await subirImagenMapaMundo(serverSlug, file)
      updateMapa({
        imagen: subido.imagen,
        ancho: subido.ancho,
        alto: subido.alto,
        posiciones_localizaciones: posiciones,
      })
      setOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  const handleImageLoad = () => {
    const img = imageRef.current
    if (!img) return
    setImageLoaded(true)
    setImageError(false)
    if (img.naturalWidth && img.naturalHeight && (mapa.ancho !== img.naturalWidth || mapa.alto !== img.naturalHeight)) {
      updateMapa({ ancho: img.naturalWidth, alto: img.naturalHeight })
    }
  }

  const handleMapClick = (event) => {
    if (!selectedLocId || !imageRef.current || !mapa.imagen) return
    const img = imageRef.current
    const rect = img.getBoundingClientRect()
    const naturalW = mapa.ancho || img.naturalWidth
    const naturalH = mapa.alto || img.naturalHeight
    if (!rect.width || !rect.height || !naturalW || !naturalH) return
    const x = Math.round((event.clientX - rect.left) * (naturalW / rect.width))
    const y = Math.round((event.clientY - rect.top) * (naturalH / rect.height))
    updateMapa({
      posiciones_localizaciones: {
        ...posiciones,
        [selectedLocId]: {
          x: Math.max(0, Math.min(naturalW, x)),
          y: Math.max(0, Math.min(naturalH, y)),
        },
      },
    })
  }

  const borrarPosicion = (locId) => {
    const next = { ...posiciones }
    delete next[locId]
    updateMapa({ posiciones_localizaciones: next })
  }

  const zoomPct = `${zoom}%`

  return (
    <section className="av-section">
      <div className="av-section-header">
        <h2 className="av-section-title">Mapa mundo</h2>
        <button
          type="button"
          className="btn-primary av-btn-small"
          onClick={() => setOpen(true)}
        >
          Editar mapa mundo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      {!serverSlug && (
        <p className="av-empty">Guarda la aventura en el servidor para poder subir el mapa pergamino.</p>
      )}
      {error && <div className="av-modal-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div
        className="av-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span className="av-chip">
          <span className="av-chip-label">Imagen</span> {mapa.imagen || 'sin mapa'}
        </span>
        {mapa.ancho && mapa.alto && (
          <span className="av-chip">
            <span className="av-chip-label">Tamaño</span> {mapa.ancho} x {mapa.alto}
          </span>
        )}
        <span className="av-chip">
          <span className="av-chip-label">Pines</span> {colocadas}/{locs.length}
        </span>
        <button
          type="button"
          className="btn-secondary av-btn-small"
          onClick={handleChooseFile}
          disabled={!serverSlug || uploading}
          title={!serverSlug ? 'Guarda la aventura en el servidor para subir el pergamino' : ''}
          style={{ marginLeft: 'auto' }}
        >
          {mapa.imagen ? 'Cambiar pergamino' : 'Subir mapa pergamino'}
        </button>
      </div>

      {open && (
        <div className="av-modal-overlay" onClick={() => setOpen(false)}>
          <div
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 8,
              width: 'min(96vw, 1520px)',
              height: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.55)',
            }}
            onClick={event => event.stopPropagation()}
          >
            <div className="av-modal-header">
              <h3>Mapa mundo</h3>
              <button type="button" className="av-modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '280px minmax(0, 1fr)',
                gap: 12,
                padding: 12,
                minHeight: 0,
                flex: 1,
              }}
            >
              <aside
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 0,
                  borderRight: '1px solid #30363d',
                  paddingRight: 12,
                }}
              >
                <button
                  type="button"
                  className="btn-secondary av-btn-small"
                  onClick={handleChooseFile}
                  disabled={!serverSlug || uploading}
                  title={!serverSlug ? 'Guarda la aventura en el servidor para subir el pergamino' : ''}
                >
                  {mapa.imagen ? 'Cambiar pergamino' : 'Subir mapa pergamino'}
                </button>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="av-btn-icon"
                    onClick={() => setZoom(z => Math.max(70, z - 10))}
                    title="Alejar"
                  >
                    −
                  </button>
                  <span className="av-chip" style={{ flex: 1, textAlign: 'center' }}>{zoomPct}</span>
                  <button
                    type="button"
                    className="av-btn-icon"
                    onClick={() => setZoom(z => Math.min(180, z + 10))}
                    title="Acercar"
                  >
                    +
                  </button>
                </div>

                {selectedLocId && posiciones[selectedLocId] && (
                  <button
                    type="button"
                    className="av-btn-danger av-btn-small"
                    onClick={() => borrarPosicion(selectedLocId)}
                  >
                    Borrar posición
                  </button>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    overflowY: 'auto',
                    minHeight: 0,
                    paddingRight: 4,
                  }}
                >
                  {locs.map(loc => {
                    const pos = posiciones[loc.id]
                    const selected = selectedLocId === loc.id
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setSelectedLocId(loc.id)}
                        className={selected ? 'av-nav-btn av-nav-btn-on' : 'av-nav-btn'}
                        style={{
                          borderRadius: 6,
                          textAlign: 'left',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 8,
                          alignItems: 'center',
                          padding: '0.45rem 0.55rem',
                        }}
                      >
                        <span style={{ minWidth: 0 }}>
                          <span className="av-cell-id">{loc.id}</span>
                          <br />
                          <span style={{ color: '#c9d1d9' }}>{locLabel(loc)}</span>
                        </span>
                        <span style={{ color: pos ? '#60a5fa' : '#f59e0b', fontSize: 11 }}>
                          {pos ? `${pos.x}, ${pos.y}` : 'sin colocar'}
                        </span>
                      </button>
                    )
                  })}
                  {!locs.length && <p className="av-empty">Sin localizaciones.</p>}
                </div>
              </aside>

              <main style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="av-chip">
                    <span className="av-chip-label">Imagen</span> {mapa.imagen || 'sin mapa'}
                  </span>
                  {mapa.ancho && mapa.alto && (
                    <span className="av-chip">
                      <span className="av-chip-label">Tamaño</span> {mapa.ancho} x {mapa.alto}
                    </span>
                  )}
                  {selectedLoc && (
                    <span className="av-chip">
                      <span className="av-chip-label">Seleccionada</span> {selectedLoc.id}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    background: '#0f172a',
                  }}
                >
                  {!mapa.imagen && (
                    <div style={{ padding: 16 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleChooseFile}
                        disabled={!serverSlug || uploading}
                      >
                        Subir mapa pergamino
                      </button>
                    </div>
                  )}

                  {mapa.imagen && (
                    <div
                      style={{
                        position: 'relative',
                        width: zoomPct,
                        minWidth: '900px',
                        margin: '0 auto',
                        cursor: selectedLoc ? 'crosshair' : 'default',
                      }}
                      onClick={handleMapClick}
                    >
                      <img
                        ref={imageRef}
                        src={imagenUrl}
                        alt="Mapa mundo"
                        onLoad={handleImageLoad}
                        onError={() => {
                          setImageLoaded(false)
                          setImageError(true)
                        }}
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                      />
                      {imageError && (
                        <div
                          style={{
                            minHeight: 520,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fca5a5',
                            padding: 24,
                            textAlign: 'center',
                          }}
                        >
                          No se pudo cargar la imagen del mapa mundo desde {imagenUrl || mapa.imagen}.
                        </div>
                      )}
                      {imageLoaded && locs.map(loc => {
                        const pos = posiciones[loc.id]
                        if (!pos || !mapa.ancho || !mapa.alto) return null
                        const left = `${(pos.x / mapa.ancho) * 100}%`
                        const top = `${(pos.y / mapa.alto) * 100}%`
                        return (
                          <div
                            key={loc.id}
                            style={{
                              position: 'absolute',
                              left,
                              top,
                              transform: 'translate(-50%, -100%)',
                              pointerEvents: 'none',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                            }}
                          >
                            <span
                              style={{
                                minWidth: 26,
                                height: 26,
                                padding: '0 5px',
                                borderRadius: 999,
                                background: loc.id === selectedLocId ? '#f59e0b' : '#2563eb',
                                border: '2px solid #f8fafc',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                              }}
                            >
                              {iniciales(loc)}
                            </span>
                            <span
                              style={{
                                background: 'rgba(15, 23, 42, 0.86)',
                                color: '#e2e8f0',
                                border: '1px solid rgba(148, 163, 184, 0.45)',
                                borderRadius: 4,
                                padding: '1px 5px',
                                fontSize: 11,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {locLabel(loc)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </main>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
