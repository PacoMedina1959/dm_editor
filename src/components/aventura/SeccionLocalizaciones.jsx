import { useState } from 'react'
import FilterInput from './FilterInput.jsx'
import ColocadorPuntosDialog from './ColocadorPuntosDialog.jsx'
import MapaIADialog from './MapaIADialog.jsx'

import { urlMapaPublico } from '../../api/mapaIA.js'
import { issuesMapaParaLocalizacion } from '../../domain/aventura.js'

const EMPTY = {
  id: '', nombre: '', nombre_en: '', zona: '', conexiones: [],
  oculta: false, descripcion: '', notas_dm: '',
}

export default function SeccionLocalizaciones({
  localizaciones,
  eventosDefinidos = [],
  onUpdate,
  onOpenIA,
  serverSlug,
  dirty,
  validacionCanonica,
}) {
  const issuesCanonicos = validacionCanonica
    ? (Array.isArray(validacionCanonica.issues) ? validacionCanonica.issues : [])
    : null

  const [editIdx, setEditIdx] = useState(null)
  const [mapaIdx, setMapaIdx] = useState(null)
  const [colocadorIdx, setColocadorIdx] = useState(null)

  const [mapaAvisos, setMapaAvisos] = useState({})
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

  const mapaEsTactico = (mapa) => {
    if (!mapa || typeof mapa !== 'object') return false
    if (mapa.tipo === 'overworld' || mapa.proyeccion === 'overworld' || mapa.proyeccion === 'bandas') return false
    return mapa.tipo === 'tactico'
      || mapa.proyeccion === 'tactico'
      || mapa.proyeccion === 'dimetrico_2_1'
      || !!mapa.imagen
  }

  const normalizarMapaTactico = (mapa) => {
    if (!mapa || typeof mapa !== 'object') return mapa
    const next = { ...mapa }
    if (mapaEsTactico(next)) {
      next.tipo = next.tipo || 'tactico'
      next.proyeccion = 'dimetrico_2_1'
    }
    return next
  }

  const cambioRiesgosoDeMapa = (prev, next) => {
    if (!prev || !next) return false
    const tieneEstructura =
      prev.spawn_entrada
      || prev.pisable
      || (Array.isArray(prev.puntos_interes) && prev.puntos_interes.length > 0)
      || (Array.isArray(prev.presencias_tacticas) && prev.presencias_tacticas.length > 0)
    if (!tieneEstructura) return false
    return ['imagen', 'tile_w', 'tile_h', 'cols', 'rows', 'origen_px'].some((k) => (
      JSON.stringify(prev[k] ?? null) !== JSON.stringify(next[k] ?? null)
    ))
  }

  /**
   * Misma carpeta y base que la imagen raster → convención `Cripta_01.png` + `Cripta_01.tmj`.
   * Solo se usa cuando aún no hay `tiled.json` en YAML (p. ej. tras quitar mapa y resubir PNG).
   */
  const inferirTiledJsonDesdeImagen = (imagen) => {
    if (typeof imagen !== 'string') return null
    const t = imagen.trim().replace(/^\//, '')
    if (!t || t.includes('..')) return null
    const m = t.match(/^(.*)\.(png|webp|jpe?g)$/i)
    if (!m) return null
    return `${m[1]}.tmj`
  }

  /** Rellena `tiled.json` por convención de nombre si falta y la imagen lo permite. */
  const enlazarTiledRasterHermanoSiFalta = (mapa) => {
    if (!mapa || typeof mapa !== 'object') return mapa
    if (String(mapa.tiled?.json || '').trim()) return mapa
    const inf = inferirTiledJsonDesdeImagen(mapa.imagen)
    if (!inf) return mapa
    const prevTiled = mapa.tiled && typeof mapa.tiled === 'object' ? mapa.tiled : {}
    return { ...mapa, tiled: { ...prevTiled, json: inf } }
  }

  /**
   * Actualiza (o borra, con `mapa = null`) el sub-objeto `mapa` de una
   * localizacion. Es el callback que usa `MapaIADialog` al aplicar.
   *
   * Opcionalmente acepta un `locPatch` para actualizar en el mismo
   * commit otros campos de la loc (por ejemplo `hora_del_dia` cuando
   * el DM ha hecho override en el dialogo).
   */
  const updateMapa = (i, mapa, locPatch = null, opts = {}) => {
    if (!editable) return
    const copy = [...items]
    const loc = { ...copy[i] }
    if (mapa == null) {
      delete loc.mapa
    } else {
      const prevMapa = loc.mapa || {}
      // `replace`: el mapa entrante ya es completo (p. ej. la normalización
      // Opción B del colocador, que elimina cols/rows). NO fusionar con el
      // previo: si no, los campos de rejilla reaparecerían y el runtime volvería
      // a modo grid, re-interpretando las celdas ya pasadas a % (desplazamiento).
      loc.mapa = normalizarMapaTactico(
        opts.replace ? { ...mapa } : { ...(loc.mapa || {}), ...mapa },
      )
      loc.mapa = enlazarTiledRasterHermanoSiFalta(loc.mapa)
      if (!opts.replace && cambioRiesgosoDeMapa(prevMapa, loc.mapa)) {
        setMapaAvisos(prev => ({
          ...prev,
          [loc.id]: 'Has cambiado la imagen o calibración. Revisa spawn, walkmask y transiciones antes de jugar.',
        }))
      }
    }
    if (locPatch && typeof locPatch === 'object') {
      for (const [k, v] of Object.entries(locPatch)) {
        // `null` => borrar el campo; cualquier otro valor => set.
        if (v === null) delete loc[k]
        else loc[k] = v
      }
    }
    copy[i] = loc
    onUpdate(copy)
  }

  const quitarMapa = (i) => {
    if (!window.confirm('¿Quitar el mapa asignado a esta localizacion? (La imagen permanece en disco por cache)')) return
    updateMapa(i, null)
  }

  if (!items.length && !editable) return null

  return (
    <section className="av-section">
      <div className="av-section-header">
        <h2 className="av-section-title">Localizaciones ({items.length})</h2>
        {editable && (
          <button type="button" className="av-edit-toggle" onClick={startAdd}>+ Añadir</button>
        )}
        {onOpenIA && <button type="button" className="av-btn-ia-inline" onClick={onOpenIA} title="Generar con IA">✨ IA</button>}
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
                    serverSlug={serverSlug}
                    dirty={dirty}
                    issuesCanonicos={issuesCanonicos}
                    onEdit={() => startEdit(realIdx)}
                    onDuplicate={() => duplicate(realIdx)}
                    onMoveUp={() => move(realIdx, -1)}
                    onMoveDown={() => move(realIdx, 1)}
                    onGenerarMapa={() => setMapaIdx(realIdx)}
                    onEditarPuntos={() => setColocadorIdx(realIdx)}
                    onQuitarMapa={() => quitarMapa(realIdx)}
                    avisoMapa={mapaAvisos[loc.id]}
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

      <MapaIADialog
        open={mapaIdx !== null}
        slug={serverSlug}
        loc={mapaIdx !== null ? items[mapaIdx] : null}
        onClose={() => setMapaIdx(null)}
        onAplicar={(mapa, extras) => {
          if (mapaIdx !== null) updateMapa(mapaIdx, mapa, extras)
        }}
      />

      {colocadorIdx !== null && (
        <ColocadorPuntosDialog
          key={colocadorIdx}
          serverSlug={serverSlug}
          loc={items[colocadorIdx]}
          localizaciones={items}
          eventosDefinidos={eventosDefinidos}
          validacionCanonica={validacionCanonica}
          readOnly={false}
          onClose={() => setColocadorIdx(null)}
          onApply={(mapa) => updateMapa(colocadorIdx, mapa, null, { replace: true })}
        />
      )}

    </section>
  )
}

function LocRow({
  loc,
  editable,
  serverSlug,
  dirty,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onGenerarMapa,
  onEditarPuntos,
  onQuitarMapa,
  avisoMapa,
  issuesCanonicos,
  isFirst,
  isLast,
}) {
  const [expanded, setExpanded] = useState(false)
  const tieneImagenRaster = !!String(loc.mapa?.imagen || '').trim()
  const tieneMapa = tieneImagenRaster || loc.mapa?.modo_render === 'piezas'
  const tieneAmbienteAudio = !!String(loc.ambiente?.audio?.src || '').trim()
  const sfxCount = Array.isArray(loc.ambiente?.sfx) ? loc.ambiente.sfx.length : 0
  return (
    <div className="av-crud-row">
      <div className="av-crud-row-main" onClick={() => setExpanded(!expanded)}>
        <span className="av-cell-id">{loc.id}</span>
        <span className="av-crud-row-name">{loc.nombre}{loc.nombre_en ? ` / ${loc.nombre_en}` : ''}</span>
        <span className="av-cell-tags">
          {(loc.conexiones || []).map(c => <span key={c} className="av-tag">{c}</span>)}
        </span>
        {tieneMapa && <span className="av-tag" title={`Mapa ${loc.mapa.tipo || ''}`}>🗺️</span>}
        {tieneAmbienteAudio && <span className="av-tag" title="Audio de ambiente">🎵</span>}
        {sfxCount > 0 && <span className="av-tag" title="Efectos de sonido">🔊 {sfxCount}</span>}
        {loc.oculta && <span className="av-tag">🔒</span>}
      </div>
      {expanded && (
        <div className="av-detail">
          {loc.descripcion && <p className="av-desc">{loc.descripcion}</p>}
          {loc.notas_dm && <p className="av-desc av-desc-dm">🎭 {loc.notas_dm}</p>}
          {(tieneAmbienteAudio || sfxCount > 0) && (
            <p className="av-desc">
              <strong>Ambiente:</strong>{' '}
              {tieneAmbienteAudio ? `audio (${loc.ambiente.audio.src})` : 'sin audio base'}
              {sfxCount > 0 ? ` · ${sfxCount} sfx` : ''}
            </p>
          )}
          {editable && (
            <MapaBloque
              loc={loc}
              serverSlug={serverSlug}
              dirty={dirty}
              onGenerar={onGenerarMapa}
              onEditarPuntos={onEditarPuntos}
              onQuitar={onQuitarMapa}
              avisoMapa={avisoMapa}
              issuesCanonicos={issuesCanonicos}
            />
          )}
        </div>
      )}
      {editable && (
        <div className="av-crud-actions">
          <button
            type="button"
            className="av-btn-icon"
            onClick={onGenerarMapa}
            disabled={!serverSlug}
            title={serverSlug
              ? (tieneMapa ? 'Regenerar mapa 2.5D con IA' : 'Generar mapa 2.5D con IA')
              : 'Guarda la aventura en el servidor para generar mapa'}
            style={tieneMapa ? { color: '#60a5fa' } : undefined}
          >
            🗺️
          </button>
          <button type="button" className="av-btn-icon" onClick={onEdit} title="Editar">✎</button>
          <button type="button" className="av-btn-icon" onClick={onDuplicate} title="Duplicar">⧉</button>
          {!isFirst && <button type="button" className="av-btn-icon" onClick={onMoveUp} title="Subir">▲</button>}
          {!isLast && <button type="button" className="av-btn-icon" onClick={onMoveDown} title="Bajar">▼</button>}
        </div>
      )}
    </div>
  )
}

/**
 * Bloque de gestion del mapa 2.5D (imagen de fondo generada por IA) para una
 * localizacion. Muestra estado actual + botones de accion.
 *
 * Estados:
 *  - Sin `serverSlug`: botones deshabilitados con pista para guardar primero.
 *  - `serverSlug` valido y sin mapa: boton "Generar mapa con IA".
 *  - `serverSlug` valido y con mapa: thumbnail + "Regenerar" + "Quitar".
 *  - `dirty`: aviso de que el prompt se construye con el YAML del disco.
 */
function MapaBloque({
  loc,
  serverSlug,
  dirty,
  onGenerar,
  onEditarPuntos,
  onQuitar,
  avisoMapa,
  issuesCanonicos = null,
}) {
  const tieneImagenRaster = !!String(loc.mapa?.imagen || '').trim()
  const tieneMapa = tieneImagenRaster || loc.mapa?.modo_render === 'piezas'
  const puede = !!serverSlug
  const urlThumb = tieneMapa && serverSlug
    ? urlMapaPublico(serverSlug, loc.mapa.imagen)
    : null

  const issuesMapa = issuesCanonicos !== null
    ? issuesMapaParaLocalizacion(issuesCanonicos, loc.id)
    : null

  const issuesMinimos = []
  if (tieneMapa && !String(loc.mapa?.imagen || '').trim() && loc.mapa?.modo_render !== 'piezas') {
    issuesMinimos.push({ severity: 'error', message: 'Falta imagen de fondo.' })
  }

  let estadoLabel = 'Mapa incompleto'
  let estadoColor = '#fca5a5'
  let issuesMostrar = []

  if (!tieneMapa) {
    estadoLabel = ''
    estadoColor = '#94a3b8'
  } else if (issuesMapa === null) {
    estadoLabel = 'Validación de mapa requiere motor (Guardar/Validar)'
    estadoColor = '#fbbf24'
    issuesMostrar = issuesMinimos
  } else {
    const errores = issuesMapa.filter(i => i.severity === 'error')
    const avisos = issuesMapa.filter(i => i.severity === 'warning')
    if (errores.length > 0) {
      estadoLabel = 'Mapa con errores'
      estadoColor = '#fca5a5'
      issuesMostrar = issuesMapa
    } else if (avisos.length > 0) {
      estadoLabel = 'Mapa con avisos'
      estadoColor = '#fbbf24'
      issuesMostrar = issuesMapa
    } else {
      estadoLabel = 'Mapa validado por el motor'
      estadoColor = '#86efac'
      issuesMostrar = []
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 8,
        borderTop: '1px dashed #334155',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <strong style={{ fontSize: 13 }}>🗺️ Mapa 2.5D</strong>

      {urlThumb && (
        <img
          src={urlThumb}
          alt={`Mapa ${loc.id}`}
          style={{
            width: 96,
            height: 96,
            objectFit: 'cover',
            border: '1px solid #334155',
            borderRadius: 4,
            background: '#0f172a',
          }}
        />
      )}

      {tieneMapa && (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {loc.mapa.tipo || 'tactico'}
          {loc.mapa.generado_ia?.seed != null && ` · seed ${loc.mapa.generado_ia.seed}`}
        </span>
      )}

      {tieneMapa && estadoLabel && (
        <details style={{ flexBasis: '100%', fontSize: 12 }} open={issuesMostrar.length > 0}>
          <summary style={{ cursor: 'pointer', color: estadoColor, fontWeight: 700 }}>
            {estadoLabel}
          </summary>
          {issuesMostrar.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#cbd5e1' }}>
              {issuesMostrar.map(issue => (
                <li
                  key={`${issue.code || 'issue'}-${issue.path || ''}-${issue.message}`}
                  style={{ color: issue.severity === 'error' ? '#fca5a5' : issue.severity === 'warning' ? '#fbbf24' : '#cbd5e1' }}
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}

      {!tieneMapa && (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          Sin mapa asignado.
        </span>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button
          type="button"
          className={tieneMapa ? 'btn-secondary av-btn-small' : 'btn-primary av-btn-small'}
          onClick={onGenerar}
          disabled={!puede}
          title={!puede ? 'Guarda primero la aventura en el servidor' : ''}
        >
          {tieneMapa ? 'Regenerar con IA' : 'Generar mapa con IA'}
        </button>

        {tieneImagenRaster && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onEditarPuntos}
            disabled={!puede}
            title="Colocar objetos canónicos y transiciones sobre el mapa"
          >
            Editar puntos del mapa
          </button>
        )}

        {tieneMapa && (
          <button
            type="button"
            className="av-btn-danger av-btn-small"
            onClick={onQuitar}
            disabled={!puede}
          >
            Quitar mapa
          </button>
        )}
      </div>

      {!puede && (
        <div style={{ flexBasis: '100%', fontSize: 11, color: '#f59e0b' }}>
          Para generar el mapa primero hay que guardar la aventura en el servidor (se necesita el slug).
        </div>
      )}

      {puede && dirty && (
        <div style={{ flexBasis: '100%', fontSize: 11, color: '#f59e0b' }}>
          Tienes cambios sin guardar; el prompt del mapa se construira con la ultima version guardada en el servidor.
        </div>
      )}

      {avisoMapa && (
        <div style={{ flexBasis: '100%', fontSize: 11, color: '#f59e0b' }}>
          {avisoMapa}
        </div>
      )}
    </div>
  )
}

function LocForm({ draft: initial, onSave, onCancel, onDelete }) {
  const [d, setD] = useState(initial)
  const [confirmDel, setConfirmDel] = useState(false)
  const upd = (k, v) => setD(prev => ({ ...prev, [k]: v }))
  const audio = d.ambiente?.audio || {}
  const sfx = Array.isArray(d.ambiente?.sfx) ? d.ambiente.sfx : []

  const setAudioField = (key, value) => {
    setD(prev => {
      const next = { ...prev }
      const ambiente = { ...(next.ambiente || {}) }
      const audioObj = { ...(ambiente.audio || {}) }
      if (value === '' || value == null) delete audioObj[key]
      else audioObj[key] = value
      if (Object.keys(audioObj).length > 0) ambiente.audio = audioObj
      else delete ambiente.audio
      if (Object.keys(ambiente).length > 0) next.ambiente = ambiente
      else delete next.ambiente
      return next
    })
  }

  const setSfxFromLines = (raw) => {
    const entries = String(raw || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(src => ({ src }))
    setD(prev => {
      const next = { ...prev }
      const ambiente = { ...(next.ambiente || {}) }
      if (entries.length > 0) ambiente.sfx = entries
      else delete ambiente.sfx
      if (Object.keys(ambiente).length > 0) next.ambiente = ambiente
      else delete next.ambiente
      return next
    })
  }

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
      <details className="av-inline-help">
        <summary>Ayuda rápida · ambiente de localización</summary>
        <p>
          Usa rutas relativas de campaña. Ejemplo audio base:
          <code> assets/audio/ambiente/taberna_loop.ogg</code>
        </p>
        <p>
          SFX: una ruta por línea (ejemplo <code>assets/audio/sfx/chimenea.wav</code>).
          El runtime mezcla base + SFX y aplica <code>fade_ms</code> al cambiar de lugar.
        </p>
        <p className="av-inline-help-note">
          Reglas: volumen entre 0 y 1; rutas sin <code>..</code>; formatos sugeridos
          <code> .ogg/.mp3/.wav/.m4a</code>.
        </p>
      </details>
      <div className="av-form-row2">
        <Field
          label="Ambiente · audio src"
          value={audio.src ?? ''}
          onChange={v => setAudioField('src', v)}
        />
        <label className="av-field-inline">
          <input
            type="checkbox"
            checked={audio.loop !== false}
            onChange={e => setAudioField('loop', e.target.checked)}
          />
          <span>Loop ambiente</span>
        </label>
      </div>
      <div className="av-form-row2">
        <label className="av-field">
          <span className="av-field-label">Ambiente · volumen (0..1)</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            className="av-input"
            value={audio.volumen ?? ''}
            onChange={e => {
              const raw = e.target.value
              if (raw === '') setAudioField('volumen', null)
              else {
                const n = Number(raw)
                setAudioField('volumen', Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null)
              }
            }}
          />
        </label>
        <label className="av-field">
          <span className="av-field-label">Ambiente · fade ms</span>
          <input
            type="number"
            min="0"
            max="10000"
            step="100"
            className="av-input"
            value={audio.fade_ms ?? ''}
            onChange={e => {
              const raw = e.target.value
              if (raw === '') setAudioField('fade_ms', null)
              else {
                const n = Number(raw)
                setAudioField('fade_ms', Number.isFinite(n) ? Math.max(0, Math.min(10000, Math.round(n))) : null)
              }
            }}
          />
        </label>
      </div>
      <FieldTextarea
        label="SFX por defecto (una ruta por línea)"
        value={sfx.map(x => x?.src).filter(Boolean).join('\n')}
        onChange={setSfxFromLines}
      />
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
