# IDEA — Generador asistido (LLM) de perfil Guardian de PNJ

| Campo | Valor |
| --- | --- |
| **Estado** | `idea` (anotada; *hacer después*) |
| **Fecha** | 2026-06-13 |
| **Última revisión** | 2026-06-14 |
| **Repo** | `dm_editor` (autoría) — consumo en runtime es `dm_virtual` |
| **Surgió** | diseñando la Pieza 1 de Persistencia (memoria subjetiva profunda del PNJ gateada por disparo) en `dm_virtual` |
| **Relacionado** | `dm_virtual/docs/specs/F10c_d_Perfil_Guardian_Declarativo_PNJs.md` (Fase 5: «ayuda IA de autoría», pendiente), F10.c.e (activación por disparo), Persistencia / Fase 4, pestaña Guardian del editor |

---

## Origen

Hoy, para **cada PNJ de cada aventura** (PNJ diferentes, guion nuevo, secretos
distintos), el autor escribe **a mano** el bloque `guardian` en el `aventura.yaml`:
rasgos de personalidad, finalidad, patrón de voz, objetivos, líneas rojas,
secretos protegidos y, sobre todo, los **disparadores** y **términos sensibles**.

Eso es laborioso y frágil:

- Hay que **anticipar todos los sinónimos e idiomas**. Ejemplo real: Marta lista
  `bodega, cellar, basement, almacen, sotano` para proteger el secreto de Gorin.
- Si olvidas una palabra, el **disparo no salta** y el PNJ «se hace el tonto»
  justo cuando debería tensarse o abrirse. Es el peor fallo posible: silencioso.
- Los **rasgos de personalidad** y el **patrón de voz** se redactan desde cero por
  PNJ, sin apoyarse en la narrativa que el autor ya escribió (descripción,
  motivación, secretos).

En una campaña con muchos PNJ esto no escala. El contrato declarativo ya existe
(ver F10.c.d); lo que falta es **ayudar a rellenarlo bien**.

## Qué se propone

En la **pestaña Guardian** del editor, un **asistente LLM** que lea la narrativa
del PNJ (nombre, descripción, motivación, `secretos`, contexto de escena) y
**proponga** un perfil `guardian` completo para que el autor lo **revise,
corrija o descarte**.

Principio rector (igual que el resto del Guardian): **declarativo, el autor
manda; el LLM solo sugiere.** Nada se guarda como canon automáticamente.

### Qué propone el asistente

1. **Rasgos de personalidad** — `personalidad`, `arquetipo`, `patron_voz`,
   `objetivos` derivados de la descripción y motivación del PNJ. (Esto es lo que
   se pidió añadir explícitamente: no solo secretos/disparadores, también el
   carácter del personaje.)
2. **Finalidad / propósito** — qué quiere el PNJ en el mundo o en la escena.
3. **Líneas rojas** — qué no debe cruzar sin condición validada.
4. **Secretos protegidos** — a partir del bloque `secretos` del PNJ, estructurar
   `secretos_protegidos[]` con su `hecho` y su `condicion_revelar`.
5. **Términos sensibles** — la parte más valiosa: expandir cada secreto a una
   lista de **sinónimos, hiperónimos y traducciones** (es/en como mínimo) para la
   detección determinista de fugas (`secretos_protegidos[].terminos_sensibles`).
6. **Disparadores** — `disparadores.*.accion_contiene` + reacción blanda sugerida
   + `requiere_revision_dm` cuando el tema sea sensible.

### Cómo encaja con lo que ya existe

- Se apoya en la **extracción de entidades que ya hace Persistencia** en
  `dm_virtual` (para no reinventar el NLP).
- Cubre el pendiente de **F10.c.d Fase 5**: «ayuda IA de autoría: texto libre del
  autor → propuesta estructurada de `guardian`, siempre revisada antes de
  guardar» (hoy `[ ]` sin hacer).
- **No toca runtime.** El consumo de `guardian` en mesa ya está cerrado en
  `dm_virtual`; esto es puramente autoría en `dm_editor`.

## Flujo de autoría propuesto

```text
1. El autor escribe descripción + motivación + secretos del PNJ (texto libre).
2. Pulsa «Sugerir perfil Guardian».
3. El asistente devuelve un bloque `guardian` propuesto (rasgos, líneas rojas,
   secretos_protegidos, terminos_sensibles, disparadores).
4. El editor muestra la propuesta en modo revisión (diff / formulario editable),
   nunca la guarda directa.
5. El autor edita/aprueba campo a campo. Solo entonces se persiste en el YAML.
6. Validación canónica habitual (motor) antes de guardar/exportar.
```

## Decisiones de diseño (provisionales)

- **El autor siempre revisa.** La IA propone una estructura; el guardado es acto
  humano explícito. (Mismo principio que F10.c.d §11 y la vista de revisión.)
- **Granularidad por campo.** Poder regenerar solo `terminos_sensibles` o solo
  `personalidad` sin rehacer todo el bloque.
- **Idiomas configurables.** Mínimo es/en para `terminos_sensibles`; permitir
  añadir más idiomas que la campaña use.
- **Sugerencia, no inferencia silenciosa.** No autocompletar al teclear; debe ser
  una acción intencional del autor.
- **Reutiliza el contrato existente**, no inventa campos nuevos en `guardian`
  salvo que el autor lo pida.

## Anti-patrones a evitar

- No guardar canon automáticamente desde la salida del LLM.
- No inferir apilabilidad/secretos/rasgos por heurísticas ocultas mientras el
  autor escribe.
- No duplicar reglas del motor en el editor: la **validación** sigue siendo de
  `dm_virtual` (`validar_campana.py`).
- No meter conocimiento de campaña concreta (Marta/Gorin/bodega) en el editor;
  el asistente trabaja sobre el texto del PNJ que tenga delante.
- No convertir los disparadores propuestos en efectos automáticos de estado
  (siguen siendo reacciones blandas, igual que en F10.c.d §8).

## Pendiente antes de promover a SPEC

- Decidir **dónde corre el LLM** (¿endpoint del motor reutilizando Persistencia,
  o llamada propia del editor?) y con qué proveedor/modelo.
- Definir el **contrato de la propuesta** (forma JSON que el editor sabe pintar
  en modo revisión).
- UI de revisión campo a campo (diff vs. formulario).
- Criterios de aceptación + casos de prueba (incluido el caso «término olvidado»:
  el asistente debe proponer sinónimos que un autor humano olvidaría).
