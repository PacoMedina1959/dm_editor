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

  checkIds(asArray(data.localizaciones), 'Localizaciones')
  checkIds(asArray(data.npcs), 'NPCs')
  checkIds(asArray(data.bestiario), 'Bestiario')
  checkIds(asArray(data.finales), 'Finales')
  checkIds(asArray(data.eventos_definidos), 'Eventos definidos')

  const escenas = asArray(data.escenas)
  const escenaIds = checkIds(escenas, 'Escenas')

  if (meta?.escena_inicial && !escenaIds.has(meta.escena_inicial)) {
    errores.push(`La escena inicial «${meta.escena_inicial}» no existe en la lista de escenas.`)
  }

  const finalIds = new Set(asArray(data.finales).map(f => f.id).filter(Boolean))

  for (const esc of escenas) {
    for (const ca of asArray(esc.condiciones_avance)) {
      if (ca.destino && !escenaIds.has(ca.destino)) {
        errores.push(`Escena «${esc.id}»: condición de avance apunta a escena «${ca.destino}» que no existe.`)
      }
    }
    for (const cf of asArray(esc.condiciones_final)) {
      if (cf.final && !finalIds.has(cf.final)) {
        avisos.push(`Escena «${esc.id}»: condición de final referencia «${cf.final}» que no está en Finales.`)
      }
    }
    if (!esc.nombre?.trim()) avisos.push(`Escena «${esc.id || '?'}»: no tiene nombre.`)
    if (!esc.objetivo?.trim()) avisos.push(`Escena «${esc.id || '?'}»: no tiene objetivo definido.`)
  }

  if (!escenas.length) avisos.push('La aventura no tiene escenas.')
  if (!asArray(data.localizaciones).length) avisos.push('No hay localizaciones definidas.')

  return { errores, avisos }
}
