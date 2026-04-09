import { useState } from 'react'

export default function SeccionMundo({ mundo, onUpdate }) {
  const [editing, setEditing] = useState(false)
  if (!mundo) return null

  const save = (field, value) => {
    onUpdate({ ...mundo, [field]: value })
  }

  return (
    <section className="av-section">
      <div className="av-section-header">
        <h2 className="av-section-title">Mundo</h2>
        <button
          type="button"
          className="av-edit-toggle"
          onClick={() => setEditing(!editing)}
        >
          {editing ? '✓ Listo' : '✎ Editar'}
        </button>
      </div>

      {editing ? (
        <div className="av-form">
          <Field label="Nombre" value={mundo.nombre ?? ''} onChange={v => save('nombre', v)} />
          <Field label="Región" value={mundo.region ?? ''} onChange={v => save('region', v)} />
          <Field label="Época" value={mundo.epoca ?? ''} onChange={v => save('epoca', v)} />
          <FieldTextarea label="Descripción" value={mundo.descripcion ?? ''} onChange={v => save('descripcion', v)} />
          <FieldTextarea label="Ambiente" value={mundo.ambiente ?? ''} onChange={v => save('ambiente', v)} />
        </div>
      ) : (
        <div className="av-card">
          <h3>{mundo.nombre || '(sin nombre)'}</h3>
          <div className="av-meta-grid">
            {mundo.region && <span className="av-chip"><span className="av-chip-label">Región:</span> {mundo.region}</span>}
            {mundo.epoca && <span className="av-chip"><span className="av-chip-label">Época:</span> {mundo.epoca}</span>}
          </div>
          {mundo.descripcion && <p className="av-desc">{mundo.descripcion}</p>}
          {mundo.ambiente && <p className="av-desc av-desc-muted"><em>{mundo.ambiente}</em></p>}
        </div>
      )}
    </section>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <input
        type="text"
        className="av-input"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </label>
  )
}

function FieldTextarea({ label, value, onChange }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <textarea
        className="av-input av-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
      />
    </label>
  )
}
