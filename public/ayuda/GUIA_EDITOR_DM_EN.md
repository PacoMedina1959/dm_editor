# DM Editor guide — adventure authoring

> Help for **game masters** who create or maintain adventures as **`aventura.yaml`** compatible with DM Virtual.  
> The **DM Editor** is a separate web app (Vite + React, typical port **5180**) that talks to the **`dm_virtual` backend** via the `/api/editor/*` API.  
> **Español:** [GUIA_EDITOR_DM.md](GUIA_EDITOR_DM.md)

---

## 1. Core concepts

| Concept | What it means in practice |
|--------|----------------------------|
| **DM Editor** | **Authoring** tool: you edit metadata, world, locations, NPCs, bestiary, story, endings, scenes, and events. The canonical output is a **single YAML** file consumed by the engine (`GestorEscenas`). |
| **Running backend** | Without the `dm_virtual` FastAPI server there is no server-side listing/save or AI import/generation. The editor usually **proxies** `/api` to that backend. |
| **Campaign slug** | Folder name under `backend/data/campañas/<slug>/` where **`aventura.yaml`** lives. **Save to server** writes there. |
| **Validate** | The editor has **local validation** (required fields, duplicate IDs, cross-references). You can also use **Validate YAML** in the game SPA (`/editor/validar/:sala`) or `POST /api/editor/validar-campana` for the same checks as the engine. |
| **AI** | **Import** turns text / URL / PDF into a YAML draft (multi-step). **AI assistant** extends a specific section. Always review before saving. |

---

## 2. Startup and main screen

- **Typical URL:** `http://localhost:5180/aventura` (editor default route).
- **Top menu:** quick links to **Adventure** (editor), **Validate YAML** (lightweight tool in the game SPA, same validation API), and **Catalog** if wired in your deployment.
- **Source indicator:** shows whether you are on **sample**, **local file**, **server** (`Server: adventure name`), etc., so you do not overwrite the wrong YAML.

---

## 3. Toolbar (overview)

| Action | Purpose |
|--------|---------|
| **Server** | Opens **server adventures** dialog: list, **load** an existing campaign, or **delete** (per your version’s permissions and confirmations). |
| **Sample** | Loads the project’s **canonical sample YAML** (schema reference). |
| **yaml** (load file) | Opens an **`aventura.yaml`** from disk (browser only; not on the server until you save). |
| **New** | Creates an **empty adventure** from the template (`plantillaAventura`). |
| **Import AI** | Modal with **Text**, **URL**, and **PDF** tabs: backend extracts text and the LLM returns YAML over **several steps**; you can **edit the result** before replacing the current project. |
| **Validate** | Runs the editor’s **built-in validation**. **Errors** usually block **export**; **warnings** inform but may not block. |
| **Export YAML** | Downloads the current document (a `*` marker when there are unsaved changes). |
| **Save to server** | After validation, asks for a **slug** and writes `backend/data/campañas/<slug>/aventura.yaml` via `PUT /api/editor/aventuras/{slug}`. |
| **AI** (purple button) | Opens the **assistant**: pick **target section** and **instructions**; the model returns a YAML snippet to **merge** (e.g. append list items). Section headers often have a **“✨ AI”** shortcut. |

---

## 4. Section navigation

Jump between YAML blocks with pill-style tabs:

- **Metadata** — name, author, version, language, starting scene, difficulty, duration, description.
- **World** — region, era, tone, descriptive text.
- **Locations**, **NPCs**, **Bestiary**, **Story**, **Endings** — lists with **CRUD** (add, edit, delete, reorder; **duplicate** on repeatable rows).
- **Scenes** — densest part: acts, DM intent, active locations/NPCs, `info_visible` / `info_oculta`, optional events, **advance** and **ending conditions** with typed **rules** editor.
- **Events** — `eventos_definidos` aligned with what the engine can register.

Large lists get a **search** filter when there are enough entries.

---

## 5. Suggested workflows

1. **New adventure from scratch:** **New** → fill **Metadata** and **World** → add **locations** and **NPCs** before chaining **scenes** → **Validate** → **Save to server** with a new `slug`.  
2. **From written material:** **Import AI** (text, URL, or PDF) → manual review → **Validate** → **Save**.  
3. **Iterate on an installed campaign:** **Server** → load → edit → **Validate** → **Save** (same `slug` to update).  
4. **Backup:** **Export YAML** before risky changes or large imports.

---

## 6. Undo, autosave, and map

- **Undo / redo:** limited history (e.g. 50 states); usual shortcuts **Ctrl+Z**, **Ctrl+Shift+Z** / **Ctrl+Y**.  
- **Autosave** to browser **localStorage** (debounced): on reopen you may be offered **session recovery**; it does **not** replace **Save to server**.  
- **Scene map:** graph view by act (transitions, endings, broken links). Good for dead ends or bad targets.  
- **AI preview (scene):** shows the **context** the engine builds for the LLM for that scene (debug what the model “sees”).

---

## 7. Engine alignment (important warnings)

- **`keyword_en_historial`:** the engine may **not evaluate** this rule type yet; backend validation often emits a **warning**. Do not rely on it to gate progress until implemented.  
- **Rules referencing NPCs:** some runtime logic matches **normalized names**, not always YAML **`id`** — see [`EDITOR_APP_CONTRACT.md`](EDITOR_APP_CONTRACT.md) §4.  
- **`vende` (items):** IDs should exist in the **global catalog** (`catalogo_objetos.json`) or you will see warnings; the game may log **warnings**.  
- **Lore `.md` files:** Markdown files at the **campaign folder root** are concatenated as lore; the editor workflow focuses on **`aventura.yaml`**. Keep those files on the server for extended lore.

---

## 8. Server validation vs editor-only

- Editor **Validate** speeds work **offline** (client rules).  
- **`POST /api/editor/validar-campana`** (and the game **Validate YAML** view at `/editor/validar/:sala`) run validation **aligned with `GestorEscenas`**. Use them **before signing off** on a campaign or after backend/editor version changes.

---

## 9. Import practical limits

- **Text:** paste the full adventure; the pipeline uses **several model calls** (metadata/world first, then scenes with context).  
- **URL:** backend extracts readable text; too little text yields a clear error.  
- **PDF:** per-page extraction; a **practical limit** applies (on the order of **~200 pages** / **~200k characters** of extracted text per internal docs). Scanned PDFs without OCR work poorly.

Output quality **depends on the model** and input: treat import as a **professional draft**, not final publication.

---

## 10. What the editor may not cover yet

Per the product plan, features such as **AI-generated maps** from locations may still be **pending**. If your menu lacks the option, it is not enabled in your branch/version.

---

## 11. Related technical docs

- YAML contract, rules, routes, warnings: [`docs/EDITOR_APP_CONTRACT.md`](EDITOR_APP_CONTRACT.md).  
- Editor and package plan: [`docs/PLAN_EDITORES_ROL.md`](PLAN_EDITORES_ROL.md).  
- Validation CLI: `backend/cli_validar_campana.py`.  
- Editor milestone checklist: `TAREAS_PENDIENTES_ROL.md` (*Editor de Aventuras* section).  
- **Table / roles** help (players and GM in session): [`GUIA_ROL_EN.md`](GUIA_ROL_EN.md).
