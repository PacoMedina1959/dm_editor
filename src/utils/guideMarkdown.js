/** Slug estable para anclas (mismo algoritmo en TOC y en <h2>). */
export function slugifyTitle(s) {
  const t = String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return t || 'section'
}

/** Quita la línea de enlace cruzado ES/EN del bloque inicial (redundante dentro de la app). */
export function preprocessGuideMd(markdown) {
  if (!markdown || typeof markdown !== 'string') return ''
  return markdown.replace(/^> \*\*(English|Español):\*\*[^\n]*\n?/gm, '')
}

export function extractTocFromMd(md) {
  if (!md) return []
  const items = []
  const re = /^## (.+)$/gm
  let m
  while ((m = re.exec(md)) !== null) {
    const title = m[1].trim()
    items.push({ title, id: slugifyTitle(title) })
  }
  return items
}
