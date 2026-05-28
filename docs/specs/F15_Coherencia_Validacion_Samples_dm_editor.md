# mini-SPEC F15 — Coherencia dm_editor ↔ dm_virtual (validación, samples, mapa)

| Campo | Valor |
| --- | --- |
| **ID** | F15 |
| **Estado** | `en ejecución — Entrega A cerrada; B-D pendientes` |
| **Prioridad** | alta (antes de UI visual `objeto_canonico` en mapa) |
| **Commit base** | `9b74f2c` |
| **Commit cierre** | `<rellenar al cerrar>` |
| **Fecha** | 2026-05-28 |
| **Repo** | `dm_editor` (motor fuente de verdad: `../dm_virtual`) |

## §0. Diagnóstico (revisión 2026-05-28)

Tras revisión en `/home/paco/python/proyectos/dm_editor` sin cambios de código:

| Área | Estado |
| --- | --- |
| Arranque / `npm run build` | OK |
| F14 catálogo (`/catalogo`, APIs `/api/editor/catalogo-*`) | Alineado con motor |
| Validación en `/aventura` | **Débil**: `validarAventura()` local ≠ `POST /api/editor/validar-campana` |
| Salud de mapa en localizaciones | **Débil**: solo exige `mapa.imagen` (`validarMapaRuntimeLocalizacion`) |
| Samples empaquetados | **Desactualizados** respecto al canon en `dm_virtual` |
| `npm run lint` | **12 errores** (build no los bloquea) |
| UI táctica (calibración, walkmask, transiciones, spawns…) | Retirada en `ab8280d`; fuera de alcance de F15 salvo validación |

**Veredicto:** el editor es usable para autoría estructural y catálogo F14, pero **no debe darse por fiable** como puerta de salida de campaña/mapa hasta cerrar esta SPEC.

**Higiene previa a implementar:** `main` puede ir `ahead` de `origin/main` y el **working tree puede estar sucio** (p. ej. cambios en `mapaIA.js`, `SeccionNpcs.jsx`, `domain/aventura.js`, samples). F15 se implementa **sin mezclar** esos cambios salvo que formen parte deliberada de una entrega (lint, validación, samples). Resolver con commit/stash/revert **antes** de abrir entregas.

**Patrones existentes a reutilizar:**

- Validación canónica correcta: `ValidarYamlPage.jsx` → `postValidarCampana` (~L17).
- Validación local insuficiente en guardado: `AventuraPage.jsx` → `ejecutarValidacion()` / `validarAventura` (~L169).
- Salud de mapa débil: `domain/aventura.js` → `validarMapaRuntimeLocalizacion` (~L110).

---

## §1. Objetivo

Alinear `dm_editor` con el contrato real del motor (`dm_virtual`):

1. Los **samples** empaquetados reflejan el canon actual del motor.
2. **Guardar** y **exportar** YAML desde `/aventura` exigen validación canónica del backend (con catálogo local cuando aplique).
3. La UI de **localizaciones** muestra avisos de mapa/puntos de interés derivados de esa misma validación (sin reimplementar reglas en JS).
4. **`npm run lint`** queda en verde en el repo del editor.

**Fuera de alcance explícito (SPEC posterior):** edición visual de `puntos_interes.tipo: objeto_canonico`; reintroducir diálogos tácticos eliminados en `ab8280d`.

---

## §2. Invariantes (NO renegociables)

- [ ] **Una sola fuente de verdad** para reglas de campaña: `dm_virtual/app/core/validar_campana.py` (+ `GestorEscenas` en build).
- [ ] El editor **no duplica** en JS la lógica de `objeto_canonico`, celdas, transiciones, catálogo combinado, etc.
- [ ] `validarAventura()` local puede seguir existiendo como **pre-check rápido** (IDs, refs, ambiente), pero **no sustituye** la validación canónica en guardado/export.
- [ ] Samples en `public/samples/` son **copias** del motor, no un subconjunto “de ejemplo” mantenido a mano con drift.
- [ ] **Guardar/export bloquean** si el backend no valida (red, 502, timeout, respuesta inválida), **aunque** `validarAventura()` local devuelva cero errores. Nunca “OK local ⇒ guardado permitido”.
- [ ] Sin backend en marcha: guardado/export **bloqueados** con aviso explícito “validación canónica no disponible”.

---

## §3. Entregas

### Entrega A — Sincronizar samples

**Objetivo:** “Cargar ejemplo canónico” y samples de desarrollo = canon del motor.

| Origen (motor) | Destino (editor) |
| --- | --- |
| `dm_virtual/backend/data/campañas/ejemplo/aventura.yaml` | `public/samples/aventura-ejemplo.yaml` |
| `dm_virtual/backend/data/objetos/catalogo_objetos.json` | `public/samples/catalogo-ejemplo.json` |

**Ficheros a tocar**

- `public/samples/aventura-ejemplo.yaml`
- `public/samples/catalogo-ejemplo.json`
- `tools/sync_samples_from_dm_virtual.sh` (nuevo, recomendado; `chmod +x`)
- `README.md` — párrafo “resincronizar samples”
- `docs/specs/F15_Coherencia_Validacion_Samples_dm_editor.md` — commit cierre A

**Script sugerido** (`tools/sync_samples_from_dm_virtual.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOTOR="${DM_VIRTUAL_ROOT:-$ROOT/../dm_virtual}"
cp "$MOTOR/backend/data/campañas/ejemplo/aventura.yaml" "$ROOT/public/samples/aventura-ejemplo.yaml"
cp "$MOTOR/backend/data/objetos/catalogo_objetos.json" "$ROOT/public/samples/catalogo-ejemplo.json"
echo "Samples actualizados desde $MOTOR"
```

**Criterios de aceptación A**

- [x] `diff` entre sample YAML y canon motor vacío (o documentado si se excluye algo a propósito).
- [x] `diff` entre sample catálogo y `catalogo_objetos.json` vacío.
- [x] `/validar` → “Cargar ejemplo canónico” valida sin errores inesperados de F4.h/F13/F14 (con backend en marcha).
- [x] `tools/sync_samples_from_dm_virtual.sh` existe, es **ejecutable** (`chmod +x`), y README (o §5) documenta su uso y la variable opcional `DM_VIRTUAL_ROOT`.
- [x] Tras ejecutar el script, los `diff` anteriores siguen vacíos.

---

### Entrega B — Validación canónica antes de guardar / exportar

**Objetivo:** `/aventura` no permite persistir YAML que el motor rechazaría.

**Comportamiento**

1. En `exportarYaml` y `handleServerSave` (mismo patrón que `ValidarYamlPage.jsx`):
   - Serializar `aventuraToYaml(data)`.
   - Llamar `postValidarCampana(yamlText, catalogoText?)` (`src/api/validarCampana.js`) — **obligatorio**; no hay atajo por validación local.
   - **Catálogo en la petición:**
     - **Con `serverSlug`:** cargar catálogo local vía `GET /api/editor/aventuras/{slug}/catalogo-objetos`, serializar a JSON y enviar en `catalogo_objetos_text` (vista combinada global+local en el motor, como F14). Si falla la carga → **bloquear** guardado/export con mensaje claro.
     - **Sin `serverSlug`:** no enviar `catalogo_objetos_text`; el motor valida referencias de objetos **solo contra el catálogo global** (comportamiento por defecto del endpoint).
   - Si `!resultado.ok` o `error_count > 0`: **no** guardar/exportar; mostrar issues del motor (reutilizar `IssueList` / `ResumenValidacion`).
2. Mantener `ejecutarValidacion()` local como botón “Validar (rápido)” o pre-check; etiquetar en UI: *“No sustituye la validación del motor”*.
3. **Bloqueo si el backend no valida:** error de red, 502/503/504, JSON inválido, excepción en `postValidarCampana` → **no** guardar/exportar, aunque la validación local acabe de pasar. Mensaje con hint de `validarCampana.js` (uvicorn :8000, `VITE_DEV_PROXY_TARGET`).
4. **Warnings** del motor (`warning_count > 0`, `ok: true`): permitir guardado con confirmación opcional o panel colapsable de warnings (al menos no bloquear, pero mostrar).

**Ficheros a tocar**

- `src/pages/AventuraPage.jsx` — flujo guardar/exportar + UI resultado canónico
- `src/api/validarCampana.js` — solo si hace falta helper compartido (p. ej. `validarAventuraCanonica(yaml, slug)`)
- `src/api/aventuras.js` — reutilizar `cargarCatalogoObjetos` en guardado
- `src/components/IssueList.jsx` / `ResumenValidacion.jsx` — reutilizar sin duplicar markup
- `public/ayuda/GUIA_EDITOR_DM.md` — nota “guardar exige validación del motor” (copia espejo EN si aplica)

**Anti-patrones B**

- No copiar reglas de `validar_campana.py` a `domain/aventura.js`.
- No hacer guardado “optimista” si falló la validación canónica.

**Criterios de aceptación B**

- [ ] YAML con error conocido del motor (p. ej. `objeto_canonico` con `item_id` inválido) → guardar/exportar **bloqueados**, issues visibles.
- [ ] YAML del ejemplo sincronizado (tras A) → guardar en `ejemplo` **permite** si motor OK.
- [ ] Backend apagado → guardar/export **bloqueados** aunque validación local OK; mensaje útil.
- [ ] Sin `serverSlug`, `item_id` solo en catálogo local → validación canónica falla (global); con slug y catálogo local cargado → pasa si el id existe en la vista combinada.
- [ ] `npm run build` OK.

---

### Entrega C — Mapa y `puntos_interes` en UI de localizaciones

**Objetivo:** el autor ve en `/aventura` los problemas de mapa que hoy solo aparecen en `/validar` o en mesa.

**Enfoque preferido (delegación)**

Tras validación canónica (o botón “Validar mapa” / reutilizar último resultado de B):

- Filtrar `issues` por **`path`** alineado con el validador del motor (formato típico en `validar_campana.py`):
  - Prefijo `localizaciones:{locId}.mapa` (p. ej. `localizaciones:cripta_sala.mapa`, `…mapa.puntos_interes[2].celda`).
  - Subcadenas `.puntos_interes` dentro de ese prefijo.
  - Complemento opcional: `code` que empiece por `MAPA_` si el `path` no matchea pero el issue es claramente de mapa.
- Helper sugerido: `issuesMapaParaLocalizacion(allIssues, locId)` → issues donde `path.startsWith(\`localizaciones:${locId}.mapa\`)` o incluye `` `localizaciones:${locId}.mapa.puntos_interes` ``.
- En `SeccionLocalizaciones` / `MapaBloque`: sustituir o complementar `validarMapaRuntimeLocalizacion` con ese subconjunto.
- Si no hay slug/backend o no hay resultado canónico reciente: “Validación de mapa requiere motor” + check mínimo de imagen (sin verde engañoso).

**Opcional (solo si la delegación es insuficiente en UX)**

- Ampliar `validarMapaRuntimeLocalizacion` con 2–3 reglas críticas copiadas (celda fuera de rango, `objeto_canonico` sin `item_id`) — **desaconsejado** salvo offline sin API.

**Ficheros a tocar**

- `src/domain/aventura.js` — `issuesMapaParaLocalizacion(issues, locId)` (filtro por `localizaciones:{id}.mapa…`); deprecar o reducir el check “solo imagen”
- `src/components/aventura/SeccionLocalizaciones.jsx` — panel salud mapa con issues del motor
- `src/pages/AventuraPage.jsx` — pasar último resultado canónico a sección localizaciones (context o prop)

**Criterios de aceptación C**

- [ ] Corona mal colocada / `item_id` inválido → issue visible en la fila de la localización afectada.
- [ ] Transición con destino inexistente → issue con código `MAPA_PI_TRANSICION_*` visible.
- [ ] Localización sin mapa → sin falso “Mapa listo” verde si el motor reporta error.

---

### Entrega D — Lint en verde

**Objetivo:** `npm run lint` sin errores en `dm_editor`.

**Errores conocidos en base `9b74f2c` (arreglar, no silenciar con eslint-disable salvo excepción documentada)**

| Fichero | Problema |
| --- | --- |
| `ImportarAventura.jsx` | variable no usada |
| `SeccionLocalizaciones.jsx` | `assetsTacticos` no usada; `setState` en effect |
| `domain/aventura.js` | funciones/params no usados |
| `hooks/useUndoRedo.js` | acceso a refs durante render (`canUndo`/`canRedo`) |
| `pages/AventuraPage.jsx` | bloque `catch` vacío |

**Warnings** (`LanguageContext.jsx` react-refresh): corregir si es trivial; si no, documentar en §Verificación.

**Criterios de aceptación D**

- [ ] `npm run lint` → exit 0.
- [ ] `npm run build` → OK.

---

## §4. Orden de implementación

```text
A (samples) → B (guardar canónico) → C (mapa en UI) → D (lint)
```

B depende de A para pruebas manuales fiables con el ejemplo real. C depende de B (necesita issues del motor en memoria o re-validación). D puede hacerse en paralelo tras A, pero conviene **al final** para no rebasear conflictos con B/C.

**Working tree sucio:** no incluir en commits F15 cambios ajenos (IA mapa, NPCs, CSS) salvo los ficheros listados en cada entrega.

---

## §5. Verificación manual (checklist)

**Preparación**

```bash
# Motor
cd ../dm_virtual && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Editor
cd ../dm_editor && npm run dev
# http://localhost:5180
```

| # | Prueba | Esperado |
| --- | --- | --- |
| 1 | `tools/sync_samples_from_dm_virtual.sh` | Samples iguales al motor |
| 2 | `/validar` → cargar ejemplo → validar | `ok: true` (o solo warnings documentados) |
| 3 | `/aventura` → cargar ejemplo → guardar `ejemplo` | OK si motor OK; bloqueado si introduces un error |
| 4 | Introducir `item_id` falso en `objeto_canonico` | Guardar bloqueado; issue `MAPA_PI_OBJETO_*` |
| 5 | `/catalogo` slug `ejemplo` | Global RO + local; guardar local |
| 6 | Localización con mapa → panel salud | Muestra issues MAPA_* del motor (entrega C) |
| 7 | `npm run lint` && `npm run build` | Ambos OK |

---

## §6. Referencias

| Documento / código | Uso |
| --- | --- |
| `dm_virtual/docs/EDITOR_APP_CONTRACT.md` §9 | Contrato `POST /api/editor/validar-campana` |
| `dm_virtual/docs/specs/F14_Catalogo_Objetos_Global_Local_dm_editor.md` | Catálogo en validación (`catalogo_objetos_text`) |
| `dm_virtual/docs/specs/F4_h_Objetos_Canonicos_Interactuables_Mapa.md` | Reglas `objeto_canonico` en runtime |
| `dm_virtual/backend/app/core/validar_campana.py` | Códigos `MAPA_*`, `MAPA_PI_*` |
| `dm_editor/src/api/validarCampana.js` | Cliente HTTP existente |
| `dm_editor/src/pages/ValidarYamlPage.jsx` | Referencia UX issues |

---

## §7. Veredicto de producto

**F15 es el siguiente paso correcto** antes de más UI de objetos canónicos en mapa: primero coherencia editor ↔ motor; después el colocador visual de `objeto_canonico` (SPEC posterior).

## §8. SPEC posterior (no F15)

- **F15b o F4.h-editor:** colocación visual de `objeto_canonico` en mapa (clic → celda → `item_id`), solo tras F15 cerrada.
- **F3.2 (archivada/obsoleta):** pincel walkmask — reevaluar si se restaura flujo táctico visual; la SPEC `F3.2_pincel_walkmask.md` describe componentes que `ab8280d` eliminó.

---

## §9. Cierre de la SPEC

**Git (SPEC validada):** commitear `docs/specs/F15_Coherencia_Validacion_Samples_dm_editor.md` en un commit acotado (solo docs F15), sin mezclar el working tree sucio actual (`mapaIA.js`, NPCs, samples, etc.).

Marcar `Estado: cerrada` y rellenar `Commit cierre` cuando:

- [ ] Entregas A, B, C y D cumplen criterios de aceptación.
- [ ] Checklist §5 ejecutado.
- [ ] Sin drift nuevo entre samples y motor (o script documentado en CI/README).
