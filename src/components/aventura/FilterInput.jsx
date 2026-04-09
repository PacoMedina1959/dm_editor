import { useState } from 'react'

/**
 * Filtro de búsqueda reutilizable para secciones CRUD.
 * Filtra items comparando el texto con los campos indicados.
 *
 * @param {{ items: any[], fields: string[], children: (filtered: any[]) => JSX.Element }} props
 */
export default function FilterInput({ items, fields, children }) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? items.filter(item => {
        const q = query.toLowerCase()
        return fields.some(f => {
          const val = item[f]
          if (typeof val === 'string') return val.toLowerCase().includes(q)
          if (Array.isArray(val)) return val.some(v => String(v).toLowerCase().includes(q))
          return false
        })
      })
    : items

  if (items.length < 4 && !query) return children(items)

  return (
    <>
      <div className="av-filter">
        <input
          type="text"
          className="av-filter-input"
          placeholder={`Buscar entre ${items.length} entradas…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <>
            <span className="av-filter-count">{filtered.length}/{items.length}</span>
            <button type="button" className="av-filter-clear" onClick={() => setQuery('')}>✕</button>
          </>
        )}
      </div>
      {children(filtered)}
    </>
  )
}
