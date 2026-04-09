#!/usr/bin/env bash
# Arranca npm run dev en la raíz de dm_editor.
#   --background  Segundo plano, log en ~/.cache/dm_editor/vite.log (sin terminal).
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
cd "$ROOT"
if ! command -v npm >/dev/null 2>&1; then
  for d in /opt/nodejs/bin /usr/local/bin; do
    [[ -d "$d" ]] && PATH="$d:$PATH"
  done
  export PATH
fi
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
fi

if [[ "${1:-}" == "--background" ]]; then
  # shellcheck source=/dev/null
  . "$ROOT/tools/lib_dm_editor.sh"
  LOG_DIR="$(dm_editor_log_dir)"
  mkdir -p "$LOG_DIR"
  LOG="$LOG_DIR/vite.log"
  PIDFILE="$LOG_DIR/vite.pid"
  _b="${DM_EDITOR_BASE:-http://localhost:5180}"
  export BASE="${_b%/}"
  if editor_http_ok; then
    exit 0
  fi
  if [[ -f "$PIDFILE" ]]; then
    old_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
      exit 0
    fi
  fi
  echo "--- $(date -Iseconds) --- npm run dev (dm_editor)" >>"$LOG"
  nohup npm run dev >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  exit 0
fi

# Terminal (modo desarrollador): no llamar a Vite si 5180 ya está ocupado.
# shellcheck source=/dev/null
. "$ROOT/tools/lib_dm_editor.sh"
_b="${DM_EDITOR_BASE:-http://localhost:5180}"
export BASE="${_b%/}"
LOG_DIR="$(dm_editor_log_dir)"
LOG="$LOG_DIR/vite.log"
PIDFILE="$LOG_DIR/vite.pid"
mkdir -p "$LOG_DIR"

if editor_http_ok; then
  cat <<EOF

El editor ya está activo en $BASE (puerto 5180 en uso).
No hace falta otro \`vite\` en esta terminal; abajo verás el log en directo (Ctrl+C para salir).

Para arrancar \`vite\` en esta ventana, libera antes el puerto (p. ej. \`ss -tlnp | grep 5180\`).
EOF
  if [[ -f "$PIDFILE" ]]; then
    old_pid="$(tr -d ' \n' <"$PIDFILE" 2>/dev/null || true)"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
      printf 'PID habitual del segundo plano: %s (comprueba con: ps -p %s -o args=)\n\n' "$old_pid" "$old_pid"
    fi
  fi
  [[ -f "$LOG" ]] || touch "$LOG" 2>/dev/null || true
  echo "--- Siguiendo: $LOG ---"
  exec tail -n 120 -F "$LOG"
fi

if dm_editor_puerto_ocupado 5180; then
  echo "Puerto 5180 ocupado, pero $BASE no responde como DM Editor." >&2
  echo "Algo distinto (o una instancia colgada) usa el puerto. Comprueba:" >&2
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | awk '$4 ~ /:5180$/ {print}' || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:5180 -sTCP:LISTEN -n -P 2>/dev/null || true
  fi
  echo "Libera el puerto y vuelve a abrir «Modo desarrollador»." >&2
  exit 1
fi

exec npm run dev
