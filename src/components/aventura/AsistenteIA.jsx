import { useEffect, useState } from 'react'
import yaml from 'js-yaml'
import { generarContenido } from '../../api/aventuras.js'

const SECCIONES = [
  { key: 'localizaciones', label: 'Localizaciones', merge: 'array' },
  { key: 'npcs', label: 'NPCs', merge: 'array' },
  { key: 'bestiario', label: 'Bestiario', merge: 'array' },
  { key: 'finales', label: 'Finales', merge: 'array' },
  { key: 'escenas', label: 'Escenas', merge: 'array' },
  { key: 'eventos_definidos', label: 'Eventos definidos', merge: 'array' },
  { key: 'historia', label: 'Historia', merge: 'object' },
]

function buildContextSummary(data) {
  if (!data) return ''
  const parts = []
  const meta = data.aventura
  if (meta) {
    parts.push(`Aventura: ${meta.nombre || '?'}`)
    if (meta.descripcion) parts.push(`Descripción: ${meta.descripcion}`)
  }
  const mundo = data.mundo
  if (mundo) {
    parts.push(`Mundo: ${mundo.nombre || '?'} — ${mundo.descripcion || ''}`)
    if (mundo.epoca) parts.push(`Época: ${mundo.epoca}`)
  }
  const locs = data.localizaciones || []
  if (locs.length) parts.push(`Localizaciones existentes: ${locs.map(l => l.id).join(', ')}`)
  const npcs = data.npcs || []
  if (npcs.length) parts.push(`NPCs existentes: ${npcs.map(n => `${n.id} (${n.nombre})`).join(', ')}`)
  const best = data.bestiario || []
  if (best.length) parts.push(`Bestiario existente: ${best.map(b => b.id).join(', ')}`)
  const escs = data.escenas || []
  if (escs.length) parts.push(`Escenas existentes: ${escs.map(e => `${e.id} (${e.nombre})`).join(', ')}`)
  const evts = data.eventos_definidos || []
  if (evts.length) parts.push(`Eventos definidos: ${evts.map(e => e.id).join(', ')}`)
  return parts.join('\n')
}

export default function AsistenteIA({ open, data, onClose, onApply, seccionInicial }) {
  const [seccion, setSeccion] = useState(seccionInicial || 'localizaciones')
  useEffect(() => { if (seccionInicial) setSeccion(seccionInicial) }, [seccionInicial])
  const [instrucciones, setInstrucciones] = useState('')
  const [resultado, setResultado] = useState(null)
  const [yamlText, setYamlText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const handleGenerar = async () => {
    if (!instrucciones.trim()) return
    setLoading(true)
    setError(null)
    setResultado(null)
    setYamlText('')
    try {
      const ctx = buildContextSummary(data)
      const res = await generarContenido(seccion, instrucciones, ctx)
      setYamlText(res.yaml_text || '')
      setResultado(res.parsed)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!resultado) {
      try {
        const parsed = yaml.load(yamlText)
        doApply(parsed)
      } catch {
        setError('No se pudo parsear el YAML editado.')
        return
      }
    } else {
      doApply(resultado)
    }
  }

  const doApply = (parsed) => {
    const sec = SECCIONES.find(s => s.key === seccion)
    if (!sec) return
    if (sec.merge === 'array') {
      const items = Array.isArray(parsed) ? parsed : [parsed]
      onApply(seccion, [...(data[seccion] || []), ...items])
    } else {
      const existing = data[seccion] || {}
      onApply(seccion, { ...existing, ...(typeof parsed === 'object' ? parsed : {}) })
    }
    setInstrucciones('')
    setResultado(null)
    setYamlText('')
    onClose()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog" onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Generar con IA</h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="av-ia-body">
          <div className="av-ia-controls">
            <label className="av-ia-label">
              Sección objetivo
              <select value={seccion} onChange={e => setSeccion(e.target.value)} className="av-input">
                {SECCIONES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>

            <label className="av-ia-label">
              Instrucciones para la IA
              <textarea
                className="av-textarea"
                rows={4}
                value={instrucciones}
                onChange={e => setInstrucciones(e.target.value)}
                placeholder="Ej: Crea 3 localizaciones para un bosque encantado con ruinas élficas y un lago misterioso"
              />
            </label>

            <button
              type="button"
              className="btn-primary"
              onClick={handleGenerar}
              disabled={loading || !instrucciones.trim()}
            >
              {loading ? 'Generando…' : 'Generar'}
            </button>
          </div>

          {error && <div className="av-modal-error">{error}</div>}

          {yamlText && (
            <div className="av-ia-result">
              <label className="av-ia-label">
                Resultado (editable)
                <textarea
                  className="av-textarea av-ia-yaml"
                  rows={12}
                  value={yamlText}
                  onChange={e => {
                    setYamlText(e.target.value)
                    setResultado(null)
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <div className="av-modal-footer">
          {yamlText && (
            <button type="button" className="btn-primary" onClick={handleApply}>
              Aplicar a la aventura
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
