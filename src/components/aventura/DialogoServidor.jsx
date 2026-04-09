import { useCallback, useEffect, useState } from 'react'
import { listarAventuras, cargarAventura, borrarAventura } from '../../api/aventuras.js'

function formatDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * Diálogo modal para listar aventuras del servidor y cargar/borrar una.
 * @param {{ open: boolean, onClose: () => void, onLoad: (yamlText: string, label: string) => void }} props
 */
export default function DialogoServidor({ open, onClose, onLoad }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const refrescar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLista(await listarAventuras())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) refrescar()
  }, [open, refrescar])

  const handleLoad = async (slug, nombre) => {
    setLoading(true)
    setError(null)
    try {
      const { yaml_text } = await cargarAventura(slug)
      onLoad(yaml_text, `Servidor: ${nombre}`, slug)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (slug) => {
    setLoading(true)
    setError(null)
    try {
      await borrarAventura(slug)
      setConfirmDelete(null)
      await refrescar()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="av-modal-overlay" onClick={onClose}>
      <div className="av-modal" onClick={e => e.stopPropagation()}>
        <div className="av-modal-header">
          <h3>Aventuras en el servidor</h3>
          <button type="button" className="av-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="av-modal-error">{error}</div>}

        <div className="av-modal-body">
          {loading && !lista && <p className="av-modal-status">Conectando con el servidor…</p>}

          {lista && lista.length === 0 && (
            <p className="av-modal-status">No hay aventuras guardadas en el servidor.</p>
          )}

          {lista && lista.length > 0 && (
            <table className="av-modal-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug</th>
                  <th>Tamaño</th>
                  <th>Modificado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map(a => (
                  <tr key={a.slug}>
                    <td className="av-modal-nombre">{a.nombre}</td>
                    <td className="av-modal-slug">{a.slug}</td>
                    <td>{formatSize(a.size)}</td>
                    <td>{formatDate(a.modified)}</td>
                    <td className="av-modal-actions">
                      <button
                        type="button"
                        className="btn-primary av-btn-small"
                        disabled={loading}
                        onClick={() => handleLoad(a.slug, a.nombre)}
                      >
                        Cargar
                      </button>
                      {confirmDelete === a.slug ? (
                        <>
                          <button
                            type="button"
                            className="av-btn-danger av-btn-small"
                            disabled={loading}
                            onClick={() => handleDelete(a.slug)}
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            className="btn-secondary av-btn-small"
                            onClick={() => setConfirmDelete(null)}
                          >
                            No
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary av-btn-small"
                          disabled={loading}
                          onClick={() => setConfirmDelete(a.slug)}
                        >
                          Borrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="av-modal-footer">
          <button type="button" className="btn-secondary" onClick={refrescar} disabled={loading}>
            Refrescar
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
