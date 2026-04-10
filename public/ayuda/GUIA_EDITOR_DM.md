# Guía del DM Editor — autoría de aventuras

> Ayuda para **directores** que crean o mantienen aventuras en formato **`aventura.yaml`** compatible con DM Virtual.  
> El **DM Editor** es una aplicación web aparte (Vite + React, puerto típico **5180**) que se comunica con el **backend** de `dm_virtual` por la API `/api/editor/*`.  
> **English:** [GUIA_EDITOR_DM_EN.md](GUIA_EDITOR_DM_EN.md)

---

## 1. Ideas que conviene tener claras

| Concepto | Qué es en la práctica |
|----------|------------------------|
| **DM Editor** | Herramienta de **autoría**: editas metadatos, mundo, localizaciones, PNJ, bestiario, historia, finales, escenas y eventos. El resultado canónico es un **único YAML** que entiende el motor (`GestorEscenas`). |
| **Backend en marcha** | Sin el servidor FastAPI de `dm_virtual`, no hay listado/guardado en disco ni llamadas a IA de importación/generación. El editor suele usar **proxy** para enviar `/api` al backend. |
| **Slug de campaña** | Nombre de carpeta bajo `backend/data/campañas/<slug>/`. Ahí vive **`aventura.yaml`**. “Guardar en servidor” persiste en esa ruta. |
| **Validar** | El editor incluye **validación local** (campos obligatorios, IDs duplicados, referencias cruzadas). Además puedes usar **Validar YAML** en la mesa (`/editor/validar/:sala`) o el endpoint `POST /api/editor/validar-campana` para la misma batería que el motor. |
| **IA** | **Importar** convierte texto / URL / PDF en borrador YAML (varias pasadas). **Asistente IA** amplía una sección concreta. Revisa siempre el resultado antes de guardar. |

---

## 2. Arranque y pantalla principal

- **URL habitual:** `http://localhost:5180/aventura` (ruta por defecto del editor).
- **Menú superior:** acceso rápido a **Aventura** (editor), **Validar YAML** (herramienta ligada al flujo de mesa en la SPA del juego, misma API de validación) y **Catálogo** si está enlazado en tu despliegue.
- **Indicador de fuente:** muestra si trabajas sobre **ejemplo**, **archivo local**, **servidor** (`Servidor: nombre de aventura`), etc. Ayuda a no sobrescribir el YAML equivocado.

---

## 3. Barra de herramientas (resumen)

| Acción | Para qué sirve |
|--------|----------------|
| **Servidor** | Abre el diálogo de **aventuras en el servidor**: listar, **cargar** una campaña existente o **borrar** (según permisos y confirmaciones de tu versión). |
| **Ejemplo** | Carga el **YAML canónico de ejemplo** del proyecto (referencia de esquema y buenas prácticas). |
| **yaml** (cargar fichero) | Abre un **`aventura.yaml`** desde tu disco (solo en el navegador; no sube al servidor hasta que guardes). |
| **Nuevo** | Crea una **aventura vacía** desde plantilla (`plantillaAventura`). |
| **Importar IA** | Modal con pestañas **Texto**, **URL** y **PDF**: el backend extrae texto y el LLM devuelve YAML en **varias pasadas**; puedes **editar el resultado** antes de sustituir el proyecto actual. |
| **Validar** | Ejecuta la **validación integrada** del editor. Los **errores** suelen bloquear **exportar**; los **avisos** informan pero no siempre bloquean. |
| **Exportar YAML** | Descarga el documento actual como fichero (marcador `*` si hay cambios sin exportar). |
| **Guardar en servidor** | Tras validar, pide **slug** y escribe `backend/data/campañas/<slug>/aventura.yaml` vía `PUT /api/editor/aventuras/{slug}`. |
| **IA** (botón morado) | Abre el **asistente**: eliges **sección destino** e **instrucciones**; el modelo devuelve fragmento YAML coherente para **fusionar** (p. ej. añadir entradas a listas). En cabeceras de sección suele haber un atajo **«✨ IA»**. |

---

## 4. Navegación por secciones

Puedes saltar entre bloques del YAML con las pestañas tipo píldora:

- **Metadatos** — nombre, autor, versión, idioma, escena inicial, dificultad, duración, descripción.
- **Mundo** — región, época, ambiente, texto de contexto.
- **Localizaciones**, **NPCs**, **Bestiario**, **Historia**, **Finales** — listas con **CRUD** (añadir, editar, eliminar, reordenar con flechas; **duplicar** en entradas repetibles).
- **Escenas** — lo más denso: actos, intención del DM, ubicaciones/NPC activos, `info_visible` / `info_oculta`, eventos opcionales, **condiciones de avance** y **de final** con editor de **reglas** tipadas.
- **Eventos** — `eventos_definidos` alineados con lo que el motor puede registrar.

En listas grandes aparece **búsqueda** cuando hay bastantes entradas.

---

## 5. Flujos recomendados

1. **Nueva aventura desde cero:** **Nuevo** → rellena **Metadatos** y **Mundo** → crea **localizaciones** y **PNJ** antes de encadenar **escenas** → **Validar** → **Guardar en servidor** con un `slug` nuevo.  
2. **Partir de material escrito:** **Importar IA** (texto, URL o PDF) → revisar y corregir a mano → **Validar** → **Guardar**.  
3. **Iterar sobre una campaña instalada:** **Servidor** → cargar → editar → **Validar** → **Guardar** (mismo `slug` para actualizar).  
4. **Copia de seguridad:** **Exportar YAML** antes de cambios arriesgados o antes de probar importaciones grandes.

---

## 6. Undo, autoguardado y mapa

- **Deshacer / rehacer:** historial limitado (p. ej. 50 estados); atajos habituales **Ctrl+Z**, **Ctrl+Shift+Z** / **Ctrl+Y**.  
- **Autoguardado** en **localStorage** del navegador (debounce): al reabrir, puede ofrecerse **recuperar sesión**; no sustituye **Guardar en servidor**.  
- **Mapa de escenas:** vista de grafo por actos (avances, finales, enlaces rotos). Útil para detectar escenas sin salida o destinos erróneos.  
- **Preview IA (escena):** muestra el **contexto** que el motor construye para el LLM en una escena concreta (útil para depurar qué “ve” la IA).

---

## 7. Coherencia con el motor (avisos importantes)

- **`keyword_en_historial`:** el motor puede **no evaluar** este tipo de regla hoy; el validador del backend suele emitir **warning**. No confíes en ella para bloquear avance hasta que el motor la implemente.  
- **Reglas que mencionan PNJ:** en runtime parte de la lógica hace coincidencias por **nombre** normalizado, no siempre por el **`id`** del YAML — revisa [`EDITOR_APP_CONTRACT.md`](EDITOR_APP_CONTRACT.md) §4.  
- **`vende` (objetos):** los ids deben existir en el **catálogo global** (`catalogo_objetos.json`) o verás avisos; el juego puede registrar **warnings** en log.  
- **Lore en `.md`:** archivos Markdown en la **raíz** de la carpeta de campaña se concatenan como lore; el flujo del editor se centra en **`aventura.yaml`**. Para lore extenso, mantén también esos ficheros en el servidor.

---

## 8. Validación en servidor vs solo en el editor

- La **Validar** del editor acelera el trabajo **sin red** (reglas propias del cliente).  
- **`POST /api/editor/validar-campana`** (y la vista **Validar YAML** del juego) ejecutan el validador **alineado con `GestorEscenas`**. Conviene pasar por ahí **antes de dar por cerrada** una campaña o si el editor y el backend han cambiado de versión.

---

## 9. Límites prácticos de importación

- **Texto:** pega el contenido completo de la aventura; el pipeline hace **varias llamadas** al modelo (metadatos y mundo primero, escenas después con contexto).  
- **URL:** el backend extrae texto legible de la página; si hay poco texto, puede fallar con error claro.  
- **PDF:** extracción por páginas; hay un **límite práctico** (del orden de **~200 páginas** / **~200k caracteres** de texto extraído según documentación interna). PDFs escaneados sin OCR darán peor resultado.

La calidad del YAML generado **depende del modelo** y del material de entrada: trata la importación como **borrador profesional**, no como publicación final.

---

## 10. Qué no cubre (aún) el editor

Según el plan de producto, funciones como **mapas generados por IA** a partir de localizaciones pueden estar **pendientes**. Si tu menú no muestra la opción, no está habilitada en tu rama o versión.

---

## 11. Documentación técnica relacionada

- Contrato YAML, reglas, rutas y advertencias: [`docs/EDITOR_APP_CONTRACT.md`](EDITOR_APP_CONTRACT.md).  
- Plan de editores y paquetes: [`docs/PLAN_EDITORES_ROL.md`](PLAN_EDITORES_ROL.md).  
- Validación CLI: `backend/cli_validar_campana.py`.  
- Resumen de hitos del editor (checklist): `TAREAS_PENDIENTES_ROL.md` (sección *Editor de Aventuras*).  
- Ayuda de **mesa / roles** (jugadores y director en partida): [`GUIA_ROL.md`](GUIA_ROL.md).
