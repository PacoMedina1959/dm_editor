# shellcheck shell=bash
# Funciones compartidas (menú, lanzadores). Uso: source desde tools/ o raíz del repo.
# Requiere: BASE exportado o DM_EDITOR_BASE (p. ej. http://localhost:5180)

dm_editor_base_normalizado() {
  local b="${DM_EDITOR_BASE:-http://localhost:5180}"
  echo "${b%/}"
}

editor_http_ok() {
  local base="${BASE:-$(dm_editor_base_normalizado)}"
  local url="${base}/"
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
  local base="${BASE:-$(dm_editor_base_normalizado)}"
  local max="${1:-120}"
  local i=0
  export BASE="$base"
  while [[ "$i" -lt "$max" ]]; do
    if editor_http_ok; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

dm_editor_log_dir() {
  echo "${XDG_CACHE_HOME:-$HOME/.cache}/dm_editor"
}

# Devuelve 0 si algo escucha en el puerto TCP dado (p. ej. 5180).
dm_editor_puerto_ocupado() {
  local puerto="${1:-5180}"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | grep -qE ":${puerto}\$" && return 0
    return 1
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$puerto" -sTCP:LISTEN -n -P >/dev/null 2>&1 && return 0
    return 1
  fi
  return 1
}
