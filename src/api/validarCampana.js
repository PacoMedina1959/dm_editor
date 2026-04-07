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

/**
 * @param {string} yamlText
 * @returns {Promise<ResultadoValidacionJson>}
 */
export async function postValidarCampana(yamlText) {
  const res = await fetch(apiUrl('/api/editor/validar-campana'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml_text: yamlText }),
  })

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(text || `HTTP ${res.status}: respuesta no JSON`)
  }

  if (!res.ok) {
    const detail = data?.detail != null ? JSON.stringify(data.detail) : text
    throw new Error(detail || `HTTP ${res.status}`)
  }

  return data
}
