import { useMemo, useRef, useState } from 'react'
import {
  CLASES_BASE_EDITOR,
  catalogoAString,
  entradasOrdenadas,
  idsLocalesConColisionGlobal,
  parseCatalogoJsonText,
  plantillaItem,
} from '../domain/catalogo.js'
import {
  cargarCatalogoObjetos,
  cargarCatalogoObjetosGlobal,
  guardarCatalogoObjetos,
} from '../api/aventuras.js'
import { formatPrecioUi, nombreVisible } from '../utils/catalogoUi.js'

const LANG = 'es'

export default function CatalogoPage() {
  const [globalCatalog, setGlobalCatalog] = useState(null)
  const [localCatalog, setLocalCatalog] = useState({})
  const [slug, setSlug] = useState('ejemplo')
  const [sourceLabel, setSourceLabel] = useState('Local sin guardar')
  const [loadError, setLoadError] = useState(null)
  const [serverMsg, setServerMsg] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [globalBusqueda, setGlobalBusqueda] = useState('')

  const [selectedId, setSelectedId] = useState(null)
  const [isNew, setIsNew] = useState(false)

  const [idEdit, setIdEdit] = useState('')
  const [nombre, setNombre] = useState('')
  const [nombreEn, setNombreEn] = useState('')
  const [categoria, setCategoria] = useState('')
  const [subtipo, setSubtipo] = useState('')
  const [precioStr, setPrecioStr] = useState('0')
  const [usableCombate, setUsableCombate] = useState(false)
  const [apilable, setApilable] = useState(false)
  const [expRequeridaStr, setExpRequeridaStr] = useState('0')
  const [clasesSel, setClasesSel] = useState([])
  const [overrideGlobal, setOverrideGlobal] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [statsText, setStatsText] = useState('{}')
  const [efectosText, setEfectosText] = useState('{}')
  const [editorError, setEditorError] = useState(null)
  const idInputRef = useRef(null)

  const globalRows = useMemo(() => {
    const rows = entradasOrdenadas(globalCatalog || {})
    const q = globalBusqueda.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const id = String(row.id || '').toLowerCase()
      const nom = String(row.nombre || '').toLowerCase()
      const cat = String(row.categoria || '').toLowerCase()
      return id.includes(q) || nom.includes(q) || cat.includes(q)
    })
  }, [globalCatalog, globalBusqueda])

  const localRows = useMemo(() => {
    const rows = entradasOrdenadas(localCatalog || {})
    const q = busqueda.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const id = String(row.id || '').toLowerCase()
      const nom = String(row.nombre || '').toLowerCase()
      const cat = String(row.categoria || '').toLowerCase()
      return id.includes(q) || nom.includes(q) || cat.includes(q)
    })
  }, [localCatalog, busqueda])

  const colisiones = useMemo(
    () => idsLocalesConColisionGlobal(localCatalog, globalCatalog),
    [localCatalog, globalCatalog],
  )

  const vaciarFormulario = () => {
    setIdEdit('')
    setNombre('')
    setNombreEn('')
    setCategoria('consumible')
    setSubtipo('')
    setPrecioStr('0')
    setUsableCombate(false)
    setApilable(false)
    setExpRequeridaStr('0')
    setClasesSel([])
    setOverrideGlobal(false)
    setDescripcion('')
    setStatsText('{}')
    setEfectosText('{}')
    setEditorError(null)
  }

  const cargarGlobal = async () => {
    setLoadError(null)
    setServerMsg(null)
    try {
      const data = await cargarCatalogoObjetosGlobal()
      setGlobalCatalog(data.catalogo || {})
      setServerMsg('Catálogo global cargado como referencia de solo lectura.')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  const cargarLocalServidor = async () => {
    const s = slug.trim()
    if (!s) return
    setLoadError(null)
    setServerMsg(null)
    try {
      const data = await cargarCatalogoObjetos(s)
      setLocalCatalog(data.catalogo || {})
      setSourceLabel(`Servidor: ${s}/catalogos/objetos.json`)
      setSelectedId(null)
      setIsNew(false)
      vaciarFormulario()
      setServerMsg('Catálogo local cargado.')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  const guardarLocalServidor = async () => {
    const s = slug.trim()
    if (!s) return
    if (colisiones.length) {
      setEditorError(`Colisión con global sin override: ${colisiones.join(', ')}`)
      return
    }
    setLoadError(null)
    setServerMsg(null)
    try {
      await guardarCatalogoObjetos(s, localCatalog || {})
      setSourceLabel(`Servidor: ${s}/catalogos/objetos.json`)
      setServerMsg('Catálogo local guardado en el paquete de aventura.')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  const onPickFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const text = await f.text()
      const p = parseCatalogoJsonText(text)
      if (!p.ok) {
        setLoadError(p.message)
        return
      }
      setLocalCatalog(p.catalog)
      setSourceLabel(`${f.name} cargado como catálogo local`)
      setLoadError(null)
      setSelectedId(null)
      setIsNew(false)
      vaciarFormulario()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }

  const exportarJson = () => {
    const blob = new Blob([catalogoAString(localCatalog || {})], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'objetos.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const seleccionarFila = (id) => {
    if (!localCatalog || !localCatalog[id]) return
    const row = localCatalog[id]
    setIsNew(false)
    setSelectedId(id)
    setIdEdit(String(row.id ?? ''))
    setNombre(String(row.nombre ?? ''))
    setNombreEn(String(row.nombre_en ?? ''))
    setCategoria(String(row.categoria ?? ''))
    setSubtipo(String(row.subtipo ?? ''))
    setPrecioStr(String(row.precio ?? 0))
    setUsableCombate(Boolean(row.usable_en_combate))
    setApilable(Boolean(row.apilable))
    setExpRequeridaStr(String(row.exp_requerida ?? 0))
    setClasesSel(Array.isArray(row.clases) ? row.clases.map(String) : [])
    setOverrideGlobal(Boolean(row.override))
    setDescripcion(String(row.descripcion ?? ''))
    setStatsText(JSON.stringify(row.stats && typeof row.stats === 'object' ? row.stats : {}, null, 2))
    setEfectosText(JSON.stringify(row.efectos && typeof row.efectos === 'object' ? row.efectos : {}, null, 2))
    setEditorError(null)
  }

  const crearOverrideDesdeGlobal = (id) => {
    const row = (globalCatalog || {})[id]
    if (!row) return
    const entry = {
      ...row,
      id,
      override: true,
    }
    setLocalCatalog((prev) => ({
      ...(prev || {}),
      [id]: entry,
    }))
    setIsNew(false)
    setSelectedId(id)
    setIdEdit(String(entry.id ?? ''))
    setNombre(String(entry.nombre ?? ''))
    setNombreEn(String(entry.nombre_en ?? ''))
    setCategoria(String(entry.categoria ?? ''))
    setSubtipo(String(entry.subtipo ?? ''))
    setPrecioStr(String(entry.precio ?? 0))
    setUsableCombate(Boolean(entry.usable_en_combate))
    setApilable(Boolean(entry.apilable))
    setExpRequeridaStr(String(entry.exp_requerida ?? 0))
    setClasesSel(Array.isArray(entry.clases) ? entry.clases.map(String) : [])
    setOverrideGlobal(true)
    setDescripcion(String(entry.descripcion ?? ''))
    setStatsText(JSON.stringify(entry.stats && typeof entry.stats === 'object' ? entry.stats : {}, null, 2))
    setEfectosText(JSON.stringify(entry.efectos && typeof entry.efectos === 'object' ? entry.efectos : {}, null, 2))
    setEditorError(null)
    setLoadError(null)
    setServerMsg(`Override local creado para «${id}». Edita sus campos y guarda el catálogo local.`)
  }

  const nuevoItem = () => {
    const baseId = `item_nuevo_${Date.now()}`
    setIsNew(true)
    setSelectedId(null)
    const tpl = plantillaItem(baseId)
    setIdEdit(tpl.id)
    setNombre(tpl.nombre)
    setNombreEn(tpl.nombre_en)
    setCategoria(tpl.categoria)
    setSubtipo(tpl.subtipo)
    setPrecioStr(String(tpl.precio))
    setUsableCombate(tpl.usable_en_combate)
    setApilable(false)
    setExpRequeridaStr('0')
    setClasesSel([])
    setOverrideGlobal(false)
    setDescripcion(tpl.descripcion)
    setStatsText(JSON.stringify(tpl.stats, null, 2))
    setEfectosText(JSON.stringify(tpl.efectos, null, 2))
    setEditorError(null)
    requestAnimationFrame(() => idInputRef.current?.focus?.())
  }

  const guardarItem = () => {
    const id = idEdit.trim()
    if (!id) {
      setEditorError('El id no puede estar vacío.')
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      setEditorError('Usa solo letras, números, guiones y guión bajo en el id.')
      return
    }
    if ((globalCatalog || {})[id] && !overrideGlobal) {
      setEditorError(`«${id}» existe en el catálogo global. Activa override explícito o usa otro id.`)
      return
    }
    let stats
    let efectos
    try {
      stats = statsText.trim() ? JSON.parse(statsText) : {}
    } catch {
      setEditorError('«stats» no es JSON válido.')
      return
    }
    try {
      efectos = efectosText.trim() ? JSON.parse(efectosText) : {}
    } catch {
      setEditorError('«efectos» no es JSON válido.')
      return
    }
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
      setEditorError('«stats» debe ser un objeto JSON.')
      return
    }
    if (!efectos || typeof efectos !== 'object' || Array.isArray(efectos)) {
      setEditorError('«efectos» debe ser un objeto JSON.')
      return
    }
    const precio = Number(precioStr)
    if (!Number.isFinite(precio) || precio < 0) {
      setEditorError('«precio» debe ser un número ≥ 0.')
      return
    }
    const expRequerida = Number(expRequeridaStr)

    const entry = {
      id,
      ...(overrideGlobal ? { override: true } : {}),
      nombre: nombre.trim(),
      nombre_en: nombreEn.trim(),
      categoria: categoria.trim(),
      subtipo: subtipo.trim(),
      efectos,
      stats,
      precio,
      usable_en_combate: usableCombate,
      ...(apilable ? { apilable: true } : {}),
      ...(Number.isFinite(expRequerida) && expRequerida > 0 ? { exp_requerida: Math.floor(expRequerida) } : {}),
      ...(clasesSel.length ? { clases: clasesSel } : {}),
      descripcion: descripcion.trim(),
    }

    const base = { ...(localCatalog || {}) }

    if (isNew) {
      if (base[id]) {
        setEditorError(`Ya existe el id local «${id}».`)
        return
      }
      base[id] = entry
      setLocalCatalog(base)
      setEditorError(null)
      setIsNew(false)
      setSelectedId(id)
      return
    }

    if (!selectedId) {
      setEditorError('Selecciona un ítem local o usa «Nuevo ítem local».')
      return
    }
    if (selectedId !== id && base[id]) {
      setEditorError(`El id local «${id}» ya está en uso por otra ficha.`)
      return
    }
    if (selectedId !== id) delete base[selectedId]
    base[id] = entry
    setLocalCatalog(base)
    setEditorError(null)
    setSelectedId(id)
  }

  const sugerirIdDuplicado = (baseRaw) => {
    const base = (baseRaw || '').trim() || 'item'
    let candidate = `${base}_copia`
    let i = 2
    while ((localCatalog || {})[candidate]) {
      candidate = `${base}_copia${i}`
      i += 1
    }
    return candidate
  }

  const duplicarItem = () => {
    if (!isNew && !selectedId) return
    const nuevoId = sugerirIdDuplicado(idEdit.trim() || selectedId || 'item')
    setIsNew(true)
    setSelectedId(null)
    setIdEdit(nuevoId)
    setOverrideGlobal(false)
    setEditorError(null)
    requestAnimationFrame(() => {
      idInputRef.current?.focus?.()
      idInputRef.current?.select?.()
    })
  }

  const eliminarItem = () => {
    if (!selectedId || isNew) return
    if (!globalThis.confirm(`¿Eliminar del catálogo local la entrada «${selectedId}»?`)) return
    setLocalCatalog((prev) => {
      const next = { ...(prev || {}) }
      delete next[selectedId]
      return next
    })
    setSelectedId(null)
    setIsNew(false)
    vaciarFormulario()
  }

  const toggleClase = (claseId) => {
    setClasesSel((prev) => (
      prev.includes(claseId)
        ? prev.filter((id) => id !== claseId)
        : [...prev, claseId]
    ))
  }

  return (
    <div className="page catalogo-page">
      <h1 className="page-title">Catálogo de objetos</h1>
      <p className="page-lead">
        El catálogo global es referencia de sistema. Los objetos propios se editan en el catálogo local de la aventura
        y se guardan como <code className="kbd">catalogos/objetos.json</code>.
      </p>

      <div className="validar-toolbar catalogo-toolbar">
        <label className="field field-grow">
          <span className="field-label">Slug aventura</span>
          <input className="catalogo-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <button type="button" className="btn-secondary" onClick={cargarGlobal}>Cargar global</button>
        <button type="button" className="btn-secondary" onClick={cargarLocalServidor}>Cargar local</button>
        <button type="button" className="btn-primary" onClick={guardarLocalServidor}>Guardar local</button>
        <button type="button" className="btn-secondary" onClick={nuevoItem}>Nuevo ítem local</button>
        <button type="button" className="btn-secondary" onClick={exportarJson}>Exportar objetos.json</button>
        <label className="btn-file">
          <input type="file" accept=".json,application/json" className="sr-only" onChange={onPickFile} />
          Abrir local…
        </label>
      </div>

      {sourceLabel && <p className="catalogo-source">Local: <strong>{sourceLabel}</strong> · {Object.keys(localCatalog || {}).length} entradas</p>}
      {globalCatalog && <p className="catalogo-source">Global: <strong>solo lectura</strong> · {Object.keys(globalCatalog).length} entradas</p>}

      {serverMsg && <div className="alert alert-ok" role="status">{serverMsg}</div>}
      {loadError && (
        <div className="alert alert-error" role="alert">
          <strong>Error</strong>
          <pre className="alert-pre">{loadError}</pre>
        </div>
      )}
      {colisiones.length > 0 && (
        <div className="alert alert-error" role="alert">
          Colisiones con global sin override: {colisiones.join(', ')}
        </div>
      )}

      <div className="catalogo-grid">
        <div className="catalogo-lista">
          <h2 className="catalogo-editor-title">Esta aventura</h2>
          <div className="catalogo-filtro">
            <label className="field-label" htmlFor="cat-busq">Buscar local</label>
            <input
              id="cat-busq"
              type="search"
              className="catalogo-search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="id, nombre o categoría…"
              autoComplete="off"
            />
          </div>
          <div className="catalogo-table-wrap">
            <table className="catalogo-table">
              <thead><tr><th>Id</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Combate</th></tr></thead>
              <tbody>
                {localRows.length === 0 ? (
                  <tr><td colSpan={5} className="catalogo-table-empty">Sin objetos locales.</td></tr>
                ) : localRows.map((row) => (
                  <tr key={row.id} className={selectedId === row.id && !isNew ? 'row-selected' : undefined}>
                    <td><button type="button" className="btn-link-id" onClick={() => seleccionarFila(row.id)}><code>{row.id}</code></button></td>
                    <td>{nombreVisible(row, LANG)} {row.override ? <span className="muted">override</span> : null}</td>
                    <td>{row.categoria}{row.subtipo ? <span className="muted"> / {row.subtipo}</span> : null}</td>
                    <td>{formatPrecioUi(row.precio, LANG)}</td>
                    <td>{row.usable_en_combate ? 'Sí' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="catalogo-editor card">
          <h2 className="catalogo-editor-title">{isNew ? 'Nuevo ítem local' : selectedId ? `Editar local: ${selectedId}` : 'Selecciona un ítem local'}</h2>
          {editorError && <div className="alert alert-error catalogo-editor-alert" role="alert">{editorError}</div>}

          <div className="catalogo-form">
            <label className="field"><span className="field-label">id</span><input ref={idInputRef} className="catalogo-input" value={idEdit} onChange={(e) => setIdEdit(e.target.value)} spellCheck={false} /></label>
            <label className="field field-check"><input type="checkbox" checked={overrideGlobal} onChange={(e) => setOverrideGlobal(e.target.checked)} /><span className="field-label">override global explícito</span></label>
            <label className="field"><span className="field-label">nombre</span><input className="catalogo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
            <label className="field"><span className="field-label">nombre_en</span><input className="catalogo-input" value={nombreEn} onChange={(e) => setNombreEn(e.target.value)} /></label>
            <div className="catalogo-form-row">
              <label className="field field-grow"><span className="field-label">categoría</span><input className="catalogo-input" value={categoria} onChange={(e) => setCategoria(e.target.value)} /></label>
              <label className="field field-grow"><span className="field-label">subtipo</span><input className="catalogo-input" value={subtipo} onChange={(e) => setSubtipo(e.target.value)} /></label>
            </div>
            <div className="catalogo-form-row">
              <label className="field field-grow"><span className="field-label">precio</span><input className="catalogo-input" type="number" min={0} step={1} value={precioStr} onChange={(e) => setPrecioStr(e.target.value)} /></label>
              <label className="field field-check"><input type="checkbox" checked={usableCombate} onChange={(e) => setUsableCombate(e.target.checked)} /><span className="field-label">usable_en_combate</span></label>
              <label className="field field-check"><input type="checkbox" checked={apilable} onChange={(e) => setApilable(e.target.checked)} /><span className="field-label">apilable</span></label>
            </div>
            <label className="field"><span className="field-label">exp_requerida</span><input className="catalogo-input" type="number" min={0} step={1} value={expRequeridaStr} onChange={(e) => setExpRequeridaStr(e.target.value)} /></label>
            <fieldset className="field">
              <legend className="field-label">clases</legend>
              <div className="catalogo-form-row">
                {CLASES_BASE_EDITOR.map((clase) => (
                  <label key={clase.id} className="field field-check">
                    <input
                      type="checkbox"
                      checked={clasesSel.includes(clase.id)}
                      onChange={() => toggleClase(clase.id)}
                    />
                    <span className="field-label">{clase.label} <code>{clase.id}</code></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field"><span className="field-label">descripcion</span><textarea className="catalogo-textarea" rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></label>
            <label className="field"><span className="field-label">stats (JSON objeto)</span><textarea className="catalogo-textarea catalogo-textarea-mono" rows={5} value={statsText} onChange={(e) => setStatsText(e.target.value)} spellCheck={false} /></label>
            <label className="field"><span className="field-label">efectos (JSON objeto)</span><textarea className="catalogo-textarea catalogo-textarea-mono" rows={4} value={efectosText} onChange={(e) => setEfectosText(e.target.value)} spellCheck={false} /></label>
          </div>

          <div className="catalogo-actions">
            <button type="button" className="btn-primary" onClick={guardarItem} disabled={!isNew && !selectedId}>Guardar ítem</button>
            <button type="button" className="btn-secondary" onClick={duplicarItem} disabled={!isNew && !selectedId}>Duplicar</button>
            <button type="button" className="btn-secondary" onClick={eliminarItem} disabled={!selectedId || isNew}>Eliminar</button>
          </div>
        </div>
      </div>

      <div className="catalogo-lista card">
        <h2 className="catalogo-editor-title">Global / sistema</h2>
        <div className="catalogo-filtro">
          <label className="field-label" htmlFor="cat-global-busq">Buscar global</label>
          <input id="cat-global-busq" type="search" className="catalogo-search" value={globalBusqueda} onChange={(e) => setGlobalBusqueda(e.target.value)} placeholder="id, nombre o categoría…" autoComplete="off" />
        </div>
        <div className="catalogo-table-wrap">
          <table className="catalogo-table">
            <thead><tr><th>Id</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Combate</th><th>Acción</th></tr></thead>
            <tbody>
              {!globalCatalog ? (
                <tr><td colSpan={6} className="catalogo-table-empty">Carga el catálogo global para consultarlo.</td></tr>
              ) : globalRows.length === 0 ? (
                <tr><td colSpan={6} className="catalogo-table-empty">Sin resultados.</td></tr>
              ) : globalRows.slice(0, 200).map((row) => (
                <tr key={row.id}>
                  <td><code>{row.id}</code></td>
                  <td>{nombreVisible(row, LANG)}</td>
                  <td>{row.categoria}{row.subtipo ? <span className="muted"> / {row.subtipo}</span> : null}</td>
                  <td>{formatPrecioUi(row.precio, LANG)}</td>
                  <td>{row.usable_en_combate ? 'Sí' : '—'}</td>
                  <td>
                    <button type="button" className="btn-secondary av-btn-small" onClick={() => crearOverrideDesdeGlobal(row.id)}>
                      Crear override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
