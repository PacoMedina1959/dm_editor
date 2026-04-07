/**
 * @param {{ issues: import('../api/validarCampana.js').IssueCampana[] }} props
 */
export default function IssueList({ issues }) {
  if (!issues || issues.length === 0) {
    return <p className="issues-empty">No hay incidencias que mostrar.</p>
  }

  const sorted = [...issues].sort((a, b) => {
    const sev = (s) => (s === 'error' ? 0 : 1)
    const d = sev(a.severity) - sev(b.severity)
    if (d !== 0) return d
    return `${a.path}:${a.code}`.localeCompare(`${b.path}:${b.code}`, 'es')
  })

  return (
    <section className="issues" aria-label="Incidencias">
      <h2 className="issues-title">Incidencias ({sorted.length})</h2>
      <ul className="issues-list">
        {sorted.map((issue, i) => (
          <li
            key={`${issue.path}-${issue.code}-${i}`}
            className={`issue issue-${issue.severity === 'warning' ? 'warn' : 'err'}`}
          >
            <div className="issue-head">
              <span
                className={`issue-sev issue-sev-${issue.severity === 'warning' ? 'warn' : 'err'}`}
              >
                {issue.severity === 'warning' ? 'Aviso' : 'Error'}
              </span>
              <code className="issue-path" title={issue.path}>
                {issue.path || '—'}
              </code>
              <span className="issue-code">{issue.code}</span>
            </div>
            <p className="issue-msg">{issue.message}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
