import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children }) {
  const loc = useLocation()
  const path = loc.pathname

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
            className={path.startsWith('/validar') ? 'nav-link nav-link-active' : 'nav-link'}
          >
            Validar YAML
          </Link>
          <Link
            to="/catalogo"
            className={path.startsWith('/catalogo') ? 'nav-link nav-link-active' : 'nav-link'}
          >
            Catálogo
          </Link>
        </nav>
      </header>
      <main className="layout-main">{children}</main>
    </div>
  )
}
