# mini-SPEC F15b — Colocador visual de puntos de interés en mapa libre

| Campo | Valor |
| --- | --- |
| **ID** | F15b |
| **Estado** | `cerrada` |
| **Prioridad** | media (tras F15 cerrada; primera UI de autoría sobre F4.h) |
| **Commit base** | `426ccef` (docs F15b; base funcional post-F15-D `a3e4e0e`) |
| **Commit cierre** | `092d384` (código); `41e8658` (cierre docs SPEC/HANDOFF/GUIA) |
| **Fecha** | 2026-05-29 |
| **Repo** | `dm_editor` (motor fuente de verdad, RO: `../dm_virtual`) |
| **Depende de** | F15 (validación canónica + issues `MAPA_*` por loc), F14 (catálogo global/local), F4.h (contrato `puntos_interes`) |

---

## §0. Diagnóstico (revisión 2026-05-29)

Revisión sin cambios de código en `dm_editor` y lectura RO de `dm_virtual` (incluido el runtime del jugador `frontend/src/game/LienzoOwlbear.jsx`):

| Hallazgo | Evidencia |
| --- | --- |
| `objeto_canonico` **ya existe y está validado** dentro de `localizaciones[].mapa.puntos_interes[]` | `dm_virtual/backend/app/core/validar_campana.py` (bloque `objeto_canonico`, códigos `MAPA_PI_OBJETO_*`) y `docs/specs/F4_h_*.md` |
| El **validador** acepta `celda` como `[float, float]` y solo comprueba rango `0..100` | `validar_campana.py:419-421` (`tablero_ok, cols, rows = True, 101, 101`; `pisable_ok=False`) y `_celda_offset_valida` |
| **PERO el runtime interpreta `celda` en modo dual** (índice de rejilla vs. porcentaje) | `LienzoOwlbear.jsx:235-251` — ver §1.bis. **Validador ≠ renderer.** |
| **Todos los mapas del ejemplo declaran `cols`/`rows`** y son IA-generados | 19/19 bloques `puntos_interes` con `cols`/`rows`; `generado_ia.hash` presente. La corona real es `celda: [24, 15]` con `cols: 48, rows: 36` → render en ~51,0 % / ~43,1 %, **no** en 24 %/15 % |
| El editor **no tenía UI** para `puntos_interes` (cerrado en F15b) | `ColocadorPuntosDialog` en `SeccionLocalizaciones` → «Editar puntos del mapa» |
| F15-C muestra issues `MAPA_PI_*`; el colocador resalta por índice de `path` | `issuesMapaParaLocalizacion` + `parseIndicePunto` |

**Veredicto:** el trabajo de F15b es de **UX** (un lienzo para colocar visualmente lo que hoy solo se escribe a mano), **pero con una decisión previa bloqueante**: el espacio de coordenadas de `celda` no es "0..100 libre" de forma incondicional — es **relativo a rejilla cuando el mapa tiene `cols`/`rows`** (caso de todos los mapas canónicos actuales) y porcentaje en caso contrario. Mezclar puntos en % dentro de un mapa con `cols`/`rows` produce posiciones erróneas silenciosas. Esta SPEC resuelve eso **normalizando el mapa a modo libre al abrir el colocador (Opción B)**.

**Decisión arquitectónica (A vs B de modelado):** ni una entidad específica `objetos_canonicos:` ni una clave genérica nueva `elementos_mapa:` — ambas exigirían modificar `dm_virtual` y duplicarían validación. Se adopta **la filosofía de lista genérica tipada por `tipo` materializada en el `puntos_interes` que el motor ya valida**. Cero cambios en el motor, cero reglas nuevas en JS, F4.h compatible al 100 %.

---

## §1. Objetivo

Permitir autorar visualmente `localizaciones[].mapa.puntos_interes[]` sobre la imagen de mapa libre (coordenadas porcentuales `0..100`), reutilizando el contrato y los validadores del motor **sin modificarlo**. Tipos soportados en el MVP: `objeto_canonico` y `transicion`.

---

## §1.bis. Espacio de coordenadas de `celda` (clave) y política de normalización (Opción B)

### Cómo interpreta el runtime `celda` (`LienzoOwlbear.jsx:235-251`)

```js
const usaGrid = cols > 0 && rows > 0
const xPct = usaGrid && rawX >= 0 && rawX < cols && rawY >= 0 && rawY < rows
  ? ((rawX + 0.5) / cols) * 100   // GRID: celda = índice de celda → centro
  : rawX                          // LIBRE: celda = porcentaje 0..100 (raw)
```

- Si el mapa **tiene `cols`/`rows`** (`usaGrid=true`) y la `celda` cae dentro de la rejilla → `celda` se interpreta como **índice de celda** y se convierte a porcentaje (centro de celda).
- Si el mapa **no tiene `cols`/`rows`** → `celda` se usa **tal cual como porcentaje** `0..100`.

**Riesgo de mezcla (motivo de la Opción B):** escribir un punto en % (p. ej. clic en `[10, 8]`) sobre un mapa con `cols: 32` hace que el runtime evalúe `10 < 32` → lo trata como **celda de rejilla** → lo pinta en `(10,5/32)*100 ≈ 32,8 %`, no en 10 %. El fallo es silencioso y solo afecta a valores `< cols`/`rows` (todo el cuadrante superior-izquierdo). El **validador no lo detecta** porque solo comprueba rango `0..100`.

### Opción B — Normalizar a modo libre al abrir el colocador

Al abrir `ColocadorPuntosDialog` sobre un mapa con `cols`/`rows` (`usaGrid=true`), se realiza **una normalización explícita y visible, una sola vez**:

1. Convertir a porcentaje, con la **misma fórmula que el runtime** (`pct = ((idx + 0.5) / cols) * 100`, ídem filas), **TODOS los campos del mapa que contienen `celda` y que el runtime/backend interpretan vía rejilla** (ver §1.ter — no solo `puntos_interes`):
   - `puntos_interes[].celda`
   - `spawn_entrada.celda`
   - `spawns_npc[].celda`
   - `presencias_tacticas[].celda` *(defensivo — ver §1.ter; sin consumidor de posicionamiento hoy, pero sus celdas son índices de rejilla)*
   - La conversión se aplica **solo si la celda cae dentro de la rejilla** (replicar la condición del consumidor: `0 ≤ x < cols` para `puntos_interes`, como `LienzoOwlbear`; `0 ≤ x ≤ cols` para spawns, como el backend — la diferencia solo afecta al borde exacto `= cols`, degenerado). Si ya está fuera de rejilla, se asume que ya era %.
2. **Solo después** de convertir todos los campos anteriores, eliminar del `mapa` los campos de rejilla que activan `usaGrid`: **`cols`, `rows`, `tile_w`, `tile_h`, `origen_px`, `pisable`** (todos en `ignored_fields` del validador; no afectan a la validación canónica).
3. A partir de ahí el mapa es `usaGrid=false` y el colocador trabaja en **porcentaje puro**: clic → `[x%, y%]` redondeado a 2 decimales.

> **Orden obligatorio (correctitud):** borrar `cols`/`rows` **reinterpreta** `spawn_entrada`/`spawns_npc` de rejilla a % en el backend. Si no se convierten primero, la posición de entrada del grupo y de los NPCs queda desplazada. Convertir → luego borrar.

Reglas de la normalización:

- Es **idempotente**: un mapa ya sin `cols`/`rows` no se toca.
- Equivale a la posición que runtime y backend ya calculaban (centro de celda), así que **no mueve visualmente** puntos ni spawns; solo cambia su representación numérica.
- Se persiste por la **puerta canónica F15-B** (Guardar/Exportar revalidan). No se escribe nada a disco fuera de ese flujo.
- Se aplica en **un único commit** del estado (un solo `updateMapa`), nunca dejando un estado intermedio con puntos normalizados pero el mapa aún con `cols`/`rows`.
- Se avisa al autor de forma explícita ("Este mapa se normaliza a coordenadas libres; puntos y spawns conservan su posición"). No es una migración silenciosa.

### §1.ter. Consumidores de `celda` que dependen de rejilla (evidencia)

| Campo | Consumidor | Conversión grid→% |
| --- | --- | --- |
| `puntos_interes[].celda` (`objeto_canonico`) | frontend `LienzoOwlbear.jsx:245-251` | `((idx + 0.5) / cols) * 100`, cond. `idx < cols` |
| `spawn_entrada.celda` | backend `main.py:_spawn_celda_para_viaje_mundo` (~2826) | lee `cols`/`rows`, mismo cálculo |
| `spawns_npc[].celda` | backend `mapa_runtime.py:_normalizar_celda_a_porcentaje_lienzo` (162-190) | `((x + 0.5) / cols) * 100`, cond. `x ≤ cols` |
| `presencias_tacticas[].celda` | **ninguno de posicionamiento** — solo `validar_campana.py:804` (lista). La migración de `mapa_runtime.py:263` opera sobre `estado.posiciones_mapa` (estado vivo), **no** sobre este campo del YAML | n/a (conversión **defensiva**) |

**Corrección dura:** la normalización **debe** convertir `puntos_interes` + `spawn_entrada` + `spawns_npc` antes de borrar `cols`/`rows`; omitir los spawns los desplazaría.
**Defensa en profundidad:** convertir además `presencias_tacticas[].celda` no es estrictamente necesario hoy (sin consumidor de posicionamiento), pero se incluye por ser barato, idempotente y a prueba de futuros lectores. Si se prefiere no tocarlo, documentar que esas celdas quedan en rejilla y no deben asumir % en runtime.

> Se descartan: **(A) Gate** (no abriría en ningún mapa canónico actual) y **(C) Grid-aware/snap** (reintroduciría colocación en rejilla, prohibido por §2).

---

## §2. Invariantes (NO renegociables)

- [x] Modelo de datos = `puntos_interes` del motor, **sin campos nuevos con semántica runtime**.
- [x] El colocador trabaja en **porcentaje `0..100`** y **solo** sobre mapas en modo libre. Si el mapa tiene `cols`/`rows`, se **normaliza primero** (§1.bis, Opción B), convirtiendo `puntos_interes` **y** `spawn_entrada`/`spawns_npc` antes de borrar la rejilla. **Nunca** se mezclan puntos en % con un mapa que conserve `cols`/`rows`.
- [x] `celda: [x, y]` se escribe como floats `0..100` (porcentaje); **nunca** se redondea a entero ni se hace snap a rejilla.
- [x] **Cero cambios en `dm_virtual`.** **Cero** reglas de validación nuevas en JS.
- [x] Validación **dura** = `POST /api/editor/validar-campana` (puerta F15-B). Feedback **visual** = issues `MAPA_PI_*` filtrados por `path` (F15-C). No se reimplementa lógica de `objeto_canonico`/`transicion` en el cliente.
- [x] Preservar campos desconocidos de puntos existentes (merge, no overwrite); preservar puntos de `tipo` no editable (§7).
- [x] No reintroducir: editor táctico, walkmask, grid/snap, rotación, escala, tilesets, `objetos_tacticos`.

---

## §3. Alcance

- Lienzo modal por localización con imagen de fondo + marcadores posicionados por porcentaje `0..100` (CSS `left:x% / top:y%`, resolución-independiente).
- **Normalización de coordenadas al abrir** (§1.bis) si el mapa tiene `cols`/`rows`.
- Acciones: **añadir**, **mover** (drag + inputs numéricos accesibles), **eliminar**, **editar propiedades**.
- Picker de `item_id`: catálogo F14 (`cargarCatalogoObjetos(slug)`), filtrando `canonico === true`.
- Picker de `destino`: `<select>` de `loc.conexiones`, **filtrado además** a locs que el motor aceptaría como destino válido (ver reglas abajo).
- Resaltado de marcadores con error según issues `MAPA_PI_*` del último resultado canónico (por índice extraído del `path`).

### Modelo de datos (esquema del motor, verbatim)

`proyeccion` la fija el flujo de generación de imagen (ejemplo real: `dimetrico_2_1`); **el colocador no la edita**.

```yaml
localizaciones:
  - id: cripta_sala
    conexiones: [cripta_camara]
    mapa:
      imagen: mapas/cripta_sala/....png
      proyeccion: dimetrico_2_1     # NO editable desde el colocador
      # cols/rows/tile_*/pisable: eliminados al normalizar (Opción B)
      puntos_interes:
        - id: corona_pedestal
          tipo: objeto_canonico
          celda: [51.04, 43.06]     # PORCENTAJE 0..100 (tras normalizar [24,15] con cols48/rows36)
          etiqueta_ui: La Corona Perdida
          icono: artefacto
          item_id: corona_perdida   # picker F14, debe ser canonico=true
          evento_al_recoger: tomar_corona
          requiere_confirmacion: true
          texto_confirmacion: "..."
        - id: salida_norte
          tipo: transicion
          celda: [50.0, 6.5]
          destino: cripta_camara    # picker desde conexiones (filtrado, ver abajo)
```

| Campo | Tipo | Validado por motor | Notas |
| --- | --- | --- | --- |
| `id` | string único | sí (`MAPA_PI_CAMPO_FALTANTE`, `MAPA_PI_ID_DUPLICADO`) | autogenerar `pi_1`, `pi_2`… |
| `tipo` | `objeto_canonico` \| `transicion` | sí (presencia) | discriminador |
| `celda` | `[x, y]` float `0..100` (%) | sí (`MAPA_PI_CELDA_FUERA`) | porcentaje en modo libre; nunca rejilla |
| `etiqueta_ui` | string | no | rótulo en lienzo |
| `icono` | string | no | hint visual |
| `item_id` *(objeto_canonico)* | string | sí (`MAPA_PI_OBJETO_ITEM_*`, `MAPA_PI_OBJETO_NO_CANONICO`) | picker F14 |
| `evento_al_recoger` *(objeto_canonico)* | string | sí (`MAPA_PI_OBJETO_EVENTO_INVALIDO`) | opcional; input libre en MVP |
| `requiere_confirmacion` *(objeto_canonico)* | bool | no | default `true` |
| `texto_confirmacion` *(objeto_canonico)* | string | no | |
| `destino` *(transicion)* | loc id | sí (varias, ver abajo) | picker desde `conexiones` filtrado |

**Reglas completas de `transicion` que aplica el motor** (`validar_campana.py`, no solo "no conectado"):

- `MAPA_PI_TRANSICION_DESTINO_FALTANTE` — falta `destino`.
- `MAPA_PI_TRANSICION_DESTINO_INVALIDO` — el destino no existe en `localizaciones`.
- `MAPA_PI_TRANSICION_DESTINO_NO_CONECTADO` — el destino no está en `conexiones` de la loc.
- `MAPA_PI_TRANSICION_DESTINO_SIN_MAPA` — el destino no tiene `mapa`, o su `proyeccion` no está en `{tactico, dimetrico_2_1}`.

→ El `<select>` de destino debe ofrecer solo locs en `conexiones` **que además** tengan `mapa` con `proyeccion ∈ {tactico, dimetrico_2_1}` (lectura del YAML en memoria, **sin** revalidar la regla en JS). El resto de combinaciones las sigue cazando F15-C tras guardar.

**Excluido del MVP y por qué:**

- **Rotación / escala:** `puntos_interes` no las define; el runtime pinta marcador icono+etiqueta, no sprite orientable → metadato muerto y reabre el editor táctico.
- **Capa visual:** no existe en el contrato; `icono` ya diferencia.
- **`spawn`:** el motor lo modela aparte (`mapa.spawn_entrada`, `mapa.spawns_npc`), no como `tipo` de punto.

---

## §4. Fuera de alcance (SPEC posterior si se necesita)

- Spawns (`spawn_entrada`, `spawns_npc`) — estructura distinta del motor.
- Tipos de punto con **semántica runtime nueva** (requerirían SPEC en `dm_virtual`).
- Edición de tipos distintos de `objeto_canonico`/`transicion` (se leen y preservan, no se editan — §7).
- Rotación, escala, capas, snap a grid, multi-selección, undo/redo propio del lienzo.
- Edición de la imagen del mapa y de `proyeccion` (sigue en `MapaIADialog`).

---

## §5. Fases

```text
A (leer/render/normalizar) → B (editar) → C (integración guardado) → D (pulido + lint)
```

- **F15b-A — Lectura / render: ✅** (`d93434d` + fix `5d8c1c3`). Pinta `puntos_interes` + panel; **normalización Opción B al abrir**; errores por `path`.
- **F15b-B — Edición: ✅** (`15b707b`, `092d384`). Añadir / mover / eliminar / editar; `id` autogenerado; pickers F14 y destino; estado local del modal; **un solo commit** al pulsar «Aplicar» (`updateMapa(..., { replace: true })`).
- **F15b-C — Integración guardado: ✅** Puerta F15-B y resaltado `MAPA_PI_*` reutilizados; documentado en `GUIA_EDITOR_DM.md` §6.
- **F15b-D — Pulido: ✅** `npm run lint` exit 0 (3 warnings documentados en F15); `npm run build` OK.

---

## §6. Ficheros previstos (editor)

| Ruta | Rol |
| --- | --- |
| `src/components/aventura/ColocadorPuntosDialog.jsx` | Modal: imagen + marcadores + panel. Props: `loc`, `localizaciones`, `serverSlug`, `validacionCanonica`, `readOnly`, `onApply(mapa)` (mapa **completo** normalizado), `onClose` |
| `src/components/aventura/SeccionLocalizaciones.jsx` | Botón «Editar puntos del mapa» (solo `mapa.imagen`); `onApply` → `updateMapa(..., { replace: true })` |
| `src/domain/aventura.js` | Helpers **puros**: `nuevoPuntoInteres(tipo)`, `normalizarMapaACoordenadasLibres(mapa)` (Opción B — convierte `puntos_interes` + `spawn_entrada` + `spawns_npc` [+ `presencias_tacticas` defensivo] y **luego** borra `cols/rows/tile_*/origen_px/pisable`; idempotente), `parseIndicePunto(path)`, merge seguro de punto |
| `src/api/aventuras.js` / `src/api/mapaIA.js` | Reutilizar `cargarCatalogoObjetos` (picker) y `urlMapaPublico(slug, mapa.imagen)` (fondo del lienzo, como `MapaBloque`). **Sin endpoints nuevos** |
| `public/ayuda/GUIA_EDITOR_DM.md` (+ espejo EN si aplica) | Nota de uso del colocador y de la normalización a coords libres |

**`parseIndicePunto(path)` — formato del motor** (`validar_campana.py`): `localizaciones:{locId}.mapa.puntos_interes[{idx}].{campo}`.

```js
// Ejemplo de contrato esperado (regex tolerante; si no casa → null y se degrada a lista de mensajes)
export function parseIndicePunto(path) {
  const m = /\.mapa\.puntos_interes\[(\d+)\]/.exec(String(path || ''))
  return m ? Number(m[1]) : null
}
```

**Anti-patrones:** no copiar reglas de `objeto_canonico`/`transicion` a `domain/aventura.js`; no revalidar `item_id`/`destino`/conectividad en JS; no añadir campos que el motor ignore; no hacer snap a rejilla.

**Nota crítica — aplicar = REEMPLAZAR (`5d8c1c3`):** el `mapa` del colocador va sin `cols`/`rows`. Fusionar con el previo reinyecta rejilla y desplaza spawns. Usar `{ replace: true }` en `updateMapa`.

---

## §7. UX del MVP (flujo, sin mockups)

Entrada: `SeccionLocalizaciones` → `MapaBloque` → botón **"Editar puntos del mapa"**.

- **Gating (decisión explícita):** habilitado **solo si `loc.mapa.imagen`** (imagen raster). `MapaBloque.tieneMapa` incluye también `modo_render==='piezas'`; el colocador **no** se abre en modo piezas sin imagen en el MVP.
- **Al abrir:** si `usaGrid` (mapa con `cols`/`rows`), ejecutar **normalización Opción B** (§1.bis) con aviso explícito; los puntos no se mueven visualmente.
- **Añadir:** "+ Punto" → elegir `tipo` → clic en la imagen fija `celda = [%x, %y]`. `id` autogenerado. `objeto_canonico` → selector `item_id` (catálogo F14, filtro `canonico=true`); `transicion` → `<select>` de `conexiones` filtrado (§3).
- **Mover:** drag del marcador; al soltar, recalcula `celda` en %. Alternativa accesible: inputs numéricos x/y en el panel.
- **Eliminar:** acción en marcador seleccionado / fila del panel, con confirmación.
- **Editar propiedades:** panel lateral con campos según `tipo`.
- **Tipos no editables:** puntos con `tipo` distinto de `objeto_canonico`/`transicion` (p. ej. los existentes con `oculto`, `icono`) se **muestran y preservan** en el merge, marcados como "no editable en esta versión"; no se pierden al guardar.
- **Errores:** reutilizar `issuesMapaParaLocalizacion(validacionCanonica.issues, loc.id)`; por el índice del `path` (`parseIndicePunto`) resaltar el marcador en rojo y listar mensaje. El parseo del índice es presentación, no validación.

**Implementación del lienzo (nota técnica):** la conversión píxel→% debe usar el **rectángulo real de la imagen** renderizada (con `object-fit`/letterboxing), no el del contenedor. El runtime ya resuelve esto con `mapBox`/`imgRect` (`LienzoOwlbear.jsx:336-348`); replicar ese patrón para que las posiciones del editor coincidan con las del jugador.

Al aplicar: `onApply(mapa)` entrega el mapa ya normalizado en **un solo commit** (`updateMapa(..., { replace: true })`), sin estados intermedios con puntos en % y mapa aún con `cols`. El guardado en servidor pasa por la puerta canónica F15-B.

**Medición del lienzo:** `ResizeObserver` en contenedor e imagen, `visualViewport` (zoom) y remediación al cambiar `selIdx` (panel lateral). Los campos x/y % siguen siendo alternativa precisa.

---

## §8. Compatibilidad

- **Campañas existentes:** `puntos_interes` es opcional; locs sin él no cambian. El ejemplo `cripta_sala` ya trae `corona_pedestal` (`celda: [24, 15]`, mapa con `cols: 48, rows: 36`) → al abrir el colocador se normaliza a % (≈ `[51.04, 43.06]`) **sin moverla visualmente**.
- **F14 catálogo:** picker desde vista combinada global+local. Sin `serverSlug` → avisar y permitir teclear `item_id` (el motor valida contra global). Coherente con F15-B.
- **F15 validación canónica:** reutilización directa; guardado/export ya bloquean con `MAPA_PI_*`. F15b **no** añade reglas JS.
- **F4.h runtime:** la salida en % es exactamente lo que `LienzoOwlbear` pinta cuando `usaGrid=false`; tras normalizar, autor y jugador ven la misma posición.

---

## §9. Riesgos

- **Mezcla de espacios de coordenadas (alto — el principal).** Puntos en % sobre un mapa con `cols`/`rows` se renderizan como rejilla. **Mitigación:** Opción B (normalizar y borrar `cols`/`rows` al abrir); invariante §2 que prohíbe la mezcla.
- **Reabrir el editor táctico por la puerta de atrás (alto).** Mitigación: congelar el modelo al esquema del motor; sin snap, rotación ni escala; review rechaza campos que el motor ignore.
- **Normalización percibida como cambio no deseado (medio).** Mitigación: aviso explícito, idempotente, sin mover puntos, persistida solo por la puerta F15-B.
- **Duplicar validación (medio).** Mitigación: solo delegación + resaltado por `path`; único feedback "duro" = el del motor.
- **Aspect-ratio / letterboxing (medio).** Mitigación: usar rect real de la imagen (`imgRect`), no el contenedor (§7).
- **Spawns desincronizados por la normalización (alto si se omite).** Borrar `cols`/`rows` sin convertir `spawn_entrada`/`spawns_npc` desplaza entrada de grupo y NPCs. Mitigación: §1.bis convierte los tres campos antes de borrar la rejilla; criterio de aceptación dedicado (§10).
- **Acoplamiento al `path` del motor (bajo).** Mitigación: `parseIndicePunto` tolerante; si no casa, degradar a lista de mensajes.
- **Regla de pies del visor (cosmético).** Tras quitar `cols`, `LienzoOwlbear.jsx:489` (`cols || 20`) usa el default 20 para la escala de regla. Es solo visual (no afecta posiciones); no bloquea F15b.
- **Confusión por el nombre `celda` (bajo).** Mitigación: tooltip/documentación "`celda` = % 0..100 en modo libre".

---

## §10. Criterios de aceptación

- [x] Cargar ejemplo → `cripta_sala`: normalización sin `cols`/`rows`; corona conserva posición visual (validado en mesa y por script sobre 19 mapas).
- [x] Normalización **idempotente**: reabrir el colocador no altera `celda` ni el `mapa`.
- [x] `objeto_canonico` + `item_id` válido guarda; inválido → puerta F15-B + marcador rojo (`MAPA_PI_OBJETO_*`).
- [x] `transicion`: `<select>` filtrado; errores `MAPA_PI_TRANSICION_*` visibles tras validar.
- [x] Mover punto actualiza solo `celda` (floats `0..100`).
- [x] Punto en zona `< cols` antiguo cae donde se coloca tras normalizar (regresión %/rejilla).
- [x] **Spawns intactos** tras normalizar + `replace` + guardar.
- [x] Tipos no editables preservados en merge del modal.
- [x] Sin `serverSlug`: entrada manual `item_id` con aviso.
- [x] `npm run lint` exit 0; `npm run build` OK.
- [x] Sin reglas `objeto_canonico`/`transicion`/conectividad duplicadas en JS (solo `destinosTransicionValidos` como filtro de UI).

---

## §11. Estrategia de pruebas

- **Manual** con motor `:8000` + editor `:5180` sobre `ejemplo`: abrir colocador en `cripta_sala`, verificar normalización sin desplazamiento (comparar contra `PlayerView`), añadir/mover/eliminar/editar.
- **Caso feliz** (corona válida) y **casos de error** (`item_id` falso, destino no conectado / sin mapa, `celda` fuera de `0..100`).
- **Coordenadas:** colocar un punto cerca de la esquina superior-izquierda y confirmar que jugador y editor lo pintan en el mismo sitio (regresión del bug de mezcla %/rejilla).
- **Transición:** colocar al menos una `transicion` en el modal (no solo la corona) y verificar destino válido + posición en mesa.
- **Spawns:** usar una loc **con `spawns_npc`** (además de `spawn_entrada`); comparar entrada de grupo y posición de NPCs en mesa antes/después de normalizar (no deben moverse). Si la loc tiene `presencias_tacticas`, comprobar que tampoco se desplazan.
- **Round-trip:** cargar YAML con puntos (incl. `tipo` no editable) → editar uno → guardar → recargar → campos/tipos no tocados preservados; `cols`/`rows` ausentes tras normalizar.
- **Regresión F15:** issues por loc se siguen mostrando; puerta de guardado intacta.
- **CI local:** `npm run build` y `npm run lint`.

---

## §12. Cierre de la SPEC

**Estado `cerrada` (2026-05-28):** F15b-A→D completadas. Código: `092d384`; documentación de cierre: `41e8658`.

- [x] Fases A–D cumplen criterios de aceptación (§10).
- [x] Pruebas §11 ejecutadas (manual + script idempotencia 19 mapas; coordenadas %/rejilla).
- [x] HANDOFF actualizado (colocador disponible; autoría F4.h en mapa libre cubierta en editor).
- [x] Sin cambios en `dm_virtual` ni reglas de validación duplicadas en JS.

**Fuera de alcance F15b (backlog motor/mesa):** pintar `transicion` en lienzo del jugador; portales DM automáticos en bordes.
