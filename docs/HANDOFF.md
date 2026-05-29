# HANDOFF — dm_editor (editor de campañas)

**Fecha:** 2026-05-28 · **Transcript:** `6002b78b-b031-4f19-bb95-986bb7c7aac7`  
**Repo:** `/home/paco/python/proyectos/dm_editor` (Vite/React, :5180 → proxy API motor)  
**Hermano:** `dm_virtual` (motor, :8000) — handoff: `dm_virtual/docs/HANDOFF.md`

---

## Metodología de traspaso

Antes de generar el HANDOFF, identifica explícitamente el proyecto objetivo y demuestra que has leído sus directorios principales, documentación y archivos relevantes. Si detectas varios repositorios relacionados, explica cuál estás analizando y por qué.

**Aplicado en este documento:** proyecto objetivo **`dm_editor`** (autoría YAML, validación vía motor, catálogo F14, F15, F15b). No sustituye al handoff del motor. Relación con `dm_virtual`: fuente de verdad de reglas y samples; este repo solo consume APIs editor y copia canon.

---

## Objetivo actual

**F15 cerrada** (`a3e4e0e`): samples, validación canónica en guardado/export, issues MAPA_* por localización.

**F15b cerrada** (`092d384`): colocador visual `puntos_interes` en mapa libre — SPEC `docs/specs/F15b_Colocador_Visual_Puntos_Interes_dm_editor.md` (`Estado: cerrada`). Cadena: `d93434d` (A) → `5d8c1c3` (replace) → `15b707b`/`092d384` (B). Guía: `public/ayuda/GUIA_EDITOR_DM.md` §6.

**Paralelo en motor:** **F4.h cerrada** — `objeto_canonico` en mapa (runtime recoger; corona en `cripta_sala`).

**Siguiente sugerido (editor):** backlog Guardian / plantillas; deuda UX colocador (`ResizeObserver` en `ColocadorPuntosDialog` si molesta el zoom).

**Fuera de F15/F15b (mesa/producto, no implementado):** destruir corona vía evento, UX finales en Control/DM, i18n `ENDING.LABEL`, pintar `transicion` en lienzo del jugador.

---

## Estado actual

| Área | Estado |
|------|--------|
| Motor `dm_virtual` | RO desde editor; F4.h runtime OK |
| Editor F15 | Cerrada (`a3e4e0e`) |
| Editor F15b | Cerrada (`092d384`): `ColocadorPuntosDialog`, normalización Opción B, `replace` al aplicar |
| `npm run lint` / `build` | exit 0 / OK (3 warnings lint documentados en F15) |
| F14 catálogo editor | OK |
| UI táctica visual | Eliminada; no reintroducir |

**Higiene git:** `main` con commits F15b locales; coordinar push si trabajo en paralelo. **Stash:** `stash@{0}: WIP pre-F15-A` — **no aplicar** salvo decisión explícita.

---

## Decisiones arquitectónicas importantes

1. **Una fuente de verdad** para reglas: `validar_campana.py` en motor. El editor **no** duplica reglas en JS.
2. **Guardar/export** = puerta F15-B; validación local nunca autoriza persistencia.
3. **Colocador F15b:** `celda` en %; normalizar `puntos_interes` + spawns antes de borrar `cols`/`rows`; aplicar con `{ replace: true }`.
4. **F15b no toca `dm_virtual`.** Autoría `transicion`/`objeto_canonico` en YAML; runtime PJ para transiciones = backlog motor.

---

## Archivos relevantes

| Ruta | Rol |
|------|-----|
| `docs/specs/F15b_Colocador_Visual_Puntos_Interes_dm_editor.md` | SPEC cerrada F15b |
| `src/components/aventura/ColocadorPuntosDialog.jsx` | Modal colocador |
| `src/components/aventura/SeccionLocalizaciones.jsx` | Entrada «Editar puntos del mapa» |
| `src/domain/aventura.js` | `normalizarMapaACoordenadasLibres`, `nuevoPuntoInteres`, `parseIndicePunto` |
| `docs/specs/F15_Coherencia_Validacion_Samples_dm_editor.md` | F15 cerrada |
| `public/ayuda/GUIA_EDITOR_DM.md` | Uso colocador §6 |
| `dm_virtual/docs/specs/F4_h_*.md` | Contrato `objeto_canonico` runtime |

---

## Trabajo realizado (F15b)

- Colocador solo lectura + normalización Opción B (`d93434d`).
- Fix aplicar con `replace` — no reinyectar rejilla (`5d8c1c3`).
- Edición completa + click-to-place (`15b707b`, `092d384`).
- Validación programática idempotencia (19 mapas ejemplo); pruebas manuales autor.

---

## Trabajo pendiente (prioridad)

1. **Push / coordinación** si `main` local lleva commits sin remoto.
2. **Opcional UX:** `ResizeObserver` + remediar `mapBox` al abrir panel de edición en colocador.
3. **Pulido Guardian** en editor — backlog motor `00_ESTADO_ACTUAL.md`.
4. **Mesa/motor:** transiciones en lienzo PJ, portales DM, finales Control.

---

## Cómo continuar

1. Leer `docs/specs/F15b_*.md` (cerrada) o backlog Guardian.
2. `cd dm_editor && git status` — no `stash pop` sin orden.
3. Motor :8000 + editor :5180 para probar campañas.
4. Cambios de reglas → motor primero; editor solo UI/helpers puros.
