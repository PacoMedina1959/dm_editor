import { useState } from 'react'

const LABELS = {
  leyenda: 'Leyenda',
  caida: 'La Caída',
  presente: 'Presente',
  secreto_mayor: 'Secreto Mayor',
}

export default function SeccionHistoria({ historia, onUpdate }) {
  const [editing, setEditing] = useState(false)
  if (!historia || typeof historia !== 'object') return null
  const entries = Object.entries(historia)
  if (!entries.length) return null

  const save = (key, value) => {
    onUpdate({ ...historia, [key]: value })
  }

  const addEntry = () => {
    const existing = Object.keys(historia)
    const defaults = ['leyenda', 'caida', 'presente', 'secreto_mayor']
    const next = defaults.find(k => !existing.includes(k)) || `seccion_${existing.length + 1}`
    onUpdate({ ...historia, [next]: '' })
  }

  return (
    <section className="av-section">
      <div className="av-section-header">
        <h2 className="av-section-title">Historia</h2>
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
          {entries.map(([key, text]) => (
            <label key={key} className="av-field">
              <span className="av-field-label">{LABELS[key] || key}</span>
              <textarea
                className="av-input av-textarea"
                value={text ?? ''}
                onChange={e => save(key, e.target.value)}
                rows={4}
              />
            </label>
          ))}
          <button type="button" className="btn-secondary av-btn-small" onClick={addEntry}>
            + Añadir sección
          </button>
        </div>
      ) : (
        entries.map(([key, text]) => (
          <div key={key} className="av-card">
            <h3>{LABELS[key] || key}</h3>
            <p className="av-desc">{text}</p>
          </div>
        ))
      )}
    </section>
  )
}
