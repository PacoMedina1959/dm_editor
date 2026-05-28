/**
 * Modelo mínimo del catálogo de objetos: objeto raíz id → ficha.
 */

/**
 * @param {unknown} data
 * @returns {{ ok: true, catalog: Record<string, object> } | { ok: false, message: string }}
 */
export function normalizarCatalogoParse(data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, message: 'El catálogo debe ser un objeto JSON (no un array ni primitivo).' }
  }

  /** @type {Record<string, object>} */
  const catalog = {}
  for (const [key, raw] of Object.entries(data)) {
    if (raw == null || typeof raw !== 'object') {
      return { ok: false, message: `Entrada «${key}»: debe ser un objeto.` }
    }
    const row = /** @type {Record<string, unknown>} */ (raw)
    const eid = row.id != null ? String(row.id).trim() : ''
    if (!eid) {
      return { ok: false, message: `Clave «${key}»: falta «id» en la ficha.` }
    }
    if (eid !== key) {
      return {
        ok: false,
        message: `Clave «${key}» ≠ id «${eid}». Corrige para que la clave y «id» coincidan (requisito del motor).`,
      }
    }
    catalog[key] = { ...row, id: eid }
  }
  return { ok: true, catalog }
}

/**
 * @param {string} text
 * @returns {{ ok: true, catalog: Record<string, object> } | { ok: false, message: string }}
 */
export function parseCatalogoJsonText(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `JSON inválido: ${msg}` }
  }
  return normalizarCatalogoParse(data)
}

/**
 * @param {Record<string, object>} catalog
 * @returns {object[]}
 */
export function entradasOrdenadas(catalog) {
  return Object.values(catalog)
    .filter(Boolean)
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || ''), 'es'))
}

/**
 * Plantilla para un ítem nuevo (campos habituales del motor).
 * @param {string} id
 */
export function plantillaItem(id) {
  return {
    id,
    nombre: '',
    nombre_en: '',
    categoria: 'consumible',
    subtipo: '',
    efectos: {},
    stats: {},
    precio: 0,
    usable_en_combate: false,
    descripcion: '',
  }
}

/**
 * Serializa para guardar (indentación legible).
 * @param {Record<string, object>} catalog
 */
export function catalogoAString(catalog) {
  return `${JSON.stringify(catalog, null, 2)}\n`
}


/**
 * @param {Record<string, object>|null|undefined} localCatalog
 * @param {Record<string, object>|null|undefined} globalCatalog
 * @returns {string[]}
 */
export function idsLocalesConColisionGlobal(localCatalog, globalCatalog) {
  const globalIds = new Set(Object.keys(globalCatalog || {}))
  return Object.entries(localCatalog || {})
    .filter(([id, row]) => globalIds.has(id) && row?.override !== true)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * @param {Record<string, object>|null|undefined} globalCatalog
 * @param {Record<string, object>|null|undefined} localCatalog
 */
export function catalogoResueltoPreview(globalCatalog, localCatalog) {
  return { ...(globalCatalog || {}), ...(localCatalog || {}) }
}
