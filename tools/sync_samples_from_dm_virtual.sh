#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOTOR="${DM_VIRTUAL_ROOT:-$ROOT/../dm_virtual}"

cp "$MOTOR/backend/data/campañas/ejemplo/aventura.yaml" "$ROOT/public/samples/aventura-ejemplo.yaml"
cp "$MOTOR/backend/data/objetos/catalogo_objetos.json" "$ROOT/public/samples/catalogo-ejemplo.json"

echo "Samples actualizados desde $MOTOR"
