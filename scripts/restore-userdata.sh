#!/usr/bin/env bash
# Restore userData from tar.gz created by backup-userdata.sh
set -euo pipefail
ARCHIVE="${1:?Usage: restore-userdata.sh backup.tar.gz}"
if [[ "$(uname)" == "Darwin" ]]; then
  PARENT="$HOME/Library/Application Support"
elif [[ "$(uname)" == "Linux" ]]; then
  PARENT="${XDG_CONFIG_HOME:-$HOME/.config}"
else
  PARENT="${APPDATA:-.}"
fi
tar -xzf "$ARCHIVE" -C "$PARENT"
echo "Restored into $PARENT"
