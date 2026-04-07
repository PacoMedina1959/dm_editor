import { useState } from 'react'
import { postValidarCampana } from '../api/validarCampana.js'
import IssueList from '../components/IssueList.jsx'
import ResumenValidacion from '../components/ResumenValidacion.jsx'

export default function ValidarYamlPage() {
  const [yamlText, setYamlText] = useState('')
  const [busy, setBusy] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  /** @type {import('../api/validarCampana.js').ResultadoValidacionJson | null} */
  const [resultado, setResultado] = useState(null)

  const validar = async () => {
    const t = yamlText.trim()
    if (!t) return
    setBusy(true)
    setFetchError(null)
    try {
      const data = await postValidarCampana(yamlText)
      setResultado(data)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e))
      setResultado(null)
    } finally {
      setBusy(false)
    }
  }

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const text = await f.text()
      setYamlText(text)
      setFetchError(null)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="page validar-page">
      <h1 className="page-title">Validar aventura (YAML)</h1>
      <p className="page-lead">
        El contenido se envía al motor DM Virtual (<code className="kbd">POST /api/editor/validar-campana</code>
        ). Asegúrate de tener el backend en marcha; en desarrollo el proxy de Vite reenvía{' '}
        <code className="kbd">/api</code> a{' '}
        <code className="kbd">{import.meta.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000'}</code>
        (puerto del editor: <strong>5174</strong>).
      </p>

      <div className="validar-toolbar">
        <label className="btn-file">
          <input
            type="file"
            accept=".yaml,.yml,text/yaml,application/x-yaml,text/x-yaml"
            className="sr-only"
            onChange={onPickFile}
          />
          Cargar archivo .yaml
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !yamlText.trim()}
          onClick={validar}
        >
          {busy ? 'Validando…' : 'Validar'}
        </button>
      </div>

      <label className="field">
        <span className="field-label">YAML</span>
        <textarea
          className="yaml-input"
          value={yamlText}
          onChange={(e) => setYamlText(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="Pega aquí el aventura.yaml o carga un fichero…"
        />
      </label>

      {fetchError && (
        <div className="alert alert-error" role="alert">
          <strong>Error</strong>
          <pre className="alert-pre">{fetchError}</pre>
        </div>
      )}

      <ResumenValidacion resultado={resultado} />

      {resultado && (
        <IssueList issues={Array.isArray(resultado.issues) ? resultado.issues : []} />
      )}
    </div>
  )
}
