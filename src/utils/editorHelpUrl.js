/**
 * URL absoluta (mismo origen) de la guía del editor, según idioma UI.
 * Los ficheros viven en `public/ayuda/` (Vite los sirve en `/ayuda/...`).
 */
export function getEditorHelpUrl(lang) {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  const file = (lang || '').toLowerCase().startsWith('en')
    ? 'GUIA_EDITOR_DM_EN.md'
    : 'GUIA_EDITOR_DM.md'
  return `${prefix}ayuda/${file}`
}
