#!/usr/bin/env bash
# Arranca npm run dev en la raíz del repo dm_editor (para el menú / escritorio).
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
exec npm run dev
