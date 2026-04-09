import { useState } from 'react'
import yaml from 'js-yaml'
import FilterInput from './FilterInput.jsx'
import PreviewEscena from './PreviewEscena.jsx'

/* ───────── constantes ───────── */

const TENSIONES = ['bajo', 'medio', 'medio-alto', 'alto', 'maximo']
const RITMOS = ['pausado', 'creciente', 'intenso', 'climax']
const PROBABILIDADES = ['baja', 'media', 'alta']
const TIPOS_REGLA = [
  'evento', 'keyword_en_historial', 'npc_conocido',
  'ubicacion_visitada', 'item_en_inventario', 'actitud_npc',
]

const EMPTY_ESCENA = {
  id: '', nombre: '', acto: 1, objetivo: '',
  intencion_dm_default: { tension: 'bajo', tono: '', ritmo: 'pausado', restricciones: [] },
  ubicaciones_activas: [], npcs_activos: [],
  info_visible: {}, info_oculta: [],
  eventos_opcionales: [], condiciones_avance: [], condiciones_final: [],
}

const EMPTY_REGLA = { tipo: 'evento', evento: '', descripcion_humana: '' }

/* ───────── componente principal ───────── */

export default function SeccionEscenas({ escenas, onUpdate, data, onOpenIA }) {
  const [editIdx, setEditIdx] = useState(null)
  const [previewEscena, setPreviewEscena] = useState(null)
  const editable = typeof onUpdate === 'function'
  const items = escenas ?? []

  const startAdd = () => {
    const next = `escena_${items.length + 1}`
    setEditIdx({ mode: 'add', draft: { ...structuredClone(EMPTY_ESCENA), id: next } })
  }
  const startEdit = (i) => setEditIdx({ mode: 'edit', index: i, draft: structuredClone(items[i]) })
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
    const clone = structuredClone(items[i]); clone.id += '_copia'; clone.nombre += ' (copia)'
    const c = [...items]; c.splice(i + 1, 0, clone); onUpdate(c)
  }

  if (!items.length && !editable) return null

  return (
    <section className="av-section">
      <div className="av-section-header">
        <h2 className="av-section-title">Escenas ({items.length})</h2>
        {editable && <button type="button" className="av-edit-toggle" onClick={startAdd}>+ Añadir</button>}
        {onOpenIA && <button type="button" className="av-btn-ia-inline" onClick={onOpenIA} title="Generar con IA">✨ IA</button>}
      </div>

      {editIdx?.mode === 'add' && (
        <EscenaForm draft={editIdx.draft} onSave={saveItem} onCancel={cancel} />
      )}

      <FilterInput items={items} fields={['id', 'nombre', 'objetivo']}>
        {filtered => {
          const actos = {}
          for (const e of filtered) { const a = e.acto ?? '?'; if (!actos[a]) actos[a] = []; actos[a].push(e) }
          return Object.entries(actos).map(([acto, escs]) => (
            <div key={acto} className="av-group">
              <h3 className="av-group-title">Acto {acto}</h3>
              {escs.map(e => {
                const realIdx = items.indexOf(e)
                const isEditing = editIdx?.mode === 'edit' && editIdx.index === realIdx
                return isEditing ? (
                  <EscenaForm
                    key={e.id}
                    draft={editIdx.draft}
                    onSave={saveItem}
                    onCancel={cancel}
                    onDelete={() => remove(realIdx)}
                  />
                ) : (
                  <EscenaRow
                    key={e.id} escena={e} editable={editable}
                    onEdit={() => startEdit(realIdx)}
                    onDuplicate={() => duplicate(realIdx)}
                    onPreview={() => setPreviewEscena(e)}
                    onMoveUp={() => move(realIdx, -1)}
                    onMoveDown={() => move(realIdx, 1)}
                    isFirst={realIdx === 0} isLast={realIdx === items.length - 1}
                  />
                )
              })}
            </div>
          ))
        }}
      </FilterInput>

      {!items.length && <p className="av-empty">Sin escenas. Pulsa «+ Añadir» para crear una.</p>}

      {previewEscena && (
        <PreviewEscena
          escena={previewEscena}
          data={data}
          onClose={() => setPreviewEscena(null)}
        />
      )}
    </section>
  )
}

/* ───────── fila vista ───────── */

function EscenaRow({ escena, editable, onEdit, onDuplicate, onPreview, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false)
  const int_ = escena.intencion_dm_default
  return (
    <div className="av-crud-row av-escena-row">
      <div className="av-crud-row-main" onClick={() => setExpanded(!expanded)}>
        <span className="av-cell-id">{escena.id}</span>
        <span className="av-crud-row-name">{escena.nombre}</span>
        {int_?.tension && <span className="av-badge av-badge-sm">{int_.tension}</span>}
      </div>
      {expanded && <EscenaDetail escena={escena} />}
      {editable && (
        <div className="av-crud-actions">
          <button type="button" className="av-btn-icon" onClick={onPreview} title="Vista IA">👁</button>
          <button type="button" className="av-btn-icon" onClick={onEdit} title="Editar">✎</button>
          <button type="button" className="av-btn-icon" onClick={onDuplicate} title="Duplicar">⧉</button>
          {!isFirst && <button type="button" className="av-btn-icon" onClick={onMoveUp} title="Subir">▲</button>}
          {!isLast && <button type="button" className="av-btn-icon" onClick={onMoveDown} title="Bajar">▼</button>}
        </div>
      )}
    </div>
  )
}

function EscenaDetail({ escena }) {
  const int_ = escena.intencion_dm_default
  return (
    <div className="av-escena-detail" onClick={ev => ev.stopPropagation()}>
      {escena.objetivo && <p className="av-desc">{escena.objetivo}</p>}
      {int_ && (
        <div className="av-desc">
          <strong>Intención DM:</strong>
          <span className="av-meta-grid" style={{ marginTop: 4 }}>
            {int_.tension && <span className="av-chip"><span className="av-chip-label">Tensión:</span> {int_.tension}</span>}
            {int_.tono && <span className="av-chip"><span className="av-chip-label">Tono:</span> {int_.tono}</span>}
            {int_.ritmo && <span className="av-chip"><span className="av-chip-label">Ritmo:</span> {int_.ritmo}</span>}
          </span>
          {int_.restricciones?.length > 0 && (
            <ul className="av-restricciones">{int_.restricciones.map((r, i) => <li key={i}>{r}</li>)}</ul>
          )}
        </div>
      )}
      {escena.npcs_activos?.length > 0 && (
        <p className="av-desc"><strong>NPCs:</strong> {escena.npcs_activos.map(n => <span key={n} className="av-tag">{n}</span>)}</p>
      )}
      {escena.ubicaciones_activas?.length > 0 && (
        <p className="av-desc"><strong>Ubicaciones:</strong> {escena.ubicaciones_activas.map(u => <span key={u} className="av-tag">{u}</span>)}</p>
      )}
      {escena.condiciones_avance?.length > 0 && (
        <div className="av-desc">
          <strong>Avance:</strong>
          {escena.condiciones_avance.map((ca, i) => (
            <span key={i} className="av-tag">→ {ca.destino}</span>
          ))}
        </div>
      )}
      {escena.condiciones_final?.length > 0 && (
        <div className="av-desc">
          <strong>Finales:</strong>
          {escena.condiciones_final.map((cf, i) => (
            <span key={i} className="av-tag av-tag-final">⭐ {cf.final}</span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────── formulario de escena ───────── */

function EscenaForm({ draft: initial, onSave, onCancel, onDelete }) {
  const [d, setD] = useState(initial)
  const [confirmDel, setConfirmDel] = useState(false)
  const [openSections, setOpenSections] = useState(new Set(['basico']))

  const upd = (k, v) => setD(prev => ({ ...prev, [k]: v }))
  const updInt = (k, v) => setD(prev => ({
    ...prev,
    intencion_dm_default: { ...prev.intencion_dm_default, [k]: v },
  }))

  const toggle = (s) => setOpenSections(prev => {
    const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n
  })

  const int_ = d.intencion_dm_default || {}

  let infoVisibleYaml = ''
  try { infoVisibleYaml = d.info_visible ? yaml.dump(d.info_visible, { indent: 2, flowLevel: 3 }) : '' }
  catch { infoVisibleYaml = '' }

  return (
    <div className="av-form av-form-escena">
      {/* Básico */}
      <FormAccordion label="Básico" id="basico" open={openSections} onToggle={toggle}>
        <div className="av-form-row3">
          <Field label="ID" value={d.id} onChange={v => upd('id', v)} />
          <Field label="Nombre" value={d.nombre} onChange={v => upd('nombre', v)} />
          <Field label="Acto" value={String(d.acto ?? '')} onChange={v => upd('acto', Number(v) || v)} />
        </div>
        <FieldTextarea label="Objetivo" value={d.objetivo ?? ''} onChange={v => upd('objetivo', v)} rows={3} />
      </FormAccordion>

      {/* Intención DM */}
      <FormAccordion label="Intención DM" id="intencion" open={openSections} onToggle={toggle}>
        <div className="av-form-row3">
          <FieldSelect label="Tensión" value={int_.tension ?? 'bajo'} options={TENSIONES} onChange={v => updInt('tension', v)} />
          <Field label="Tono" value={int_.tono ?? ''} onChange={v => updInt('tono', v)} />
          <FieldSelect label="Ritmo" value={int_.ritmo ?? 'pausado'} options={RITMOS} onChange={v => updInt('ritmo', v)} />
        </div>
        <FieldTextarea
          label="Restricciones (una por línea)"
          value={(int_.restricciones || []).join('\n')}
          onChange={v => updInt('restricciones', v.split('\n').filter(Boolean))}
          rows={3}
        />
      </FormAccordion>

      {/* Activos */}
      <FormAccordion label="Ubicaciones y NPCs activos" id="activos" open={openSections} onToggle={toggle}>
        <Field
          label="Ubicaciones activas (separadas por coma)"
          value={(d.ubicaciones_activas || []).join(', ')}
          onChange={v => upd('ubicaciones_activas', v.split(',').map(s => s.trim()).filter(Boolean))}
        />
        <Field
          label="NPCs activos (separados por coma)"
          value={(d.npcs_activos || []).join(', ')}
          onChange={v => upd('npcs_activos', v.split(',').map(s => s.trim()).filter(Boolean))}
        />
      </FormAccordion>

      {/* Info visible (YAML) */}
      <FormAccordion label="Info visible" id="info_visible" open={openSections} onToggle={toggle}>
        <FieldTextarea
          label="Info visible (formato YAML)"
          value={infoVisibleYaml}
          onChange={v => {
            try { upd('info_visible', yaml.load(v) ?? {}) }
            catch { /* ignore parse errors while typing */ }
          }}
          rows={6}
          mono
        />
      </FormAccordion>

      {/* Info oculta */}
      <FormAccordion label="Info oculta" id="info_oculta" open={openSections} onToggle={toggle}>
        <FieldTextarea
          label="Info oculta (una por línea)"
          value={(d.info_oculta || []).join('\n')}
          onChange={v => upd('info_oculta', v.split('\n').filter(Boolean))}
          rows={4}
        />
      </FormAccordion>

      {/* Eventos opcionales */}
      <FormAccordion label={`Eventos opcionales (${(d.eventos_opcionales || []).length})`} id="eventos" open={openSections} onToggle={toggle}>
        <EventosEditor
          eventos={d.eventos_opcionales || []}
          onChange={v => upd('eventos_opcionales', v)}
        />
      </FormAccordion>

      {/* Condiciones de avance */}
      <FormAccordion label={`Condiciones de avance (${(d.condiciones_avance || []).length})`} id="avance" open={openSections} onToggle={toggle}>
        <CondicionesEditor
          condiciones={d.condiciones_avance || []}
          onChange={v => upd('condiciones_avance', v)}
          campoDestino="destino"
          labelDestino="Destino (escena)"
        />
      </FormAccordion>

      {/* Condiciones de final */}
      <FormAccordion label={`Condiciones de final (${(d.condiciones_final || []).length})`} id="final" open={openSections} onToggle={toggle}>
        <CondicionesEditor
          condiciones={d.condiciones_final || []}
          onChange={v => upd('condiciones_final', v)}
          campoDestino="final"
          labelDestino="Final"
        />
      </FormAccordion>

      {/* Botones */}
      <div className="av-form-buttons">
        <button type="button" className="btn-primary av-btn-small" onClick={() => onSave(d)}>Guardar escena</button>
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

/* ───────── acordeón de formulario ───────── */

function FormAccordion({ label, id, open, onToggle, children }) {
  const isOpen = open.has(id)
  return (
    <div className="av-accordion">
      <button type="button" className="av-accordion-header" onClick={() => onToggle(id)}>
        <span className="av-accordion-arrow">{isOpen ? '▾' : '▸'}</span>
        <span>{label}</span>
      </button>
      {isOpen && <div className="av-accordion-body">{children}</div>}
    </div>
  )
}

/* ───────── editor de eventos opcionales ───────── */

function EventosEditor({ eventos, onChange }) {
  const add = () => onChange([...eventos, { id: '', descripcion: '', probabilidad: 'media', avanza_trama: false }])
  const upd = (i, k, v) => { const c = [...eventos]; c[i] = { ...c[i], [k]: v }; onChange(c) }
  const del = (i) => onChange(eventos.filter((_, idx) => idx !== i))

  return (
    <div className="av-sub-list">
      {eventos.map((ev, i) => (
        <div key={i} className="av-sub-item">
          <div className="av-form-row2">
            <Field label="ID evento" value={ev.id} onChange={v => upd(i, 'id', v)} />
            <FieldSelect label="Probabilidad" value={ev.probabilidad ?? 'media'} options={PROBABILIDADES} onChange={v => upd(i, 'probabilidad', v)} />
          </div>
          <FieldTextarea label="Descripción" value={ev.descripcion ?? ''} onChange={v => upd(i, 'descripcion', v)} rows={2} />
          <div className="av-sub-item-footer">
            <label className="av-field-inline">
              <input type="checkbox" checked={!!ev.avanza_trama} onChange={e => upd(i, 'avanza_trama', e.target.checked)} />
              <span>Avanza trama</span>
            </label>
            <button type="button" className="av-btn-danger av-btn-xs" onClick={() => del(i)}>✕</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary av-btn-small" onClick={add}>+ Evento</button>
    </div>
  )
}

/* ───────── editor de condiciones (avance / final) ───────── */

function CondicionesEditor({ condiciones, onChange, campoDestino, labelDestino }) {
  const add = () => onChange([...condiciones, { [campoDestino]: '', descripcion: '', operador: 'any', reglas: [] }])
  const upd = (i, k, v) => { const c = [...condiciones]; c[i] = { ...c[i], [k]: v }; onChange(c) }
  const del = (i) => onChange(condiciones.filter((_, idx) => idx !== i))
  const updReglas = (i, reglas) => { const c = [...condiciones]; c[i] = { ...c[i], reglas }; onChange(c) }

  return (
    <div className="av-sub-list">
      {condiciones.map((cond, i) => (
        <div key={i} className="av-sub-item av-cond-item">
          <div className="av-form-row2">
            <Field label={labelDestino} value={cond[campoDestino] ?? ''} onChange={v => upd(i, campoDestino, v)} />
            <FieldSelect label="Operador" value={cond.operador ?? 'any'} options={['any', 'all']} onChange={v => upd(i, 'operador', v)} />
          </div>
          <Field label="Descripción" value={cond.descripcion ?? ''} onChange={v => upd(i, 'descripcion', v)} />
          <ReglasEditor reglas={cond.reglas || []} onChange={r => updReglas(i, r)} />
          <div className="av-sub-item-footer">
            <button type="button" className="av-btn-danger av-btn-xs" onClick={() => del(i)}>✕ Eliminar condición</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn-secondary av-btn-small" onClick={add}>+ Condición</button>
    </div>
  )
}

/* ───────── editor de reglas ───────── */

function ReglasEditor({ reglas, onChange }) {
  const add = () => onChange([...reglas, { ...EMPTY_REGLA }])
  const upd = (i, k, v) => { const c = [...reglas]; c[i] = { ...c[i], [k]: v }; onChange(c) }
  const del = (i) => onChange(reglas.filter((_, idx) => idx !== i))

  const changeTipo = (i, tipo) => {
    const base = { tipo }
    switch (tipo) {
      case 'evento': base.evento = ''; base.descripcion_humana = ''; break
      case 'keyword_en_historial': base.palabras = []; break
      case 'npc_conocido': base.npc = ''; break
      case 'ubicacion_visitada': base.lugar = ''; break
      case 'item_en_inventario': base.item_patron = ''; break
      case 'actitud_npc': base.npc = ''; base.valor = ''; break
    }
    const c = [...reglas]; c[i] = base; onChange(c)
  }

  return (
    <div className="av-reglas-editor">
      <span className="av-field-label">Reglas ({reglas.length})</span>
      {reglas.map((r, i) => (
        <div key={i} className="av-regla-row">
          <FieldSelect label="Tipo" value={r.tipo} options={TIPOS_REGLA} onChange={v => changeTipo(i, v)} />
          <ReglaFields regla={r} onUpdate={(k, v) => upd(i, k, v)} />
          <button type="button" className="av-btn-danger av-btn-xs av-regla-del" onClick={() => del(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn-secondary av-btn-xs" onClick={add}>+ Regla</button>
    </div>
  )
}

function ReglaFields({ regla, onUpdate }) {
  switch (regla.tipo) {
    case 'evento':
      return (
        <>
          <Field label="Evento" value={regla.evento ?? ''} onChange={v => onUpdate('evento', v)} />
          <Field label="Descripción humana" value={regla.descripcion_humana ?? ''} onChange={v => onUpdate('descripcion_humana', v)} />
        </>
      )
    case 'keyword_en_historial':
      return (
        <Field
          label="Palabras clave (coma)"
          value={(regla.palabras || []).join(', ')}
          onChange={v => onUpdate('palabras', v.split(',').map(s => s.trim()).filter(Boolean))}
        />
      )
    case 'npc_conocido':
      return <Field label="NPC" value={regla.npc ?? ''} onChange={v => onUpdate('npc', v)} />
    case 'ubicacion_visitada':
      return <Field label="Lugar" value={regla.lugar ?? ''} onChange={v => onUpdate('lugar', v)} />
    case 'item_en_inventario':
      return <Field label="Patrón de item" value={regla.item_patron ?? ''} onChange={v => onUpdate('item_patron', v)} />
    case 'actitud_npc':
      return (
        <>
          <Field label="NPC" value={regla.npc ?? ''} onChange={v => onUpdate('npc', v)} />
          <Field label="Valor actitud" value={regla.valor ?? ''} onChange={v => onUpdate('valor', v)} />
        </>
      )
    default:
      return null
  }
}

/* ───────── primitivos de formulario ───────── */

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

function FieldTextarea({ label, value, onChange, rows = 2, mono = false }) {
  return (
    <label className="av-field">
      <span className="av-field-label">{label}</span>
      <textarea
        className={`av-input av-textarea ${mono ? 'av-mono' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
      />
    </label>
  )
}
