/**
 * Base del API DM Virtual. Vacío = rutas relativas `/api/...` (proxy Vite en desarrollo).
 * @returns {string} sin barra final
 */
export function getApiBase() {
  const raw = import.meta.env.VITE_API_BASE
  if (raw == null || String(raw).trim() === '') return ''
  return String(raw).replace(/\/$/, '')
}

/**
 * @param {string} path - p. ej. `/api/editor/validar-campana`
 * @returns {string}
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getApiBase()
  return base ? `${base}${p}` : p
}
