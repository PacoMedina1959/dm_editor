import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const loc = useLocation()
  const enValidar = loc.pathname.startsWith('/validar')

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-brand">
          <strong>DM Editor</strong>
          <span className="layout-sub">Autoría para DM Virtual</span>
        </div>
        <nav className="layout-nav">
          <Link
            to="/validar"
            className={enValidar ? 'nav-link nav-link-active' : 'nav-link'}
          >
            Validar YAML
          </Link>
        </nav>
      </header>
      <main className="layout-main">{children}</main>
    </div>
  )
}
