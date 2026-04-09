/**
 * Preview de escena: muestra el contexto exacto que recibiría la IA,
 * replicando la lógica de GestorEscenas.construir_contexto_llm().
 */

function lookupMap(arr) {
  const m = {}
  if (!Array.isArray(arr)) return m
  for (const item of arr) if (item?.id) m[item.id] = item
  return m
}

function buildContext(escena, aventura) {
  const lines = []
  const mundo = aventura?.mundo || {}
  const locsMap = lookupMap(aventura?.localizaciones)
  const npcsMap = lookupMap(aventura?.npcs)
  const bestMap = lookupMap(aventura?.bestiario)
  const historia = aventura?.historia || {}
  const eventosMap = lookupMap(aventura?.eventos_definidos)
  const info = escena.info_visible || {}
  const intencion = escena.intencion_dm || {}

  lines.push(`[Escena actual: ${escena.nombre}]`)

  if (intencion || escena.objetivo) {
    lines.push(`Objetivo de la escena: ${escena.objetivo || '(sin definir)'}`)
    lines.push(
      `Tensión: ${intencion.tension || '?'} | ` +
      `Tono: ${intencion.tono || '?'} | ` +
      `Ritmo: ${intencion.ritmo || '?'}`
    )
    const restricciones = intencion.restricciones || []
    if (restricciones.length) {
      lines.push('RESTRICCIONES:')
      restricciones.forEach(r => lines.push(`  - ${r}`))
    }
  }

  if (info.mundo === 'completo' && mundo.nombre) {
    lines.push('')
    lines.push(`[Mundo: ${mundo.nombre}]`)
    if (mundo.descripcion) lines.push(mundo.descripcion)
    if (mundo.ambiente) lines.push(`Ambiente: ${mundo.ambiente}`)
  }

  let locsVisibles = info.localizaciones || []
  if (locsVisibles === 'completo') locsVisibles = Object.keys(locsMap)
  if (Array.isArray(locsVisibles) && locsVisibles.length) {
    lines.push('')
    lines.push('[Localizaciones accesibles]')
    for (const locId of locsVisibles) {
      const loc = locsMap[locId]
      if (loc) lines.push(`- ${loc.nombre}: ${loc.descripcion || ''}`)
    }
  }

  let npcsVisibles = info.npcs || {}
  if (npcsVisibles === 'completo') {
    npcsVisibles = {}
    Object.keys(npcsMap).forEach(k => { npcsVisibles[k] = 'completo' })
  }
  if (typeof npcsVisibles === 'object' && !Array.isArray(npcsVisibles) && Object.keys(npcsVisibles).length) {
    lines.push('')
    lines.push('[NPCs en esta escena]')
    for (const [npcId, nivel] of Object.entries(npcsVisibles)) {
      const npc = npcsMap[npcId]
      if (!npc) continue
      lines.push(`- ${npc.nombre} (${npc.ubicacion || '?'}): ${npc.descripcion || ''}`)
      lines.push(`  Actitud: ${npc.actitud_inicial || 'neutral'} | Motivación: ${npc.motivacion || '?'}`)
      lines.push(`  Frase: "${npc.frase || ''}"`)
      if (nivel === 'completo' && npc.secretos?.length) {
        lines.push(`  [Secretos DM]: ${npc.secretos.join('; ')}`)
      }
    }
  }

  const histVisible = info.historia
  if (histVisible) {
    if (histVisible === 'completo') {
      for (const [clave, texto] of Object.entries(historia)) {
        lines.push('')
        lines.push(`[Historia — ${clave}]`)
        lines.push(texto)
      }
    } else if (Array.isArray(histVisible)) {
      for (const clave of histVisible) {
        if (historia[clave]) {
          lines.push('')
          lines.push(`[Historia — ${clave}]`)
          lines.push(historia[clave])
        }
      }
    }
  }

  let bestVisible = info.bestiario
  if (bestVisible) {
    if (bestVisible === 'completo') bestVisible = Object.keys(bestMap)
    if (Array.isArray(bestVisible) && bestVisible.length) {
      lines.push('')
      lines.push('[Criaturas conocidas]')
      for (const bId of bestVisible) {
        const b = bestMap[bId]
        if (!b) continue
        lines.push(`- ${b.nombre} (${b.peligro || '?'}): ${b.aspecto || ''}`)
        lines.push(`  Comportamiento: ${b.comportamiento || ''}`)
        lines.push(`  Debilidad: ${b.debilidad || ''}`)
      }
    }
  }

  const evOpc = escena.eventos_opcionales || []
  if (evOpc.length) {
    lines.push('')
    lines.push('[Eventos que pueden ocurrir en esta escena]')
    for (const ev of evOpc) {
      lines.push(`- ${ev.descripcion || ev.id || '?'} (probabilidad: ${ev.probabilidad || '?'})`)
    }
  }

  if (Object.keys(eventosMap).length) {
    lines.push('')
    lines.push('[Eventos válidos para eventos_disparados]')
    lines.push('Usa SOLO estos ids en el campo eventos_disparados:')
    for (const e of Object.values(eventosMap)) {
      lines.push(`  - ${e.id}: ${e.descripcion || ''}`)
    }
  }

  const oculta = escena.info_oculta || []
  if (oculta.length) {
    lines.push('')
    lines.push('[Info oculta — solo DM]')
    oculta.forEach(h => lines.push(`  - ${h}`))
  }

  const avance = escena.condiciones_avance || []
  if (avance.length) {
    lines.push('')
    lines.push('[Condiciones de avance]')
    avance.forEach(c => {
      lines.push(`→ ${c.descripcion || '?'} → destino: ${c.destino || '?'}`)
    })
  }

  const final_ = escena.condiciones_final || []
  if (final_.length) {
    lines.push('')
    lines.push('[Condiciones de final]')
    final_.forEach(c => {
      lines.push(`⭐ ${c.descripcion || '?'} → final: ${c.final || '?'}`)
    })
  }

  return lines.join('\n')
}

export default function PreviewEscena({ escena, data, onClose }) {
  if (!escena) return null
  const ctx = buildContext(escena, data)

  return (
    <div className="av-preview-overlay" onClick={onClose}>
      <div className="av-preview" onClick={e => e.stopPropagation()}>
        <div className="av-preview-header">
          <h3>Preview IA — {escena.nombre}</h3>
          <span className="av-preview-hint">Esto es lo que recibe la IA como contexto</span>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>
        <pre className="av-preview-body">{ctx}</pre>
        <div className="av-preview-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { navigator.clipboard.writeText(ctx) }}
          >
            Copiar al portapapeles
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
