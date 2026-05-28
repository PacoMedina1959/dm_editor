import { apiUrl } from './client.js'

/**
 * @typedef {{ slug: string, nombre: string, size: number, modified: string }} AventuraResumen
 */

function _hint502(status) {
  if (status === 502 || status === 503 || status === 504) {
    return 'El backend DM Virtual no responde. ¿Está arrancado en el puerto 8000?'
  }
  return ''
}

async function _json(res) {
  const text = await res.text()
  if (!res.ok) {
    const hint = _hint502(res.status)
    if (hint) throw new Error(hint)
    let data
    try { data = JSON.parse(text) } catch { throw new Error(text || `HTTP ${res.status}`) }
    if (typeof data?.detail === 'string') {
      throw new Error(data.detail)
    }
    if (data?.detail && typeof data.detail === 'object') {
      const detail = data.detail
      const lines = []
      if (detail.message) lines.push(String(detail.message))
      if (Array.isArray(detail.issues)) {
        lines.push(...detail.issues.map((issue) => {
          const code = issue?.code ? `[${issue.code}] ` : ''
          const path = issue?.path ? `${issue.path}: ` : ''
          const message = issue?.message || JSON.stringify(issue)
          return `${code}${path}${message}`
        }))
      }
      throw new Error(lines.length ? lines.join('\n') : JSON.stringify(detail))
    }
    throw new Error(data?.detail || `HTTP ${res.status}`)
  }
  try { return JSON.parse(text) } catch { throw new Error('Respuesta no JSON') }
}

/** @returns {Promise<AventuraResumen[]>} */
export async function listarAventuras() {
  const res = await fetch(apiUrl('/api/editor/aventuras'))
  return _json(res)
}

/** @returns {Promise<{ slug: string, yaml_text: string }>} */
export async function cargarAventura(slug) {
  const res = await fetch(apiUrl(`/api/editor/aventuras/${encodeURIComponent(slug)}`))
  return _json(res)
}

/** @returns {Promise<{ ok: boolean, slug: string }>} */
export async function guardarAventura(slug, yamlText) {
  const res = await fetch(apiUrl(`/api/editor/aventuras/${encodeURIComponent(slug)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml_text: yamlText }),
  })
  return _json(res)
}


/** @returns {Promise<{ catalogo: Record<string, object> }>} */
export async function cargarCatalogoObjetosGlobal() {
  const res = await fetch(apiUrl('/api/editor/catalogo-objetos-global'))
  return _json(res)
}

/** @returns {Promise<{ slug: string, catalogo: Record<string, object> }>} */
export async function cargarCatalogoObjetos(slug) {
  const res = await fetch(apiUrl(`/api/editor/aventuras/${encodeURIComponent(slug)}/catalogo-objetos`))
  return _json(res)
}

/** @returns {Promise<{ ok: boolean, slug: string, catalogo: Record<string, object>, issues?: Array<object> }>} */
export async function guardarCatalogoObjetos(slug, catalogo) {
  const res = await fetch(apiUrl(`/api/editor/aventuras/${encodeURIComponent(slug)}/catalogo-objetos`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ catalogo: catalogo || {} }),
  })
  return _json(res)
}

/** @returns {Promise<{ ok: boolean, slug: string }>} */
export async function borrarAventura(slug) {
  const res = await fetch(apiUrl(`/api/editor/aventuras/${encodeURIComponent(slug)}`), {
    method: 'DELETE',
  })
  return _json(res)
}

/**
 * Lista imágenes disponibles bajo `assets/tacticos/**` para registrar catálogo.
 *
 * @param {string} slug
 * @returns {Promise<{ assets: Array<{ ruta: string, categoria_sugerida: string, id_sugerido: string }> }>}
 */
export async function listarAssetsTacticos(slug) {
  const res = await fetch(apiUrl(`/api/editor/aventuras/${encodeURIComponent(slug)}/assets/tacticos`))
  return _json(res)
}

/** @returns {Promise<{ ok: boolean, yaml_text: string, parsed: any }>} */
export async function generarContenido(seccion, instrucciones, contextoAventura) {
  const res = await fetch(apiUrl('/api/editor/generar'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seccion,
      instrucciones,
      contexto_aventura: contextoAventura || '',
    }),
  })
  return _json(res)
}
