import { useState } from 'react'

export default function SeccionMeta({ resumen, meta, onUpdate }) {
  const [editing, setEditing] = useState(false)
  if (!resumen) return null

  const save = (field, value) => {
    onUpdate({ ...meta, [field]: value })
  }

  const { counts } = resumen

  return (
    <section className="av-section av-meta">
      <div className="av-section-header">
        <h2 className="av-section-title">{resumen.nombre || '(sin nombre)'}</h2>
        <button
          type="button"
          className="av-edit-toggle"
          onClick={() => setEditing(!editing)}
        >
          {editing ? '✓ Listo' : '✎ Editar'}
        </button>
      </div>

      {!editing && resumen.descripcion && <p className="av-desc">{resumen.descripcion}</p>}

      {editing ? (
        <div className="av-form">
          <Field label="Nombre" value={meta.nombre ?? ''} onChange={v => save('nombre', v)} />
          <Field label="Autor" value={meta.autor ?? ''} onChange={v => save('autor', v)} />
          <Field label="Versión" value={String(meta.version ?? '')} onChange={v => save('version', v)} />
          <FieldSelect
            label="Idioma principal"
            value={meta.idioma_principal ?? 'es'}
            options={['es', 'en']}
            onChange={v => save('idioma_principal', v)}
          />
          <Field label="Escena inicial" value={meta.escena_inicial ?? ''} onChange={v => save('escena_inicial', v)} />
          <FieldSelect
            label="Dificultad"
            value={meta.dificultad ?? 'media'}
            options={['baja', 'media', 'alta']}
            onChange={v => save('dificultad', v)}
          />
          <Field label="Duración estimada" value={meta.duracion_estimada ?? ''} onChange={v => save('duracion_estimada', v)} />
          <FieldTextarea label="Descripción" value={meta.descripcion ?? ''} onChange={v => save('descripcion', v)} />
        </div>
      ) : (
        <div className="av-meta-grid">
          {resumen.autor && <Chip label="Autor" value={resumen.autor} />}
          {resumen.version && <Chip label="Versión" value={resumen.version} />}
          {resumen.idioma && <Chip label="Idioma" value={resumen.idioma} />}
          {resumen.dificultad && <Chip label="Dificultad" value={resumen.dificultad} />}
          {resumen.duracion && <Chip label="Duración" value={resumen.duracion} />}
          {resumen.escena_inicial && <Chip label="Escena inicial" value={resumen.escena_inicial} />}
        </div>
      )}

      <div className="av-counts">
        <CountBadge n={counts.localizaciones} label="localizaciones" />
        <CountBadge n={counts.npcs} label="NPCs" />
        <CountBadge n={counts.bestiario} label="bestias" />
        <CountBadge n={counts.escenas} label="escenas" />
        <CountBadge n={counts.finales} label="finales" />
        <CountBadge n={counts.eventos} label="eventos" />
      </div>
    </section>
  )
}

function Chip({ label, value }) {
  return (
    <span className="av-chip">
      <span className="av-chip-label">{label}:</span> {value}
    </span>
  )
}

function CountBadge({ n, label }) {
  return <span className="av-count-badge">{n} {label}</span>
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
      <textarea
        className="av-input av-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
      />
    </label>
  )
}
