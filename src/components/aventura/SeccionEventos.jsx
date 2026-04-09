import { useState } from 'react'
import FilterInput from './FilterInput.jsx'

const EMPTY = { id: '', descripcion: '', deteccion_automatica: null }
const TIPOS_DETECCION = ['item_en_inventario', 'npc_conocido', 'ubicacion_visitada']

export default function SeccionEventos({ eventos, onUpdate }) {
  const [editIdx, setEditIdx] = useState(null)
  const editable = typeof onUpdate === 'function'
  const items = eventos ?? []

  const startAdd = () => {
    const next = `evento_${items.length + 1}`
    setEditIdx({ mode: 'add', draft: { ...EMPTY, id: next } })
  }
  const startEdit = (i) => setEditIdx({ mode: 'edit', index: i, draft: structuredClone(items[i]) })
  const cancel = () => setEditIdx(null)

  const saveItem = (draft) => {
    const clean = { ...draft }
    if (!clean.deteccion_automatica?.tipo) clean.deteccion_automatica = undefined
    if (editIdx.mode === 'add') onUpdate([...items, clean])
    else { const c = [...items]; c[editIdx.index] = clean; onUpdate(c) }
    setEditIdx(null)
  }

  const remove = (i) => { onUpdate(items.filter((_, idx) => idx !== i)); setEditIdx(null) }
  const move = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= items.length) return
    const c = [...items]; [c[i], c[j]] = [c[j], c[i]]; onUpdate(c)
  }
  const duplicate = (i) => {
    const clone = structuredClone(items[i]); clone.id += '_copia'
    const c = [...items]; c.splice(i + 1, 0, clone); onUpdate(c)
  }

  if (!items.length && !editable) return null

  return (
    <section className="av-section">
      <div className="av-section-header">
        <h2 className="av-section-title">Eventos definidos ({items.length})</h2>
        {editable && <button type="button" className="av-edit-toggle" onClick={startAdd}>+ Añadir</button>}
      </div>

      {editIdx?.mode === 'add' && (
        <EventoForm draft={editIdx.draft} onSave={saveItem} onCancel={cancel} />
      )}

      <FilterInput items={items} fields={['id', 'descripcion']}>
        {filtered => filtered.map(ev => {
          const i = items.indexOf(ev)
          const isEditing = editIdx?.mode === 'edit' && editIdx.index === i
          return isEditing ? (
            <EventoForm key={ev.id} draft={editIdx.draft} onSave={saveItem} onCancel={cancel} onDelete={() => remove(i)} />
          ) : (
            <EventoRow
              key={ev.id} evento={ev} editable={editable}
              onEdit={() => startEdit(i)} onDuplicate={() => duplicate(i)}
              onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)}
              isFirst={i === 0} isLast={i === items.length - 1}
            />
          )
        })}
      </FilterInput>

      {!items.length && <p className="av-empty">Sin eventos definidos. Pulsa «+ Añadir» para crear uno.</p>}
    </section>
  )
}

function EventoRow({ evento, editable, onEdit, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }) {
  const det = evento.deteccion_automatica
  return (
    <div className="av-crud-row">
      <div className="av-crud-row-main">
        <span className="av-cell-id">{evento.id}</span>
        <span className="av-crud-row-name">{evento.descripcion}</span>
        {det && (
          <span className="av-tag" title={`${det.tipo}: ${det.item_patron || det.npc || det.lugar || ''}`}>
            ⚡ {det.tipo}
          </span>
        )}
      </div>
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

function EventoForm({ draft: initial, onSave, onCancel, onDelete }) {
  const [d, setD] = useState(initial)
  const [confirmDel, setConfirmDel] = useState(false)
  const [usaDeteccion, setUsaDeteccion] = useState(!!initial.deteccion_automatica?.tipo)

  const upd = (k, v) => setD(prev => ({ ...prev, [k]: v }))
  const updDet = (k, v) => setD(prev => ({
    ...prev,
    deteccion_automatica: { ...(prev.deteccion_automatica || {}), [k]: v },
  }))

  const toggleDeteccion = (on) => {
    setUsaDeteccion(on)
    if (!on) upd('deteccion_automatica', null)
    else upd('deteccion_automatica', { tipo: 'item_en_inventario', item_patron: '' })
  }

  const det = d.deteccion_automatica

  return (
    <div className="av-form av-form-inline">
      <div className="av-form-row2">
        <Field label="ID" value={d.id} onChange={v => upd('id', v)} />
        <Field label="Descripción" value={d.descripcion} onChange={v => upd('descripcion', v)} />
      </div>

      <label className="av-field-inline">
        <input type="checkbox" checked={usaDeteccion} onChange={e => toggleDeteccion(e.target.checked)} />
        <span>Detección automática</span>
      </label>

      {usaDeteccion && det && (
        <div className="av-sub-item">
          <FieldSelect
            label="Tipo de detección"
            value={det.tipo || 'item_en_inventario'}
            options={TIPOS_DETECCION}
            onChange={v => {
              const base = { tipo: v }
              if (v === 'item_en_inventario') base.item_patron = ''
              else if (v === 'npc_conocido') base.npc = ''
              else if (v === 'ubicacion_visitada') base.lugar = ''
              upd('deteccion_automatica', base)
            }}
          />
          {det.tipo === 'item_en_inventario' && (
            <Field label="Patrón item (regex)" value={det.item_patron ?? ''} onChange={v => updDet('item_patron', v)} />
          )}
          {det.tipo === 'npc_conocido' && (
            <Field label="NPC" value={det.npc ?? ''} onChange={v => updDet('npc', v)} />
          )}
          {det.tipo === 'ubicacion_visitada' && (
            <Field label="Lugar" value={det.lugar ?? ''} onChange={v => updDet('lugar', v)} />
          )}
        </div>
      )}

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

function FieldSelect({ label, value, options, onChange }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <select className="av-input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}
