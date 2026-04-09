import { useState } from 'react'
import FilterInput from './FilterInput.jsx'

const EMPTY = {
  id: '', nombre: '', nombre_en: '', ubicacion: '', actitud_inicial: 'neutral',
  genero: '', descripcion: '', motivacion: '', frase: '', secretos: [], vende: [],
}

const ACTITUDES = ['amistosa', 'neutral', 'desconfiado', 'hostil']

export default function SeccionNpcs({ npcs, onUpdate }) {
  const [editIdx, setEditIdx] = useState(null)
  const editable = typeof onUpdate === 'function'
  const items = npcs ?? []

  const startAdd = () => {
    const next = `npc_${items.length + 1}`
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
        <h2 className="av-section-title">NPCs ({items.length})</h2>
        {editable && <button type="button" className="av-edit-toggle" onClick={startAdd}>+ Añadir</button>}
      </div>

      {editIdx?.mode === 'add' && (
        <NpcForm draft={editIdx.draft} onSave={saveItem} onCancel={cancel} />
      )}

      <FilterInput items={items} fields={['id', 'nombre', 'ubicacion', 'descripcion']}>
        {filtered => filtered.map(npc => {
          const i = items.indexOf(npc)
          const isEditing = editIdx?.mode === 'edit' && editIdx.index === i
          return isEditing ? (
            <NpcForm key={npc.id} draft={editIdx.draft} onSave={saveItem} onCancel={cancel} onDelete={() => remove(i)} />
          ) : (
            <NpcRow
              key={npc.id} npc={npc} editable={editable}
              onEdit={() => startEdit(i)} onDuplicate={() => duplicate(i)}
              onMoveUp={() => move(i, -1)} onMoveDown={() => move(i, 1)}
              isFirst={i === 0} isLast={i === items.length - 1}
            />
          )
        })}
      </FilterInput>

      {!items.length && <p className="av-empty">Sin NPCs. Pulsa «+ Añadir» para crear uno.</p>}
    </section>
  )
}

function ActitudBadge({ actitud }) {
  if (!actitud) return <span>—</span>
  const colors = {
    amistosa: '#2d7a3a', amistoso: '#2d7a3a', neutral: '#8a7730',
    desconfiado: '#9a5a20', desconfiada: '#9a5a20', hostil: '#8a2020',
  }
  return <span className="av-badge" style={{ background: colors[actitud.toLowerCase()] || '#555' }}>{actitud}</span>
}

function NpcRow({ npc, editable, onEdit, onDuplicate, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="av-crud-row">
      <div className="av-crud-row-main" onClick={() => setExpanded(!expanded)}>
        <span className="av-cell-id">{npc.id}</span>
        <span className="av-crud-row-name">{npc.nombre}</span>
        <span className="av-tag">{npc.ubicacion || '—'}</span>
        <ActitudBadge actitud={npc.actitud_inicial} />
      </div>
      {expanded && (
        <div className="av-detail">
          {npc.descripcion && <p className="av-desc">{npc.descripcion}</p>}
          {npc.motivacion && <p className="av-desc"><strong>Motivación:</strong> {npc.motivacion}</p>}
          {npc.frase && <p className="av-desc av-desc-muted"><em>«{npc.frase}»</em></p>}
          {npc.secretos?.length > 0 && (
            <div className="av-desc av-desc-dm">
              <strong>Secretos:</strong>
              <ul>{npc.secretos.map((s, j) => <li key={j}>{s}</li>)}</ul>
            </div>
          )}
          {npc.vende?.length > 0 && (
            <p className="av-desc">
              <strong>Vende:</strong>{' '}
              {npc.vende.map(v => <span key={v} className="av-tag">{v}</span>)}
            </p>
          )}
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

function NpcForm({ draft: initial, onSave, onCancel, onDelete }) {
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
        <Field label="Ubicación" value={d.ubicacion ?? ''} onChange={v => upd('ubicacion', v)} />
      </div>
      <div className="av-form-row2">
        <FieldSelect label="Actitud" value={d.actitud_inicial ?? 'neutral'} options={ACTITUDES} onChange={v => upd('actitud_inicial', v)} />
        <Field label="Género" value={d.genero ?? ''} onChange={v => upd('genero', v)} />
      </div>
      <FieldTextarea label="Descripción" value={d.descripcion ?? ''} onChange={v => upd('descripcion', v)} />
      <Field label="Motivación" value={d.motivacion ?? ''} onChange={v => upd('motivacion', v)} />
      <Field label="Frase característica" value={d.frase ?? ''} onChange={v => upd('frase', v)} />
      <FieldTextarea
        label="Secretos (uno por línea)"
        value={(d.secretos || []).join('\n')}
        onChange={v => upd('secretos', v.split('\n').filter(Boolean))}
      />
      <Field
        label="Vende (separados por coma)"
        value={(d.vende || []).join(', ')}
        onChange={v => upd('vende', v.split(',').map(s => s.trim()).filter(Boolean))}
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
