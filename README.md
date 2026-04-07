# DM Editor

Aplicación de **autoría** para campañas compatibles con [**DM Virtual**](https://github.com/PacoMedina1959/dm_virtual): canon `aventura.yaml` / `GestorEscenas`. Este repo es solo el editor; el motor y la partida viven en el otro proyecto.

## Probar sin un `aventura.yaml` propio

En la pantalla **Validar YAML**, el botón **«Cargar ejemplo canónico»** rellena el texto con una copia de `dm_virtual/backend/data/campañas/ejemplo/aventura.yaml` (fichero en `public/samples/`). Si el ejemplo del motor cambia mucho, conviene volver a copiar ese YAML al editor.

## Catálogo de objetos (`/catalogo`)

- **Cargar ejemplo**: copia empaquetada de `dm_virtual/backend/data/objetos/catalogo_objetos.json` (`public/samples/catalogo-ejemplo.json`).
- **Abrir JSON**: fichero con el mismo esquema (clave = `id` de cada ficha).
- **Edición**: tabla + formulario; **stats** y **efectos** como JSON objeto.
- **Exportar JSON**: descarga para sustituir o comparar con `catalogo_objetos.json` del motor.

## Menú local (`tools/`)

- **`tools/hub_editor.html`** — página con accesos a `/validar` y `/catalogo`. Ábrela con el navegador (`file://…`) o desde el menú. Query opcional: `?base=http://localhost:5174` (u otra máquina/puerto).
- **`tools/menu_editor.sh`** — Zenity (si hay escritorio) o menú por terminal: hub, validar, catálogo. Variables: `DM_EDITOR_BASE`, `DM_EDITOR_HUB`.

En el Escritorio: **Menu DM Editor** (lanza ese script).

## Desarrollo

```bash
cp .env.example .env   # opcional: ajusta VITE_DEV_PROXY_TARGET si el API no está en :8000
npm install
npm run dev
```

- **URL del editor:** [http://localhost:5174](http://localhost:5174) por defecto (puerto distinto del frontend del motor, 5173). Si 5174 está ocupada, Vite elige la siguiente; **`vite.config.js`** abre el navegador en `/validar` con el puerto correcto.
- Las peticiones a **`/api/*`** se reenvían al backend DM Virtual (`VITE_DEV_PROXY_TARGET`, por defecto `http://localhost:8000`). Arranca antes el motor (`uvicorn` en el repo `dm_virtual`).
- Si prefieres URL absoluta del API (sin proxy), define **`VITE_API_BASE`** en `.env` (ver `.env.example`).

## Repo motor (fuente de verdad del formato)

- Ruta local típica: `../dm_virtual`
- Contrato y claves YAML: `../dm_virtual/docs/EDITOR_APP_CONTRACT.md`
- Plan de fases (objetos → PNJ → escenas → import): `../dm_virtual/docs/PLAN_EDITORES_ROL.md`
- Validación: `POST /api/editor/validar-campana` en el backend del motor.

## Próximos pasos (producto)

1. `manifest.json` mínimo y flujo de paquete.
2. Módulo catálogo: lectura → CRUD → export JSON.
