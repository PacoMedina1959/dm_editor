# SPEC F22 — Autoría de Guardian en el editor (ficha PNJ)

| Campo | Valor |
| --- | --- |
| **ID** | F22 (se salta F21: reservado en `dm_virtual` para «niebla oculta amenazas»; números separados a propósito) |
| **Fase del roadmap** | Backlog del editor nº1 — dar superficie de autoría al bloque `guardian` que hoy se escribe a mano en YAML |
| **Autor (diseño)** | Fable (Opus) |
| **Estado** | `abierta` (borrador para revisión; entregas no implementadas) |
| **Commit base** | `fe082c7` |
| **Fecha inicio** | 2026-06-14 |
| **Plantilla** | v6 (`dm_virtual/docs/specs/PLANTILLA_SPEC.md`) — commit por entrega, hash en el reporte de cierre |
| **Nota de calibre** | 4 entregas atómicas (A–D). Repo: **`dm_editor`** exclusivamente. |

## §0. Contexto y estado del repo

- Repos: el trabajo es **solo en `dm_editor`**; `dm_virtual` es fuente de verdad **read-only** (contrato Guardian ya cerrado y consumido en runtime).
- **Hoy no hay autoría Guardian en el editor.** `grep guardian src/` = 0. La sección de PNJ (`src/components/aventura/SeccionNpcs.jsx`) edita solo campos básicos (`nombre`, `genero`, `descripcion`, `motivacion`, `frase`, `secretos[]`, `vende[]`); el bloque `guardian` se escribe **a mano en el `aventura.yaml`**.
- Leer antes de tocar:
  - `dm_editor/src/components/aventura/SeccionNpcs.jsx` — formulario de PNJ (`EMPTY`, `draft`, `saveItem`). El editor Guardian se monta aquí como subformulario de la ficha.
  - `dm_editor/src/domain/aventura.js` — parseo/serialización de la aventura (`asArray`, normalizaciones). Punto donde se garantiza la **fidelidad de round-trip**.
  - `dm_editor/src/pages/AventuraPage.jsx` — orquestación de secciones y guardado/export.
- **Contrato Guardian que esta SPEC consume (NO modificar; forma real, regla v6)** — `dm_virtual/docs/specs/F10c_d_Perfil_Guardian_Declarativo_PNJs.md` y siguientes (e/f/h/i/l). Estructura por PNJ:
  - **Carácter (blando):** `arquetipo`, `personalidad`, `finalidad`, `patron_voz`.
  - **`secretos_protegidos[]`:** `id`, `hecho`, `terminos_sensibles[]`, `terminos_prohibidos_respuesta[]`, `condicion_revelar`.
  - **`disparadores`:** mapa `{clave}` → `accion_contiene[]`, `reaccion`, `requiere_revision_dm` (opcional).
- **El motor NO valida `guardian`** (`grep guardian backend/app/core/validar_campana.py` = vacío). A diferencia de F20, **no hay red de seguridad canónica**: las ayudas de esta SPEC son **lints de autoría advisory**, no reglas, y **no bloquean guardar**.
- **Precedente de pérdida de datos:** el editor de catálogo descartó el campo `sfx` de un objeto al guardar porque el formulario no lo conocía (incidente 2026-06-14). La ficha PNJ tiene el mismo riesgo con `guardian`: por eso la **fidelidad de round-trip** (no perder campos desconocidos) es invariante, no detalle.
- **Verificación en este repo**: sin framework de tests. Red de seguridad: `npm run lint` + `npm run build` + **prueba de round-trip** (cargar `aventura.yaml` con Guardian, guardar sin tocar y `git diff` vacío en el bloque) + checklist manual por entrega.

### Decisiones de diseño

| Tema | Resolución |
| --- | --- |
| ¿Dónde vive el editor Guardian? | Subformulario **colapsable** dentro de la ficha de PNJ (`SeccionNpcs`), no una pestaña nueva. El Guardian es del PNJ; mantenerlo junto a `descripcion`/`motivacion`/`secretos`. |
| Naturaleza de las ayudas (C) | **Advisory, nunca gate.** El motor no valida Guardian; el editor no inventa reglas canónicas. Las ayudas son avisos visibles que el autor puede ignorar; guardar siempre se permite. |
| Round-trip | **Preservar campos desconocidos** del bloque `guardian` y de cada secreto/disparador. El formulario edita los campos del contrato; lo que no entienda lo **conserva tal cual**, no lo borra (lección `sfx`). |
| `disparadores` como mapa | Se editan como lista de entradas con `clave` editable (no objeto opaco). Clave duplicada = aviso, no bloqueo. |
| Heurística de «fuga en `motivacion`» | Comparación simple: si algún `terminos_sensibles` (o `hecho`) aparece literal en el texto público (`descripcion`/`motivacion`/`frase`), avisar. Es una pista, no un detector semántico. |
| Idiomas de `terminos_sensibles` | El editor no traduce ni completa solo; solo **avisa de listas cortas/vacías**. La sugerencia automática (LLM) es otra idea aparcada (ver HANDOFF §«Trabajo pendiente» punto 2), construida **encima** de esta base. |

## §1. Objetivo

Un autor puede crear y revisar el perfil `guardian` de un PNJ —carácter, secretos protegidos con sus términos, y disparadores— **desde la ficha del editor**, sin escribir YAML a mano, sin perder ningún campo al guardar, y con avisos que reduzcan el fallo más caro: que un `terminos_sensibles` incompleto deje el disparo silencioso.

## §2. Invariantes (NO renegociables, con por qué)

- [ ] **Fidelidad de round-trip:** cargar → guardar sin editar **no cambia** el bloque `guardian` (ni reordena ni pierde campos desconocidos). Por qué: el editor ya perdió `sfx` una vez; con Guardian el coste es un secreto desprotegido.
- [ ] **`dm_virtual` no se toca** — solo lectura del contrato y de samples.
- [ ] **Las ayudas son advisory:** ningún lint de Guardian bloquea guardar/export. Por qué: el motor no valida Guardian; el editor no debe fingir que sí.
- [ ] **El editor no inventa contrato:** solo expone los campos de F10.c.d; nada de campos nuevos en `guardian` salvo que el autor los escriba (y entonces se preservan).
- [ ] **Commit por entrega con hash en el reporte** (plantilla v6).

## §3. Alcance

### ✅ Sí toca (por entrega)
- **A (Base carácter + round-trip):** `SeccionNpcs.jsx` (subformulario Guardian colapsable: `arquetipo`, `personalidad`, `finalidad`, `patron_voz`); `domain/aventura.js` si hace falta para preservar `guardian` íntegro en parseo/serialización.
- **B (Secretos + disparadores):** `SeccionNpcs.jsx` — editor de `secretos_protegidos[]` (con `terminos_sensibles[]`, `terminos_prohibidos_respuesta[]`, `condicion_revelar`) y de `disparadores` (lista clave→`accion_contiene[]`/`reaccion`/`requiere_revision_dm`).
- **C (Ayudas anti-error, advisory):** lints visibles en la ficha — `terminos_sensibles` vacío/corto, fuga de término en texto público (`motivacion`/`descripcion`/`frase`), y **localizador de campos incompletos** por PNJ (secreto sin `condicion_revelar`, disparador sin `reaccion`, etc.).
- **D (Resync + guía + cierre):** validar que el sample con Guardian (Marta/Gorin, etc.) hace round-trip limpio; `public/ayuda/GUIA_EDITOR_DM.md` (sección Guardian); `docs/HANDOFF.md`; esta SPEC con hashes.

### ❌ NO toca
- `dm_virtual` (ningún fichero).
- **Sugerencia automática con LLM** de `terminos_sensibles`/disparadores — idea aparcada aparte; esta SPEC es la **base** sobre la que aquélla se montaría.
- El consumo en runtime del Guardian (gating por disparo, LoreKeeper, memoria) — todo eso ya está cerrado en `dm_virtual`.
- Reglas canónicas de Guardian en JS (no existen en el motor; no se crean aquí).

## §4. Especificación funcional

### §4.1 Entrega A — base de carácter + fidelidad de round-trip

- `SeccionNpcs`: en el `draft` del PNJ, subformulario **«Guardian»** colapsable con `arquetipo`, `personalidad`, `finalidad`, `patron_voz` (textareas/inputs). Cargar desde `npc.guardian`; al guardar, escribir de vuelta en `npc.guardian` **mezclando** sobre el objeto existente (no reemplazar, para no perder `secretos_protegidos`/`disparadores`/campos desconocidos).
- Si el PNJ no tiene `guardian`, el subformulario aparece vacío y **no** se serializa un `guardian: {}` espurio (omitir bloque vacío, como F20 omite defaults).
- `domain/aventura.js`: garantizar que parseo/serialización **conservan** `guardian` íntegro (incluidos campos no editados).
- Checklist manual: abrir el sample, editar `patron_voz` de Marta, guardar → el `git diff` muestra **solo** esa línea; `secretos_protegidos` y `disparadores` intactos.

### §4.2 Entrega B — secretos protegidos y disparadores

- **`secretos_protegidos[]`:** lista editable; por secreto: `id`, `hecho` (textarea), `condicion_revelar` (texto/ref), `terminos_sensibles[]` y `terminos_prohibidos_respuesta[]` como listas de chips/«uno por línea». Añadir/eliminar secretos y términos.
- **`disparadores`:** lista de entradas con `clave` editable; por entrada: `accion_contiene[]` (lista), `reaccion` (textarea), `requiere_revision_dm` (checkbox, omitir si false).
- Serialización: `disparadores` vuelve a mapa `{clave: {...}}`; clave vacía o duplicada = aviso (no bloquea). Campos desconocidos dentro de un secreto/disparador se preservan.
- Checklist manual: reproducir el secreto `gorin_bodega` de Marta (términos `gorin, bodega, cellar, basement, almacen, sotano`) desde el formulario; guardar y comparar contra el YAML original — equivalente (salvo orden estable documentado).

### §4.3 Entrega C — ayudas anti-error (advisory, no bloquean)

- **`terminos_sensibles` flaco:** aviso si un secreto tiene 0 términos, o si `terminos_prohibidos_respuesta` ⊄ contexto razonable; pista de «recuerda sinónimos/idiomas» (sin autocompletar).
- **Fuga en texto público:** si un `terminos_sensibles` o palabra clave del `hecho` aparece literal en `motivacion`/`descripcion`/`frase` del PNJ, avisar («el secreto se filtra en texto que el jugador puede ver»).
- **Localizador de campos incompletos:** panel por PNJ que lista huecos del Guardian (secreto sin `condicion_revelar`, disparador sin `reaccion`, `guardian` sin `patron_voz`…). Es navegación/checklist, no validación dura.
- Todas las ayudas son visibles pero **guardar siempre se permite**.
- Checklist manual: meter «bodega» en la `motivacion` de Marta → aparece el aviso de fuga; vaciar `terminos_sensibles` de un secreto → aviso de lista vacía; en ambos casos se puede guardar igual.

### §4.4 Entrega D — resync + guía + cierre

- Verificar round-trip sobre el/los sample(s) reales con Guardian (Marta, Bertram, Renard…): cargar y guardar sin tocar → `git diff` vacío en los bloques `guardian`.
- `GUIA_EDITOR_DM.md`: subsección «Autoría de Guardian» (carácter, secretos/términos, disparadores, qué significan los avisos).
- `docs/HANDOFF.md`: marcar el nº1 del backlog editor como hecho; esta SPEC `cerrada` + hashes.

## §5. Criterios de aceptación (binarios)

- [ ] Sin tocar YAML a mano: se crea el perfil `guardian` completo de un PNJ (carácter + 1 secreto con términos + 1 disparador) desde la ficha, y se guarda.
- [ ] **Round-trip limpio:** cargar un sample con Guardian y guardar sin editar deja el bloque `guardian` byte-equivalente (orden estable documentado); ningún campo desconocido se pierde.
- [ ] Las tres ayudas de C se disparan en sus casos (términos vacíos, fuga en `motivacion`, campo incompleto) y **ninguna** impide guardar.

## §6. Tests a crear/verificar

Sin framework en este repo. Por entrega: `npm run lint` (0 errores, ≤3 warnings históricos) + `npm run build` (OK) + **prueba de round-trip** (la red real, dado que el motor no valida Guardian) + checklist manual. Opcional: una función pura de dominio para los lints de C, smoke-testeable con `node --input-type=module` como se hizo con `referenciasHuerfanas`.

## §7. STOP & ASK

Estándar v6. Específicos:
- Si el round-trip no puede ser estable sin reordenar claves del YAML → STOP con propuesta (documentar el orden canónico vs. tocar el serializador global).
- Si para preservar campos desconocidos hay que refactorizar el parseo de `aventura.js` más allá de lo local → STOP (no arrastrar un refactor mayor).
- Si surge la tentación de validar Guardian «de verdad» → STOP: eso sería contrato del motor (`dm_virtual`), no del editor; se decide allí.

## §8. Anti-patrones (además de plantilla)

- **No perder campos** del bloque `guardian` al guardar (lección `sfx`).
- No convertir las ayudas en **gates** de guardado (el motor no valida Guardian).
- No inventar campos nuevos en `guardian` ni reglas canónicas en JS.
- No autocompletar `terminos_sensibles` en silencio (eso es la idea LLM, declarativa y aparte: el autor manda).
- No mezclar esta base con la sugerencia LLM: primero el sitio donde revisar/aprobar; la IA, después y encima.

## §9. Entregable y trazabilidad

Tabla criterio→implementación→verificación por entrega + **hash de commit en cada reporte de cierre** (plantilla v6).

| Entrega | Hash | Implementación | Verificación |
| --- | --- | --- | --- |
| A | `—` | Subformulario carácter en `SeccionNpcs`; round-trip íntegro en `aventura.js`. | lint/build + round-trip diff vacío. |
| B | `—` | Editor de `secretos_protegidos[]` y `disparadores`. | lint/build + reproducción del secreto `gorin_bodega`. |
| C | `—` | Lints advisory: términos flacos, fuga en texto público, campos incompletos. | lint/build + checklist de los 3 avisos (sin bloquear guardado). |
| D | `—` | Round-trip de samples reales, guía, HANDOFF, cierre SPEC. | lint/build + `git diff` vacío en bloques `guardian`. |

## §10. Changelog

| Fecha | Tipo | Cambio |
| --- | --- | --- |
| 2026-06-14 | creación | Borrador inicial (Fable). Da superficie de autoría al bloque `guardian` (hoy YAML a mano); base sobre la que se montaría la sugerencia LLM aparcada. Invariante central: fidelidad de round-trip (lección `sfx`). |
