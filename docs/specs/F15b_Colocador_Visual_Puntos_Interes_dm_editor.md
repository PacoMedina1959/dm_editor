# mini-SPEC F15b — Colocador visual de puntos de interés en mapa libre

| Campo | Valor |
| --- | --- |
| **ID** | F15b |
| **Estado** | `borrador` |
| **Prioridad** | media (tras F15 cerrada; primera UI de autoría sobre F4.h) |
| **Commit base** | `<rellenar al abrir>` |
| **Commit cierre** | `<rellenar al cerrar>` |
| **Fecha** | 2026-05-29 |
| **Repo** | `dm_editor` (motor fuente de verdad, RO: `../dm_virtual`) |
| **Depende de** | F15 (validación canónica + issues `MAPA_*` por loc), F14 (catálogo global/local), F4.h (contrato `puntos_interes`) |

---

## §0. Diagnóstico (revisión 2026-05-29)

Revisión sin cambios de código en `dm_editor` y lectura RO de `dm_virtual`:

| Hallazgo | Evidencia |
| --- | --- |
| `objeto_canonico` **ya existe y está validado** dentro de `localizaciones[].mapa.puntos_interes[]` | `dm_virtual/backend/app/core/validar_campana.py` (bloque `objeto_canonico`, códigos `MAPA_PI_OBJETO_*`) y `docs/specs/F4_h_*.md` |
| `celda: [x, y]` **ya es coordenada libre 0..100** (floats), no rejilla | `validar_campana.py:419-421` (`tablero_ok, cols, rows = True, 101, 101`; `pisable_ok=False`) y `_celda_offset_valida` (acepta `[float, float]`) |
| `cols/rows/tile_*/origen_px/pisable` son **legado ignorado** en el contrato principal | `ignored_fields` en `_validar_mapa_localizacion`; comentario "Mapa libre tipo Owlbear: sin tablero, colisiones ni walkmask" |
| El editor **no tiene UI** para `puntos_interes` | No existe lienzo por-localización; `MapaIADialog` solo genera/sube imagen, `MapaMundoDialog` posiciona locs, `MapaEscenas` es grafo de escenas |
| F15-C ya muestra issues `MAPA_PI_*` por fila de loc, pero el autor **no puede crearlos/moverlos** | `SeccionLocalizaciones.jsx` + `issuesMapaParaLocalizacion` |

**Veredicto:** el trabajo de F15b **no es de modelo de datos** (F4.h ya lo fijó en el modelo de coordenadas libres); es de **UX**: dar un lienzo para colocar visualmente lo que hoy solo se escribe a mano en el YAML.

**Decisión arquitectónica (A vs B):** ni una entidad específica `objetos_canonicos:` (A) ni una clave genérica nueva `elementos_mapa:` (B) — ambas exigirían modificar `dm_virtual` y duplicarían validación. Se adopta **la filosofía de B (lista genérica tipada por `tipo`) materializada en el `puntos_interes` que el motor ya valida**. Cero cambios en el motor, cero reglas nuevas en JS, F4.h compatible al 100 %.

---

## §1. Objetivo

Permitir autorar visualmente `localizaciones[].mapa.puntos_interes[]` sobre la imagen de mapa libre (coordenadas `0..100`), reutilizando el contrato y los validadores del motor **sin modificarlo**. Tipos soportados en el MVP: `objeto_canonico` y `transicion`.

---

## §2. Invariantes (NO renegociables)

- [ ] Modelo de datos = `puntos_interes` del motor, **sin campos nuevos con semántica runtime**.
- [ ] `celda: [x, y]` son floats `0..100` (coordenada libre Owlbear); **nunca** rejilla ni entero forzado.
- [ ] **Cero cambios en `dm_virtual`.** **Cero** reglas de validación nuevas en JS.
- [ ] Validación **dura** = `POST /api/editor/validar-campana` (puerta F15-B). Feedback **visual** = issues `MAPA_PI_*` filtrados por `path` (F15-C). No se reimplementa lógica de `objeto_canonico`/`transicion` en el cliente.
- [ ] Preservar campos desconocidos de puntos existentes (merge, no overwrite).
- [ ] No reintroducir: editor táctico, walkmask, grid/snap, rotación, escala, tilesets, `objetos_tacticos`.

---

## §3. Alcance

- Lienzo modal por localización con imagen de fondo + marcadores posicionados por coordenada `0..100` (CSS `left:x% / top:y%`, resolución-independiente).
- Acciones: **añadir**, **mover** (drag + inputs numéricos accesibles), **eliminar**, **editar propiedades**.
- Picker de `item_id`: catálogo F14 (`cargarCatalogoObjetos(slug)`), filtrando `canonico === true`.
- Picker de `destino`: `<select>` de `loc.conexiones`.
- Resaltado de marcadores con error según issues `MAPA_PI_*` del último resultado canónico (por índice extraído del `path`).

### Modelo de datos (esquema del motor, verbatim)

```yaml
localizaciones:
  - id: cripta_sala
    conexiones: [cripta_camara]
    mapa:
      imagen: mapas/cripta_sala/....png
      proyeccion: tactico          # lo fija el flujo de generación de imagen
      puntos_interes:
        - id: corona_pedestal
          tipo: objeto_canonico
          celda: [45.2, 62.8]       # coord LIBRE 0..100 (no rejilla)
          etiqueta_ui: La Corona Perdida
          icono: artefacto
          item_id: corona_perdida   # picker F14, debe ser canonico=true
          evento_al_recoger: tomar_corona
          requiere_confirmacion: true
          texto_confirmacion: "..."
        - id: salida_norte
          tipo: transicion
          celda: [50.0, 4.0]
          destino: cripta_camara    # picker desde conexiones
```

| Campo | Tipo | Validado por motor | Notas |
| --- | --- | --- | --- |
| `id` | string único | sí (`MAPA_PI_CAMPO_FALTANTE`, `MAPA_PI_ID_DUPLICADO`) | autogenerar `pi_1`, `pi_2`… |
| `tipo` | `objeto_canonico` \| `transicion` | sí (presencia) | discriminador |
| `celda` | `[x, y]` float `0..100` | sí (`MAPA_PI_CELDA_FUERA`) | coordenada libre; nunca redondear a entero |
| `etiqueta_ui` | string | no | rótulo en lienzo |
| `icono` | string | no | hint visual |
| `item_id` *(objeto_canonico)* | string | sí (`MAPA_PI_OBJETO_ITEM_*`, `MAPA_PI_OBJETO_NO_CANONICO`) | picker F14 |
| `evento_al_recoger` *(objeto_canonico)* | string | sí (`MAPA_PI_OBJETO_EVENTO_INVALIDO`) | opcional |
| `requiere_confirmacion` *(objeto_canonico)* | bool | no | default `true` |
| `texto_confirmacion` *(objeto_canonico)* | string | no | |
| `destino` *(transicion)* | loc id | sí (`MAPA_PI_TRANSICION_DESTINO_*`) | picker desde `conexiones` |

**Excluido del MVP y por qué:**

- **Rotación / escala:** `puntos_interes` no las define; el runtime pinta marcador icono+etiqueta, no sprite orientable → serían metadato muerto y reabren el editor táctico.
- **Capa visual:** no existe en el contrato; `icono` ya diferencia.
- **`spawn`:** el motor lo modela aparte (`mapa.spawn_entrada`, `mapa.spawns_npc`), no como `tipo` de punto.

---

## §4. Fuera de alcance (SPEC posterior si se necesita)

- Spawns (`spawn_entrada`, `spawns_npc`) — estructura distinta del motor.
- Tipos de punto con **semántica runtime nueva** (requerirían SPEC en `dm_virtual`).
- Rotación, escala, capas, snap a grid, multi-selección, undo/redo propio del lienzo.
- Edición de la imagen del mapa (sigue en `MapaIADialog`).

---

## §5. Fases

```text
A (leer/render) → B (editar) → C (integración guardado) → D (pulido + lint)
```

- **F15b-A — Lectura / render:** pintar `puntos_interes` existentes sobre la imagen (solo lectura) + panel lateral. Marcar errores por `path`.
- **F15b-B — Edición:** añadir / mover / eliminar / editar; autogenerar `id`; pickers `item_id` y `destino`; escribir vía `updateSection` (que ya resetea `validacionCanonica`).
- **F15b-C — Integración guardado:** confirmar que la puerta canónica F15-B bloquea con `MAPA_PI_*` y que el marcador erróneo se resalta. Documentar en `GUIA_EDITOR_DM`.
- **F15b-D — Pulido:** `npm run lint` en verde y `npm run build` OK.

---

## §6. Ficheros previstos (editor)

| Ruta | Rol |
| --- | --- |
| `src/components/aventura/ColocadorPuntosDialog.jsx` (nuevo) | Lienzo modal: imagen + marcadores + panel lateral |
| `src/components/aventura/SeccionLocalizaciones.jsx` | Botón "Editar puntos del mapa" (gating por `mapa.imagen`) + wiring |
| `src/domain/aventura.js` | Helpers **puros**: `nuevoPuntoInteres(tipo)`, `parseIndicePunto(path)`, merge seguro de punto |
| `src/api/aventuras.js` | Reutiliza `cargarCatalogoObjetos`; **sin endpoints nuevos** |
| `public/ayuda/GUIA_EDITOR_DM.md` (+ espejo EN si aplica) | Nota de uso del colocador |

**Anti-patrones:** no copiar reglas de `objeto_canonico`/`transicion` a `domain/aventura.js`; no revalidar `item_id`/`destino` en JS; no añadir campos que el motor ignore.

---

## §7. UX del MVP (flujo, sin mockups)

Entrada: `SeccionLocalizaciones` → `MapaBloque` → botón **"Editar puntos del mapa"** (habilitado solo si `loc.mapa.imagen`).

- **Añadir:** "+ Punto" → elegir `tipo` → clic en la imagen fija `celda = [%x, %y]`. `id` autogenerado. `objeto_canonico` → selector `item_id` (catálogo F14, filtro `canonico=true`); `transicion` → `<select>` de `conexiones`.
- **Mover:** drag del marcador; al soltar, recalcula `celda` en %. Alternativa accesible: inputs numéricos x/y en el panel.
- **Eliminar:** acción en marcador seleccionado / fila del panel, con confirmación.
- **Editar propiedades:** panel lateral con campos según `tipo`.
- **Errores:** reutilizar `issuesMapaParaLocalizacion(validacionCanonica.issues, loc.id)`; por el índice del `path` (`…puntos_interes[i]`) resaltar el marcador `i` en rojo y listar mensaje. El parseo del índice es presentación, no validación.

Al aplicar: `onUpdate` escribe `loc.mapa.puntos_interes` (merge preservando campos desconocidos). El guardado pasa por la puerta canónica F15-B.

---

## §8. Compatibilidad

- **Campañas existentes:** `puntos_interes` es opcional; locs sin él no cambian. El ejemplo `cripta_sala` ya trae `corona_pedestal` → leer y pintar lo existente sin reescribir el YAML.
- **F14 catálogo:** picker desde vista combinada global+local. Sin `serverSlug` → avisar y permitir teclear `item_id` (el motor valida contra global). Coherente con F15-B.
- **F15 validación canónica:** reutilización directa; guardado/export ya bloquean con `MAPA_PI_*`. F15b **no** añade reglas JS.
- **F4.h runtime:** salida idéntica al formato que el handler WS `recoger_objeto_mapa` y `LienzoOwlbear` ya consumen.

---

## §9. Riesgos

- **Reabrir el editor táctico por la puerta de atrás (alto).** Mitigación: congelar el modelo al esquema del motor; rechazar en review cualquier campo que el motor ignore.
- **Duplicar validación (medio).** Mitigación: solo delegación + resaltado por `path`; el único feedback "duro" es el del motor.
- **Confusión por el nombre `celda` (bajo).** Mitigación: documentar y tooltip "`celda` = coord libre 0..100"; nunca redondear.
- **Acoplamiento al `path` del motor (bajo).** Mitigación: parser tolerante; si no casa, degradar a lista de mensajes sin romper.
- **Sin imagen no hay lienzo (bajo).** Gating claro: exigir `mapa.imagen`; si no, dirigir a generar/subir primero.

---

## §10. Criterios de aceptación

- [ ] Cargar ejemplo → `cripta_sala` muestra `corona_pedestal` en su posición; guardar no reescribe campos no editados.
- [ ] Añadir `objeto_canonico` con `item_id` canónico válido → guarda; con `item_id` inválido → guardado bloqueado y marcador en rojo (`MAPA_PI_OBJETO_*`).
- [ ] Añadir `transicion` a destino no conectado → `MAPA_PI_TRANSICION_DESTINO_NO_CONECTADO` visible y marcador resaltado.
- [ ] Mover un punto cambia **solo** `celda` (floats `0..100`); diff YAML mínimo.
- [ ] Sin `serverSlug`: picker `item_id` degrada a entrada manual con aviso; no rompe.
- [ ] `npm run lint` → exit 0; `npm run build` → OK.
- [ ] Revisión de diff: ninguna regla de `objeto_canonico`/`transicion` reimplementada en JS.

---

## §11. Estrategia de pruebas

- **Manual** con motor `:8000` + editor `:5180` sobre `ejemplo`: flujo completo (añadir/mover/eliminar/editar).
- **Caso feliz** (corona válida) y **casos de error** (`item_id` falso, destino no conectado, `celda` fuera de `0..100`).
- **Round-trip:** cargar YAML con puntos → editar uno → guardar → recargar → campos no tocados preservados.
- **Regresión F15:** issues por loc se siguen mostrando; puerta de guardado intacta.
- **CI local:** `npm run build` y `npm run lint`.

---

## §12. Cierre de la SPEC

Marcar `Estado: cerrada` y rellenar `Commit cierre` cuando:

- [ ] Fases A–D cumplen criterios de aceptación (§10).
- [ ] Pruebas §11 ejecutadas.
- [ ] HANDOFF actualizado (colocador disponible; F4.h-editor cubierto).
- [ ] Sin cambios en `dm_virtual` ni reglas de validación duplicadas en JS.
