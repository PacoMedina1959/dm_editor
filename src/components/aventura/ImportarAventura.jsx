import { useRef, useState } from 'react'
import { apiUrl } from '../../api/client.js'

const MODOS = [
  { id: 'texto', label: '📝 Texto', hint: 'Pega el texto de una aventura (D&D, homebrew, guion narrativo…).' },
  { id: 'url', label: '🌐 URL', hint: 'Introduce la URL de una página web con la aventura.' },
  { id: 'pdf', label: '📄 PDF', hint: 'Sube un archivo PDF con la aventura (máx. 50 MB).' },
]

export default function ImportarAventura({ open, onClose, onImport }) {
  const [modo, setModo] = useState('texto')
  const [texto, setTexto] = useState('')
  const [url, setUrl] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [yamlText, setYamlText] = useState('')
  const fileRef = useRef(null)

  if (!open) return null

  const canImport =
    (modo === 'texto' && texto.trim().length >= 50) ||
    (modo === 'url' && url.trim().length >= 10) ||
    (modo === 'pdf' && pdfFile)

  const handleImportar = async () => {
    if (!canImport) return
    setLoading(true)
    setError(null)
    setResultado(null)
    setYamlText('')

    const label =
      modo === 'url' ? 'Descargando página y procesando con IA…' :
      modo === 'pdf' ? 'Extrayendo texto del PDF y procesando con IA…' :
      'Enviando al servidor…'
    setProgreso(`${label} (2 pasadas IA, puede tardar 20-60s)`)

    try {
      let res
      if (modo === 'texto') {
        res = await fetch(apiUrl('/api/editor/importar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto_fuente: texto }),
        })
      } else if (modo === 'url') {
        res = await fetch(apiUrl('/api/editor/importar-url'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        })
      } else {
        const formData = new FormData()
        formData.append('archivo', pdfFile)
        res = await fetch(apiUrl('/api/editor/importar-pdf'), {
          method: 'POST',
          body: formData,
        })
      }

      const data = await res.text()
      if (!res.ok) {
        let detail
        try { detail = JSON.parse(data)?.detail } catch { /* */ }
        throw new Error(detail || data || `HTTP ${res.status}`)
      }

      const parsed = JSON.parse(data)
      setYamlText(parsed.yaml_text || '')
      setResultado(parsed.parsed)

      const extraInfo = parsed.texto_extraido_len
        ? ` — ${(parsed.texto_extraido_len / 1000).toFixed(1)}k caracteres extraídos`
        : ''
      setProgreso(
        `Importación completada (paso 1: ${parsed.pasos?.paso1_ok ? '✓' : '✗'}, ` +
        `paso 2: ${parsed.pasos?.paso2_ok ? '✓' : '✗'})${extraInfo}`
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
    setUrl('')
    setPdfFile(null)
    setResultado(null)
    setYamlText('')
    onClose()
  }

  const handleReset = () => {
    setYamlText('')
    setResultado(null)
    setProgreso('')
    setError(null)
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
              <div className="av-importar-tabs">
                {MODOS.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    className={`av-importar-tab ${modo === m.id ? 'active' : ''}`}
                    onClick={() => { setModo(m.id); setError(null) }}
                    disabled={loading}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className="av-importar-hint">
                {MODOS.find(m => m.id === modo)?.hint}
              </p>

              {modo === 'texto' && (
                <>
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

              {modo === 'url' && (
                <input
                  type="url"
                  className="av-input av-importar-url-input"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://ejemplo.com/aventura-dnd"
                  disabled={loading}
                />
              )}

              {modo === 'pdf' && (
                <div className="av-importar-pdf-zone">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) setPdfFile(f)
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary av-importar-pdf-btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={loading}
                  >
                    {pdfFile ? `📄 ${pdfFile.name}` : 'Seleccionar archivo PDF…'}
                  </button>
                  {pdfFile && (
                    <span className="av-filter-count">
                      {(pdfFile.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
              )}
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
              disabled={loading || !canImport}
            >
              {loading ? 'Procesando…' : 'Importar con IA'}
            </button>
          )}
          {yamlText && (
            <>
              <button type="button" className="btn-primary" onClick={handleApply}>
                Cargar en el editor
              </button>
              <button type="button" className="btn-secondary" onClick={handleReset}>
                ← Volver
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
