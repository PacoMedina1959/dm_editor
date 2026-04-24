/**
 * Cliente API para la generacion de mapas 2.5D con IA.
 *
 * Tres endpoints en el backend (ver `docs/PLAN_MAPAS_2_5D.md` seccion 3 en dm_virtual):
 *  - POST `/api/editor/aventuras/{slug}/localizaciones/{loc_id}/mapa/generar`
 *  - GET  `/api/editor/mapa/jobs/{job_id}`
 *  - GET  `/api/campanas/{slug}/mapas/{loc_id}/{fichero}` (estatico, cache 1 agno)
 *
 * El POST encola un job (o devuelve OK instantaneo si ya esta cacheado);
 * el cliente hace polling al GET hasta `estado === 'ok' | 'error'`.
 *
 * Si el GET del job devuelve 404, el backend ha reiniciado y el job_id
 * en memoria se ha perdido. Repetir el POST con `force=false` recupera
 * al instante (la imagen sigue en disco gracias al cache).
 */
import { apiUrl } from './client.js'

/**
 * @typedef {Object} JobMapaEstado
 * @property {string}   job_id
 * @property {string}   slug
 * @property {string}   loc_id
 * @property {('pendiente'|'ejecutando'|'ok'|'error')} estado
 * @property {number}   progreso
 * @property {string}   hash
 * @property {string|null} ruta_relativa
 * @property {string}   formato
 * @property {number|null} ancho
 * @property {number|null} alto
 * @property {string}   prompt
 * @property {number}   seed
 * @property {string}   modelo
 * @property {string|null} error
 * @property {number}   created_at
 * @property {number|null} finished_at
 */

/**
 * @typedef {Object} GenerarMapaParams
 * @property {('tactico'|'overworld')} [proyeccion]   Default 'tactico'.
 * @property {number}  [seed]     0 => derivado del prompt. Default 0.
 * @property {number}  [ancho]    Default 1024. Rango 128..2048.
 * @property {number}  [alto]     Default 1024. Rango 128..2048.
 * @property {boolean} [force]    Saltar cache. Default false.
 * @property {('dia'|'amanecer'|'atardecer'|'noche'|'')} [hora]
 *   Franja horaria. '' o undefined => el backend usa ``localizacion.hora_del_dia``
 *   del YAML si existe; si no, no se añade directiva de tiempo. Solo afecta
 *   a escenas outdoor y a proyección overworld; en indoor se ignora.
 * @property {string} [extrasPrompt]
 *   Instrucciones extra del DM (F3.3). Se añaden al prompt como bloque
 *   ``DM notes`` antes del negativo. Máximo ~500 chars efectivos tras
 *   higiene en backend; aquí limitamos a 2000 chars por seguridad
 *   (el backend rechaza más). Vacío o undefined => no se envía y el
 *   hash de cache coincide con el de la variante sin extras.
 */

async function _json(res) {
  const text = await res.text()
  if (!res.ok) {
    let detail = ''
    try { detail = JSON.parse(text)?.detail } catch { /* not json */ }
    throw new Error(detail || text || `HTTP ${res.status}`)
  }
  return JSON.parse(text)
}

/**
 * Lanza generacion de mapa para una localizacion.
 *
 * Si la imagen ya esta cacheada y `force=false`, la respuesta llega con
 * `estado: 'ok'` y `ruta_relativa` rellena: no hace falta polling.
 *
 * @param {string} slug
 * @param {string} locId
 * @param {GenerarMapaParams} [params]
 * @returns {Promise<JobMapaEstado>}
 */
export async function generarMapaIA(slug, locId, params = {}) {
  const url = apiUrl(
    `/api/editor/aventuras/${encodeURIComponent(slug)}` +
    `/localizaciones/${encodeURIComponent(locId)}/mapa/generar`,
  )
  const body = {
    proyeccion: params.proyeccion ?? 'tactico',
    seed: params.seed ?? 0,
    ancho: params.ancho ?? 1024,
    alto: params.alto ?? 1024,
    force: !!params.force,
  }
  // Solo incluimos `hora` si es un valor con contenido: el backend
  // interpreta null/ausente como "usa lo que diga el YAML".
  if (params.hora) body.hora = params.hora
  // Instrucciones extra del DM (F3.3). Si viene vacío/undefined no
  // lo mandamos: así el hash de cache coincide con el de la variante
  // "sin extras" y evitamos regeneraciones innecesarias.
  if (params.extrasPrompt && params.extrasPrompt.trim()) {
    body.extras_prompt = params.extrasPrompt
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return _json(res)
}

/**
 * Consulta el estado actual de un job. Si el backend se reinicio, el
 * GET devuelve 404: en ese caso hay que relanzar el POST con force=false
 * (la imagen sigue disponible por cache de disco).
 *
 * @param {string} jobId
 * @returns {Promise<JobMapaEstado>}
 */
export async function consultarJobMapa(jobId) {
  const res = await fetch(apiUrl(`/api/editor/mapa/jobs/${encodeURIComponent(jobId)}`))
  return _json(res)
}

/**
 * @typedef {Object} PromptPreview
 * @property {string} slug
 * @property {string} loc_id
 * @property {string} proyeccion
 * @property {string} prompt            Prompt final en ingles, tal cual se enviaria.
 * @property {string} modelo            identificador_modelo() del proveedor activo.
 * @property {string} version_stylist   p. ej. "v3". Util para correlar con metadatos.
 * @property {number} caracteres
 */

/**
 * Previsualiza el prompt que se enviaria al proveedor de imagen sin generarla.
 *
 * Pensado para que el DM pueda:
 *  - Ver exactamente que instrucciones recibe gpt-image-1 / flux / ...
 *  - Copiar el prompt y pegarlo en ChatGPT / web del proveedor para
 *    iterar variantes sin consumir creditos de API.
 *
 * Es un GET puro: no crea job, no toca disco, no llama a IA.
 *
 * @param {string} slug
 * @param {string} locId
 * @param {('tactico'|'overworld')} [proyeccion]  Default 'tactico'.
 * @param {Object} [opts]
 * @param {('dia'|'amanecer'|'atardecer'|'noche'|'')} [opts.hora]
 *   Franja horaria para previsualizar. Si se omite o va vacia, el backend
 *   usa ``localizacion.hora_del_dia`` del YAML si existe.
 * @param {string} [opts.extras]
 *   Instrucciones extra del DM (F3.3). Se envian tal cual al backend,
 *   que las higieniza y trunca. Vacio/undefined => no se envian.
 * @returns {Promise<PromptPreview>}
 */
export async function previsualizarPromptMapa(
  slug,
  locId,
  proyeccion = 'tactico',
  opts = {},
) {
  const qs = new URLSearchParams({ proyeccion })
  if (opts.hora) qs.set('hora', opts.hora)
  if (opts.extras && opts.extras.trim()) qs.set('extras', opts.extras)
  const url = apiUrl(
    `/api/editor/aventuras/${encodeURIComponent(slug)}` +
    `/localizaciones/${encodeURIComponent(locId)}/mapa/prompt?${qs.toString()}`,
  )
  const res = await fetch(url)
  return _json(res)
}

/**
 * URL publica (cache HTTP de 1 agno) para mostrar la imagen generada.
 *
 * @param {string} slug
 * @param {string} rutaRelativa  Tal cual viene en `JobMapaEstado.ruta_relativa`,
 *                               p. ej. `mapas/cripta/cripta__abcd1234.png`.
 * @returns {string}
 */
export function urlMapaPublico(slug, rutaRelativa) {
  if (!slug || !rutaRelativa) return ''
  const limpia = rutaRelativa.replace(/^\//, '')
  return apiUrl(`/api/campanas/${encodeURIComponent(slug)}/${limpia}`)
}

/**
 * Sube una imagen de mapa pre-generada (F3.4) para una localizacion.
 *
 * Pensado para el flujo hibrido: el DM genera la imagen en otra
 * herramienta (gemini.google.com, Midjourney, pintura propia) y la
 * sube aqui sin pasar por el pipeline IA de nuestra API.
 *
 * El backend valida formato por magic bytes (PNG/WebP/JPEG),
 * tamagno maximo 10 MB, y guarda bajo esquema canonico
 * `mapas/{loc_id}/{loc_id}__manual__{hash8}.{ext}`. La respuesta
 * tiene el MISMO shape que `generarMapaIA` (con `origen="manual"`),
 * asi que el codigo de aplicacion del dialogo se reutiliza tal cual.
 *
 * @param {string} slug
 * @param {string} locId
 * @param {File|Blob} file   Fichero obtenido de un <input type="file">.
 * @returns {Promise<JobMapaEstado & { origen: 'manual' }>}
 */
export async function subirImagenMapa(slug, locId, file) {
  const url = apiUrl(
    `/api/editor/aventuras/${encodeURIComponent(slug)}` +
    `/localizaciones/${encodeURIComponent(locId)}/mapa/subir`,
  )
  const fd = new FormData()
  fd.append('archivo', file, file.name || 'mapa')
  const res = await fetch(url, { method: 'POST', body: fd })
  return _json(res)
}

/**
 * Hace polling del job hasta que termina (ok/error) o hasta el timeout.
 * Llama a `onTick(estado)` en cada actualizacion para que la UI pinte
 * progreso en vivo.
 *
 * @param {string} jobId
 * @param {Object} [opts]
 * @param {number} [opts.intervaloMs]    Default 700.
 * @param {number} [opts.timeoutMs]      Default 60000.
 * @param {(estado: JobMapaEstado) => void} [opts.onTick]
 * @param {() => boolean} [opts.cancelado]  Si devuelve true, aborta.
 * @returns {Promise<JobMapaEstado>}
 */
export async function esperarJobMapa(jobId, opts = {}) {
  const intervalo = opts.intervaloMs ?? 700
  const timeout = opts.timeoutMs ?? 60000
  const fin = Date.now() + timeout

  while (Date.now() < fin) {
    if (opts.cancelado?.()) {
      const e = new Error('cancelado')
      e.code = 'cancelado'
      throw e
    }
    const estado = await consultarJobMapa(jobId)
    opts.onTick?.(estado)
    if (estado.estado === 'ok' || estado.estado === 'error') return estado
    await new Promise(r => setTimeout(r, intervalo))
  }
  throw new Error(`El job ${jobId} no termino en ${timeout}ms`)
}
