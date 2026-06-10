import yaml from 'js-yaml'


/**
 * @typedef {Object} AventuraParseResult
 * @property {boolean} ok
 * @property {string} [error]
 * @property {object} [data]  - raw dict from yaml.load
 * @property {object} [meta]  - aventura block
 * @property {object} [mundo]
 * @property {object[]} [localizaciones]
 * @property {object[]} [npcs]
 * @property {object[]} [bestiario]
 * @property {object[]} [assets_tacticos]
 * @property {object} [historia]
 * @property {object[]} [finales]
 * @property {object[]} [escenas]
 * @property {object[]} [eventos_definidos]
 */

/**
 * Parsea el texto YAML de una aventura y devuelve las secciones desglosadas.
 * @param {string} text
 * @returns {AventuraParseResult}
 */
export function parseAventuraYaml(text) {
  let data
  try {
    data = yaml.load(text)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'El YAML debe ser un objeto raíz (no un array ni texto plano).' }
  }

  const meta = data.aventura ?? null
  if (!meta || typeof meta !== 'object') {
    return { ok: false, error: 'Falta la clave «aventura» con los metadatos de la aventura.' }
  }

  return {
    ok: true,
    data,
    meta,
    mundo: data.mundo ?? null,
    localizaciones: asArray(data.localizaciones),
    npcs: asArray(data.npcs),
    bestiario: asArray(data.bestiario),
    assets_tacticos: asArray(data.assets_tacticos),
    historia: data.historia ?? null,
    finales: asArray(data.finales),
    escenas: asArray(data.escenas),
    eventos_definidos: asArray(data.eventos_definidos),
  }
}

function asArray(v) {
  if (Array.isArray(v)) return v
  if (v == null) return []
  return [v]
}

function esListaParesEnteros(arr) {
  if (!Array.isArray(arr)) return false
  return arr.every(pair => Array.isArray(pair) && pair.length === 2 && Number.isInteger(pair[0]) && Number.isInteger(pair[1]))
}

function esRutaMediaValida(src, extsPermitidas) {
  const s = String(src || '').trim()
  if (!s) return false
  if (s.startsWith('/') || s.includes('..')) return false
  const m = s.toLowerCase().match(/\.([a-z0-9]+)$/)
  if (!m) return false
  return extsPermitidas.has(m[1])
}

function normalizarNumero(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Filtra los issues canónicos del motor pertenecientes al mapa de una localización.
 * @param {Array<{path:string,code:string,message:string,severity:string}>} issues
 * @param {string} locId
 * @returns {Array} subconjunto de issues cuyo path empieza por `localizaciones:{locId}.mapa`
 */
export function issuesMapaParaLocalizacion(issues, locId) {
  if (!Array.isArray(issues) || !locId) return []
  const prefijo = `localizaciones:${locId}.mapa`
  return issues.filter(i => typeof i?.path === 'string' && i.path.startsWith(prefijo))
}

const CAMPOS_REJILLA_MAPA = ['cols', 'rows', 'tile_w', 'tile_h', 'origen_px', 'pisable']

function redondearCoordPct(n) {
  return Math.round(n * 100) / 100
}

function mapaUsaRejilla(mapa) {
  if (!mapa || typeof mapa !== 'object') return false
  const cols = Number(mapa.cols)
  const rows = Number(mapa.rows)
  return Number.isFinite(cols) && cols > 0 && Number.isFinite(rows) && rows > 0
}

/**
 * Convierte celda de indice de rejilla a porcentaje (centro de celda), si aplica.
 * @param {unknown} celda
 * @param {number} cols
 * @param {number} rows
 * @param {{ inclusiveMax?: boolean }} opts — false = Lienzo (idx < cols); true = backend spawns
 */
function celdaRejillaAPorcentaje(celda, cols, rows, opts = {}) {
  const inclusiveMax = opts.inclusiveMax === true
  if (!Array.isArray(celda) || celda.length < 2) return celda
  const x = Number(celda[0])
  const y = Number(celda[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return celda

  const enRejillaX = inclusiveMax ? (x >= 0 && x <= cols) : (x >= 0 && x < cols)
  const enRejillaY = inclusiveMax ? (y >= 0 && y <= rows) : (y >= 0 && y < rows)
  if (!enRejillaX || !enRejillaY) {
    return [redondearCoordPct(x), redondearCoordPct(y)]
  }
  return [
    redondearCoordPct(((x + 0.5) / cols) * 100),
    redondearCoordPct(((y + 0.5) / rows) * 100),
  ]
}

function convertirCeldaEnObjeto(obj, cols, rows, opts) {
  if (!obj || typeof obj !== 'object' || !('celda' in obj)) return obj
  return { ...obj, celda: celdaRejillaAPorcentaje(obj.celda, cols, rows, opts) }
}

/**
 * @param {object} mapa
 * @returns {{ mapa: object, normalized: boolean }}
 */
export function normalizarMapaACoordenadasLibres(mapa) {
  if (!mapa || typeof mapa !== 'object' || !mapaUsaRejilla(mapa)) {
    return { mapa: mapa ? { ...mapa } : mapa, normalized: false }
  }

  const cols = Number(mapa.cols)
  const rows = Number(mapa.rows)
  const out = { ...mapa }

  if (Array.isArray(out.puntos_interes)) {
    out.puntos_interes = out.puntos_interes.map((p) => (
      p && typeof p === 'object'
        ? convertirCeldaEnObjeto(p, cols, rows, { inclusiveMax: false })
        : p
    ))
  }

  if (out.spawn_entrada && typeof out.spawn_entrada === 'object') {
    out.spawn_entrada = convertirCeldaEnObjeto(out.spawn_entrada, cols, rows, { inclusiveMax: true })
  }

  if (Array.isArray(out.spawns_npc)) {
    out.spawns_npc = out.spawns_npc.map((s) => (
      s && typeof s === 'object'
        ? convertirCeldaEnObjeto(s, cols, rows, { inclusiveMax: true })
        : s
    ))
  }

  if (Array.isArray(out.presencias_tacticas)) {
    out.presencias_tacticas = out.presencias_tacticas.map((p) => (
      p && typeof p === 'object'
        ? convertirCeldaEnObjeto(p, cols, rows, { inclusiveMax: true })
        : p
    ))
  }

  for (const k of CAMPOS_REJILLA_MAPA) {
    delete out[k]
  }

  return { mapa: out, normalized: true }
}

/**
 * @param {string} path
 * @returns {number|null}
 */
export function parseIndicePunto(path) {
  const m = /\.mapa\.puntos_interes\[(\d+)\]/.exec(String(path || ''))
  return m ? Number(m[1]) : null
}

/**
 * Crea un punto de interés nuevo con id único y defaults por tipo (F15b-B).
 * El id evita colisión con los existentes (el motor emite `MAPA_PI_ID_DUPLICADO`).
 * `celda` en porcentaje 0..100 (modo libre); por defecto el centro del lienzo.
 *
 * @param {'objeto_canonico'|'transicion'|'puerta_bloqueada'} tipo
 * @param {Array<{id?:string}>} puntosExistentes
 * @param {[number, number]} [celda]
 * @returns {object}
 */
export function nuevoPuntoInteres(tipo, puntosExistentes = [], celda = [50, 50]) {
  const ids = new Set((Array.isArray(puntosExistentes) ? puntosExistentes : []).map(p => String(p?.id || '')))
  let n = ids.size + 1
  let id = `pi_${n}`
  while (ids.has(id)) { n += 1; id = `pi_${n}` }
  const base = { id, tipo, celda: [celda[0], celda[1]] }
  if (tipo === 'objeto_canonico') {
    return { ...base, etiqueta_ui: '', icono: '', item_id: '', requiere_confirmacion: true }
  }
  if (tipo === 'transicion') {
    return { ...base, etiqueta_ui: '', icono: '', destino: '' }
  }
  if (tipo === 'puerta_bloqueada') {
    return {
      ...base,
      etiqueta_ui: '',
      dificultad: 12,
      requiere_objeto: 'ganzuas',
      transicion_al_exito: '',
      oculto: false,
    }
  }
  return base
}

/**
 * Localizaciones válidas como `destino` de una transición desde `loc` (F15b-B):
 * deben estar en `loc.conexiones` y tener `mapa.proyeccion ∈ {tactico, dimetrico_2_1}`.
 * Solo lectura del YAML en memoria; NO revalida la regla del motor.
 *
 * @param {object} loc
 * @param {object[]} localizaciones
 * @returns {string[]} ids de destino válidos
 */
export function destinosTransicionValidos(loc, localizaciones = []) {
  const conexiones = new Set(
    (Array.isArray(loc?.conexiones) ? loc.conexiones : [])
      .map(c => String(c || '').trim())
      .filter(Boolean),
  )
  const proyeccionesOk = new Set(['tactico', 'dimetrico_2_1'])
  return (Array.isArray(localizaciones) ? localizaciones : [])
    .filter(l => conexiones.has(String(l?.id || '').trim()))
    .filter(l => proyeccionesOk.has(String(l?.mapa?.proyeccion || '').trim()))
    .map(l => String(l.id).trim())
}

/**
 * Valida si el mapa de una localizacion esta listo para runtime (Owlbear style).
 *
 * @param {object} loc
 * @returns {{ estado: 'ok'|'warning'|'error', issues: Array<{ severity: 'ok'|'warning'|'error', code: string, message: string }> }}
 */
export function validarMapaRuntimeLocalizacion(loc) {
  const mapa = loc?.mapa
  const issues = []

  if (!mapa || typeof mapa !== 'object') {
    return { estado: 'error', issues: [{ severity: 'error', code: 'MAPA_SIN_MAPA', message: 'Error: falta mapa.' }] }
  }

  if (!String(mapa.imagen || '').trim()) {
    return { estado: 'error', issues: [{ severity: 'error', code: 'MAPA_SIN_IMAGEN', message: 'Error: falta imagen de fondo.' }] }
  }

  issues.push({ severity: 'ok', code: 'MAPA_IMAGEN_OK', message: 'OK: tablero de imagen asignado.' })

  return { estado: 'ok', issues }
}

export async function validarMapaRuntimeLocalizacionAsync(_slug, loc) {
  return validarMapaRuntimeLocalizacion(loc)
}

/** Resumen compacto para la cabecera del visor. */
export function resumenAventura(data) {
  const meta = data?.aventura
  if (!meta) return null
  return {
    nombre: meta.nombre ?? '(sin nombre)',
    autor: meta.autor ?? '',
    version: meta.version ?? '',
    idioma: meta.idioma_principal ?? '',
    escena_inicial: meta.escena_inicial ?? '',
    dificultad: meta.dificultad ?? '',
    duracion: meta.duracion_estimada ?? '',
    descripcion: meta.descripcion ?? '',
    counts: {
      localizaciones: asArray(data.localizaciones).length,
      npcs: asArray(data.npcs).length,
      bestiario: asArray(data.bestiario).length,
      escenas: asArray(data.escenas).length,
      finales: asArray(data.finales).length,
      eventos: asArray(data.eventos_definidos).length,
    },
  }
}

/**
 * Serializa el objeto data completo a YAML legible.
 * @param {object} data
 * @returns {string}
 */
export function aventuraToYaml(data) {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  })
}

/** Plantilla vacía para una aventura nueva. */
export function plantillaAventura() {
  return {
    aventura: {
      nombre: 'Mi aventura',
      version: 1,
      autor: '',
      idioma_principal: 'es',
      escena_inicial: 'escena_1',
      descripcion: '',
      duracion_estimada: '1-2 sesiones',
      dificultad: 'media',
    },
    mundo: {
      nombre: '',
      region: '',
      epoca: 'medieval fantástica',
      descripcion: '',
      ambiente: '',
    },
    localizaciones: [],
    npcs: [],
    bestiario: [],
    historia: {
      leyenda: '',
      presente: '',
    },
    finales: [],
    escenas: [
      {
        id: 'escena_1',
        nombre: 'Inicio',
        acto: 1,
        objetivo: '',
        intencion_dm_default: { tension: 'bajo', tono: '', ritmo: 'pausado', restricciones: [] },
        ubicaciones_activas: [],
        npcs_activos: [],
        info_visible: {},
        info_oculta: [],
        condiciones_avance: [],
      },
    ],
    eventos_definidos: [],
  }
}

/**
 * Descarga un string como fichero en el navegador.
 * @param {string} contenido
 * @param {string} nombreArchivo
 */
export function descargarArchivo(contenido, nombreArchivo) {
  const blob = new Blob([contenido], { type: 'text/yaml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Valida la coherencia interna de una aventura.
 * @param {object} data - objeto raíz del YAML
 * @returns {{ errores: string[], avisos: string[] }}
 */
export function validarAventura(data) {
  const errores = []
  const avisos = []
  if (!data) { errores.push('No hay datos cargados.'); return { errores, avisos } }

  const meta = data.aventura
  if (!meta) errores.push('Falta el bloque «aventura» (metadatos).')
  else if (!meta.nombre?.trim()) errores.push('El nombre de la aventura está vacío.')

  const checkIds = (arr, label) => {
    const seen = new Set()
    for (const item of arr) {
      if (!item.id?.trim()) errores.push(`${label}: hay una entrada sin ID.`)
      else if (seen.has(item.id)) errores.push(`${label}: ID duplicado «${item.id}».`)
      else seen.add(item.id)
    }
    return seen
  }

  const locIds = checkIds(asArray(data.localizaciones), 'Localizaciones')
  const npcIds = checkIds(asArray(data.npcs), 'NPCs')
  const bestiaIds = checkIds(asArray(data.bestiario), 'Bestiario')
  const assetTacticoIds = checkIds(asArray(data.assets_tacticos), 'Assets tácticos')
  const finalIds = checkIds(asArray(data.finales), 'Finales')
  const eventoIds = checkIds(asArray(data.eventos_definidos), 'Eventos definidos')
  const allCharIds = new Set([...npcIds, ...bestiaIds])

  const escenas = asArray(data.escenas)
  const escenaIds = checkIds(escenas, 'Escenas')

  if (meta?.escena_inicial && !escenaIds.has(meta.escena_inicial)) {
    errores.push(`La escena inicial «${meta.escena_inicial}» no existe en la lista de escenas.`)
  }

  const mapaMundo = meta?.mapa_mundo
  if (mapaMundo != null) {
    if (typeof mapaMundo !== 'object' || Array.isArray(mapaMundo)) {
      errores.push('El bloque «aventura.mapa_mundo» debe ser un objeto.')
    } else {
      if (!String(mapaMundo.imagen || '').trim()) {
        errores.push('Mapa mundo: falta «imagen».')
      }
      for (const campo of ['ancho', 'alto']) {
        if (
          mapaMundo[campo] != null &&
          (!Number.isInteger(mapaMundo[campo]) || mapaMundo[campo] <= 0)
        ) {
          errores.push(`Mapa mundo: «${campo}» debe ser un entero positivo.`)
        }
      }
      const posiciones = mapaMundo.posiciones_localizaciones
      if (posiciones != null) {
        if (typeof posiciones !== 'object' || Array.isArray(posiciones)) {
          errores.push('Mapa mundo: «posiciones_localizaciones» debe ser un objeto.')
        } else {
          for (const [locId, pos] of Object.entries(posiciones)) {
            if (!locIds.has(locId)) {
              errores.push(`Mapa mundo: localización «${locId}» no existe.`)
            }
            if (
              !pos ||
              typeof pos !== 'object' ||
              Array.isArray(pos) ||
              !Number.isInteger(pos.x) ||
              !Number.isInteger(pos.y) ||
              pos.x < 0 ||
              pos.y < 0
            ) {
              errores.push(`Mapa mundo: posición inválida para «${locId}».`)
            }
          }
        }
      }
    }
  }

  const categoriasAssets = new Set(['suelos', 'paredes', 'puertas', 'escaleras', 'muebles', 'props', 'decoracion'])
  for (const asset of asArray(data.assets_tacticos)) {
    const tag = `Asset táctico «${asset?.id || '?'}»`
    if (!categoriasAssets.has(asset?.categoria)) {
      errores.push(`${tag}: categoría inválida.`)
    }
    if (!String(asset?.imagen || '').startsWith('assets/tacticos/')) {
      errores.push(`${tag}: imagen debe estar bajo assets/tacticos/.`)
    }
    if (!esListaParesEnteros(asset?.ocupa)) {
      errores.push(`${tag}: ocupa debe ser una lista de pares enteros.`)
    }
    if (
      asset?.offset_px != null
      && (!Array.isArray(asset.offset_px) || asset.offset_px.length !== 2 || !asset.offset_px.every(Number.isInteger))
    ) {
      errores.push(`${tag}: offset_px debe ser [x, y].`)
    }
    if (asset?.escala_visual != null) {
      const escala = Number(asset.escala_visual)
      if (!Number.isFinite(escala) || escala <= 0 || escala > 5) {
        errores.push(`${tag}: escala_visual debe estar entre 0.1 y 5.`)
      }
    }
  }

  // Referencias cruzadas por escena
  for (const esc of escenas) {
    const tag = `Escena «${esc.id || '?'}»`

    // Ubicaciones activas → deben existir en localizaciones
    for (const u of asArray(esc.ubicaciones_activas)) {
      if (!locIds.has(u)) avisos.push(`${tag}: ubicación activa «${u}» no está en Localizaciones.`)
    }

    // NPCs activos → deben existir en NPCs o bestiario
    for (const n of asArray(esc.npcs_activos)) {
      if (!allCharIds.has(n)) avisos.push(`${tag}: NPC activo «${n}» no está en NPCs ni en Bestiario.`)
    }

    // Condiciones de avance → destinos deben existir
    for (const ca of asArray(esc.condiciones_avance)) {
      if (ca.destino && !escenaIds.has(ca.destino)) {
        errores.push(`${tag}: condición de avance apunta a escena «${ca.destino}» que no existe.`)
      }
      validarReglasRefs(asArray(ca.reglas), tag + ' (avance)', eventoIds, npcIds, locIds, avisos)
    }

    // Condiciones de final → finales deben existir
    for (const cf of asArray(esc.condiciones_final)) {
      if (cf.final && !finalIds.has(cf.final)) {
        avisos.push(`${tag}: condición de final referencia «${cf.final}» que no está en Finales.`)
      }
      validarReglasRefs(asArray(cf.reglas), tag + ' (final)', eventoIds, npcIds, locIds, avisos)
    }

    // Eventos opcionales → sus IDs deberían estar en eventos_definidos
    for (const ev of asArray(esc.eventos_opcionales)) {
      if (ev.id && !eventoIds.has(ev.id)) {
        avisos.push(`${tag}: evento opcional «${ev.id}» no está en Eventos definidos.`)
      }
    }

    const media = esc?.media
    if (media != null && (typeof media !== 'object' || Array.isArray(media))) {
      errores.push(`${tag}: «media» debe ser un objeto.`)
    } else if (media) {
      const validarVideo = (bloque) => {
        const v = media[bloque]
        if (v == null) return
        if (typeof v !== 'object' || Array.isArray(v)) {
          errores.push(`${tag}: «media.${bloque}» debe ser un objeto.`)
          return
        }
        if (!String(v.src || '').trim()) {
          errores.push(`${tag}: «media.${bloque}.src» es obligatorio.`)
        } else if (!esRutaMediaValida(v.src, new Set(['mp4', 'webm']))) {
          errores.push(`${tag}: «media.${bloque}.src» debe ser ruta relativa de video (.mp4/.webm).`)
        }
        if (v.poster != null && String(v.poster).trim()) {
          if (!esRutaMediaValida(v.poster, new Set(['png', 'jpg', 'jpeg', 'webp']))) {
            errores.push(`${tag}: «media.${bloque}.poster» debe ser ruta relativa de imagen (.png/.jpg/.jpeg/.webp).`)
          }
        }
        if (v.max_ms != null) {
          const t = normalizarNumero(v.max_ms)
          if (t == null || t < 1000 || t > 180000) {
            errores.push(`${tag}: «media.${bloque}.max_ms» debe estar entre 1000 y 180000.`)
          }
        }
        if (v.skippable != null && typeof v.skippable !== 'boolean') {
          errores.push(`${tag}: «media.${bloque}.skippable» debe ser booleano.`)
        }
      }
      validarVideo('intro_video')
      validarVideo('outro_video')
    }

    if (!esc.nombre?.trim()) avisos.push(`${tag}: no tiene nombre.`)
    if (!esc.objetivo?.trim()) avisos.push(`${tag}: no tiene objetivo definido.`)
  }

  // Eventos definidos sin uso en ninguna escena
  if (eventoIds.size > 0) {
    const eventosUsados = new Set()
    for (const esc of escenas) {
      for (const ev of asArray(esc.eventos_opcionales)) if (ev.id) eventosUsados.add(ev.id)
      for (const ca of asArray(esc.condiciones_avance))
        for (const r of asArray(ca.reglas)) if (r.tipo === 'evento' && r.evento) eventosUsados.add(r.evento)
      for (const cf of asArray(esc.condiciones_final))
        for (const r of asArray(cf.reglas)) if (r.tipo === 'evento' && r.evento) eventosUsados.add(r.evento)
    }
    for (const id of eventoIds) {
      if (!eventosUsados.has(id)) avisos.push(`Evento definido «${id}» no se usa en ninguna escena.`)
    }
  }

  // NPCs y localizaciones sin uso en escenas
  if (escenas.length > 0) {
    const npcsUsados = new Set()
    const locsUsadas = new Set()
    for (const esc of escenas) {
      for (const n of asArray(esc.npcs_activos)) npcsUsados.add(n)
      for (const u of asArray(esc.ubicaciones_activas)) locsUsadas.add(u)
    }
    for (const id of npcIds) {
      if (!npcsUsados.has(id)) avisos.push(`NPC «${id}» no aparece como activo en ninguna escena.`)
    }
    for (const id of locIds) {
      if (!locsUsadas.has(id)) avisos.push(`Localización «${id}» no aparece como activa en ninguna escena.`)
    }
  }

  if (!escenas.length) avisos.push('La aventura no tiene escenas.')
  if (!asArray(data.localizaciones).length) avisos.push('No hay localizaciones definidas.')
  for (const loc of asArray(data.localizaciones)) {
    const tagLoc = `Localización «${loc?.id || '?'}»`
    const amb = loc?.ambiente
    if (amb != null && (typeof amb !== 'object' || Array.isArray(amb))) {
      errores.push(`${tagLoc}: «ambiente» debe ser un objeto.`)
    }
    const audio = amb?.audio
    if (audio != null) {
      if (typeof audio !== 'object' || Array.isArray(audio)) {
        errores.push(`${tagLoc}: «ambiente.audio» debe ser un objeto.`)
      } else {
        if (!String(audio.src || '').trim()) {
          errores.push(`${tagLoc}: «ambiente.audio.src» es obligatorio cuando hay audio.`)
        } else if (!esRutaMediaValida(audio.src, new Set(['mp3', 'ogg', 'wav', 'm4a']))) {
          errores.push(`${tagLoc}: «ambiente.audio.src» debe ser ruta relativa de audio (.mp3/.ogg/.wav/.m4a).`)
        }
        if (audio.volumen != null) {
          const vol = normalizarNumero(audio.volumen)
          if (vol == null || vol < 0 || vol > 1) {
            errores.push(`${tagLoc}: «ambiente.audio.volumen» debe estar entre 0 y 1.`)
          }
        }
        if (audio.fade_ms != null) {
          const fade = normalizarNumero(audio.fade_ms)
          if (fade == null || fade < 0 || fade > 10000) {
            errores.push(`${tagLoc}: «ambiente.audio.fade_ms» debe estar entre 0 y 10000.`)
          }
        }
        if (audio.loop != null && typeof audio.loop !== 'boolean') {
          errores.push(`${tagLoc}: «ambiente.audio.loop» debe ser booleano.`)
        }
      }
    }
    const sfx = amb?.sfx
    if (sfx != null) {
      if (!Array.isArray(sfx)) {
        errores.push(`${tagLoc}: «ambiente.sfx» debe ser una lista.`)
      } else {
        sfx.forEach((fx, idx) => {
          const tagFx = `${tagLoc}: ambiente.sfx[${idx}]`
          if (!fx || typeof fx !== 'object' || Array.isArray(fx)) {
            errores.push(`${tagFx} debe ser un objeto.`)
            return
          }
          if (!String(fx.src || '').trim()) {
            errores.push(`${tagFx}.src es obligatorio.`)
          } else if (!esRutaMediaValida(fx.src, new Set(['mp3', 'ogg', 'wav', 'm4a']))) {
            errores.push(`${tagFx}.src debe ser ruta relativa de audio (.mp3/.ogg/.wav/.m4a).`)
          }
          if (fx.volumen != null) {
            const vol = normalizarNumero(fx.volumen)
            if (vol == null || vol < 0 || vol > 1) {
              errores.push(`${tagFx}.volumen debe estar entre 0 y 1.`)
            }
          }
          if (fx.loop != null && typeof fx.loop !== 'boolean') {
            errores.push(`${tagFx}.loop debe ser booleano.`)
          }
        })
      }
    }

    const objetos = asArray(loc?.mapa?.objetos_tacticos)
    for (const obj of objetos) {
      if (obj?.asset_id && !assetTacticoIds.has(obj.asset_id)) {
        errores.push(`Localización «${loc?.id || '?'}»: objeto táctico referencia asset inexistente «${obj.asset_id}».`)
      }
      if (obj?.tipo_interaccion === 'transicion') {
        if (!obj.destino) {
          errores.push(`Localización «${loc?.id || '?'}»: objeto táctico «${obj?.id || '?'}» es transición pero no tiene destino.`)
        } else if (!locIds.has(obj.destino)) {
          errores.push(`Localización «${loc?.id || '?'}»: objeto táctico «${obj?.id || '?'}» apunta a destino inexistente «${obj.destino}».`)
        }
      }
      if (obj?.escala_visual != null) {
        const escala = Number(obj.escala_visual)
        if (!Number.isFinite(escala) || escala <= 0 || escala > 5) {
          errores.push(`Localización «${loc?.id || '?'}»: objeto táctico «${obj?.id || '?'}» tiene escala_visual inválida.`)
        }
      }
    }
  }

  return { errores, avisos }
}

function validarReglasRefs(reglas, context, eventoIds, npcIds, locIds, avisos) {
  for (const r of reglas) {
    if (r.tipo === 'evento' && r.evento && !eventoIds.has(r.evento)) {
      avisos.push(`${context}: regla referencia evento «${r.evento}» no definido en Eventos.`)
    }
    if ((r.tipo === 'npc_conocido' || r.tipo === 'actitud_npc') && r.npc && !npcIds.has(r.npc)) {
      avisos.push(`${context}: regla referencia NPC «${r.npc}» no definido.`)
    }
    if (r.tipo === 'ubicacion_visitada' && r.lugar && !locIds.has(r.lugar)) {
      avisos.push(`${context}: regla referencia ubicación «${r.lugar}» no definida.`)
    }
  }
}
