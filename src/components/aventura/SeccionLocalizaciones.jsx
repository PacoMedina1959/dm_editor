import { useState } from 'react'
import FilterInput from './FilterInput.jsx'

const EMPTY = {
  id: '', nombre: '', nombre_en: '', zona: '', conexiones: [],
  oculta: false, descripcion: '', notas_dm: '',
}

export default function SeccionLocalizaciones({ localizaciones, onUpdate }) {
  const [editIdx, setEditIdx] = useState(null)
  const editable = typeof onUpdate === 'function'
  const items = localizaciones ?? []

  const startAdd = () => {
    const next = `loc_${items.length + 1}`
    setEditIdx({ mode: 'add', draft: { ...EMPTY, id: next } })
  }

  const startEdit = (i) => {
    setEditIdx({ mode: 'edit', index: i, draft: { ...items[i] } })
  }

  const cancel = () => setEditIdx(null)

  const saveItem = (draft) => {
    if (editIdx.mode === 'add') {
      onUpdate([...items, draft])
    } else {
      const copy = [...items]
      copy[editIdx.index] = draft
      onUpdate(copy)
    }
    setEditIdx(null)
  }

  const remove = (i) => {
    onUpdate(items.filter((_, idx) => idx !== i))
    setEditIdx(null)
  }

  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const copy = [...items]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    onUpdate(copy)
  }

  const duplicate = (i) => {
    const clone = structuredClone(items[i])
    clone.id = clone.id + '_copia'
    const copy = [...items]
    copy.splice(i + 1, 0, clone)
    onUpdate(copy)
  }

  if (!items.length && !editable) return null

  return (
    <section className="av-section">
      <div className="av-section-header">
        <h2 className="av-section-title">Localizaciones ({items.length})</h2>
        {editable && (
          <button type="button" className="av-edit-toggle" onClick={startAdd}>+ Añadir</button>
        )}
      </div>

      {editIdx?.mode === 'add' && (
        <LocForm draft={editIdx.draft} onSave={saveItem} onCancel={cancel} />
      )}

      <FilterInput items={items} fields={['id', 'nombre', 'zona', 'descripcion', 'conexiones']}>
        {filtered => {
          const zonas = {}
          for (const loc of filtered) {
            const z = loc.zona || '(sin zona)'
            if (!zonas[z]) zonas[z] = []
            zonas[z].push(loc)
          }
          return Object.entries(zonas).map(([zona, locs]) => (
            <div key={zona} className="av-group">
              <h3 className="av-group-title">{zona}</h3>
              {locs.map(loc => {
                const realIdx = items.indexOf(loc)
                const isEditing = editIdx?.mode === 'edit' && editIdx.index === realIdx
                return isEditing ? (
                  <LocForm
                    key={loc.id}
                    draft={editIdx.draft}
                    onSave={saveItem}
                    onCancel={cancel}
                    onDelete={() => remove(realIdx)}
                  />
                ) : (
                  <LocRow
                    key={loc.id}
                    loc={loc}
                    editable={editable}
                    onEdit={() => startEdit(realIdx)}
                    onDuplicate={() => duplicate(realIdx)}
                    onMoveUp={() => move(realIdx, -1)}
                    onMoveDown={() => move(realIdx, 1)}
                    isFirst={realIdx === 0}
                    isLast={realIdx === items.length - 1}
                  />
                )
              })}
            </div>
          ))
        }}
      </FilterInput>

      {!items.length && <p className="av-empty">Sin localizaciones. Pulsa «+ Añadir» para crear una.</p>}
    </section>
  )
}

function LocRow({ loc, editable, onEdit, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="av-crud-row">
      <div className="av-crud-row-main" onClick={() => setExpanded(!expanded)}>
        <span className="av-cell-id">{loc.id}</span>
        <span className="av-crud-row-name">{loc.nombre}{loc.nombre_en ? ` / ${loc.nombre_en}` : ''}</span>
        <span className="av-cell-tags">
          {(loc.conexiones || []).map(c => <span key={c} className="av-tag">{c}</span>)}
        </span>
        {loc.oculta && <span className="av-tag">🔒</span>}
      </div>
      {expanded && (
        <div className="av-detail">
          {loc.descripcion && <p className="av-desc">{loc.descripcion}</p>}
          {loc.notas_dm && <p className="av-desc av-desc-dm">🎭 {loc.notas_dm}</p>}
        </div>
      )}
      {editable && (
        <div className="av-crud-actions">
          <button type="button" className="av-btn-icon" onClick={onEdit} title="Editar">✎</button>
          <button type="button" className="av-btn-icon" onClick={onDuplicate} title="Duplicar">⧉</button>
          {!isFirst && <button type="button" className="av-btn-icon" onClick={onMoveUp} title="Subir">▲</button>}
          {!isLast && <button type="button" className="av-btn-icon" onClick={onMoveDown} title="Bajar">▼</button>}
        </div>
      )}
    </div>
  )
}

function LocForm({ draft: initial, onSave, onCancel, onDelete }) {
  const [d, setD] = useState(initial)
  const [confirmDel, setConfirmDel] = useState(false)
  const upd = (k, v) => setD(prev => ({ ...prev, [k]: v }))

  return (
    <div className="av-form av-form-inline">
      <div className="av-form-row2">
        <Field label="ID" value={d.id} onChange={v => upd('id', v)} />
        <Field label="Nombre" value={d.nombre} onChange={v => upd('nombre', v)} />
      </div>
      <div className="av-form-row2">
        <Field label="Nombre (en)" value={d.nombre_en ?? ''} onChange={v => upd('nombre_en', v)} />
        <Field label="Zona" value={d.zona ?? ''} onChange={v => upd('zona', v)} />
      </div>
      <Field
        label="Conexiones (separadas por coma)"
        value={(d.conexiones || []).join(', ')}
        onChange={v => upd('conexiones', v.split(',').map(s => s.trim()).filter(Boolean))}
      />
      <FieldTextarea label="Descripción" value={d.descripcion ?? ''} onChange={v => upd('descripcion', v)} />
      <FieldTextarea label="Notas DM" value={d.notas_dm ?? ''} onChange={v => upd('notas_dm', v)} />
      <label className="av-field-inline">
        <input type="checkbox" checked={!!d.oculta} onChange={e => upd('oculta', e.target.checked)} />
        <span>Localización oculta</span>
      </label>
      <div className="av-form-buttons">
        <button type="button" className="btn-primary av-btn-small" onClick={() => onSave(d)}>Guardar</button>
        <button type="button" className="btn-secondary av-btn-small" onClick={onCancel}>Cancelar</button>
        {onDelete && !confirmDel && (
          <button type="button" className="av-btn-danger av-btn-small" onClick={() => setConfirmDel(true)}>Eliminar</button>
        )}
        {onDelete && confirmDel && (
          <button type="button" className="av-btn-danger av-btn-small" onClick={onDelete}>¿Seguro? Confirmar</button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <input type="text" className="av-input" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  )
}

function FieldTextarea({ label, value, onChange }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <textarea className="av-input av-textarea" value={value} onChange={e => onChange(e.target.value)} rows={2} />
    </label>
  )
}
