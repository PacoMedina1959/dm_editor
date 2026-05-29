# mini-SPEC F15b — Colocador visual de puntos de interés en mapa libre

| Campo | Valor |
| --- | --- |
| **ID** | F15b |
| **Estado** | `validada` |
| **Prioridad** | media (tras F15 cerrada; primera UI de autoría sobre F4.h) |
| **Commit base** | `426ccef` (docs F15b; base funcional post-F15-D `a3e4e0e`) |
| **Commit cierre** | `<rellenar al cerrar>` |
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
| El editor **no tenía UI** para `puntos_interes` (ahora F15b-A añade el colocador, solo lectura — `d93434d`) | No existía lienzo por-localización; `MapaIADialog` solo genera/sube imagen, `MapaMundoDialog` posiciona locs, `MapaEscenas` es grafo de escenas |
| F15-C ya muestra issues `MAPA_PI_*` por fila de loc, pero el autor **no puede crearlos/moverlos** | `SeccionLocalizaciones.jsx` + `issuesMapaParaLocalizacion` |

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
- Se aplica en **un único commit** del estado (un solo `updateMapa(..., { replace: true })` — reemplaza, no fusiona; ver §6), nunca dejando un estado intermedio con puntos normalizados pero el mapa aún con `cols`/`rows`.
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

- [ ] Modelo de datos = `puntos_interes` del motor, **sin campos nuevos con semántica runtime**.
- [ ] El colocador trabaja en **porcentaje `0..100`** y **solo** sobre mapas en modo libre. Si el mapa tiene `cols`/`rows`, se **normaliza primero** (§1.bis, Opción B), convirtiendo `puntos_interes` **y** `spawn_entrada`/`spawns_npc` antes de borrar la rejilla. **Nunca** se mezclan puntos en % con un mapa que conserve `cols`/`rows`.
- [ ] `celda: [x, y]` se escribe como floats `0..100` (porcentaje); **nunca** se redondea a entero ni se hace snap a rejilla.
- [ ] **Cero cambios en `dm_virtual`.** **Cero** reglas de validación nuevas en JS.
- [ ] Validación **dura** = `POST /api/editor/validar-campana` (puerta F15-B). Feedback **visual** = issues `MAPA_PI_*` filtrados por `path` (F15-C). No se reimplementa lógica de `objeto_canonico`/`transicion` en el cliente.
- [ ] Preservar campos desconocidos de puntos existentes (merge, no overwrite); preservar puntos de `tipo` no editable (§7).
- [ ] No reintroducir: editor táctico, walkmask, grid/snap, rotación, escala, tilesets, `objetos_tacticos`.

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

- **F15b-A — Lectura / render: ✅ implementada (`d93434d` + fix `5d8c1c3`).** Pinta `puntos_interes` existentes sobre la imagen (solo lectura) + panel lateral; **normalización Opción B al abrir** (§1.bis); errores por `path`. Pendiente: cierre visual del round-trip §10 en `PlayerView`.
- **F15b-B — Edición:** añadir / mover / eliminar / editar; autogenerar `id`; pickers `item_id` y `destino` (filtrado). **Dos decisiones fijadas (ver §7):** (1) la edición vive en **estado local del modal** y se persiste en **un único commit** al pulsar «Aplicar» (mismo `updateMapa(..., { replace: true })` que A), **no** con `updateSection` por cada cambio; (2) el diálogo necesita **`localizaciones` y el catálogo F14** cableados (hoy no los recibe).
- **F15b-C — Integración guardado:** confirmar que la puerta canónica F15-B bloquea con `MAPA_PI_*` y que el marcador erróneo se resalta. Documentar en `GUIA_EDITOR_DM`.
- **F15b-D — Pulido:** `npm run lint` en verde y `npm run build` OK.

---

## §6. Ficheros previstos (editor)

| Ruta | Rol |
| --- | --- |
| `src/components/aventura/ColocadorPuntosDialog.jsx` (nuevo) | Lienzo modal: imagen + marcadores + panel lateral. Props: `loc`, `serverSlug`, `validacionCanonica` (issues por `path`), `readOnly`, `onApply(mapa)` (mapa **completo** normalizado — ver nota crítica), `onClose`. **En B (edición):** añadir prop `localizaciones` (lista completa, para filtrar `destino`) y fuente del **catálogo F14** (`cargarCatalogoObjetos(slug)` para el picker `item_id`). |
| `src/components/aventura/SeccionLocalizaciones.jsx` | Botón "Editar puntos del mapa" (gating por `mapa.imagen`) + wiring; pasar `validacionCanonica`. **`updateMapa` debe REEMPLAZAR el mapa al aplicar el colocador (`{ replace: true }`), no fusionar** — ver nota crítica abajo |
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

**Nota crítica — aplicar = REEMPLAZAR, no fusionar (corrección F15b-A):** el `mapa` que entrega el colocador es un objeto **completo** ya normalizado (con `cols/rows/tile_*/origen_px/pisable` **eliminados**). Si la persistencia fusiona con el mapa previo (`{ ...loc.mapa, ...mapa }`), los campos de rejilla del mapa antiguo **reaparecen** y el runtime vuelve a `usaGrid=true`, re-interpretando como rejilla toda celda `< cols` (incluidos los spawns) → **desplazamiento silencioso**. `updateMapa` ofrece `{ replace: true }`: usa `{ ...mapa }` (sin spread del previo) y omite el aviso de "cambio riesgoso". Verificado: sin esta opción, `cols/rows` no desaparecían tras Guardar y los spawns se movían. Nota: tras el `replace`, `updateMapa` aún pasa por `normalizarMapaTactico` (fija `tipo`/`proyeccion`) y `enlazarTiledRasterHermanoSiFalta` (añade `tiled.json` por convención si falta) — son **metadatos**, **no restauran rejilla** (`cols`/`rows` siguen ausentes).

**Anti-patrones:** no copiar reglas de `objeto_canonico`/`transicion` a `domain/aventura.js`; no revalidar `item_id`/`destino`/conectividad en JS; no añadir campos que el motor ignore; no hacer snap a rejilla; **no fusionar el mapa normalizado con el previo al persistir**.

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

Al aplicar: `onApply` entrega el `mapa` ya normalizado completo en **un solo commit** que **REEMPLAZA** `loc.mapa` (`updateMapa(..., { replace: true })` — **no** fusiona a nivel mapa; ver nota crítica §6), sin estados intermedios con puntos en % y mapa aún con `cols`. El "merge preservando campos/tipos desconocidos" aplica **solo dentro de `puntos_interes`** al editar en B (conservar los puntos no editables), nunca al objeto `mapa`. El guardado pasa por la puerta canónica F15-B.

### Decisiones de F15b-B (edición) — fijadas

1. **Estado de edición = local al modal; commit único en «Aplicar».** Las operaciones (añadir/mover/eliminar/editar) mutan una **copia de trabajo** dentro del diálogo, sembrada desde el mapa ya normalizado. Solo «Aplicar al mapa» persiste, y lo hace con el **mismo `updateMapa(..., { replace: true })`** que A (reemplaza, no fusiona). **No** se usa `updateSection` por cada cambio. Motivos: una sola entrada en `useUndoRedo` por sesión de edición (no una por drag), `validacionCanonica` no se resetea en cada micro-cambio, y se preserva el invariante de reemplazo. «Cerrar sin aplicar» descarta. (La obligación de §5-B de escribir vía `updateSection` se cumple en el momento de aplicar: `updateMapa → onUpdate → updateSection`.)

2. **Wiring de dependencias al diálogo.** El colocador necesita dos entradas que hoy no recibe:
   - **`localizaciones`** (lista completa): para el `<select>` de `destino`, filtrado a conexiones cuyo `mapa.proyeccion ∈ {tactico, dimetrico_2_1}` (lectura en memoria, **sin** revalidar la regla en JS). `SeccionLocalizaciones` ya tiene `items` en scope → `localizaciones={items}`.
   - **Catálogo F14**: para el picker `item_id`, vía `cargarCatalogoObjetos(slug)` filtrando `canonico === true`. Sin `serverSlug` → entrada manual de `item_id` con aviso ("validación contra catálogo global"). Decidir carga dentro del diálogo (estado loading/empty) o por prop; ambas válidas, sin endpoints nuevos.

3. **Feedback de validación durante la edición.** Editar resetea `validacionCanonica` a `null` (vía `updateMapa`/`updateSection`), así que el resaltado de errores por `path` desaparece hasta el siguiente guardado/validación. Mostrar aviso explícito en el panel ("cambios sin validar; guarda para ver issues del motor"). No reimplementar validación en JS.

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
- **Reinyección de rejilla por fusión al aplicar (alto si se omite — bug real de F15b-A).** Persistir el mapa normalizado fusionándolo con el previo (`{ ...loc.mapa, ...mapa }`) reintroduce `cols`/`rows` → el runtime vuelve a modo rejilla y desplaza celdas. Mitigación: aplicar con `{ replace: true }` (§6); corregido en `5d8c1c3`.
- **Acoplamiento al `path` del motor (bajo).** Mitigación: `parseIndicePunto` tolerante; si no casa, degradar a lista de mensajes.
- **Regla de pies del visor (cosmético).** Tras quitar `cols`, `LienzoOwlbear.jsx:489` (`cols || 20`) usa el default 20 para la escala de regla. Es solo visual (no afecta posiciones); no bloquea F15b.
- **Confusión por el nombre `celda` (bajo).** Mitigación: tooltip/documentación "`celda` = % 0..100 en modo libre".

---

## §10. Criterios de aceptación

- [ ] Cargar ejemplo → `cripta_sala` muestra `corona_pedestal` en su posición. Al **abrir** el colocador la normalización ocurre en memoria (no persiste); **tras «Aplicar al mapa» y Guardar**, el YAML de la loc ya **no tiene `cols`/`rows`** y la corona **no se mueve** en `PlayerView`.
- [ ] Normalización **idempotente**: reabrir el colocador sobre un mapa ya normalizado no cambia `celda` ni el `mapa`.
- [ ] Añadir `objeto_canonico` con `item_id` canónico válido → guarda; con `item_id` inválido → guardado bloqueado y marcador en rojo (`MAPA_PI_OBJETO_*`).
- [ ] Añadir `transicion`: el `<select>` solo ofrece destinos conectados con mapa y proyección válida; un destino forzado inválido → `MAPA_PI_TRANSICION_DESTINO_*` visible y marcador resaltado.
- [ ] Mover un punto cambia **solo** `celda` (floats `0..100`); diff YAML mínimo.
- [ ] Un punto en zona superior-izquierda (`< ` antiguo `cols`) cae donde se hizo clic (verifica que la normalización eliminó el modo rejilla).
- [ ] **Spawns intactos:** tras normalizar y guardar, la posición de `spawn_entrada` (entrada del grupo) y de los `spawns_npc` en mesa es la misma que antes (entrada y NPCs no se desplazan).
- [ ] Puntos de `tipo` no editable se preservan tras editar/guardar.
- [ ] Sin `serverSlug`: picker `item_id` degrada a entrada manual con aviso; no rompe.
- [ ] `npm run lint` → exit 0; `npm run build` → OK.
- [ ] Revisión de diff: ninguna regla de `objeto_canonico`/`transicion`/conectividad reimplementada en JS.

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

**Estado `validada` (2026-05-29):** implementación por fases (A→D). `Commit base` de código: `426ccef`.

**Progreso de implementación:**
- **F15b-A** ✅ `d93434d` (colocador solo lectura + normalización Opción B) + `5d8c1c3` (fix: aplicar reemplaza, no fusiona). Falta el check visual §10 en `PlayerView` para darla por cerrada.
- **F15b-B/C/D** pendientes (decisiones fijadas en §5-B/§7).

Marcar `Estado: cerrada` y rellenar `Commit cierre` cuando:

- [ ] Fases A–D cumplen criterios de aceptación (§10).
- [ ] Pruebas §11 ejecutadas (incl. la de coordenadas %/rejilla).
- [ ] HANDOFF actualizado (colocador disponible; F4.h-editor cubierto).
- [ ] Sin cambios en `dm_virtual` ni reglas de validación duplicadas en JS.
