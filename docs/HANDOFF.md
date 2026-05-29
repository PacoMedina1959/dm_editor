# HANDOFF — dm_editor (editor de campañas)

**Fecha:** 2026-05-28 · **Transcript:** `6002b78b-b031-4f19-bb95-986bb7c7aac7`  
**Repo:** `/home/paco/python/proyectos/dm_editor` (Vite/React, :5180 → proxy API motor)  
**Hermano:** `dm_virtual` (motor, :8000) — handoff: `dm_virtual/docs/HANDOFF.md`

---

## Metodología de traspaso

Antes de generar el HANDOFF, identifica explícitamente el proyecto objetivo y demuestra que has leído sus directorios principales, documentación y archivos relevantes. Si detectas varios repositorios relacionados, explica cuál estás analizando y por qué.

**Aplicado en este documento:** proyecto objetivo **`dm_editor`** (autoría YAML, validación vía motor, catálogo F14, F15). No sustituye al handoff del motor. Relación con `dm_virtual`: fuente de verdad de reglas y samples; este repo solo consume APIs editor y copia canon. Revisión base: `docs/specs/F15_*.md`, `src/pages/AventuraPage.jsx`, `src/api/validarCampana.js`, `tools/sync_samples_from_dm_virtual.sh`, `git log`/`status` del editor.

---

## Objetivo actual

**F15 cerrada** (`a3e4e0e`): samples, validación canónica en guardado/export, issues MAPA_* por localización, lint sin errores. SPEC: `cerrada` — ver `docs/specs/F15_Coherencia_Validacion_Samples_dm_editor.md`.

**F15b validada** (`426ccef`): colocador visual `puntos_interes` — SPEC `docs/specs/F15b_Colocador_Visual_Puntos_Interes_dm_editor.md`. **Siguiente:** F15b-A (lectura/render + normalización Opción B).

**Paralelo en motor:** **F4.h cerrada** (`7d05fee`/`daa9643`) — `objeto_canonico` en mapa (corona en `cripta_sala`).

**Fuera de F15 (mesa/producto, no implementado):** destruir corona vía evento `destruir_corona`, UX de finales en Control/DM, i18n `ENDING.LABEL` en jugador.

---

## Estado actual

| Área | Estado |
|------|--------|
| Motor `dm_virtual` | `main` alineado con `origin/main`; solo **untracked** `backend/data/campañas/ejemplo/catalogos/` |
| F4.h runtime | Implementado: validación, WS `recoger_objeto_mapa`, corona en YAML, tests |
| Editor F15 (cerrada) | A `d98ef61`, B `00ac290`, C `6600ba0`, D `a3e4e0e` — samples, guardado canónico, mapa por loc, lint OK |
| `npm run lint` / `build` | exit 0 / OK (3 warnings lint documentados en F15 §5) |
| F14 catálogo editor | OK (`16697a6`); global RO + local + override |
| UI táctica visual (calibrador, walkmask…) | Eliminada en `ab8280d`; no reintroducir en F15 |

**Higiene git:** `main` sincronizado con `origin` tras F15. **Stash:** `stash@{0}: WIP pre-F15-A` — **no aplicar** salvo decisión explícita (cambios ajenos a F15).

---

## Decisiones arquitectónicas importantes

1. **Una fuente de verdad** para reglas de campaña: `dm_virtual/backend/app/core/validar_campana.py` (+ `GestorEscenas` en build). El editor **no** duplica reglas en JS.
2. **Guardar/export** en `/aventura` = puerta de validación canónica (F15-B); validación local (`validarAventura`) solo pre-check, nunca autoriza persistencia.
3. **Samples** = copia del motor vía script; no mantenimiento manual en `public/samples/`.
4. **Principio motor:** «La IA narra, el motor valida» — si narrativa y estado chocan, gana `EstadoMundo`.
5. **Mapa principal:** mapa libre Owlbear (coords `0..100`, floats); legado táctico fuera del contrato principal (F4.g).
6. **Catálogo F14:** global RO en runtime; local por slug con override; validación con `catalogo_objetos_text` si hay `serverSlug`.
7. **F15-C:** filtrar `issues` por `path` (`localizaciones:{locId}.mapa…`), no reescribir `validar_campana.py`.
8. **Commits F15 acotados** — no mezclar stash WIP ni cambios ajenos (IA mapa, NPCs).

---

## Archivos relevantes

| Ruta | Rol |
|------|-----|
| `dm_editor/docs/specs/F15_Coherencia_Validacion_Samples_dm_editor.md` | SPEC maestra; checklist §5 |
| `dm_editor/src/pages/AventuraPage.jsx` | Guardar/export + validación B; cablear issues → localizaciones (C) |
| `dm_editor/src/pages/ValidarYamlPage.jsx` | Patrón correcto `postValidarCampana` |
| `dm_editor/src/api/validarCampana.js` | Cliente HTTP validación |
| `dm_editor/docs/specs/F15b_Colocador_Visual_Puntos_Interes_dm_editor.md` | Colocador mapa libre; Opción B coords |
| `dm_editor/src/domain/aventura.js` | `issuesMapaParaLocalizacion`; helpers F15b |
| `dm_editor/src/components/aventura/SeccionLocalizaciones.jsx` | Panel salud mapa (C) |
| `dm_editor/tools/sync_samples_from_dm_virtual.sh` | Sync samples (A) |
| `dm_virtual/backend/app/core/validar_campana.py` | Códigos `MAPA_*`, `MAPA_PI_*` |
| `dm_virtual/docs/EDITOR_APP_CONTRACT.md` | Contrato APIs editor |
| `dm_virtual/docs/specs/F4_h_*.md` | `objeto_canonico` runtime |
| `dm_virtual/docs/specs/F14_*.md` | Catálogo global/local |
| `dm_virtual/docs/00_ESTADO_ACTUAL.md` | Panorama motor |
| `dm_virtual/backend/data/campañas/ejemplo/aventura.yaml` | Canon ejemplo (corona, finales) |

---

## Trabajo realizado (sesión / commits recientes)

**dm_editor:** F15 SPEC (`6254b58`) → A samples (`d98ef61`) → B validación guardado (`00ac290`) → fix F14 overrides (`16697a6`). Simplificación mapas (`ab8280d`).

**dm_virtual:** F4.h objetos canónicos en mapa (`5ffe6b0`…`daa9643`); límite recogida a jugadores; campaña ejemplo con `corona_pedestal`.

**Conversación (producto, sin código):** corona = recoger en mapa + evento `destruir_corona` en `mina_veta`/escena 5; `dm_forzar_transicion_escena` persiste final pero Control no muestra epílogo; tras final solo Nueva partida; catálogo editor «Global» vs «Esta aventura» aclarado.

---

## Trabajo pendiente (prioridad)

1. **F15b-A en curso** — `ColocadorPuntosDialog` + `normalizarMapaACoordenadasLibres` (4 campos `celda`); luego B/C/D.
2. **Pulido Guardian** en editor (plantillas, validadores) — backlog `dm_virtual/docs/00_ESTADO_ACTUAL.md`.
3. **Verificación manual** checklist F15 §5 si cambia el motor o los samples.
4. **Post-F15 / mesa:** bugs producto en `dm_virtual` (finales Control, `ENDING.LABEL`, destruir corona).

---

## Riesgos y advertencias

- **Stash `WIP pre-F15-A`:** mezclarlo con F15 genera conflictos y commits sucios.
- **Validación local engañosa:** sin backend o sin C, el autor puede creer que el mapa está bien (solo exige `mapa.imagen`).
- **`main` editor sin push:** 5 commits locales; coordinar antes de trabajo en paralelo.
- **Handler WS monolítico** (`main.py`): funcional pero frágil; no refactorizar sin SPEC.
- **Tests backend:** ejecutar con `.venv`; suite completa puede tener fallos históricos fuera de alcance (ver `00_ESTADO_ACTUAL.md`).
- **Finales / corona:** forzar final desde Control no arregla inventario ni UI DM; destruir corona no tiene UI mecánica en DM humano directo.
- **No revertir** puerta B ni sync A sin motivo documentado.

---

## Cómo continuar

1. Leer `docs/specs/F15b_Colocador_Visual_Puntos_Interes_dm_editor.md` (validada; §1.bis normalización).
2. `cd dm_editor && git status` — **no** `git stash pop` sin orden.
3. Motor :8000 + editor :5180; implementar F15b-A→D sin tocar `dm_virtual`.
4. Tras F15b cerrada: resincronizar samples si cambia el YAML ejemplo en motor.
