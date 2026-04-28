import { useState } from 'react'
import FilterInput from './FilterInput.jsx'
import MapaIADialog from './MapaIADialog.jsx'
import CalibradorGridDialog from './CalibradorGridDialog.jsx'
import WalkmaskBrushDialog from './WalkmaskBrushDialog.jsx'
import TransitionPointsDialog from './TransitionPointsDialog.jsx'
import SpawnEntranceDialog from './SpawnEntranceDialog.jsx'
import NpcSpawnsDialog from './NpcSpawnsDialog.jsx'
import PresenciasTacticasDialog from './PresenciasTacticasDialog.jsx'
import PiezasTacticasDialog from './PiezasTacticasDialog.jsx'
import { urlMapaPublico } from '../../api/mapaIA.js'
import { validarMapaRuntimeLocalizacion } from '../../domain/aventura.js'

const EMPTY = {
  id: '', nombre: '', nombre_en: '', zona: '', conexiones: [],
  oculta: false, descripcion: '', notas_dm: '',
}

export default function SeccionLocalizaciones({
  localizaciones,
  npcs = [],
  bestiario = [],
  assetsTacticos = [],
  onUpdate,
  onOpenIA,
  serverSlug,
  dirty,
}) {
  const [editIdx, setEditIdx] = useState(null)
  const [mapaIdx, setMapaIdx] = useState(null)
  const [calibradorIdx, setCalibradorIdx] = useState(null)
  const [walkmaskIdx, setWalkmaskIdx] = useState(null)
  const [transicionesIdx, setTransicionesIdx] = useState(null)
  const [spawnIdx, setSpawnIdx] = useState(null)
  const [npcSpawnsIdx, setNpcSpawnsIdx] = useState(null)
  const [presenciasIdx, setPresenciasIdx] = useState(null)
  const [piezasIdx, setPiezasIdx] = useState(null)
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
   * Actualiza (o borra, con `mapa = null`) el sub-objeto `mapa` de una
   * localizacion. Es el callback que usa `MapaIADialog` al aplicar.
   *
   * Opcionalmente acepta un `locPatch` para actualizar en el mismo
   * commit otros campos de la loc (por ejemplo `hora_del_dia` cuando
   * el DM ha hecho override en el dialogo).
   */
  const updateMapa = (i, mapa, locPatch = null) => {
    if (!editable) return
    const copy = [...items]
    const loc = { ...copy[i] }
    if (mapa == null) {
      delete loc.mapa
    } else {
      const prevMapa = loc.mapa || {}
      loc.mapa = normalizarMapaTactico({
        ...(loc.mapa || {}),
        ...mapa,
      })
      if (cambioRiesgosoDeMapa(prevMapa, loc.mapa)) {
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
                    localizaciones={items}
                    npcs={npcs}
                    bestiario={bestiario}
                    editable={editable}
                    serverSlug={serverSlug}
                    dirty={dirty}
                    onEdit={() => startEdit(realIdx)}
                    onDuplicate={() => duplicate(realIdx)}
                    onMoveUp={() => move(realIdx, -1)}
                    onMoveDown={() => move(realIdx, 1)}
                    onGenerarMapa={() => setMapaIdx(realIdx)}
                    onQuitarMapa={() => quitarMapa(realIdx)}
                    onCalibrarGrid={() => setCalibradorIdx(realIdx)}
                    onPintarWalkmask={() => setWalkmaskIdx(realIdx)}
                    onEditarTransiciones={() => setTransicionesIdx(realIdx)}
                    onEditarSpawn={() => setSpawnIdx(realIdx)}
                    onEditarNpcSpawns={() => setNpcSpawnsIdx(realIdx)}
                    onEditarPresencias={() => setPresenciasIdx(realIdx)}
                    onEditarPiezas={() => setPiezasIdx(realIdx)}
                    assetsTacticos={assetsTacticos}
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

      {calibradorIdx !== null && (
        <CalibradorGridDialog
          key={`cal-${calibradorIdx}`}
          open
          slug={serverSlug}
          loc={items[calibradorIdx]}
          onClose={() => setCalibradorIdx(null)}
          onAplicar={(mapa) => updateMapa(calibradorIdx, mapa)}
        />
      )}

      {walkmaskIdx !== null && (
        <WalkmaskBrushDialog
          key={`walk-${walkmaskIdx}`}
          open
          slug={serverSlug}
          loc={items[walkmaskIdx]}
          onClose={() => setWalkmaskIdx(null)}
          onAplicar={(mapa) => updateMapa(walkmaskIdx, mapa)}
        />
      )}

      {transicionesIdx !== null && (
        <TransitionPointsDialog
          key={`trans-${transicionesIdx}`}
          open
          slug={serverSlug}
          loc={items[transicionesIdx]}
          localizaciones={items}
          onClose={() => setTransicionesIdx(null)}
          onAplicar={(mapa) => updateMapa(transicionesIdx, mapa)}
        />
      )}

      {spawnIdx !== null && (
        <SpawnEntranceDialog
          key={`spawn-${spawnIdx}`}
          open
          slug={serverSlug}
          loc={items[spawnIdx]}
          onClose={() => setSpawnIdx(null)}
          onAplicar={(mapa) => updateMapa(spawnIdx, mapa)}
        />
      )}

      {npcSpawnsIdx !== null && (
        <NpcSpawnsDialog
          key={`npc-spawn-${npcSpawnsIdx}`}
          open
          slug={serverSlug}
          loc={items[npcSpawnsIdx]}
          npcs={npcs}
          onClose={() => setNpcSpawnsIdx(null)}
          onAplicar={(mapa) => updateMapa(npcSpawnsIdx, mapa)}
        />
      )}

      {presenciasIdx !== null && (
        <PresenciasTacticasDialog
          key={`presencias-${presenciasIdx}`}
          open
          slug={serverSlug}
          loc={items[presenciasIdx]}
          bestiario={bestiario}
          onClose={() => setPresenciasIdx(null)}
          onAplicar={(mapa) => updateMapa(presenciasIdx, mapa)}
        />
      )}

      {piezasIdx !== null && (
        <PiezasTacticasDialog
          key={`piezas-${piezasIdx}`}
          open
          slug={serverSlug}
          loc={items[piezasIdx]}
          localizaciones={items}
          assetsTacticos={assetsTacticos}
          onClose={() => setPiezasIdx(null)}
          onAplicar={(mapa) => updateMapa(piezasIdx, mapa)}
        />
      )}
    </section>
  )
}

function LocRow({
  loc,
  localizaciones,
  npcs,
  bestiario,
  editable,
  serverSlug,
  dirty,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onGenerarMapa,
  onQuitarMapa,
  onCalibrarGrid,
  onPintarWalkmask,
  onEditarTransiciones,
  onEditarSpawn,
  onEditarNpcSpawns,
  onEditarPresencias,
  onEditarPiezas,
  assetsTacticos,
  avisoMapa,
  isFirst,
  isLast,
}) {
  const [expanded, setExpanded] = useState(false)
  const tieneMapa = !!loc.mapa?.imagen || loc.mapa?.modo_render === 'piezas'
  return (
    <div className="av-crud-row">
      <div className="av-crud-row-main" onClick={() => setExpanded(!expanded)}>
        <span className="av-cell-id">{loc.id}</span>
        <span className="av-crud-row-name">{loc.nombre}{loc.nombre_en ? ` / ${loc.nombre_en}` : ''}</span>
        <span className="av-cell-tags">
          {(loc.conexiones || []).map(c => <span key={c} className="av-tag">{c}</span>)}
        </span>
        {tieneMapa && <span className="av-tag" title={`Mapa ${loc.mapa.tipo || ''}`}>🗺️</span>}
        {loc.oculta && <span className="av-tag">🔒</span>}
      </div>
      {expanded && (
        <div className="av-detail">
          {loc.descripcion && <p className="av-desc">{loc.descripcion}</p>}
          {loc.notas_dm && <p className="av-desc av-desc-dm">🎭 {loc.notas_dm}</p>}
          {editable && (
            <MapaBloque
              loc={loc}
              serverSlug={serverSlug}
              dirty={dirty}
              onGenerar={onGenerarMapa}
              onQuitar={onQuitarMapa}
              onCalibrar={onCalibrarGrid}
              onPintarWalkmask={onPintarWalkmask}
              onEditarTransiciones={onEditarTransiciones}
              onEditarSpawn={onEditarSpawn}
              onEditarNpcSpawns={onEditarNpcSpawns}
              onEditarPresencias={onEditarPresencias}
              onEditarPiezas={onEditarPiezas}
              assetsTacticos={assetsTacticos}
              avisoMapa={avisoMapa}
              localizaciones={localizaciones}
              npcs={npcs}
              bestiario={bestiario}
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
  onQuitar,
  onCalibrar,
  onPintarWalkmask,
  onEditarTransiciones,
  onEditarSpawn,
  onEditarNpcSpawns,
  onEditarPresencias,
  onEditarPiezas,
  assetsTacticos = [],
  avisoMapa,
  localizaciones = [],
  npcs = [],
  bestiario = [],
}) {
  const tieneMapa = !!loc.mapa?.imagen || loc.mapa?.modo_render === 'piezas'
  const puede = !!serverSlug
  const urlThumb = tieneMapa && serverSlug
    ? urlMapaPublico(serverSlug, loc.mapa.imagen)
    : null
  const salud = tieneMapa ? validarMapaRuntimeLocalizacion(loc, localizaciones, { npcs, bestiario }) : null
  const estadoLabel = salud?.estado === 'ok'
    ? 'Mapa listo'
    : salud?.estado === 'warning'
      ? 'Mapa con avisos'
      : 'Mapa incompleto'
  const estadoColor = salud?.estado === 'ok'
    ? '#86efac'
    : salud?.estado === 'warning'
      ? '#fbbf24'
      : '#fca5a5'

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

      {tieneMapa && salud && (
        <details style={{ flexBasis: '100%', fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: estadoColor, fontWeight: 700 }}>
            {estadoLabel}
          </summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#cbd5e1' }}>
            {salud.issues.map(issue => (
              <li key={`${issue.code}-${issue.message}`} style={{ color: issue.severity === 'error' ? '#fca5a5' : issue.severity === 'warning' ? '#fbbf24' : '#86efac' }}>
                {issue.message}
              </li>
            ))}
          </ul>
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
        {tieneMapa && onCalibrar && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onCalibrar}
            disabled={!puede}
            title="Ajustar grid isométrico sobre la imagen"
          >
            📐 Calibrar grid
          </button>
        )}
        {tieneMapa && onPintarWalkmask && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onPintarWalkmask}
            disabled={!puede}
            title="Pintar celdas pisables y bloqueadas"
          >
            🖌️ Pintar walkmask
          </button>
        )}
        {tieneMapa && onEditarTransiciones && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onEditarTransiciones}
            disabled={!puede}
            title="Colocar salidas, puertas y escaleras tácticas"
          >
            🚪 Transiciones
          </button>
        )}
        {tieneMapa && onEditarSpawn && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onEditarSpawn}
            disabled={!puede}
            title="Colocar la celda donde aparece el grupo al entrar"
          >
            📍 Spawn entrada
          </button>
        )}
        {tieneMapa && onEditarNpcSpawns && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onEditarNpcSpawns}
            disabled={!puede}
            title="Colocar NPCs canónicos sobre el mapa táctico"
          >
            NPCs
          </button>
        )}
        {tieneMapa && onEditarPresencias && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onEditarPresencias}
            disabled={!puede}
            title="Colocar criaturas y presencias tácticas pasivas sobre el mapa"
          >
            Presencias
          </button>
        )}
        {tieneMapa && onEditarPiezas && (
          <button
            type="button"
            className="btn-secondary av-btn-small"
            onClick={onEditarPiezas}
            disabled={!puede || assetsTacticos.length === 0}
            title={assetsTacticos.length ? 'Colocar objetos tácticos estructurados' : 'Define assets_tacticos en la campaña para usar piezas'}
          >
            Piezas
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
