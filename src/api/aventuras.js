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
