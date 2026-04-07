#!/usr/bin/env bash
#
# Menú DM Editor — sin terminal para el usuario habitual: Vite en segundo plano + navegador.
#
#   DM_EDITOR_BASE      defecto http://localhost:5180
#   DM_EDITOR_SKIP_VITE 1 = no arranca servidor, solo abre URLs
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
export DM_EDITOR_BASE="${DM_EDITOR_BASE:-http://localhost:5180}"
export BASE="${DM_EDITOR_BASE%/}"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/lib_dm_editor.sh"

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

abrir_terminal_cmd() {
  local titulo="$1"
  local ejecutable="$2"
  case "$TERMINAL" in
    xfce4-terminal) xfce4-terminal --title="$titulo" --hold -e "$ejecutable" & ;;
    gnome-terminal) gnome-terminal --title="$titulo" -- "$ejecutable" & ;;
    mate-terminal) mate-terminal --title="$titulo" -e "$ejecutable" & ;;
    *) xterm -title="$titulo" -hold -e "$ejecutable" & ;;
  esac
}

iniciar_vite_segundo_plano() {
  chmod +x "$START_VITE" 2>/dev/null || true
  "$START_VITE" --background
}

asegurar_vite() {
  if [[ "${DM_EDITOR_SKIP_VITE:-0}" == "1" ]]; then
    return 0
  fi
  if editor_http_ok; then
    return 0
  fi

  local msg logdir
  logdir="$(dm_editor_log_dir)"
  msg="El servidor del editor no responde en:\n<b>$BASE</b>\n\n¿Iniciarlo en <b>segundo plano</b> (sin terminal)?\nRegistro: <tt>$logdir/vite.log</tt>"

  if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
    zenity --question --title="DM Editor" --width=440 --text="$msg" 2>/dev/null || return 1
  else
    echo "El editor no responde en $BASE" >&2
    read -r -p "¿Iniciar en segundo plano (log en $logdir/vite.log)? [s/N] " ans
    if [[ "${ans,,}" != "s" && "${ans,,}" != "si" ]]; then
      return 1
    fi
  fi

  iniciar_vite_segundo_plano

  if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
    zenity --info --title="DM Editor" --text="Iniciando… Esperando respuesta en $BASE" --timeout=4 2>/dev/null || true
  fi

  if ! esperar_editor 120; then
    local err
    err="No respondió a tiempo: $BASE\n\nRevisa el log:\n$logdir/vite.log\n\n¿Puerto 5180 ocupado por otro programa?"
    if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
      zenity --error --title="DM Editor" --width=420 --text="$err" 2>/dev/null || true
    else
      echo "$err" >&2
    fi
    return 1
  fi

  if [[ -n "${DISPLAY:-}" ]] && command -v notify-send >/dev/null 2>&1; then
    notify-send -a "DM Editor" "Servidor listo" "Abriendo el editor en $BASE" 2>/dev/null || true
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

accion_dev_terminal() {
  chmod +x "$START_VITE" 2>/dev/null || true
  abrir_terminal_cmd "DM Editor — Vite (logs)" "$START_VITE"
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
  local logdir
  logdir="$(dm_editor_log_dir)"
  echo "DM Editor — base: $BASE (log segundo plano: $logdir/vite.log)"
  PS3="Opción: "
  select opt in "Validar YAML" "Catálogo" "Iniciar servidor (segundo plano)" "Modo desarrollador (terminal con logs)" "Panel hub (HTML)" "Salir"; do
    case $REPLY in
      1)
        asegurar_vite || true
        accion_validar
        break
        ;;
      2)
        asegurar_vite || true
        accion_catalogo
        break
        ;;
      3)
        iniciar_vite_segundo_plano
        esperar_editor 120 || echo "Revisa $logdir/vite.log" >&2
        break
        ;;
      4) accion_dev_terminal; break ;;
      5)
        asegurar_vite || true
        accion_hub
        break
        ;;
      6) break ;;
      *) echo "Número no válido" ;;
    esac
  done
}

if [[ -n "${DISPLAY:-}" ]] && command -v zenity >/dev/null 2>&1; then
  asegurar_vite || true

  choice="$(zenity --list --title="DM Editor" --width=440 --height=380 \
    --text="Todo en <b>$BASE</b> — el servidor puede arrancar solo en segundo plano (sin terminal)." \
    --column="" --hide-header \
    "✓ Validar YAML" \
    "📦 Catálogo de objetos" \
    "📋 Panel hub (opcional, archivo local)" \
    "🔧 Modo desarrollador: terminal con logs" \
    2>/dev/null)" || exit 0

  case "$choice" in
    *Validar*) accion_validar ;;
    *Catálogo*) accion_catalogo ;;
    *hub*|*Panel*) accion_hub ;;
    *desarrollador*|*terminal*|*logs*) accion_dev_terminal ;;
  esac
  exit 0
fi

menu_terminal
