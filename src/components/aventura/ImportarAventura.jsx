import { useState } from 'react'
import { apiUrl } from '../../api/client.js'

export default function ImportarAventura({ open, onClose, onImport }) {
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [yamlText, setYamlText] = useState('')

  if (!open) return null

  const handleImportar = async () => {
    if (texto.trim().length < 50) {
      setError('El texto debe tener al menos 50 caracteres.')
      return
    }
    setLoading(true)
    setError(null)
    setResultado(null)
    setYamlText('')
    setProgreso('Enviando al servidor… (2 pasadas IA, puede tardar 20-40s)')

    try {
      const res = await fetch(apiUrl('/api/editor/importar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto_fuente: texto }),
      })

      const data = await res.text()
      if (!res.ok) {
        let detail
        try { detail = JSON.parse(data)?.detail } catch {}
        throw new Error(detail || data || `HTTP ${res.status}`)
      }

      const parsed = JSON.parse(data)
      setYamlText(parsed.yaml_text || '')
      setResultado(parsed.parsed)
      setProgreso(
        `Importación completada (paso 1: ${parsed.pasos?.paso1_ok ? '✓' : '✗'}, ` +
        `paso 2: ${parsed.pasos?.paso2_ok ? '✓' : '✗'})`
      )
    } catch (e) {
      setError(e.message)
      setProgreso('')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!yamlText) return
    onImport(yamlText, 'Importada con IA')
    setTexto('')
    setResultado(null)
    setYamlText('')
    onClose()
  }

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-ia-dialog av-importar-dialog" onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Importar aventura con IA</h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="av-ia-body">
          {!yamlText && (
            <>
              <p className="av-importar-hint">
                Pega el texto de una aventura (D&D, homebrew, guion narrativo…).
                La IA lo convertirá en el formato estructurado del editor.
              </p>
              <textarea
                className="av-textarea av-importar-input"
                rows={12}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="Pega aquí el texto de la aventura…"
                disabled={loading}
              />
              <div className="av-importar-meta">
                {texto.length > 0 && (
                  <span className="av-filter-count">
                    {texto.length.toLocaleString()} caracteres
                  </span>
                )}
              </div>
            </>
          )}

          {progreso && <p className="av-importar-progreso">{progreso}</p>}
          {error && <div className="av-modal-error">{error}</div>}

          {yamlText && (
            <div className="av-ia-result">
              <label className="av-ia-label">
                Resultado YAML (editable antes de aplicar)
                <textarea
                  className="av-textarea av-ia-yaml"
                  rows={16}
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
          {!yamlText && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleImportar}
              disabled={loading || texto.trim().length < 50}
            >
              {loading ? 'Procesando…' : 'Importar con IA'}
            </button>
          )}
          {yamlText && (
            <button type="button" className="btn-primary" onClick={handleApply}>
              Cargar en el editor
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
