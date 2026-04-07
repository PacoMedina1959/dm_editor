# DM Editor

Aplicación de **autoría** para campañas compatibles con [**DM Virtual**](https://github.com/PacoMedina1959/dm_virtual): canon `aventura.yaml` / `GestorEscenas`. Este repo es solo el editor; el motor y la partida viven en el otro proyecto.

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
