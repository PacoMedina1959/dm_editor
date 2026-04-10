import { Link, Outlet, useLocation } from 'react-router-dom'

export default function Layout() {
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
            to="/aventura"
            className={path.startsWith('/aventura') ? 'nav-link nav-link-active' : 'nav-link'}
          >
            Aventura
          </Link>
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
          <Link
            to="/ayuda"
            className={path.startsWith('/ayuda') ? 'nav-link nav-link-active' : 'nav-link'}
          >
            Ayuda
          </Link>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
