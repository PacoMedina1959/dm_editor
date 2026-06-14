# HANDOFF — dm_editor (editor de campañas)

**Fecha:** 2026-05-29 · **Transcript:** `6002b78b-b031-4f19-bb95-986bb7c7aac7`  
**Repo:** `/home/paco/python/proyectos/dm_editor` (Vite/React, :5180 → proxy API motor)  
**Hermano:** `dm_virtual` (motor, :8000) — handoff mesa/runtime: `dm_virtual/docs/HANDOFF.md`

---

## Metodología de traspaso

Antes de generar el HANDOFF, identifica explícitamente el proyecto objetivo y demuestra que has leído sus directorios principales, documentación y archivos relevantes. Si detectas varios repositorios relacionados, explica cuál estás analizando y por qué.

**Aplicado en este documento:** proyecto objetivo **`dm_editor`** (autoría YAML, validación vía motor, catálogo F14, F15, F15b). No sustituye al handoff del motor. Relación con `dm_virtual`: fuente de verdad de reglas y samples; este repo solo consume APIs editor y copia canon.

---

## Objetivo actual

**F15 cerrada** (`a3e4e0e`): samples, validación canónica en guardado/export, issues MAPA_* por localización.

**F15b cerrada** — SPEC `docs/specs/F15b_Colocador_Visual_Puntos_Interes_dm_editor.md` (`Estado: cerrada`). **HEAD** `5c69c3a`. Cadena: `d93434d` (A) → `5d8c1c3` (replace) → `15b707b`/`092d384` (B) → `41e8658`/`9f8c628`/`c162b14` (docs cierre + cifras `cripta_sala`) → `5c69c3a` (ResizeObserver `mapBox`). Guía: `public/ayuda/GUIA_EDITOR_DM.md` §6.

**Paralelo en motor (RO):** **F4.h cerrada** — `objeto_canonico` recogible en mapa; corona en `cripta_sala`.

**Siguiente sugerido (solo editor):** backlog Guardian / plantillas (`dm_virtual/docs/00_ESTADO_ACTUAL.md`).

**Fuera de este repo (ver `dm_virtual/docs/HANDOFF.md`):** finales en Control/DM, `ENDING.LABEL`, `destruir_corona`, transiciones visibles en lienzo PJ, portales DM automáticos. Idea futura (sin SPEC): `transicion` + `oculto` visible al PJ.

---

## Estado actual

| Área | Estado |
|------|--------|
| Motor `dm_virtual` | RO desde editor; F4.h runtime OK |
| Editor F15 | Cerrada (`a3e4e0e`) |
| Editor F15b | Cerrada (`5c69c3a`): colocador, Opción B, `replace`, ResizeObserver |
| `npm run lint` / `build` | exit 0 / OK (3 warnings lint documentados en F15) |
| F14 catálogo editor | OK |
| UI táctica visual | Eliminada; no reintroducir |

**Higiene git:** `main` sincronizado con `origin/main` (último push incluye F15b completo). **Stash:** `stash@{0}: WIP pre-F15-A` — **no aplicar** salvo decisión explícita.

---

## Decisiones arquitectónicas importantes

1. **Una fuente de verdad** para reglas: `validar_campana.py` en motor. El editor **no** duplica reglas en JS.
2. **Guardar/export** = puerta F15-B; validación local nunca autoriza persistencia.
3. **Colocador F15b:** `celda` en %; normalizar `puntos_interes` + spawns antes de borrar `cols`/`rows`; aplicar con `{ replace: true }`.
4. **F15b no toca `dm_virtual`.** Autoría `transicion`/`objeto_canonico` en YAML; activación en mesa = backlog motor.

---

## Archivos relevantes

| Ruta | Rol |
|------|-----|
| `docs/specs/F15b_Colocador_Visual_Puntos_Interes_dm_editor.md` | SPEC cerrada F15b |
| `src/components/aventura/ColocadorPuntosDialog.jsx` | Modal colocador (+ medición `mapBox`) |
| `src/components/aventura/SeccionLocalizaciones.jsx` | Entrada «Editar puntos del mapa» |
| `src/domain/aventura.js` | `normalizarMapaACoordenadasLibres`, `nuevoPuntoInteres`, `parseIndicePunto` |
| `docs/specs/F15_Coherencia_Validacion_Samples_dm_editor.md` | F15 cerrada |
| `public/ayuda/GUIA_EDITOR_DM.md` | Uso colocador §6 |
| `dm_virtual/docs/specs/F4_h_*.md` | Contrato `objeto_canonico` runtime |
| `dm_virtual/docs/HANDOFF.md` | Finales, corona destruir, ENDING.LABEL, transiciones PJ |

---

## Trabajo realizado (F15b, sesión)

- Colocador A/B + normalización Opción B + `replace` (`d93434d` … `092d384`).
- Cierre SPEC/HANDOFF/GUIA; cifras `cripta_sala` 48×36 → `[51.04, 43.06]` (`c162b14`).
- ResizeObserver + `visualViewport` + remediación al abrir panel (`5c69c3a`).
- Validación programática (19 mapas); pasada visual autor.

---

## Trabajo pendiente (prioridad)

1. **Pulido Guardian** en editor — backlog `dm_virtual/docs/00_ESTADO_ACTUAL.md`.
2. **IDEA — Generador asistido (LLM) de perfil Guardian de PNJ** (2026-06-13; *hacer después*) → ficha completa en [`docs/ideas/IDEA_GENERADOR_GUARDIAN_LLM.md`](ideas/IDEA_GENERADOR_GUARDIAN_LLM.md). Hoy el bloque `guardian` (rasgos de personalidad, líneas rojas, `secretos_protegidos.terminos_sensibles`, `disparadores.accion_contiene`) se escribe **a mano** por PNJ en el `aventura.yaml` de cada aventura: laborioso y frágil — hay que anticipar todos los sinónimos/idiomas (p.ej. Marta lista `bodega, cellar, basement, almacen, sotano`); si olvidas una palabra, el disparo no salta y el PNJ se hace el tonto justo cuando debería abrirse. Propuesta: en la **pestaña Guardian**, un asistente LLM que lea la narrativa del PNJ y **proponga** el perfil completo —incluidos **rasgos de personalidad** y patrón de voz, además de secretos y disparadores— para que el autor lo **revise y apruebe** (declarativo: el autor manda, el LLM sugiere). Se apoya en la extracción de entidades de **Persistencia** y cubre el pendiente de F10.c.d Fase 5. Autoría (dm_editor), separado del consumo en runtime (dm_virtual). Surgió diseñando la Pieza 1 (memoria subjetiva profunda gateada por disparo).
3. **Mesa/motor** — solo en `dm_virtual`: ver su HANDOFF (finales Control, `ENDING.LABEL`, `destruir_corona`, transiciones en lienzo PJ).

---

## Cómo continuar

1. Editor: SPEC F15b (cerrada) o backlog Guardian.
2. Mesa/producto: leer `dm_virtual/docs/HANDOFF.md` — no duplicar aquí.
3. `cd dm_editor && git status` — no `stash pop` sin orden.
4. Motor :8000 + editor :5180. Reglas nuevas → motor primero; editor solo UI/helpers puros.
