/** @typedef {'error'|'warning'} SeveridadIssue */

export const SEVERIDAD = {
  ERROR: /** @type {const} */ ('error'),
  WARNING: /** @type {const} */ ('warning'),
}

/**
 * @param {import('../api/validarCampana.js').ResultadoValidacionJson} r
 * @returns {{ ok: boolean, sinIncidencias: boolean }}
 */
export function resumenFlags(r) {
  const n = Array.isArray(r.issues) ? r.issues.length : 0
  return {
    ok: Boolean(r.ok),
    sinIncidencias: n === 0,
  }
}
