/**
 * Diagrama visual del flujo de escenas agrupado por actos.
 * Muestra las conexiones de avance y final entre escenas.
 */
export default function MapaEscenas({ escenas, finales }) {
  if (!escenas?.length) return null

  const actos = {}
  for (const e of escenas) {
    const a = e.acto ?? '?'
    if (!actos[a]) actos[a] = []
    actos[a].push(e)
  }

  const escenaIds = new Set(escenas.map(e => e.id))
  const finalIds = new Set((finales || []).map(f => f.id))

  const actKeys = Object.keys(actos).sort((a, b) => {
    const na = Number(a), nb = Number(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return String(a).localeCompare(String(b))
  })

  return (
    <div className="av-mapa">
      <h3 className="av-mapa-title">Flujo de escenas</h3>
      <div className="av-mapa-grid" style={{ gridTemplateColumns: `repeat(${actKeys.length}, 1fr)` }}>
        {actKeys.map(acto => (
          <div key={acto} className="av-mapa-col">
            <div className="av-mapa-acto-label">Acto {acto}</div>
            {actos[acto].map(esc => (
              <EscenaNode
                key={esc.id}
                escena={esc}
                escenaIds={escenaIds}
                finalIds={finalIds}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function EscenaNode({ escena, escenaIds, finalIds }) {
  const avances = (escena.condiciones_avance || []).filter(ca => ca.destino)
  const finals = (escena.condiciones_final || []).filter(cf => cf.final)
  const nAvance = avances.length
  const nFinal = finals.length

  return (
    <div className="av-mapa-node">
      <div className="av-mapa-node-header">
        <span className="av-mapa-node-id">{escena.id}</span>
        <span className="av-mapa-node-name">{escena.nombre}</span>
      </div>

      {escena.intencion_dm_default?.tension && (
        <span className={`av-mapa-tension av-mapa-tension-${escena.intencion_dm_default.tension}`}>
          {escena.intencion_dm_default.tension}
        </span>
      )}

      {nAvance > 0 && (
        <div className="av-mapa-links">
          {avances.map((ca, i) => {
            const exists = escenaIds.has(ca.destino)
            return (
              <span key={i} className={`av-mapa-link ${exists ? '' : 'av-mapa-link-broken'}`} title={ca.descripcion || ''}>
                → {ca.destino}{ca.operador === 'all' ? ' (all)' : ''}
              </span>
            )
          })}
        </div>
      )}

      {nFinal > 0 && (
        <div className="av-mapa-links">
          {finals.map((cf, i) => {
            const exists = finalIds.has(cf.final)
            return (
              <span key={i} className={`av-mapa-link av-mapa-link-final ${exists ? '' : 'av-mapa-link-broken'}`} title={cf.descripcion || ''}>
                ⭐ {cf.final}
              </span>
            )
          })}
        </div>
      )}

      {nAvance === 0 && nFinal === 0 && (
        <span className="av-mapa-dead">sin salidas</span>
      )}
    </div>
  )
}
