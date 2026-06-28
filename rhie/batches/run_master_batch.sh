#!/bin/sh
# Safe cron entry — do NOT run every minute.
# Recommended: */15 * * * * /path/to/rhie/batches/run_master_batch.sh

DIR="$(cd "$(dirname "$0")" && pwd)"
PHP_BIN="${PHP_BIN:-php}"
LOCK_FILE="/tmp/rhie_master_batch.lock"

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] master_batch already running. Skipping."
  exit 0
fi

cd "$DIR/../.." || exit 1
exec "$PHP_BIN" "$DIR/master_batch.php"
