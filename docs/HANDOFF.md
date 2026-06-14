# HANDOFF — dm_editor (editor de campañas)

**Fecha:** 2026-06-10 · **Transcript:** `6002b78b-b031-4f19-bb95-986bb7c7aac7`  
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

**F20 cerrada** — SPEC `docs/specs/F20_Autoria_Apilable_Exp_Puertas_dm_editor.md`: autoría de `apilable`, `exp_requerida`/`clases` y `puerta_bloqueada`; samples resincronizados desde `dm_virtual` con `puerta_herreria`, `ganzuas` y `curacion_mayor`. Validación canónica del sample: `error_count=0`, `warning_count=4` (`REGLA_HISTORIAL_DESACTIVADA`, histórico).

**UX catálogo global/local hecho** (paso nº6 de `dm_virtual/docs/00_ESTADO_ACTUAL.md`): claridad global/runtime ya existía; añadido **comprobador de referencias huérfanas** en el catálogo (botón → `validar-campana`, filtra los códigos `MAPA_PI_OBJETO_ITEM_INVALIDO` / `MAPA_PI_CONSUMIR_ITEM_INVALIDO` / `MAPA_PI_PUERTA_OBJETO_INVALIDO` / `CATALOGO_ID_DESCONOCIDO` y ofrece «Crear «id»») y **pulido de «Crear override»** (la tabla global marca `override local`/`colisión local` y enlaza a «Ver local» en vez de sobrescribir en silencio). Solo aplica al catálogo de objetos; los assets tácticos son otro modelo (sin global/local). Idea futura: navegación a la incidencia desde la página **Validar** para el resto de referencias rotas (eventos, destinos, bestiario/NPC).

**Paralelo en motor (RO):** **F4.h cerrada** — `objeto_canonico` recogible en mapa; corona en `cripta_sala`.

**Siguiente sugerido (solo editor):** ver §«Trabajo pendiente» de este HANDOFF (backlog del editor, fuente de verdad). Primero: pulido Guardian (plantillas/validadores) o autorías de clases si el motor amplía `CLASES_BASE`.

**Fuera de este repo (ver `dm_virtual/docs/HANDOFF.md`):** finales en Control/DM, `ENDING.LABEL`, `destruir_corona`, transiciones visibles en lienzo PJ, portales DM automáticos. Idea futura (sin SPEC): `transicion` + `oculto` visible al PJ.

---

## Estado actual

| Área | Estado |
|------|--------|
| Motor `dm_virtual` | RO desde editor; F4.h runtime OK |
| Editor F15 | Cerrada (`a3e4e0e`) |
| Editor F15b | Cerrada (`5c69c3a`): colocador, Opción B, `replace`, ResizeObserver |
| Editor F20 | Cerrada: catálogo apilable/Exp/clases, puerta bloqueada en colocador, samples F16/F17/F19 |
| `npm run lint` / `build` | exit 0 / OK (3 warnings lint documentados en F15) |
| F14 catálogo editor | OK |
| UX catálogo global/local | Hecho (nº6): referencias huérfanas + pulido override |
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
| `src/pages/CatalogoPage.jsx` | Catálogo local: apilable, Exp y clases |
| `src/domain/catalogo.js` | Plantilla/parseo de catálogo y `CLASES_BASE_EDITOR` |
| `docs/specs/F15_Coherencia_Validacion_Samples_dm_editor.md` | F15 cerrada |
| `docs/specs/F20_Autoria_Apilable_Exp_Puertas_dm_editor.md` | SPEC cerrada F20 |
| `public/ayuda/GUIA_EDITOR_DM.md` | Uso colocador §6 |
| `dm_virtual/docs/specs/F4_h_*.md` | Contrato `objeto_canonico` runtime |
| `dm_virtual/docs/HANDOFF.md` | Finales, corona destruir, ENDING.LABEL, transiciones PJ |

---

## Trabajo realizado (F15b, sesión)

- Colocador A/B + normalización Opción B + `replace` (`d93434d` … `092d384`).
- Cierre SPEC/HANDOFF/GUIA; cifras `cripta_sala` 48×36 → `[51.04, 43.06]` (`c162b14`).
- ResizeObserver + `visualViewport` + remediación al abrir panel (`5c69c3a`).
- Validación programática (19 mapas); pasada visual autor.

## Trabajo realizado (F20, sesión)

- Catálogo: checkbox `apilable`, campo `exp_requerida`, selector de `clases` y serialización omitiendo defaults.
- Colocador: nuevo tipo editable `puerta_bloqueada`, botón 🔒, campos `dificultad`, `transicion_al_exito`, `requiere_objeto`, `evento_al_exito` y `oculto`.
- Samples: resync desde `dm_virtual` con `puerta_herreria`, `ganzuas`, `curacion_mayor` y flags F19.
- Verificación: `npm run lint` (0 errores, 3 warnings históricos), `npm run build` OK y `POST /api/editor/validar-campana` sobre sample con `error_count=0`.

---

## Trabajo pendiente (prioridad)

> **Backlog del editor — fuente de verdad.** Las tareas solo-editor viven **aquí**, no en `dm_virtual/docs/00_ESTADO_ACTUAL.md` (que a partir de ahora lista solo motor/mesa). Migrado el 2026-06-14 al separar backlogs.

1. **Autoría de Guardian** en editor — SPEC `docs/specs/F22_Autoria_Guardian_dm_editor.md` (`abierta`): dar superficie de ficha al bloque `guardian` (hoy YAML a mano), con lints advisory (`terminos_sensibles` flacos, fuga en texto público, campos incompletos) e invariante de fidelidad de round-trip (lección `sfx`). El motor NO valida Guardian → las ayudas no bloquean guardar. Antesala natural de la idea LLM del punto 2.
2. **IDEA — Generador de disparadores (Guardian) con LLM** (2026-06-13; *hacer después*). Hoy los `secretos_protegidos.terminos_sensibles` y los `disparadores.accion_contiene` se escriben **a mano** por PNJ en el `aventura.yaml` de cada aventura: laborioso y frágil — hay que anticipar todos los sinónimos/idiomas (p.ej. Marta lista `bodega, cellar, basement, almacen, sotano`); si olvidas una palabra, el disparo no salta y el PNJ se hace el tonto justo cuando debería abrirse. Propuesta: en la **pestaña Guardian** del editor, un asistente LLM que lea la narrativa/el secreto y **proponga** esas listas para que el autor las **revise y apruebe** (declarativo: el autor manda, el LLM sugiere). Se apoya en la extracción de entidades que ya hace **Persistencia**. Es autoría (su sitio es dm_editor), separado del consumo en runtime (dm_virtual). Surgió diseñando la Pieza 1 (memoria subjetiva profunda gateada por disparo).
3. **Autoría futura de clases** si `dm_virtual` ejecuta IDEA_CLASES_12: actualizar `CLASES_BASE_EDITOR`.
4. **Mesa/motor** — solo en `dm_virtual`: ver su HANDOFF (finales Control, `ENDING.LABEL`, `destruir_corona`, transiciones en lienzo PJ).

---

## Cómo continuar

1. Editor: SPEC F15b (cerrada) o backlog Guardian.
2. Mesa/producto: leer `dm_virtual/docs/HANDOFF.md` — no duplicar aquí.
3. `cd dm_editor && git status` — no `stash pop` sin orden.
4. Motor :8000 + editor :5180. Reglas nuevas → motor primero; editor solo UI/helpers puros.
