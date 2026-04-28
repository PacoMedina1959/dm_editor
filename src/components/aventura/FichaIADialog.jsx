import { useEffect, useState } from 'react'
import { generarFichaIA, urlMapaPublico } from '../../api/mapaIA.js'

export default function FichaIADialog({
  open,
  slug,
  tipo,
  item,
  onClose,
  onAplicar,
}) {
  const [promptExtra, setPromptExtra] = useState('')
  const [force, setForce] = useState(false)
  const [seed, setSeed] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!open) return
    setPromptExtra('')
    setForce(false)
    setSeed(0)
    setResultado(null)
    setError(null)
    setCargando(false)
  }, [open, item?.id])

  if (!open || !item) return null

  const spriteActual = item.sprite?.imagen
  const spriteNuevo = resultado?.sprite?.imagen
  const preview = spriteNuevo || spriteActual
  const urlPreview = preview ? urlMapaPublico(slug, preview) : ''
  const tituloTipo = tipo === 'npc' ? 'NPC' : 'bestiario'

  const handleGenerar = async () => {
    setError(null)
    setCargando(true)
    try {
      const data = await generarFichaIA(slug, tipo, item.id, {
        promptExtra,
        force,
        seed: Number(seed) || 0,
      })
      setResultado(data)
      setForce(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCargando(false)
    }
  }

  const handleAplicar = () => {
    if (!resultado?.sprite) return
    onAplicar?.(resultado.sprite)
    onClose?.()
  }

  return (
    <div className="av-modal-backdrop" role="dialog" aria-modal="true">
      <div className="av-modal av-ficha-ia-modal">
        <div className="av-modal-header">
          <h3>Ficha IA · {tituloTipo}</h3>
          <button type="button" className="av-btn-icon" onClick={onClose} title="Cerrar">×</button>
        </div>
        <div className="av-ficha-ia-body">
          <div className="av-ficha-ia-preview">
            {urlPreview ? (
              <img src={urlPreview} alt={`Ficha de ${item.nombre || item.id}`} />
            ) : (
              <div className="av-ficha-ia-empty">Sin ficha</div>
            )}
          </div>
          <div className="av-ficha-ia-form">
            <div className="av-field">
              <span className="av-field-label">Entidad</span>
              <input className="av-input" value={`${item.id} · ${item.nombre || ''}`} readOnly />
            </div>
            <label className="av-field">
              <span className="av-field-label">Dirección extra para el prompt</span>
              <textarea
                className="av-input av-textarea"
                rows={5}
                value={promptExtra}
                onChange={e => setPromptExtra(e.target.value)}
                maxLength={2000}
                placeholder="Rasgos visuales, encuadre, color, equipo..."
              />
            </label>
            <div className="av-form-row2">
              <label className="av-field">
                <span className="av-field-label">Seed</span>
                <input
                  type="number"
                  min="0"
                  className="av-input"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                />
              </label>
              <label className="av-field-inline av-ficha-ia-force">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={e => setForce(e.target.checked)}
                />
                <span>Regenerar aunque ya tenga ficha</span>
              </label>
            </div>
            {error && <p className="av-error">{error}</p>}
            {resultado?.ruta_relativa && (
              <p className="av-desc av-desc-muted">{resultado.ruta_relativa}</p>
            )}
          </div>
        </div>
        <div className="av-modal-actions">
          <button type="button" className="btn-secondary av-btn-small" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn-secondary av-btn-small" onClick={handleGenerar} disabled={!slug || cargando}>
            {cargando ? 'Generando...' : 'Generar ficha IA'}
          </button>
          <button type="button" className="btn-primary av-btn-small" onClick={handleAplicar} disabled={!resultado?.sprite}>
            Aplicar ficha
          </button>
        </div>
      </div>
    </div>
  )
}
