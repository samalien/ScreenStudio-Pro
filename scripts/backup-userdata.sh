#!/usr/bin/env bash
# Backup ScreenStudio Pro userData (projects, auth, billing, media index)
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="${1:-./backup-ssp-$STAMP.tar.gz}"

# Resolve userData paths (Linux/macOS/Windows via env)
if [[ -n "${SSP_USERDATA:-}" ]]; then
  DATA="$SSP_USERDATA"
elif [[ "$(uname)" == "Darwin" ]]; then
  DATA="$HOME/Library/Application Support/screenstudio-pro"
elif [[ "$(uname)" == "Linux" ]]; then
  DATA="${XDG_CONFIG_HOME:-$HOME/.config}/screenstudio-pro"
else
  DATA="${APPDATA:-}/screenstudio-pro"
fi

if [[ ! -d "$DATA" ]]; then
  echo "UserData not found: $DATA"
  echo "Set SSP_USERDATA to the app userData directory."
  exit 1
fi

tar -czf "$OUT" -C "$(dirname "$DATA")" "$(basename "$DATA")"
echo "Backup written: $OUT"
