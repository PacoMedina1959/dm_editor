import { useEffect, useRef, useState } from 'react'
import {
  generarMapaIA,
  esperarJobMapa,
  urlMapaPublico,
  previsualizarPromptMapa,
} from '../../api/mapaIA.js'

/**
 * Modal para generar la imagen de fondo 2.5D de una localizacion usando IA.
 *
 * Flujo:
 *  1. Formulario (proyeccion, seed, tamagno, forzar).
 *  2. POST al backend → devuelve `job_id`.
 *  3. Si estado === 'ok' de inmediato (cache hit) → pinta preview.
 *     Si no, polling hasta ok/error.
 *  4. Vista previa: <img src=URL publica>.
 *  5. "Aplicar a la localizacion" → propaga `loc.mapa = { imagen, tipo, ... }`
 *     al estado de la aventura (el DM debe luego "Guardar en servidor"
 *     o "Exportar YAML" para persistir).
 *
 * Pre-requisitos que controla el componente padre:
 *  - `slug` no vacio (aventura guardada en servidor).
 *  - Opcional: el padre deberia desaconsejar generar con `dirty=true`
 *    porque el backend lee el YAML del disco para componer el prompt.
 */
export default function MapaIADialog({
  open,
  slug,
  loc,
  onClose,
  onAplicar,
}) {
  const [proyeccion, setProyeccion] = useState('tactico')
  const [seed, setSeed] = useState(0)
  // Tamaños reales admitidos por gpt-image-1. Valor con formato "WxH";
  // el backend acepta ancho y alto separados. Los tamaños que no encajen
  // se remapean al más cercano, así que aquí solo exponemos los 3 válidos.
  const [tamagno, setTamagno] = useState('1024x1024')
  const [force, setForce] = useState(false)
  // '' = auto (backend usa loc.hora_del_dia del YAML si existe).
  // 'dia' | 'amanecer' | 'atardecer' | 'noche' = override explícito.
  const [hora, setHora] = useState('')
  // Instrucciones extra del DM (F3.3). Texto libre que se añade al
  // prompt como bloque "DM notes". Se persiste en
  // ``mapa.generado_ia.extras_prompt`` al aplicar para recordar la
  // última variante usada. Tope conservador 500 chars (coincide con
  // el MAX_CHARS_EXTRAS del backend).
  const [extrasPrompt, setExtrasPrompt] = useState('')
  // Valor "debouncado" para no spamear el preview mientras se escribe.
  const [extrasDebounced, setExtrasDebounced] = useState('')
  const MAX_EXTRAS = 500

  const [estadoJob, setEstadoJob] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  // Preview del prompt (lectura barata, sin llamar a IA).
  const [promptPreview, setPromptPreview] = useState(null)
  const [cargandoPrompt, setCargandoPrompt] = useState(false)
  const [errorPrompt, setErrorPrompt] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const canceladoRef = useRef(false)
  const jobIdRef = useRef(null)

  // Reset al abrir
  useEffect(() => {
    if (!open) return
    canceladoRef.current = false
    setEstadoJob(null)
    setError(null)
    setCargando(false)
    setSeed(0)
    setForce(false)
    setPromptPreview(null)
    setErrorPrompt(null)
    setCopiado(false)
    // El default de ``hora`` es el valor del YAML ('' => "auto").
    // El usuario puede sobrescribirlo temporalmente sin mutar el YAML.
    setHora(loc?.hora_del_dia || '')
    // Precargar los extras con lo último aplicado (si existe) para
    // que el DM pueda iterar desde su última variante.
    const extrasPrev = loc?.mapa?.generado_ia?.extras_prompt || ''
    setExtrasPrompt(extrasPrev)
    setExtrasDebounced(extrasPrev)
  }, [open, loc?.id, loc?.hora_del_dia, loc?.mapa?.generado_ia?.extras_prompt])

  // Debounce de ``extrasPrompt`` para recargar el preview del prompt sin
  // spamear la API mientras el DM escribe. 400 ms es un compromiso
  // razonable (el endpoint es barato pero sigue cruzando red + YAML).
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setExtrasDebounced(extrasPrompt), 400)
    return () => clearTimeout(t)
  }, [open, extrasPrompt])

  // Carga/recarga del prompt previsualizado al abrir o al cambiar proyeccion.
  // El endpoint es barato (solo lee YAML + invoca stylist), asi que no hace
  // falta debounce: el select de proyeccion solo tiene 2 opciones.
  useEffect(() => {
    if (!open || !slug || !loc?.id) return
    let cancelado = false
    setCargandoPrompt(true)
    setErrorPrompt(null)
    setCopiado(false)
    previsualizarPromptMapa(slug, loc.id, proyeccion, {
      hora,
      extras: extrasDebounced,
    })
      .then(data => { if (!cancelado) setPromptPreview(data) })
      .catch(err => {
        if (!cancelado) {
          setErrorPrompt(err instanceof Error ? err.message : String(err))
          setPromptPreview(null)
        }
      })
      .finally(() => { if (!cancelado) setCargandoPrompt(false) })
    return () => { cancelado = true }
  }, [open, slug, loc?.id, proyeccion, hora, extrasDebounced])

  // Cancelar polling al cerrar
  useEffect(() => {
    return () => { canceladoRef.current = true }
  }, [])

  if (!open || !loc) return null

  const terminado = estadoJob?.estado === 'ok'
  const fallido = estadoJob?.estado === 'error'
  const enMarcha = cargando && !terminado && !fallido
  const urlPreview = terminado && estadoJob.ruta_relativa
    ? urlMapaPublico(slug, estadoJob.ruta_relativa)
    : null

  const handleGenerar = async () => {
    setError(null)
    setEstadoJob(null)
    setCargando(true)
    canceladoRef.current = false

    const [ancho, alto] = (tamagno || '1024').split('x').map(n => parseInt(n, 10))
    const params = {
      proyeccion,
      seed: Number.isFinite(seed) ? seed : 0,
      ancho: Number.isFinite(ancho) && ancho > 0 ? ancho : 1024,
      alto: Number.isFinite(alto) && alto > 0 ? alto : (Number.isFinite(ancho) ? ancho : 1024),
      force,
      hora,
      extrasPrompt,
    }

    try {
      const inicial = await generarMapaIA(slug, loc.id, params)
      jobIdRef.current = inicial.job_id
      setEstadoJob(inicial)

      if (inicial.estado === 'ok' || inicial.estado === 'error') {
        setCargando(false)
        return
      }

      const final = await esperarJobMapa(inicial.job_id, {
        intervaloMs: 700,
        timeoutMs: 120000,
        cancelado: () => canceladoRef.current,
        onTick: (e) => setEstadoJob(e),
      })
      setEstadoJob(final)
    } catch (e) {
      if (e?.code === 'cancelado') return
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }

  const handleCancelar = () => {
    canceladoRef.current = true
    setCargando(false)
  }

  const handleRegenerar = () => {
    setForce(true)
    setSeed(prev => {
      // Si la seed actual es 0 (auto), forzamos una aleatoria para variar el resultado.
      if (!prev) return Math.floor(Math.random() * 1_000_000)
      return prev + 1
    })
  }

  const handleAplicar = () => {
    if (!terminado || !estadoJob.ruta_relativa) return
    const extrasLimpio = (extrasPrompt || '').trim()
    const mapa = {
      imagen: estadoJob.ruta_relativa,
      tipo: proyeccion,
      generado_ia: {
        hash: estadoJob.hash,
        prompt: estadoJob.prompt,
        seed: estadoJob.seed,
        modelo: estadoJob.modelo,
        ancho: estadoJob.ancho,
        alto: estadoJob.alto,
        // Solo persistimos extras_prompt si el DM lo ha usado; así las
        // localizaciones sin retoques del DM quedan más limpias en el
        // YAML. Almacenamos el texto crudo (sin truncar); el stylist
        // lo higieniza cada vez que compone el prompt.
        ...(extrasLimpio ? { extras_prompt: extrasLimpio } : {}),
      },
    }
    // Si el DM ha elegido una hora distinta a la almacenada en el YAML,
    // proponemos propagarla para que futuras regeneraciones mantengan
    // la misma atmósfera. Pasamos un segundo argumento con el "patch"
    // de loc; los consumidores antiguos simplemente lo ignoran.
    const horaActualYaml = loc?.hora_del_dia || ''
    const extras = {}
    if (hora !== horaActualYaml) {
      extras.hora_del_dia = hora || null
    }
    onAplicar?.(mapa, extras)
    onClose?.()
  }

  const handleClose = () => {
    canceladoRef.current = true
    onClose?.()
  }

  const handleCopiarPrompt = async () => {
    const texto = promptPreview?.prompt
    if (!texto) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
      } else {
        // Fallback para navegadores sin API moderna o contextos no seguros.
        const ta = document.createElement('textarea')
        ta.value = texto
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1500)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className="av-modal-overlay" onClick={handleClose}>
      <div
        className="av-ia-dialog"
        style={{ maxWidth: 820 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="av-modal-header">
          <h3>
            Generar mapa con IA — <span className="av-cell-id">{loc.id}</span>
          </h3>
          <button type="button" className="av-modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="av-ia-body">
          <div className="av-ia-controls">
            <div className="av-form-row2">
              <label className="av-ia-label">
                Proyeccion
                <select
                  value={proyeccion}
                  onChange={e => setProyeccion(e.target.value)}
                  className="av-input"
                  disabled={enMarcha}
                >
                  <option value="tactico">Tactico (isometrico 2:1)</option>
                  <option value="overworld">Overworld (cenital)</option>
                </select>
              </label>

              <label className="av-ia-label">
                Hora del día
                <select
                  value={hora}
                  onChange={e => setHora(e.target.value)}
                  className="av-input"
                  disabled={enMarcha}
                  title="Afecta a escenas exteriores y overworld; en interiores se ignora."
                >
                  <option value="">Auto (sin directiva)</option>
                  <option value="dia">Día (mediodía)</option>
                  <option value="amanecer">Amanecer (mañana)</option>
                  <option value="atardecer">Atardecer (tarde)</option>
                  <option value="noche">Noche</option>
                </select>
              </label>
            </div>

            <div className="av-form-row2">
              <label className="av-ia-label">
                Tamaño (px)
                <select
                  value={tamagno}
                  onChange={e => setTamagno(e.target.value)}
                  className="av-input"
                  disabled={enMarcha}
                  title="gpt-image-1 solo admite 3 tamaños reales; otros se remapean al más cercano"
                >
                  <option value="1024x1024">1024 × 1024 — cuadrado (interiores, tácticos)</option>
                  <option value="1536x1024">1536 × 1024 — paisaje (plazas, exteriores, overworld)</option>
                  <option value="1024x1536">1024 × 1536 — retrato (torres, pasillos)</option>
                </select>
              </label>
              <div className="av-ia-label" style={{ alignSelf: 'end' }}>
                {hora !== (loc?.hora_del_dia || '') && (() => {
                  const tieneMapaPrevio = Boolean(loc?.mapa?.imagen)
                  const bg = tieneMapaPrevio ? '#7c2d12' : '#1f2937'
                  const border = tieneMapaPrevio ? '#ea580c' : '#334155'
                  const iconoColor = tieneMapaPrevio ? '#fb923c' : '#fbbf24'
                  return (
                    <div
                      style={{
                        fontSize: 11,
                        lineHeight: 1.5,
                        background: bg,
                        border: `1px solid ${border}`,
                        padding: '6px 8px',
                        borderRadius: 4,
                        color: '#fef3c7',
                      }}
                    >
                      <div style={{ color: iconoColor, fontWeight: 600, marginBottom: 2 }}>
                        {tieneMapaPrevio ? '⚠ Regeneración destructiva' : 'ⓘ Cambio de canon'}
                      </div>
                      <div>
                        Al aplicar, se actualizará{' '}
                        <code style={{
                          background: '#0f172a',
                          padding: '1px 4px',
                          borderRadius: 3,
                        }}>
                          hora_del_dia
                        </code>{' '}
                        (
                        {loc?.hora_del_dia ? `actual: ${loc.hora_del_dia}` : 'ahora sin valor'}
                        {' '}→ <b>{hora || 'sin valor'}</b>).
                      </div>
                      {tieneMapaPrevio && (
                        <div style={{ marginTop: 4 }}>
                          El mapa actual se <b>regenerará por completo</b>: el
                          modelo no puede reiluminar la imagen anterior, hará
                          una nueva. La arquitectura, la fuente y la distribución
                          <b> no se conservarán</b> — se parecerán pero no serán
                          idénticas (gpt-image-1 no respeta seed).
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="av-form-row2">
              <label className="av-ia-label">
                Seed (0 = auto, derivada del prompt)
                <input
                  type="number"
                  min={0}
                  className="av-input"
                  value={seed}
                  onChange={e => setSeed(parseInt(e.target.value || '0', 10) || 0)}
                  disabled={enMarcha}
                />
              </label>

              <label className="av-field-inline" style={{ alignSelf: 'end' }}>
                <input
                  type="checkbox"
                  checked={force}
                  onChange={e => setForce(e.target.checked)}
                  disabled={enMarcha}
                />
                <span>Forzar regeneracion (saltar cache)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!enMarcha && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleGenerar}
                  disabled={!slug}
                  title={!slug ? 'Guarda la aventura en el servidor primero' : ''}
                >
                  {estadoJob ? 'Regenerar' : 'Generar'}
                </button>
              )}
              {enMarcha && (
                <button type="button" className="btn-secondary" onClick={handleCancelar}>
                  Cancelar
                </button>
              )}
              {terminado && (
                <button type="button" className="btn-secondary" onClick={handleRegenerar}>
                  Probar otra variante
                </button>
              )}
            </div>

            <div className="av-ia-prompt-block" style={{ marginTop: 12 }}>
              <div
                className="av-ia-label"
                style={{
                  fontWeight: 600,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span>
                  Instrucciones extra del DM{' '}
                  <span style={{ fontWeight: 400, fontSize: 11, color: '#94a3b8' }}>
                    (opcional, se añaden al prompt como &quot;DM notes&quot;)
                  </span>
                </span>
                <span
                  style={{
                    fontWeight: 400,
                    fontSize: 11,
                    color: extrasPrompt.length > MAX_EXTRAS ? '#f87171' : '#94a3b8',
                  }}
                >
                  {extrasPrompt.length} / {MAX_EXTRAS}
                </span>
              </div>
              <textarea
                className="av-input"
                rows={3}
                value={extrasPrompt}
                onChange={e => setExtrasPrompt(e.target.value.slice(0, MAX_EXTRAS))}
                placeholder={'Ej.: "cutaway roof, show ceiling beams from above, warm tavern palette with golden lantern light"'}
                disabled={enMarcha}
                style={{
                  width: '100%',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 12,
                  lineHeight: 1.4,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  resize: 'vertical',
                  marginBottom: 12,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div className="av-ia-label" style={{ fontWeight: 600 }}>
                  Prompt que se enviará al proveedor
                  {promptPreview?.modelo && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontWeight: 400,
                        fontSize: 11,
                        color: '#94a3b8',
                      }}
                    >
                      ({promptPreview.modelo} · stylist {promptPreview.version_stylist} · {promptPreview.caracteres} chars)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '2px 10px' }}
                  onClick={handleCopiarPrompt}
                  disabled={!promptPreview?.prompt}
                  title="Copiar al portapapeles para probarlo en ChatGPT u otro proveedor sin gastar créditos"
                >
                  {copiado ? 'Copiado ✓' : 'Copiar prompt'}
                </button>
              </div>

              {cargandoPrompt && (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Componiendo prompt…
                </div>
              )}
              {errorPrompt && (
                <div className="av-modal-error" style={{ fontSize: 12 }}>
                  No se pudo cargar el prompt: {errorPrompt}
                </div>
              )}
              {promptPreview?.prompt && !cargandoPrompt && (
                <textarea
                  readOnly
                  value={promptPreview.prompt}
                  rows={8}
                  className="av-input"
                  style={{
                    width: '100%',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 12,
                    lineHeight: 1.4,
                    background: '#0f172a',
                    color: '#e2e8f0',
                    resize: 'vertical',
                  }}
                  onFocus={e => e.target.select()}
                />
              )}
            </div>
          </div>

          {error && <div className="av-modal-error">{error}</div>}

          {estadoJob && (
            <div className="av-ia-result">
              <div className="av-ia-label" style={{ fontWeight: 600 }}>
                Estado: {estadoJob.estado}
                {estadoJob.estado === 'ejecutando' && ` (${estadoJob.progreso}%)`}
              </div>

              {enMarcha && (
                <div
                  style={{
                    height: 6,
                    background: '#1f2937',
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${estadoJob.progreso || 0}%`,
                      background: 'linear-gradient(90deg, #60a5fa, #a78bfa)',
                      transition: 'width 400ms ease-out',
                    }}
                  />
                </div>
              )}

              {fallido && (
                <div className="av-modal-error">
                  Fallo: {estadoJob.error || 'error desconocido'}
                </div>
              )}

              {urlPreview && (
                <>
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <img
                      key={urlPreview}
                      src={urlPreview}
                      alt={`Mapa ${loc.id}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 460,
                        border: '1px solid #334155',
                        borderRadius: 4,
                        background: '#0f172a',
                      }}
                    />
                  </div>

                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer' }}>
                      Metadatos (prompt, seed, modelo)
                    </summary>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: 12,
                        marginTop: 6,
                        background: '#0f172a',
                        padding: 8,
                        borderRadius: 4,
                      }}
                    >
{`seed:    ${estadoJob.seed}
modelo:  ${estadoJob.modelo}
tamagno: ${estadoJob.ancho} x ${estadoJob.alto}
hash:    ${estadoJob.hash}
ruta:    ${estadoJob.ruta_relativa}

prompt:
${estadoJob.prompt}`}
                    </pre>
                  </details>
                </>
              )}
            </div>
          )}
        </div>

        <div className="av-modal-footer">
          {terminado && (
            <button type="button" className="btn-primary" onClick={handleAplicar}>
              Usar este mapa en la localizacion
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={handleClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
