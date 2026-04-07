import { apiUrl } from './client.js'

/**
 * @typedef {Object} IssueCampana
 * @property {string} path
 * @property {string} code
 * @property {string} message
 * @property {'error'|'warning'} severity
 */

/**
 * Respuesta JSON del backend (`resultado_a_jsonable`).
 * @typedef {Object} ResultadoValidacionJson
 * @property {boolean} ok
 * @property {string} source
 * @property {string|null} [nombre_aventura]
 * @property {string|null} [escena_inicial]
 * @property {IssueCampana[]} issues
 * @property {number} error_count
 * @property {number} warning_count
 */

function mensajeProxyBackend(status) {
  if (status === 502 || status === 503 || status === 504) {
    return [
      `HTTP ${status}: el dev server (Vite) no pudo hablar con el backend DM Virtual.`,
      'Arranca el motor: en la carpeta backend del repo dm_virtual, con el venv activo:',
      '  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000',
      'Si el API usa otro puerto, crea .env en dm_editor con VITE_DEV_PROXY_TARGET=http://localhost:PUERTO y reinicia Vite.',
    ].join('\n')
  }
  return ''
}

/**
 * @param {string} yamlText
 * @returns {Promise<ResultadoValidacionJson>}
 */
export async function postValidarCampana(yamlText) {
  const url = apiUrl('/api/editor/validar-campana')
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml_text: yamlText }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Red: ${msg}\nNo se pudo completar la petición a ${url || '«API»'}.\n¿Backend en marcha y proxy configurado?`,
    )
  }

  const text = await res.text()

  if (!res.ok) {
    const hint = mensajeProxyBackend(res.status)
    if (hint) throw new Error(hint)
    let data
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      throw new Error(text?.trim() || `HTTP ${res.status}: respuesta no JSON`)
    }
    const detail = data?.detail != null ? JSON.stringify(data.detail) : text
    throw new Error(detail || `HTTP ${res.status}`)
  }

  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(text?.trim() || `HTTP ${res.status}: respuesta no JSON`)
  }

  return data
}
