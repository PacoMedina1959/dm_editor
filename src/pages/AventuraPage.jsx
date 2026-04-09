import { useCallback, useState } from 'react'
import {
  parseAventuraYaml,
  resumenAventura,
  aventuraToYaml,
  plantillaAventura,
  descargarArchivo,
  validarAventura,
} from '../domain/aventura.js'
import SeccionMeta from '../components/aventura/SeccionMeta.jsx'
import SeccionMundo from '../components/aventura/SeccionMundo.jsx'
import SeccionLocalizaciones from '../components/aventura/SeccionLocalizaciones.jsx'
import SeccionNpcs from '../components/aventura/SeccionNpcs.jsx'
import SeccionBestiario from '../components/aventura/SeccionBestiario.jsx'
import SeccionHistoria from '../components/aventura/SeccionHistoria.jsx'
import SeccionFinales from '../components/aventura/SeccionFinales.jsx'
import SeccionEscenas from '../components/aventura/SeccionEscenas.jsx'
import SeccionEventos from '../components/aventura/SeccionEventos.jsx'
import MapaEscenas from '../components/aventura/MapaEscenas.jsx'

const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/aventura-ejemplo.yaml`

const SECCIONES = [
  { key: 'meta', label: 'Metadatos' },
  { key: 'mundo', label: 'Mundo' },
  { key: 'localizaciones', label: 'Localizaciones' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'bestiario', label: 'Bestiario' },
  { key: 'historia', label: 'Historia' },
  { key: 'finales', label: 'Finales' },
  { key: 'escenas', label: 'Escenas' },
  { key: 'eventos_definidos', label: 'Eventos' },
]

export default function AventuraPage() {
  /** @type {[object|null, function]} data = raw parsed YAML object (mutable) */
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [dirty, setDirty] = useState(false)
  const [validacion, setValidacion] = useState(null)
  const [visibles, setVisibles] = useState(new Set(SECCIONES.map(s => s.key)))

  const cargar = (text, label) => {
    setLoadError(null)
    const result = parseAventuraYaml(text)
    if (!result.ok) {
      setLoadError(result.error)
      setData(null)
      return
    }
    setData(result.data)
    setSourceLabel(label)
    setDirty(false)
  }

  const cargarEjemplo = async () => {
    try {
      const res = await fetch(SAMPLE_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      cargar(await res.text(), 'Ejemplo canónico (La Corona Perdida)')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  const nuevaAventura = () => {
    setData(plantillaAventura())
    setSourceLabel('Nueva aventura')
    setLoadError(null)
    setDirty(false)
  }

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      cargar(await f.text(), f.name)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }

  const ejecutarValidacion = () => {
    if (!data) return null
    const result = validarAventura(data)
    setValidacion(result)
    return result
  }

  const exportarYaml = () => {
    if (!data) return
    const result = ejecutarValidacion()
    if (result?.errores?.length) return
    const nombre = (data.aventura?.nombre || 'aventura')
      .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    descargarArchivo(aventuraToYaml(data), `${nombre}.yaml`)
  }

  /**
   * Actualiza una clave raíz del data (p.ej. 'aventura', 'mundo', 'historia').
   * @param {string} key
   * @param {any} value
   */
  const updateSection = useCallback((key, value) => {
    setData(prev => {
      if (!prev) return prev
      return { ...prev, [key]: value }
    })
    setDirty(true)
  }, [])

  const toggleSeccion = (key) => {
    setVisibles(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const resumen = data ? resumenAventura(data) : null

  return (
    <div className="page aventura-page">
      <h1 className="page-title">Editor de aventura</h1>
      <p className="page-lead">
        Carga, edita y exporta un <code className="kbd">aventura.yaml</code> completo.
      </p>

      <div className="validar-toolbar">
        <button type="button" className="btn-secondary" onClick={cargarEjemplo}>
          Cargar ejemplo
        </button>
        <label className="btn-file">
          <input
            type="file"
            accept=".yaml,.yml"
            className="sr-only"
            onChange={onPickFile}
          />
          Cargar archivo .yaml
        </label>
        <button type="button" className="btn-secondary" onClick={nuevaAventura}>
          Nueva aventura
        </button>
        {data && (
          <>
            <button type="button" className="btn-secondary" onClick={ejecutarValidacion}>
              Validar
            </button>
            <button type="button" className="btn-primary" onClick={exportarYaml}>
              Exportar YAML{dirty ? ' *' : ''}
            </button>
          </>
        )}
      </div>

      {loadError && (
        <div className="alert alert-error" role="alert">
          <strong>Error al cargar</strong>
          <pre className="alert-pre">{loadError}</pre>
        </div>
      )}

      {validacion && (validacion.errores.length > 0 || validacion.avisos.length > 0) && (
        <div className="av-validacion">
          {validacion.errores.length > 0 && (
            <div className="av-validacion-bloque av-validacion-errores">
              <strong>Errores ({validacion.errores.length})</strong>
              <ul>{validacion.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          {validacion.avisos.length > 0 && (
            <div className="av-validacion-bloque av-validacion-avisos">
              <strong>Avisos ({validacion.avisos.length})</strong>
              <ul>{validacion.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {validacion.errores.length === 0 && (
            <p className="av-validacion-ok">✓ Sin errores. La aventura se puede exportar.</p>
          )}
        </div>
      )}

      {data && (
        <>
          <div className="av-source-bar">
            <span>Fuente: <strong>{sourceLabel}</strong></span>
            {dirty && <span className="av-dirty-badge">modificado</span>}
          </div>

          <nav className="av-nav">
            {SECCIONES.map(s => (
              <button
                key={s.key}
                type="button"
                className={`av-nav-btn ${visibles.has(s.key) ? 'av-nav-btn-on' : ''}`}
                onClick={() => toggleSeccion(s.key)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {visibles.has('meta') && (
            <SeccionMeta
              resumen={resumen}
              meta={data.aventura}
              onUpdate={(v) => updateSection('aventura', v)}
            />
          )}
          {visibles.has('mundo') && (
            <SeccionMundo
              mundo={data.mundo}
              onUpdate={(v) => updateSection('mundo', v)}
            />
          )}
          {visibles.has('localizaciones') && (
            <SeccionLocalizaciones
              localizaciones={data.localizaciones || []}
              onUpdate={(v) => updateSection('localizaciones', v)}
            />
          )}
          {visibles.has('npcs') && (
            <SeccionNpcs
              npcs={data.npcs || []}
              onUpdate={(v) => updateSection('npcs', v)}
            />
          )}
          {visibles.has('bestiario') && (
            <SeccionBestiario
              bestiario={data.bestiario || []}
              onUpdate={(v) => updateSection('bestiario', v)}
            />
          )}
          {visibles.has('historia') && (
            <SeccionHistoria
              historia={data.historia}
              onUpdate={(v) => updateSection('historia', v)}
            />
          )}
          {visibles.has('finales') && (
            <SeccionFinales
              finales={data.finales || []}
              onUpdate={(v) => updateSection('finales', v)}
            />
          )}
          {visibles.has('escenas') && (
            <>
              <MapaEscenas escenas={data.escenas || []} finales={data.finales || []} />
              <SeccionEscenas
                escenas={data.escenas || []}
                onUpdate={(v) => updateSection('escenas', v)}
              />
            </>
          )}
          {visibles.has('eventos_definidos') && (
            <SeccionEventos
              eventos={data.eventos_definidos || []}
              onUpdate={(v) => updateSection('eventos_definidos', v)}
            />
          )}
        </>
      )}
    </div>
  )
}
