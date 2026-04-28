import { useCallback, useEffect, useRef, useState } from 'react'
import {
  parseAventuraYaml,
  resumenAventura,
  aventuraToYaml,
  plantillaAventura,
  descargarArchivo,
  validarAventura,
} from '../domain/aventura.js'
import useUndoRedo from '../hooks/useUndoRedo.js'
import { guardarAventura } from '../api/aventuras.js'
import DialogoServidor from '../components/aventura/DialogoServidor.jsx'
import AsistenteIA from '../components/aventura/AsistenteIA.jsx'
import ImportarAventura from '../components/aventura/ImportarAventura.jsx'
import SeccionMeta from '../components/aventura/SeccionMeta.jsx'
import SeccionMundo from '../components/aventura/SeccionMundo.jsx'
import SeccionLocalizaciones from '../components/aventura/SeccionLocalizaciones.jsx'
import MapaMundoDialog from '../components/aventura/MapaMundoDialog.jsx'
import SeccionNpcs from '../components/aventura/SeccionNpcs.jsx'
import SeccionBestiario from '../components/aventura/SeccionBestiario.jsx'
import SeccionHistoria from '../components/aventura/SeccionHistoria.jsx'
import SeccionFinales from '../components/aventura/SeccionFinales.jsx'
import SeccionEscenas from '../components/aventura/SeccionEscenas.jsx'
import SeccionEventos from '../components/aventura/SeccionEventos.jsx'
import MapaEscenas from '../components/aventura/MapaEscenas.jsx'
import CatalogoPiezasTacticasDialog from '../components/aventura/CatalogoPiezasTacticasDialog.jsx'

const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/aventura-ejemplo.yaml`

const SECCIONES = [
  { key: 'meta', label: 'Metadatos' },
  { key: 'mundo', label: 'Mundo' },
  { key: 'mapa_mundo', label: 'Mapa mundo' },
  { key: 'localizaciones', label: 'Localizaciones' },
  { key: 'npcs', label: 'NPCs' },
  { key: 'bestiario', label: 'Bestiario' },
  { key: 'historia', label: 'Historia' },
  { key: 'finales', label: 'Finales' },
  { key: 'escenas', label: 'Escenas' },
  { key: 'eventos_definidos', label: 'Eventos' },
]

const LS_KEY = 'dm_editor_autosave'

function saveToLocalStorage(data, sourceLabel) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data, sourceLabel, ts: Date.now() }))
  } catch { /* quota exceeded — ignore */ }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data) return null
    return parsed
  } catch { return null }
}

function clearLocalStorage() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

function formatAge(ts) {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'hace unos segundos'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.round(hrs / 24)} días`
}

export default function AventuraPage() {
  const {
    state: data, pushState, resetState,
    undo, redo, canUndo, canRedo,
  } = useUndoRedo(null)
  const [loadError, setLoadError] = useState(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [dirty, setDirty] = useState(false)
  const [validacion, setValidacion] = useState(null)
  const [visibles, setVisibles] = useState(new Set(SECCIONES.map(s => s.key)))
  const [recoveryOffer, setRecoveryOffer] = useState(() => loadFromLocalStorage())
  const [serverOpen, setServerOpen] = useState(false)
  const [serverSlug, setServerSlug] = useState('')
  const [serverMsg, setServerMsg] = useState(null)
  const [iaOpen, setIaOpen] = useState(false)
  const [iaSeccion, setIaSeccion] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [catalogoPiezasOpen, setCatalogoPiezasOpen] = useState(false)
  const autosaveTimer = useRef(null)
  const quickSaveRef = useRef(null)

  useEffect(() => {
    if (!data || !dirty) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => saveToLocalStorage(data, sourceLabel), 1500)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
  }, [data, dirty, sourceLabel])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
        else if (e.key === 's') { e.preventDefault(); quickSaveRef.current?.() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  const cargar = (text, label) => {
    setLoadError(null)
    const result = parseAventuraYaml(text)
    if (!result.ok) {
      setLoadError(result.error)
      resetState(null)
      return
    }
    resetState(result.data)
    setSourceLabel(label)
    setDirty(false)
    setRecoveryOffer(null)
  }

  const recuperarSesion = () => {
    if (!recoveryOffer?.data) return
    resetState(recoveryOffer.data)
    setSourceLabel(recoveryOffer.sourceLabel || 'Sesión recuperada')
    setDirty(true)
    setRecoveryOffer(null)
  }

  const descartarRecuperacion = () => {
    clearLocalStorage()
    setRecoveryOffer(null)
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
    resetState(plantillaAventura())
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
    setDirty(false)
    clearLocalStorage()
  }

  const handleServerLoad = (yamlText, label, slug) => {
    cargar(yamlText, label)
    if (slug) setServerSlug(slug)
    setServerOpen(false)
  }

  const handleIaApply = (seccion, value) => {
    updateSection(seccion, value)
  }

  const openIA = useCallback((sec) => {
    setIaSeccion(sec || '')
    setIaOpen(true)
  }, [])

  const toSlug = (name) =>
    name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '').slice(0, 64) || 'aventura'

  const handleServerSave = async () => {
    if (!data) return
    const result = ejecutarValidacion()
    if (result?.errores?.length) return

    let slug = serverSlug
    if (!slug) {
      const suggested = toSlug(data.aventura?.nombre || 'aventura')
      const input = window.prompt('Nombre identificador (slug) para guardar en el servidor:', suggested)
      if (!input) return
      slug = toSlug(input)
    }

    setServerMsg(null)
    try {
      await guardarAventura(slug, aventuraToYaml(data))
      setServerSlug(slug)
      setDirty(false)
      clearLocalStorage()
      setServerMsg({ ok: true, text: `Guardado en servidor como «${slug}»` })
      setTimeout(() => setServerMsg(null), 4000)
    } catch (e) {
      setServerMsg({ ok: false, text: e.message })
    }
  }

  quickSaveRef.current = serverSlug ? handleServerSave : exportarYaml

  /**
   * Actualiza una clave raíz del data (p.ej. 'aventura', 'mundo', 'historia').
   * @param {string} key
   * @param {any} value
   */
  const updateSection = useCallback((key, value) => {
    pushState(prev => {
      if (!prev) return prev
      return { ...prev, [key]: value }
    })
    setDirty(true)
  }, [pushState])

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

      {!data && recoveryOffer && (
        <div className="av-recovery">
          <span>
            Hay una sesión sin guardar ({recoveryOffer.sourceLabel || 'sin nombre'}, {formatAge(recoveryOffer.ts)}).
          </span>
          <button type="button" className="btn-primary av-btn-small" onClick={recuperarSesion}>
            Recuperar
          </button>
          <button type="button" className="btn-secondary av-btn-small" onClick={descartarRecuperacion}>
            Descartar
          </button>
        </div>
      )}

      <div className="validar-toolbar">
        <button type="button" className="btn-secondary" onClick={() => setServerOpen(true)}>
          Servidor
        </button>
        <button type="button" className="btn-secondary" onClick={cargarEjemplo}>
          Ejemplo
        </button>
        <label className="btn-file">
          <input
            type="file"
            accept=".yaml,.yml"
            className="sr-only"
            onChange={onPickFile}
          />
          .yaml
        </label>
        <button type="button" className="btn-secondary" onClick={nuevaAventura}>
          Nueva
        </button>
        <button type="button" className="av-btn-ia" onClick={() => setImportOpen(true)} title="Importar aventura desde texto con IA">
          Importar IA
        </button>
        {data && (
          <>
            <span className="av-undo-group">
              <button type="button" className="av-btn-undo" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">↩</button>
              <button type="button" className="av-btn-undo" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">↪</button>
            </span>
            <button type="button" className="btn-secondary" onClick={ejecutarValidacion}>
              Validar
            </button>
            <button type="button" className="btn-secondary" onClick={() => setCatalogoPiezasOpen(true)}>
              Piezas tácticas
            </button>
            <button type="button" className="btn-primary" onClick={exportarYaml}>
              Exportar YAML{dirty ? ' *' : ''}
            </button>
            <button type="button" className="btn-primary" onClick={handleServerSave}>
              Guardar en servidor{dirty ? ' *' : ''}
            </button>
            <button type="button" className="av-btn-ia" onClick={() => openIA('')} title="Generar contenido con IA">
              IA
            </button>
          </>
        )}
      </div>

      <DialogoServidor
        open={serverOpen}
        onClose={() => setServerOpen(false)}
        onLoad={handleServerLoad}
      />

      <AsistenteIA
        open={iaOpen}
        data={data}
        onClose={() => setIaOpen(false)}
        onApply={handleIaApply}
        seccionInicial={iaSeccion}
      />

      <ImportarAventura
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(yamlText, label) => cargar(yamlText, label)}
      />

      {serverMsg && (
        <div className={`av-server-msg ${serverMsg.ok ? 'av-server-msg-ok' : 'av-server-msg-err'}`}>
          {serverMsg.text}
          <button type="button" className="av-filter-clear" onClick={() => setServerMsg(null)}>✕</button>
        </div>
      )}

      {data && (
        <CatalogoPiezasTacticasDialog
          open={catalogoPiezasOpen}
          slug={serverSlug}
          assetsTacticos={data.assets_tacticos || []}
          onClose={() => setCatalogoPiezasOpen(false)}
          onAplicar={(v) => updateSection('assets_tacticos', v)}
        />
      )}

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
          {visibles.has('mapa_mundo') && (
            <MapaMundoDialog
              aventura={data.aventura}
              localizaciones={data.localizaciones || []}
              onUpdate={(v) => updateSection('aventura', v)}
              serverSlug={serverSlug}
            />
          )}
          {visibles.has('localizaciones') && (
            <SeccionLocalizaciones
              localizaciones={data.localizaciones || []}
              npcs={data.npcs || []}
              bestiario={data.bestiario || []}
              assetsTacticos={data.assets_tacticos || []}
              onUpdate={(v) => updateSection('localizaciones', v)}
              onOpenIA={() => openIA('localizaciones')}
              serverSlug={serverSlug}
              dirty={dirty}
            />
          )}
          {visibles.has('npcs') && (
            <SeccionNpcs
              npcs={data.npcs || []}
              onUpdate={(v) => updateSection('npcs', v)}
              onOpenIA={() => openIA('npcs')}
              serverSlug={serverSlug}
            />
          )}
          {visibles.has('bestiario') && (
            <SeccionBestiario
              bestiario={data.bestiario || []}
              onUpdate={(v) => updateSection('bestiario', v)}
              onOpenIA={() => openIA('bestiario')}
              serverSlug={serverSlug}
            />
          )}
          {visibles.has('historia') && (
            <SeccionHistoria
              historia={data.historia}
              onUpdate={(v) => updateSection('historia', v)}
              onOpenIA={() => openIA('historia')}
            />
          )}
          {visibles.has('finales') && (
            <SeccionFinales
              finales={data.finales || []}
              onUpdate={(v) => updateSection('finales', v)}
              onOpenIA={() => openIA('finales')}
            />
          )}
          {visibles.has('escenas') && (
            <>
              <MapaEscenas escenas={data.escenas || []} finales={data.finales || []} />
              <SeccionEscenas
                escenas={data.escenas || []}
                onUpdate={(v) => updateSection('escenas', v)}
                data={data}
                onOpenIA={() => openIA('escenas')}
              />
            </>
          )}
          {visibles.has('eventos_definidos') && (
            <SeccionEventos
              eventos={data.eventos_definidos || []}
              onUpdate={(v) => updateSection('eventos_definidos', v)}
              onOpenIA={() => openIA('eventos_definidos')}
            />
          )}
        </>
      )}
    </div>
  )
}
