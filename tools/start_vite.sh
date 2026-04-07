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

exec npm run dev
