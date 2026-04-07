import { resumenFlags } from '../domain/validacion.js'

/**
 * @param {{ resultado: import('../api/validarCampana.js').ResultadoValidacionJson | null }} props
 */
export default function ResumenValidacion({ resultado }) {
  if (!resultado) return null

  const { ok, sinIncidencias } = resumenFlags(resultado)

  return (
    <section className="card resumen" aria-label="Resumen de validación">
      <div className="resumen-row">
        <span className={`badge badge-${ok ? 'ok' : 'bad'}`}>
          {ok ? 'Sin errores bloqueantes' : 'Con errores'}
        </span>
        {resultado.nombre_aventura != null && resultado.nombre_aventura !== '' && (
          <span className="resumen-meta">
            Aventura: <strong>{resultado.nombre_aventura}</strong>
          </span>
        )}
        {resultado.escena_inicial != null && resultado.escena_inicial !== '' && (
          <span className="resumen-meta">
            Escena inicial: <code>{resultado.escena_inicial}</code>
          </span>
        )}
      </div>
      <div className="resumen-counts">
        Errores: <strong>{resultado.error_count ?? 0}</strong>
        {' · '}
        Avisos: <strong>{resultado.warning_count ?? 0}</strong>
        {sinIncidencias && (
          <span className="resumen-note"> (ningún issue en la lista)</span>
        )}
      </div>
      {resultado.source && (
        <p className="resumen-source">
          Origen: <code className="kbd">{resultado.source}</code>
        </p>
      )}
    </section>
  )
}
