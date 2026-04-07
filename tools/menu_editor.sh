#!/usr/bin/env bash
#
# Menú DM Editor — asegura Vite (:5180) y abre rutas HTTP (misma base siempre).
#
#   DM_EDITOR_BASE      defecto: http://localhost:5180
#   DM_EDITOR_HUB       ruta hub HTML (opcional, 4.ª opción)
#   DM_EDITOR_SKIP_VITE si es 1, no pregunta ni arranca Vite (solo abre URLs)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
BASE="${DM_EDITOR_BASE:-http://localhost:5180}"
BASE="${BASE%/}"
HUB_HTML="${DM_EDITOR_HUB:-$SCRIPT_DIR/hub_editor.html}"
START_VITE="$SCRIPT_DIR/start_vite.sh"

if ! command -v xdg-open >/dev/null 2>&1; then
  echo "Instala xdg-open" >&2
  exit 1
fi

detectar_terminal() {
  for term in xfce4-terminal gnome-terminal mate-terminal konsole xterm; do
    if command -v "$term" >/dev/null 2>&1; then
      echo "$term"
      return
    fi
  done
  echo "xterm"
}
TERMINAL=$(detectar_terminal)

abrir_terminal() {
  local titulo="$1"
  local ejecutable="$2"
  case "$TERMINAL" in
    xfce4-terminal)
      xfce4-terminal --title="$titulo" --hold -e "$ejecutable" &
      ;;
    gnome-terminal)
      gnome-terminal --title="$titulo" -- "$ejecutable" &
      ;;
    mate-terminal)
      mate-terminal --title="$titulo" -e "$ejecutable" &
      ;;
    *)
      xterm -title "$titulo" -hold -e "$ejecutable" &
      ;;
  esac
}

editor_http_ok() {
  local url="${BASE}/"
  if command -v curl >/dev/null 2>&1; then
    curl -sf --connect-timeout 1 --max-time 3 "$url" 2>/dev/null | grep -q "DM Editor" && return 0
    return 1
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q -O - --timeout=3 "$url" 2>/dev/null | grep -q "DM Editor" && return 0
  fi
  return 1
}

esperar_editor() {
  local max="${1:-90}"
  local i=0
  while [[ "$i" -lt "$max" ]]; do
    if editor_http_ok; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

asegurar_vite() {
  if [[ "${DM_EDITOR_SKIP_VITE:-0}" == "1" ]]; then
    return 0
  fi
  if editor_http_ok; then
    return 0
  fi

  local msg
  msg="No responde el servidor del editor en:\n<b>$BASE</b>\n\n¿Abrir una terminal y ejecutar <tt>npm run dev</tt> (puerto 5180)?"

  if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
    zenity --question --title="DM Editor" --width=400 --text="$msg" 2>/dev/null || return 1
  else
    echo "El editor no responde en $BASE" >&2
    read -r -p "¿Arrancar Vite en nueva terminal? [s/N] " ans
    if [[ "${ans,,}" != "s" && "${ans,,}" != "si" ]]; then
      return 1
    fi
  fi

  chmod +x "$START_VITE" 2>/dev/null || true
  abrir_terminal "DM Editor — Vite (npm run dev)" "$START_VITE"

  if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
    zenity --info --title="DM Editor" --text="Esperando a que Vite responda en $BASE…\n(Puede tardar unos segundos)" --timeout=5 2>/dev/null || true
  fi

  if ! esperar_editor 120; then
    if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
      zenity --error --title="DM Editor" --text="Tiempo agotado: $BASE no responde.\nRevisa la terminal de Vite (¿puerto 5180 ocupado?)." 2>/dev/null || true
    else
      echo "Tiempo agotado esperando $BASE" >&2
    fi
    return 1
  fi
  return 0
}

uri_hub() {
  local abs
  abs="$(readlink -f "$HUB_HTML" 2>/dev/null || true)"
  if [[ -z "$abs" || ! -f "$abs" ]]; then
    echo "No se encuentra el hub: $HUB_HTML" >&2
    return 1
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

accion_solo_vite() {
  chmod +x "$START_VITE" 2>/dev/null || true
  abrir_terminal "DM Editor — Vite" "$START_VITE"
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
  echo "DM Editor — base: $BASE"
  PS3="Opción: "
  select opt in "Solo arrancar Vite (terminal)" "Validar YAML (navegador)" "Catálogo" "Panel hub (HTML)" "Salir"; do
    case $REPLY in
      1) accion_solo_vite; break ;;
      2)
        asegurar_vite || true
        accion_validar
        break
        ;;
      3)
        asegurar_vite || true
        accion_catalogo
        break
        ;;
      4)
        asegurar_vite || true
        accion_hub
        break
        ;;
      5) break ;;
      *) echo "Número no válido" ;;
    esac
  done
}

if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
  asegurar_vite || true

  choice="$(zenity --list --title="DM Editor" --width=420 --height=340 \
    --text="Rutas del editor en <b>$BASE</b> (mismo origen que Vite).\nEl HTML del hub es opcional; lo habitual es Validar o Catálogo." \
    --column="" --hide-header \
    "✓ Validar YAML" \
    "📦 Catálogo de objetos" \
    "⚙️ Solo arrancar Vite (terminal)" \
    "📋 Panel hub (file://, secundario)" \
    2>/dev/null)" || exit 0

  case "$choice" in
    *Validar*) accion_validar ;;
    *Catálogo*) accion_catalogo ;;
    *arrancar*|*Vite*) accion_solo_vite ;;
    *hub*|*Panel*) accion_hub ;;
  esac
  exit 0
fi

menu_terminal
