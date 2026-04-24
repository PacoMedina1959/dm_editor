import { useMemo, useRef, useState } from 'react'
import {
  catalogoAString,
  entradasOrdenadas,
  parseCatalogoJsonText,
  plantillaItem,
} from '../domain/catalogo.js'
import { formatPrecioUi, nombreVisible } from '../utils/catalogoUi.js'

const LANG = 'es'
const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/catalogo-ejemplo.json`

export default function CatalogoPage() {
  /** @type {[Record<string, object>|null, function]} */
  const [catalog, setCatalog] = useState(null)
  const [sourceLabel, setSourceLabel] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  /** id seleccionado en catálogo existente; null si modo «nuevo» o nada */
  const [selectedId, setSelectedId] = useState(null)
  /** true: formulario es alta nueva (aún no hay clave en catalog) */
  const [isNew, setIsNew] = useState(false)

  const [idEdit, setIdEdit] = useState('')
  const [nombre, setNombre] = useState('')
  const [nombreEn, setNombreEn] = useState('')
  const [categoria, setCategoria] = useState('')
  const [subtipo, setSubtipo] = useState('')
  const [precioStr, setPrecioStr] = useState('0')
  const [usableCombate, setUsableCombate] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [statsText, setStatsText] = useState('{}')
  const [efectosText, setEfectosText] = useState('{}')
  const [editorError, setEditorError] = useState(null)
  const idInputRef = useRef(null)

  const filas = useMemo(() => {
    if (!catalog) return []
    const rows = entradasOrdenadas(catalog)
    const q = busqueda.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const id = String(row.id || '').toLowerCase()
      const nom = String(row.nombre || '').toLowerCase()
      const cat = String(row.categoria || '').toLowerCase()
      return id.includes(q) || nom.includes(q) || cat.includes(q)
    })
  }, [catalog, busqueda])

  const vaciarFormulario = () => {
    setIdEdit('')
    setNombre('')
    setNombreEn('')
    setCategoria('consumible')
    setSubtipo('')
    setPrecioStr('0')
    setUsableCombate(false)
    setDescripcion('')
    setStatsText('{}')
    setEfectosText('{}')
    setEditorError(null)
  }

  const cargarEjemplo = async () => {
    try {
      const res = await fetch(SAMPLE_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const p = parseCatalogoJsonText(text)
      if (!p.ok) {
        setLoadError(p.message)
        return
      }
      setCatalog(p.catalog)
      setSourceLabel('Ejemplo (DM Virtual)')
      setLoadError(null)
      setSelectedId(null)
      setIsNew(false)
      vaciarFormulario()
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
      setCatalog(p.catalog)
      setSourceLabel(f.name)
      setLoadError(null)
      setSelectedId(null)
      setIsNew(false)
      vaciarFormulario()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }

  const exportarJson = () => {
    if (!catalog) return
    const blob = new Blob([catalogoAString(catalog)], { type: 'application/json;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = sourceLabel?.endsWith('.json') ? sourceLabel : 'catalogo_objetos.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const seleccionarFila = (id) => {
    if (!catalog || !catalog[id]) return
    const row = catalog[id]
    setIsNew(false)
    setSelectedId(id)
    setIdEdit(String(row.id ?? ''))
    setNombre(String(row.nombre ?? ''))
    setNombreEn(String(row.nombre_en ?? ''))
    setCategoria(String(row.categoria ?? ''))
    setSubtipo(String(row.subtipo ?? ''))
    setPrecioStr(String(row.precio ?? 0))
    setUsableCombate(Boolean(row.usable_en_combate))
    setDescripcion(String(row.descripcion ?? ''))
    setStatsText(JSON.stringify(row.stats && typeof row.stats === 'object' ? row.stats : {}, null, 2))
    setEfectosText(
      JSON.stringify(row.efectos && typeof row.efectos === 'object' ? row.efectos : {}, null, 2),
    )
    setEditorError(null)
  }

  const nuevoItem = () => {
    if (!catalog) {
      setCatalog({})
      setSourceLabel('Sin guardar (nuevo)')
    }
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
    setDescripcion(tpl.descripcion)
    setStatsText(JSON.stringify(tpl.stats, null, 2))
    setEfectosText(JSON.stringify(tpl.efectos, null, 2))
    setEditorError(null)
  }

  const guardarItem = () => {
    if (!catalog) return
    const id = idEdit.trim()
    if (!id) {
      setEditorError('El id no puede estar vacío.')
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      setEditorError('Usa solo letras, números, guiones y guión bajo en el id.')
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

    const entry = {
      id,
      nombre: nombre.trim(),
      nombre_en: nombreEn.trim(),
      categoria: categoria.trim(),
      subtipo: subtipo.trim(),
      efectos,
      stats,
      precio,
      usable_en_combate: usableCombate,
      descripcion: descripcion.trim(),
    }

    const base = { ...catalog }

    if (isNew) {
      if (base[id]) {
        setEditorError(`Ya existe el id «${id}».`)
        return
      }
      base[id] = entry
      setCatalog(base)
      setEditorError(null)
      setIsNew(false)
      setSelectedId(id)
      return
    }

    if (!selectedId) {
      setEditorError('Selecciona un ítem o usa «Nuevo ítem».')
      return
    }
    if (selectedId !== id && base[id]) {
      setEditorError(`El id «${id}» ya está en uso por otra ficha.`)
      return
    }
    if (selectedId !== id) delete base[selectedId]
    base[id] = entry
    setCatalog(base)
    setEditorError(null)
    setSelectedId(id)
  }

  /** Id sugerido al duplicar: `<base>_copia`, `<base>_copia2`, … sin colisión en catálogo. */
  const sugerirIdDuplicado = (baseRaw) => {
    if (!catalog) return `item_copia_${Date.now()}`
    const base = (baseRaw || '').trim() || 'item'
    let candidate = `${base}_copia`
    let i = 2
    while (catalog[candidate]) {
      candidate = `${base}_copia${i}`
      i += 1
    }
    return candidate
  }

  /**
   * Copia los valores actuales del formulario (incl. cambios sin guardar) a un ítem nuevo.
   * El usuario puede renombrar el id (p. ej. guiso_pescado) antes de «Guardar ítem».
   */
  const duplicarItem = () => {
    if (!catalog) return
    if (!isNew && !selectedId) return
    const baseForId = idEdit.trim() || selectedId || 'item'
    const nuevoId = sugerirIdDuplicado(baseForId)
    setIsNew(true)
    setSelectedId(null)
    setIdEdit(nuevoId)
    setEditorError(null)
    requestAnimationFrame(() => {
      idInputRef.current?.focus?.()
      idInputRef.current?.select?.()
    })
  }

  const eliminarItem = () => {
    if (!catalog || !selectedId || isNew) return
    if (!globalThis.confirm(`¿Eliminar del catálogo la entrada «${selectedId}»?`)) return
    setCatalog((prev) => {
      const next = { ...prev }
      delete next[selectedId]
      return Object.keys(next).length ? next : null
    })
    setSelectedId(null)
    setIsNew(false)
    vaciarFormulario()
  }

  return (
    <div className="page catalogo-page">
      <h1 className="page-title">Catálogo de objetos</h1>
      <p className="page-lead">
        Formato canónico: un objeto JSON cuyas claves son los <code className="kbd">id</code> y coinciden
        con el campo <code className="kbd">id</code> de cada ficha (como en el motor DM Virtual).
      </p>

      <div className="validar-toolbar catalogo-toolbar">
        <button type="button" className="btn-secondary" onClick={cargarEjemplo}>
          Cargar ejemplo
        </button>
        <label className="btn-file">
          <input type="file" accept=".json,application/json" className="sr-only" onChange={onPickFile} />
          Abrir JSON…
        </label>
        <button type="button" className="btn-secondary" onClick={nuevoItem}>
          Nuevo ítem
        </button>
        <button type="button" className="btn-primary" onClick={exportarJson} disabled={!catalog}>
          Exportar JSON
        </button>
      </div>

      {sourceLabel && (
        <p className="catalogo-source">
          Origen: <strong>{sourceLabel}</strong> · {catalog ? Object.keys(catalog).length : 0} entradas
        </p>
      )}

      {loadError && (
        <div className="alert alert-error" role="alert">
          <strong>Error al cargar</strong>
          <pre className="alert-pre">{loadError}</pre>
        </div>
      )}

      {!catalog && !loadError && (
        <p className="catalogo-empty-hint">Carga un fichero o el ejemplo para empezar.</p>
      )}

      {catalog && (
        <div className="catalogo-grid">
          <div className="catalogo-lista">
            <div className="catalogo-filtro">
              <label className="field-label" htmlFor="cat-busq">
                Buscar
              </label>
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
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Precio</th>
                    <th>Combate</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="catalogo-table-empty">
                        Sin resultados.
                      </td>
                    </tr>
                  ) : (
                    filas.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedId === row.id && !isNew ? 'row-selected' : undefined}
                      >
                        <td>
                          <button type="button" className="btn-link-id" onClick={() => seleccionarFila(row.id)}>
                            <code>{row.id}</code>
                          </button>
                        </td>
                        <td>{nombreVisible(row, LANG)}</td>
                        <td>
                          {row.categoria}
                          {row.subtipo ? (
                            <>
                              {' '}
                              <span className="muted">/ {row.subtipo}</span>
                            </>
                          ) : null}
                        </td>
                        <td>{formatPrecioUi(row.precio, LANG)}</td>
                        <td>{row.usable_en_combate ? 'Sí' : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="catalogo-editor card">
            <h2 className="catalogo-editor-title">
              {isNew ? 'Nuevo ítem' : selectedId ? `Editar: ${selectedId}` : 'Selecciona un ítem'}
            </h2>

            {editorError && (
              <div className="alert alert-error catalogo-editor-alert" role="alert">
                {editorError}
              </div>
            )}

            <div className="catalogo-form">
              <label className="field">
                <span className="field-label">id</span>
                <input
                  ref={idInputRef}
                  className="catalogo-input"
                  value={idEdit}
                  onChange={(e) => setIdEdit(e.target.value)}
                  disabled={!catalog}
                  spellCheck={false}
                />
              </label>
              <label className="field">
                <span className="field-label">nombre</span>
                <input className="catalogo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </label>
              <label className="field">
                <span className="field-label">nombre_en</span>
                <input
                  className="catalogo-input"
                  value={nombreEn}
                  onChange={(e) => setNombreEn(e.target.value)}
                />
              </label>
              <div className="catalogo-form-row">
                <label className="field field-grow">
                  <span className="field-label">categoría</span>
                  <input
                    className="catalogo-input"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                  />
                </label>
                <label className="field field-grow">
                  <span className="field-label">subtipo</span>
                  <input
                    className="catalogo-input"
                    value={subtipo}
                    onChange={(e) => setSubtipo(e.target.value)}
                  />
                </label>
              </div>
              <div className="catalogo-form-row">
                <label className="field field-grow">
                  <span className="field-label">precio</span>
                  <input
                    className="catalogo-input"
                    type="number"
                    min={0}
                    step={1}
                    value={precioStr}
                    onChange={(e) => setPrecioStr(e.target.value)}
                  />
                </label>
                <label className="field field-check">
                  <input
                    type="checkbox"
                    checked={usableCombate}
                    onChange={(e) => setUsableCombate(e.target.checked)}
                  />
                  <span className="field-label">usable_en_combate</span>
                </label>
              </div>
              <label className="field">
                <span className="field-label">descripcion</span>
                <textarea
                  className="catalogo-textarea"
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">stats (JSON objeto)</span>
                <textarea
                  className="catalogo-textarea catalogo-textarea-mono"
                  rows={5}
                  value={statsText}
                  onChange={(e) => setStatsText(e.target.value)}
                  spellCheck={false}
                />
              </label>
              <label className="field">
                <span className="field-label">efectos (JSON objeto)</span>
                <textarea
                  className="catalogo-textarea catalogo-textarea-mono"
                  rows={4}
                  value={efectosText}
                  onChange={(e) => setEfectosText(e.target.value)}
                  spellCheck={false}
                />
              </label>
            </div>

            <div className="catalogo-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={guardarItem}
                disabled={!catalog || (!isNew && !selectedId)}
              >
                Guardar ítem
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={duplicarItem}
                disabled={!catalog || (!isNew && !selectedId)}
                title="Copia el formulario actual (aunque no esté guardado) a un ítem nuevo; ajusta el id y guarda."
              >
                Duplicar
              </button>
              <button type="button" className="btn-secondary" onClick={eliminarItem} disabled={!selectedId || isNew}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
