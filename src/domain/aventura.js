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

function esEnteroPositivo(v) {
  return Number.isInteger(v) && v > 0
}

function esCelda(v) {
  return Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)
}

function parsePisables(pisable, cols, rows) {
  if (typeof pisable !== 'string') return { ok: false, filas: null }
  const filas = pisable.split(/\r?\n/)
  while (filas[0]?.trim() === '') filas.shift()
  while (filas[filas.length - 1]?.trim() === '') filas.pop()
  const ok = filas.length === rows && filas.every(f => f.length === cols && /^[#.]+$/.test(f))
  return { ok, filas: ok ? filas : null }
}

function celdaDentro(celda, cols, rows) {
  return esCelda(celda) && celda[0] >= 0 && celda[1] >= 0 && celda[0] < cols && celda[1] < rows
}

function esListaParesEnteros(v) {
  return Array.isArray(v)
    && v.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger))
}

function localizacionTieneMapaTacticoListo(loc, localizaciones) {
  return validarMapaRuntimeLocalizacion(loc, localizaciones, { validarDestinoListo: false }).estado !== 'error'
}

/**
 * Valida si el mapa tactico de una localizacion esta listo para runtime.
 *
 * @param {object} loc
 * @param {object[]} localizaciones
 * @param {{ validarDestinoListo?: boolean, npcs?: object[], bestiario?: object[] }} opts
 * @returns {{ estado: 'ok'|'warning'|'error', issues: Array<{ severity: 'ok'|'warning'|'error', code: string, message: string }> }}
 */
export function validarMapaRuntimeLocalizacion(loc, localizaciones = [], opts = {}) {
  const validarDestinoListo = opts.validarDestinoListo !== false
  const npcs = asArray(opts.npcs)
  const bestiario = asArray(opts.bestiario)
  const mapa = loc?.mapa
  const issues = []
  const add = (severity, code, message) => issues.push({ severity, code, message })

  if (!mapa || typeof mapa !== 'object') {
    return { estado: 'error', issues: [{ severity: 'error', code: 'MAPA_SIN_MAPA', message: 'Error: falta mapa.' }] }
  }

  const esPiezas = mapa.modo_render === 'piezas'
  if (!String(mapa.imagen || '').trim()) {
    if (esPiezas) {
      add('ok', 'MAPA_RENDER_PIEZAS_OK', 'OK: mapa por piezas sin imagen de fondo.')
    } else {
      add('error', 'MAPA_SIN_IMAGEN', 'Error: falta imagen.')
    }
  } else {
    add('ok', 'MAPA_IMAGEN_OK', 'OK: imagen asignada')
  }

  if (esPiezas && !String(mapa.imagen || '').trim() && !String(mapa.suelo_default || '').trim()) {
    add('warning', 'MAPA_SUELO_DEFAULT_FALTANTE', 'Aviso fuerte: mapa por piezas sin imagen necesita suelo_default.')
  }

  if (mapa.proyeccion !== 'dimetrico_2_1') {
    add('error', 'MAPA_SIN_PROYECCION_TACTICA', 'Error: proyección táctica ausente o inválida.')
  } else {
    add('ok', 'MAPA_PROYECCION_OK', 'OK: proyección táctica')
  }

  const calibracionOk =
    esEnteroPositivo(mapa.tile_w)
    && esEnteroPositivo(mapa.tile_h)
    && esEnteroPositivo(mapa.cols)
    && esEnteroPositivo(mapa.rows)
    && Array.isArray(mapa.origen_px)
    && mapa.origen_px.length === 2
    && mapa.origen_px.every(Number.isInteger)
  if (!calibracionOk) {
    add('error', 'MAPA_CALIBRACION_INCOMPLETA', 'Error: calibración incompleta.')
  } else {
    add('ok', 'MAPA_CALIBRACION_OK', `OK: calibración ${mapa.cols}x${mapa.rows}`)
  }

  const cols = mapa.cols
  const rows = mapa.rows
  const pisable = calibracionOk ? parsePisables(mapa.pisable, cols, rows) : { ok: false, filas: null }
  if (!mapa.pisable) {
    add('warning', 'MAPA_PISABLE_FALTANTE', 'Aviso: falta walkmask/pisable.')
  } else if (!pisable.ok) {
    add('error', 'MAPA_PISABLE_INVALIDO', 'Error: walkmask/pisable inválida.')
  } else {
    add('ok', 'MAPA_PISABLE_OK', `OK: walkmask ${cols}x${rows}`)
  }

  const spawn = mapa.spawn_entrada
  const spawnCelda = spawn?.celda
  if (!spawn || !esCelda(spawnCelda)) {
    add('error', 'MAPA_SPAWN_FALTANTE', 'Error: falta spawn_entrada.')
  } else if (calibracionOk && !celdaDentro(spawnCelda, cols, rows)) {
    add('error', 'MAPA_SPAWN_FUERA', 'Error: spawn_entrada fuera del tablero.')
  } else if (pisable.ok && pisable.filas?.[spawnCelda[1]]?.[spawnCelda[0]] === '.') {
    add('warning', 'MAPA_SPAWN_BLOQUEADO', 'Aviso: spawn_entrada cae sobre celda bloqueada.')
  } else {
    add('ok', 'MAPA_SPAWN_OK', `OK: spawn entrada [${spawnCelda.join(', ')}]`)
  }

  const locIds = new Set(localizaciones.map(l => l?.id).filter(Boolean))
  const locPorId = new Map(localizaciones.map(l => [l?.id, l]).filter(([id]) => id))
  const conexiones = new Set(Array.isArray(loc?.conexiones) ? loc.conexiones : [])
  const transiciones = Array.isArray(mapa.puntos_interes)
    ? mapa.puntos_interes.filter(p => p?.tipo === 'transicion')
    : []
  const ids = new Set()
  for (const [idx, punto] of transiciones.entries()) {
    const label = punto?.id || `transición ${idx + 1}`
    if (!String(punto?.id || '').trim()) add('error', 'MAPA_TRANSICION_ID_FALTANTE', 'Error: transición sin ID.')
    else if (ids.has(punto.id)) add('error', 'MAPA_TRANSICION_ID_DUPLICADO', `Error: transición duplicada «${punto.id}».`)
    else ids.add(punto.id)

    if (!celdaDentro(punto?.celda, cols, rows)) {
      add('error', 'MAPA_TRANSICION_CELDA_INVALIDA', `Error: ${label} tiene celda inválida.`)
    } else if (pisable.ok && pisable.filas?.[punto.celda[1]]?.[punto.celda[0]] === '.') {
      add('warning', 'MAPA_TRANSICION_CELDA_BLOQUEADA', `Aviso: ${label} cae sobre celda bloqueada.`)
    }

    if (!locIds.has(punto?.destino)) {
      add('error', 'MAPA_TRANSICION_DESTINO_INVALIDO', `Error: ${label} apunta a destino inexistente.`)
    } else {
      if (!conexiones.has(punto.destino)) {
        add('error', 'MAPA_TRANSICION_DESTINO_NO_CONECTADO', `Error: ${label} apunta a destino no conectado.`)
      }
      const destino = locPorId.get(punto.destino)
      if (!destino?.mapa?.imagen) {
        add('error', 'MAPA_TRANSICION_DESTINO_NO_LISTO', `Error: ${label} apunta a destino sin mapa táctico.`)
      } else if (validarDestinoListo && !localizacionTieneMapaTacticoListo(destino, localizaciones)) {
        add('warning', 'MAPA_TRANSICION_DESTINO_NO_LISTO', `Aviso: ${label} apunta a destino con mapa incompleto.`)
      }
    }
  }
  if (transiciones.length === 0) add('ok', 'MAPA_TRANSICIONES_OK', 'OK: sin transiciones declaradas')

  const npcsPorId = new Map(npcs.map(n => [n?.id, n]).filter(([id]) => id))
  const spawnsNpc = Array.isArray(mapa.spawns_npc) ? mapa.spawns_npc : []
  const idsSpawnNpc = new Set()
  for (const [idx, spawnNpc] of spawnsNpc.entries()) {
    const label = spawnNpc?.npc_id || `spawn NPC ${idx + 1}`
    if (!spawnNpc || typeof spawnNpc !== 'object') {
      add('error', 'MAPA_SPAWN_NPC_INVALIDO', 'Error: spawn de NPC inválido.')
      continue
    }
    if (!String(spawnNpc.npc_id || '').trim()) {
      add('error', 'MAPA_SPAWN_NPC_ID_FALTANTE', 'Error: spawn de NPC sin npc_id.')
    } else if (npcs.length && !npcsPorId.has(spawnNpc.npc_id)) {
      add('error', 'MAPA_SPAWN_NPC_ID_INVALIDO', `Error: ${label} no existe en NPCs.`)
    } else if (idsSpawnNpc.has(spawnNpc.npc_id)) {
      add('error', 'MAPA_SPAWN_NPC_DUPLICADO', `Error: ${label} tiene spawn duplicado.`)
    } else {
      idsSpawnNpc.add(spawnNpc.npc_id)
    }
    const npc = npcsPorId.get(spawnNpc.npc_id)
    if (npc?.ubicacion && loc?.id && npc.ubicacion !== loc.id) {
      add('error', 'MAPA_SPAWN_NPC_UBICACION', `Error: ${label} pertenece a «${npc.ubicacion}».`)
    }
    if (!celdaDentro(spawnNpc.celda, cols, rows)) {
      add('error', 'MAPA_SPAWN_NPC_CELDA_INVALIDA', `Error: ${label} tiene celda inválida.`)
    } else if (pisable.ok && pisable.filas?.[spawnNpc.celda[1]]?.[spawnNpc.celda[0]] === '.') {
      add('warning', 'MAPA_SPAWN_NPC_BLOQUEADO', `Aviso: ${label} cae sobre celda bloqueada.`)
    }
  }

  const npcsDeLoc = npcs.filter(n => n?.ubicacion === loc?.id)
  const comerciantesSinSpawn = npcsDeLoc.filter(n => Array.isArray(n?.vende) && n.vende.length && !idsSpawnNpc.has(n.id))
  for (const npc of comerciantesSinSpawn) {
    add('warning', 'MAPA_NPC_COMERCIANTE_SIN_SPAWN', `Aviso: ${npc.nombre || npc.id} tiene vende pero no tiene spawn en este mapa.`)
  }

  const bestiarioPorId = new Map(bestiario.map(b => [b?.id, b]).filter(([id]) => id))
  const presencias = Array.isArray(mapa.presencias_tacticas) ? mapa.presencias_tacticas : []
  const idsPresencias = new Set()
  for (const [idx, presencia] of presencias.entries()) {
    const label = presencia?.id || `presencia ${idx + 1}`
    if (!presencia || typeof presencia !== 'object') {
      add('error', 'MAPA_PRESENCIA_INVALIDA', 'Error: presencia táctica inválida.')
      continue
    }
    if (!String(presencia.id || '').trim()) {
      add('error', 'MAPA_PRESENCIA_ID_FALTANTE', 'Error: presencia táctica sin ID.')
    } else if (idsPresencias.has(presencia.id)) {
      add('error', 'MAPA_PRESENCIA_ID_DUPLICADO', `Error: presencia duplicada «${presencia.id}».`)
    } else {
      idsPresencias.add(presencia.id)
    }
    if (presencia.tipo !== 'bestiario') {
      add('error', 'MAPA_PRESENCIA_TIPO_INVALIDO', `Error: ${label} debe ser de tipo bestiario.`)
    }
    if (!String(presencia.ref || '').trim()) {
      add('error', 'MAPA_PRESENCIA_REF_FALTANTE', `Error: ${label} no tiene ref.`)
    } else if (bestiario.length && !bestiarioPorId.has(presencia.ref)) {
      add('error', 'MAPA_PRESENCIA_REF_INVALIDA', `Error: ${label} referencia bestiario inexistente.`)
    }
    const bestia = bestiarioPorId.get(presencia.ref)
    if (bestia?.ubicacion && loc?.id && bestia.ubicacion !== loc.id) {
      add('error', 'MAPA_PRESENCIA_UBICACION', `Error: ${label} pertenece a «${bestia.ubicacion}».`)
    }
    const cantidad = presencia.cantidad ?? 1
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 99) {
      add('error', 'MAPA_PRESENCIA_CANTIDAD_INVALIDA', `Error: ${label} tiene cantidad inválida.`)
    }
    if ('visible' in presencia && typeof presencia.visible !== 'boolean') {
      add('error', 'MAPA_PRESENCIA_VISIBLE_INVALIDO', `Error: ${label} tiene visible inválido.`)
    }
    if (!celdaDentro(presencia.celda, cols, rows)) {
      add('error', 'MAPA_PRESENCIA_CELDA_INVALIDA', `Error: ${label} tiene celda inválida.`)
    } else if (pisable.ok && pisable.filas?.[presencia.celda[1]]?.[presencia.celda[0]] === '.') {
      add('warning', 'MAPA_PRESENCIA_BLOQUEADA', `Aviso: ${label} cae sobre celda bloqueada.`)
    }
  }

  const tieneErrores = issues.some(i => i.severity === 'error')
  const tieneWarnings = issues.some(i => i.severity === 'warning')
  return { estado: tieneErrores ? 'error' : tieneWarnings ? 'warning' : 'ok', issues }
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
