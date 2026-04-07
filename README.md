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

Diseño para **no depender de la terminal**: el servidor puede arrancar **en segundo plano** y el navegador se abre solo.

- **`tools/start_vite.sh`** — `npm run dev` en primer plano; con **`--background`** escribe en **`~/.cache/dm_editor/vite.log`** y guarda PID en **`vite.pid`** (misma carpeta).
- **`tools/menu_editor.sh`** — Si hace falta, arranca con **`start_vite.sh --background`** (Zenity pregunta antes) y abre **`http://localhost:5180/validar`** o **`/catalogo`**. Opción **Modo desarrollador** si quieres una terminal con logs.
- **`tools/lib_dm_editor.sh`** — Comprueba si el servidor responde (uso interno).
- **`tools/hub_editor.html`** — Panel opcional; el flujo principal es la URL del Vite.

**Icono del escritorio *Iniciar DM Editor*** (si lo tienes): segundo plano + abre **`/validar`** sin dejarte una terminal obligatoria.

**Detener el servidor:** `kill "$(cat ~/.cache/dm_editor/vite.pid)"` (o cerrar el proceso `node`/Vite desde el monitor del sistema).

## Desarrollo

```bash
cp .env.example .env   # opcional: ajusta VITE_DEV_PROXY_TARGET si el API no está en :8000
npm install
npm run dev
```

- **URL del editor:** [http://localhost:5180](http://localhost:5180) — puerto fijo en `vite.config.js` (`strictPort`) para no chocar con el frontend del motor (5173) ni con otros Vite en 5174+. Si 5180 está ocupado, Vite fallará: libera el puerto o cámbialo en la config.
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
