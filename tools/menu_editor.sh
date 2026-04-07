#!/usr/bin/env bash
#
# Menú DM Editor — abre el hub local o pestañas directas al Vite.
#
#   DM_EDITOR_BASE   URL del dev server (defecto: http://localhost:5174)
#   DM_EDITOR_HUB    ruta al hub HTML (defecto: junto a este script)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
BASE="${DM_EDITOR_BASE:-http://localhost:5174}"
BASE="${BASE%/}"
HUB_HTML="${DM_EDITOR_HUB:-$SCRIPT_DIR/hub_editor.html}"

if ! command -v xdg-open >/dev/null 2>&1; then
  echo "Instala xdg-open o abre manualmente: $HUB_HTML" >&2
  exit 1
fi

uri_hub() {
  local abs
  abs="$(readlink -f "$HUB_HTML" 2>/dev/null || true)"
  if [[ -z "$abs" || ! -f "$abs" ]]; then
    echo "No se encuentra el hub: $HUB_HTML" >&2
    exit 1
  fi
  if command -v python3 >/dev/null 2>&1; then
    DM_HUB_ABS="$abs" DM_HUB_BASE="$BASE" python3 -c '
import os, urllib.parse
from pathlib import Path
p = Path(os.environ["DM_HUB_ABS"]).resolve()
b = os.environ["DM_HUB_BASE"]
q = urllib.parse.urlencode({"base": b})
print(p.as_uri() + "?" + q)
'
    return
  fi
  echo "file://${abs}?base=${BASE}"
}

abrir() {
  xdg-open "$1" 2>/dev/null &
}

accion_hub() {
  abrir "$(uri_hub)"
}

accion_validar() {
  abrir "${BASE}/validar"
}

accion_catalogo() {
  abrir "${BASE}/catalogo"
}

menu_terminal() {
  PS3="Opción: "
  select opt in "Hub (página local)" "Validar YAML" "Catálogo" "Salir"; do
    case $REPLY in
      1) accion_hub; break ;;
      2) accion_validar; break ;;
      3) accion_catalogo; break ;;
      4) break ;;
      *) echo "Número no válido" ;;
    esac
  done
}

if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
  choice="$(zenity --list --title="DM Editor" --width=380 --height=300 \
    --text="<b>1)</b> Arranca antes Vite: «Iniciar DM Editor» o <tt>npm run dev</tt> en dm_editor.\n<b>2)</b> Luego abre el hub o una ruta.\n\nServidor esperado: <b>$BASE</b>" \
    --column="" --hide-header \
    "📋 Hub de utilidades (recomendado)" \
    "✓ Abrir /validar" \
    "📦 Abrir /catalogo" \
    2>/dev/null)" || exit 0
  case "$choice" in
    *Hub*) accion_hub ;;
    *validar*) accion_validar ;;
    *catalogo*|*Catálogo*) accion_catalogo ;;
  esac
  exit 0
fi

echo "DM Editor — menú (sin zenity). Base: $BASE"
menu_terminal
