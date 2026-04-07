/** @param {Record<string, unknown>|null|undefined} entry @param {string} lang */
export function nombreVisible(entry, lang) {
  if (!entry || typeof entry !== 'object') return ''
  const isEn = String(lang || '').toLowerCase().startsWith('en')
  if (isEn) {
    const ne = String(entry.nombre_en ?? '').trim()
    if (ne) return ne
  }
  const n = String(entry.nombre ?? entry.id ?? '').trim()
  return n || String(entry.id || '').trim()
}

/** @param {unknown} precio @param {string} lang */
export function formatPrecioUi(precio, lang) {
  const n = Number(precio)
  if (!Number.isFinite(n)) return '—'
  return (lang || '').startsWith('en') ? `${n} crowns` : `${n} coronas`
}

/** @param {Record<string, unknown>|null|undefined} stats @param {string} lang */
export function formatStatsUi(stats, lang) {
  if (!stats || typeof stats !== 'object') return ''
  const isEn = (lang || '').startsWith('en')
  const bits = []
  for (const [k, v] of Object.entries(stats)) {
    if (v == null || v === '') continue
    bits.push(`${k}: ${v}`)
  }
  return bits.length ? bits.join(' · ') : isEn ? '—' : '—'
}
