import { useState } from 'react'
import FilterInput from './FilterInput.jsx'

const EMPTY = {
  id: '', nombre: '', ubicacion: '', peligro: 'medio',
  evitable: false, grupo: '', aspecto: '', comportamiento: '', debilidad: '',
}

const PELIGROS = ['bajo', 'medio', 'medio-alto', 'alto']

export default function SeccionBestiario({ bestiario, onUpdate, onOpenIA }) {
  const [editIdx, setEditIdx] = useState(null)
  const editable = typeof onUpdate === 'function'
  const items = bestiario ?? []

  const startAdd = () => {
    const next = `bestia_${items.length + 1}`
    setEditIdx({ mode: 'add', draft: { ...EMPTY, id: next } })
  }
  const startEdit = (i) => setEditIdx({ mode: 'edit', index: i, draft: { ...items[i] } })
  const cancel = () => setEditIdx(null)

  const saveItem = (draft) => {
    if (editIdx.mode === 'add') onUpdate([...items, draft])
    else { const c = [...items]; c[editIdx.index] = draft; onUpdate(c) }
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
        <h2 className="av-section-title">Bestiario ({items.length})</h2>
        {editable && <button type="button" className="av-edit-toggle" onClick={startAdd}>+ Añadir</button>}
        {onOpenIA && <button type="button" className="av-btn-ia-inline" onClick={onOpenIA} title="Generar con IA">✨ IA</button>}
      </div>

      {editIdx?.mode === 'add' && (
        <BestiaForm draft={editIdx.draft} onSave={saveItem} onCancel={cancel} />
      )}

      <FilterInput items={items} fields={['id', 'nombre', 'ubicacion', 'aspecto']}>
        {filtered => filtered.map(b => {
          const i = items.indexOf(b)
          const isEditing = editIdx?.mode === 'edit' && editIdx.index === i
          return isEditing ? (
            <BestiaForm key={b.id} draft={editIdx.draft} onSave={saveItem} onCancel={cancel} onDelete={() => remove(i)} />
          ) : (
            <BestiaRow
              key={b.id} bestia={b} editable={editable}
              onEdit={() => startEdit(i)} onDuplicate={() => duplicate(i)}
              onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)}
              isFirst={i === 0} isLast={i === items.length - 1}
            />
          )
        })}
      </FilterInput>

      {!items.length && <p className="av-empty">Sin bestias. Pulsa «+ Añadir» para crear una.</p>}
    </section>
  )
}

function PeligroBadge({ peligro }) {
  if (!peligro) return <span>—</span>
  const colors = { bajo: '#2d7a3a', medio: '#8a7730', 'medio-alto': '#9a5a20', alto: '#8a2020' }
  return <span className="av-badge" style={{ background: colors[peligro.toLowerCase()] || '#555' }}>{peligro}</span>
}

function BestiaRow({ bestia, editable, onEdit, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="av-crud-row">
      <div className="av-crud-row-main" onClick={() => setExpanded(!expanded)}>
        <span className="av-cell-id">{bestia.id}</span>
        <span className="av-crud-row-name">{bestia.nombre}</span>
        <span className="av-tag">{bestia.ubicacion || '—'}</span>
        <PeligroBadge peligro={bestia.peligro} />
        {bestia.evitable && <span className="av-tag">evitable</span>}
      </div>
      {expanded && (
        <div className="av-detail">
          {bestia.grupo && <p className="av-desc"><strong>Grupo:</strong> {bestia.grupo}</p>}
          {bestia.aspecto && <p className="av-desc">{bestia.aspecto}</p>}
          {bestia.comportamiento && <p className="av-desc"><strong>Comportamiento:</strong> {bestia.comportamiento}</p>}
          {bestia.debilidad && <p className="av-desc av-desc-dm"><strong>Debilidad:</strong> {bestia.debilidad}</p>}
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

function BestiaForm({ draft: initial, onSave, onCancel, onDelete }) {
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
        <Field label="Ubicación" value={d.ubicacion ?? ''} onChange={v => upd('ubicacion', v)} />
        <FieldSelect label="Peligro" value={d.peligro ?? 'medio'} options={PELIGROS} onChange={v => upd('peligro', v)} />
      </div>
      <Field label="Grupo" value={d.grupo ?? ''} onChange={v => upd('grupo', v)} />
      <FieldTextarea label="Aspecto" value={d.aspecto ?? ''} onChange={v => upd('aspecto', v)} />
      <FieldTextarea label="Comportamiento" value={d.comportamiento ?? ''} onChange={v => upd('comportamiento', v)} />
      <FieldTextarea label="Debilidad" value={d.debilidad ?? ''} onChange={v => upd('debilidad', v)} />
      <label className="av-field-inline">
        <input type="checkbox" checked={!!d.evitable} onChange={e => upd('evitable', e.target.checked)} />
        <span>Evitable</span>
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

function FieldTextarea({ label, value, onChange }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <textarea className="av-input av-textarea" value={value} onChange={e => onChange(e.target.value)} rows={2} />
    </label>
  )
}
