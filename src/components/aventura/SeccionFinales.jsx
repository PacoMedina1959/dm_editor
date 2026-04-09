import { useState } from 'react'

const EMPTY = {
  id: '', nombre: '', tono: 'agridulce', descripcion: '', requisitos: [], consecuencias: [],
}

const TONOS = ['heroico', 'agridulce', 'tragico', 'oscuro']

const TONO_COLORS = {
  heroico: '#2d7a3a', tragico: '#8a2020', agridulce: '#8a7730', oscuro: '#4a0e4e',
}

export default function SeccionFinales({ finales, onUpdate }) {
  const [editIdx, setEditIdx] = useState(null)
  const editable = typeof onUpdate === 'function'
  const items = finales ?? []

  const startAdd = () => {
    const next = `final_${items.length + 1}`
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
        <h2 className="av-section-title">Finales ({items.length})</h2>
        {editable && <button type="button" className="av-edit-toggle" onClick={startAdd}>+ Añadir</button>}
      </div>

      {editIdx?.mode === 'add' && (
        <FinalForm draft={editIdx.draft} onSave={saveItem} onCancel={cancel} />
      )}

      <div className="av-cards-grid">
        {items.map((f, i) => {
          const isEditing = editIdx?.mode === 'edit' && editIdx.index === i
          return isEditing ? (
            <FinalForm key={f.id} draft={editIdx.draft} onSave={saveItem} onCancel={cancel} onDelete={() => remove(i)} />
          ) : (
            <FinalCard
              key={f.id} final_={f} editable={editable}
              onEdit={() => startEdit(i)} onDuplicate={() => duplicate(i)}
              onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)}
              isFirst={i === 0} isLast={i === items.length - 1}
            />
          )
        })}
      </div>

      {!items.length && <p className="av-empty">Sin finales. Pulsa «+ Añadir» para crear uno.</p>}
    </section>
  )
}

function FinalCard({ final_: f, editable, onEdit, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div className="av-card">
      <div className="av-card-header">
        <span className="av-cell-id">{f.id}</span>
        <strong>{f.nombre}</strong>
        {f.tono && (
          <span className="av-badge" style={{ background: TONO_COLORS[f.tono] || '#555' }}>{f.tono}</span>
        )}
      </div>
      {f.descripcion && <p className="av-desc">{f.descripcion}</p>}
      {f.requisitos?.length > 0 && (
        <div className="av-desc">
          <strong>Requisitos:</strong>
          <ul>{f.requisitos.map((r, j) => <li key={j}>{r}</li>)}</ul>
        </div>
      )}
      {f.consecuencias?.length > 0 && (
        <div className="av-desc">
          <strong>Consecuencias:</strong>
          <ul>{f.consecuencias.map((c, j) => <li key={j}>{c}</li>)}</ul>
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

function FinalForm({ draft: initial, onSave, onCancel, onDelete }) {
  const [d, setD] = useState(initial)
  const [confirmDel, setConfirmDel] = useState(false)
  const upd = (k, v) => setD(prev => ({ ...prev, [k]: v }))

  return (
    <div className="av-form av-form-inline">
      <div className="av-form-row2">
        <Field label="ID" value={d.id} onChange={v => upd('id', v)} />
        <Field label="Nombre" value={d.nombre} onChange={v => upd('nombre', v)} />
      </div>
      <FieldSelect label="Tono" value={d.tono ?? 'agridulce'} options={TONOS} onChange={v => upd('tono', v)} />
      <FieldTextarea label="Descripción" value={d.descripcion ?? ''} onChange={v => upd('descripcion', v)} />
      <FieldTextarea
        label="Requisitos (uno por línea)"
        value={(d.requisitos || []).join('\n')}
        onChange={v => upd('requisitos', v.split('\n').filter(Boolean))}
      />
      <FieldTextarea
        label="Consecuencias (una por línea)"
        value={(d.consecuencias || []).join('\n')}
        onChange={v => upd('consecuencias', v.split('\n').filter(Boolean))}
      />
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
