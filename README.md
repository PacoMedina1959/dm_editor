# DM Editor

Aplicación de **autoría** para campañas compatibles con [**DM Virtual**](https://github.com/PacoMedina1959/dm_virtual): canon `aventura.yaml` / `GestorEscenas`. Este repo es solo el editor; el motor y la partida viven en el otro proyecto.

## Repo motor (fuente de verdad del formato)

- Ruta local típica: `../dm_virtual`
- Contrato y claves YAML: `../dm_virtual/docs/EDITOR_APP_CONTRACT.md`
- Plan de fases (objetos → PNJ → escenas → import): `../dm_virtual/docs/PLAN_EDITORES_ROL.md`
- Validación HTTP (con backend levantado): `POST /api/editor/validar-campana` → `../dm_virtual/backend/app/main.py`

## Próximos pasos sugeridos

1. Inicializar el stack del editor (p. ej. Vite + React o Tauri).
2. `manifest.json` del paquete (Fase 0) y flujo export/import.
3. Primer módulo: catálogo de objetos alineado a `catalogo_objetos.json` (Fase 1 del plan).
