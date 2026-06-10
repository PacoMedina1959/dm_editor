# SPEC F20 — Autoría en editor: Apilable, Exp/clases y puertas bloqueadas

| Campo | Valor |
| --- | --- |
| **ID** | F20 |
| **Fase del roadmap** | `dm_editor` al día con el motor (cierra los huecos de autoría abiertos por F16/F17/F19 en `dm_virtual` el 2026-06-10) |
| **Autor (diseño)** | Fable (Opus) |
| **Estado** | `validada` (gatekeeper 2026-06-10; decisiones de diseño ratificadas en revisión) |
| **Commit base** | `c89c3ed` (HEAD al commit documental de apertura) |
| **Commit cierre** | *(rellenar al archivar; nunca auto-referenciado)* |
| **Fecha inicio** | 2026-06-10 |
| **Plantilla** | v6 (`dm_virtual/docs/specs/PLANTILLA_SPEC.md`) — aplica la regla de **commit por entrega** (§9 v6: el reporte de cierre incluye hash o se devuelve) |
| **Nota de calibre** | 4 entregas atómicas (A–D), cada una pequeña y con commit propio. Repo: **`dm_editor`** exclusivamente. |

## §0. Contexto y estado del repo

- Repos: el trabajo es **solo en `dm_editor`**; `dm_virtual` es fuente de verdad **read-only** (contratos ya cerrados y testeados allí).
- Leer antes de tocar:
  - `dm_editor/docs/HANDOFF.md` — decisión nº1: **una fuente de verdad para reglas** (`validar_campana.py` del motor); el editor NO duplica reglas en JS. Guardar/export pasa por la puerta de validación F15-B.
  - `dm_editor/src/pages/CatalogoPage.jsx` — formulario plano (un `useState` por campo: `nombre`, `nombreEn`, `categoria`, `subtipo`, `precioStr`, `usableCombate`, …). Los campos nuevos siguen ese patrón.
  - `dm_editor/src/domain/catalogo.js` — `plantillaItem`, parseo/serialización del catálogo local.
  - `dm_editor/src/components/aventura/ColocadorPuntosDialog.jsx` — colocador visual F15b: `TIPOS_EDITABLES = {'objeto_canonico','transicion'}` (línea ~12), `modoAñadir` y panel de campos por tipo (~363). La puerta es **un tipo más**, no una herramienta nueva.
  - `dm_editor/tools/sync_samples_from_dm_virtual.sh` — resync de samples (pendiente desde F4.i).
- Contratos del motor que esta SPEC consume (NO modificar; citas de forma real, regla v6):
  - **F16** `apilable`: booleano opcional en entrada de catálogo; ausente = no apilable (contrato §4.7 de `dm_virtual/docs/specs/F16_Inventario_Apilable_Cantidad.md`; validación `CATALOGO_APILABLE_INVALIDO` en `dm_virtual/backend/app/core/objetos.py::_normalizar_catalogo_dict` ~180).
  - **F19** `exp_requerida` (entero ≥ 0, raíz) y `clases` (lista de claves de `CLASES_BASE`, raíz): validación en `objetos.py::~201` (códigos de issue de catálogo; clase desconocida = warning).
  - **F17** `tipo: puerta_bloqueada` en `mapa.puntos_interes`: campos `dificultad` (entero ≥ 1), `transicion_al_exito` (localización existente, **conectada** y con mapa táctico), `evento_al_exito` (opcional, ∈ `eventos_definidos`), `requiere_objeto` (default `ganzuas`, ∈ catálogo resuelto), `habilidad` (v1 solo `trampas`) — códigos `MAPA_PI_PUERTA_*` en `dm_virtual/backend/app/core/validar_campana.py:725-817`.
- **Verificación en este repo**: `dm_editor` no tiene framework de tests (scripts: `dev`/`build`/`preview`/`lint`). La red de seguridad es: `npm run lint` + `npm run build` + **validación por API del motor** (`POST /api/editor/validar-campana`, que ya valida todo lo anterior) + checklist manual por entrega.

### Decisiones de diseño

| Tema | Resolución |
| --- | --- |
| Clases para el multi-select de `clases` | Constante UI local con las 6 claves actuales (`warrior`, `mage`, `healer`, `rogue`, `ranger`, `adventurer`) + comentario "mantener en sincronía con `CLASES_BASE` (estado_mundo.py)". No hay endpoint de clases y crear uno es tocar motor (fuera de alcance); el gate real es del motor (clase desconocida = warning de validación). Si llega IDEA_CLASES_12, este es el único punto a tocar en el editor. |
| Serialización de campos opcionales | **Omitir cuando es el default**: `apilable` solo si `true`; `exp_requerida` solo si > 0; `clases` solo si no vacía. Mantiene los JSON/YAML limpios y respeta los defaults conservadores del motor. |
| `requiere_objeto` y `evento_al_exito` de la puerta | Selects poblados desde datos reales ya cargados en el editor: catálogo resuelto (para objetos) y `eventos_definidos` de la aventura (para eventos), con `ganzuas` preseleccionado. `habilidad` NO se expone en v1 (el motor solo admite `trampas`; mostrar un select de una opción es ruido). |
| `transicion_al_exito` | Select de las **conexiones** de la localización en edición (dato ya disponible en la aventura cargada) — no un texto libre; el error de destino no conectado debe ser difícil de cometer, no solo detectable. |

## §1. Objetivo

Un autor de campaña puede, sin editar JSON/YAML a mano: marcar un objeto como apilable, ponerle requisito de Exp y clases aprendibles, y colocar una puerta bloqueada en un mapa con su DC y su destino — y todo ello pasa la validación canónica del motor antes de guardarse.

## §2. Invariantes (NO renegociables, con por qué)

- [ ] **El editor no duplica reglas**: toda validación de fondo es del motor vía API (decisión nº1 del HANDOFF de este repo). El editor solo añade affordances (selects desde datos reales, defaults) que hacen difícil equivocarse.
- [ ] **`dm_virtual` no se toca** — los contratos F16/F17/F19 están cerrados y testeados; cualquier necesidad de cambio en el motor es STOP & ASK, no un commit allí.
- [ ] **Campos opcionales se omiten en su default** al serializar — no ensuciar el canon con `apilable: false` en 30 objetos.
- [ ] **Guardar/export sigue pasando por la puerta de validación** (F15-B): nada de lo nuevo puentea `validar-campana`.
- [ ] **Commit por entrega con hash en el reporte** (plantilla v6 §9).

## §3. Alcance

### ✅ Sí toca (por entrega)
- **A (Apilable):** `CatalogoPage.jsx` (checkbox), `domain/catalogo.js` (plantilla/serialización).
- **B (Exp/clases):** `CatalogoPage.jsx` (numérico `exp_requerida` + multi-select `clases`), `domain/catalogo.js`, constante de clases.
- **C (Puerta bloqueada):** `ColocadorPuntosDialog.jsx` (`TIPOS_EDITABLES` + botón + panel de campos + render del punto), helpers de dominio de aventura si hacen falta (`domain/aventura.js`).
- **D (Resync + cierre):** ejecución de `tools/sync_samples_from_dm_virtual.sh`, validación del sample `ejemplo` vía API (debe salir limpio — ya contiene `puerta_herreria`, `ganzuas`, `curacion_mayor`), `public/ayuda/GUIA_EDITOR_DM.md` (secciones nuevas), `docs/HANDOFF.md` de este repo, esta SPEC con hashes.

### ❌ NO toca
- `dm_virtual` (ningún fichero).
- La UI táctica eliminada (HANDOFF: "no reintroducir").
- Tipos de punto existentes (`objeto_canonico`, `transicion`) salvo el alta del nuevo tipo en las estructuras comunes.
- Autoría de Guardian, plantillas, F15-C/D (backlog aparte).

## §4. Especificación funcional

### §4.1 Entrega A — checkbox Apilable

- `CatalogoPage`: estado `const [apilable, setApilable] = useState(false)` + checkbox "Apilable" junto a "Usable en combate"; cargar/limpiar en los mismos puntos que los campos existentes (`seleccionar`, `nuevo`, `override`).
- Serialización: incluir `apilable: true` solo si está marcado (omitir si no).
- `domain/catalogo.js::plantillaItem`: sin `apilable` por defecto.
- Checklist manual: marcar `vendajes` como apilable en el catálogo local de `ejemplo`, guardar → el JSON guardado contiene `"apilable": true` y la validación pasa; desmarcar → la clave desaparece.

### §4.2 Entrega B — Exp y clases

- `CatalogoPage`: `expRequeridaStr` (input numérico ≥ 0, default "0") y `clasesSel` (multi-select/checkbox-group con la constante de 6 clases).
- Serialización: `exp_requerida` solo si > 0; `clases` solo si lista no vacía. Carga: leer ambos del item seleccionado con defaults.
- Validación negativa manual: forzar un valor inválido (p. ej. editar a mano `-5` en el JSON local) → la puerta de guardado muestra el issue del motor (`exp_requerida debe ser un entero ≥ 0`). El editor **no** replica ese check en JS más allá del `min=0` del input.
- Checklist manual: en `ejemplo`, ver que `curacion_mayor` (sincronizado en D… si D aún no corrió, crear un override de prueba) carga con Exp 100 y clases `healer/mage` marcadas; guardar sin cambios no altera el JSON (round-trip estable).

### §4.3 Entrega C — puerta bloqueada en el colocador

- `TIPOS_EDITABLES` += `'puerta_bloqueada'`; `modoAñadir` admite el tipo nuevo; botón "🔒 Puerta" junto a los dos existentes.
- Al colocar: punto con defaults `{tipo: 'puerta_bloqueada', dificultad: 12, requiere_objeto: 'ganzuas', oculto: false}` y celda en % (mismo régimen F15b).
- Panel de campos del tipo (espejo del de `transicion`): `id`, `etiqueta_ui`, `dificultad` (numérico ≥ 1), `transicion_al_exito` (**select de las conexiones** de la localización en edición), `requiere_objeto` (select del catálogo resuelto, `ganzuas` preseleccionado), `evento_al_exito` (select opcional de `eventos_definidos`, vacío = ninguno), `oculto` (checkbox).
- Render en lienzo: marcador distinguible (🔒 o color propio) con tooltip tipo+coords, como los existentes.
- Checklist manual: colocar una puerta de prueba en un mapa del sample, guardar → `validar-campana` limpio; cambiar el destino a una localización NO conectada (vía select no se puede — editar JSON/YAML a mano) → el guardado muestra `MAPA_PI_PUERTA_DESTINO_INVALIDO`. Borrar el punto de prueba al acabar.

### §4.4 Entrega D — resync de samples + cierre

- Ejecutar `tools/sync_samples_from_dm_virtual.sh` (trae `aventura.yaml` con `puerta_herreria`/Bertram/`curacion_mayor` y el catálogo con `ganzuas`/`curacion_mayor`/flags F19) y commitear los samples actualizados.
- Validar el sample `ejemplo` completo vía `POST /api/editor/validar-campana` → **0 errores** (criterio duro: si el sample del motor no valida limpio en el editor, hay desalineación que investigar antes de cerrar).
- Abrir en el editor: la puerta de la herrería aparece en el colocador con sus campos; `curacion_mayor` muestra Exp/clases; `ganzuas` muestra Apilable. (Esto verifica las entregas A–C contra **datos reales del canon**, no fixtures — regla v6.)
- `GUIA_EDITOR_DM.md`: subsecciones "Objetos: apilable, Exp y clases" y "Puertas bloqueadas" (breves, con captura si la guía las usa).
- `docs/HANDOFF.md` de este repo: estado actualizado. Esta SPEC: `cerrada` + hashes post-commit.

## §5. Criterios de aceptación (binarios, independientes de los tests)

- [ ] Sin tocar JSON/YAML a mano: se marca un objeto apilable, se le pone Exp 100 + clases, y se coloca una puerta con DC y destino conectado — y el guardado valida limpio contra el motor.
- [ ] El sample `ejemplo` resincronizado se abre, se muestra completo (puerta de la herrería incluida con todos sus campos en el panel) y valida con 0 errores vía API.
- [ ] Un destino no conectado o una `exp_requerida` inválida introducidos a mano son **rechazados por la puerta de guardado** con el código del motor — demostrando que el editor no puentea la validación canónica.

## §6. Tests a crear/verificar

Sin framework de tests en este repo: la verificación por entrega es `npm run lint` (exit 0, sin warnings nuevos sobre los 3 documentados en F15) + `npm run build` (OK) + el checklist manual de cada entrega + la validación API con **datos reales del sample** (regla v6 de forma real: el criterio §5.2 asserta contra el canon sincronizado, no contra fixtures del editor).

## §7. STOP & ASK

Estándar v6. Específicos:
- Si cualquier pieza exige tocar `dm_virtual` (un endpoint nuevo, un campo que el motor no valida como se esperaba) → STOP; se decide si abre SPEC hermana en el motor.
- Si el resync de samples (D) arrastra diffs inesperados más allá de F16/F17/F19 (p. ej. cambios de mapas no relacionados) → STOP con el diff, antes de commitear.
- Si el colocador F15b resulta no soportar paneles de campos por tipo sin refactor → STOP con propuesta (no refactorizar F15b de paso).

## §8. Anti-patrones (además de plantilla)

- No duplicar en JS reglas del motor (solo affordances de UI).
- No escribir `apilable: false` / `exp_requerida: 0` / `clases: []` en el canon (omitir defaults).
- No exponer `habilidad` de la puerta en v1 (el motor solo admite `trampas`).
- No texto libre donde hay datos reales para un select (destino, objeto requerido, evento).
- No reintroducir UI táctica ni tocar el régimen de celdas en % de F15b.
- No aplicar el stash `WIP pre-F15-A` (HANDOFF: no aplicar salvo decisión explícita).

## §9. Entregable y trazabilidad

Tabla criterio→implementación→verificación por entrega + **hash de commit en cada reporte de cierre** (plantilla v6 — sin hash, el reporte se devuelve).

## §10. Changelog

| Fecha | Tipo | Cambio |
| --- | --- | --- |
| 2026-06-10 | creación | Redacción inicial (Fable). Cierra los 3 huecos de autoría abiertos por F16/F17/F19 + resync de samples pendiente desde F4.i. Primera SPEC redactada bajo plantilla v6. |
