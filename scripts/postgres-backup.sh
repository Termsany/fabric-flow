#!/bin/sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"

mkdir -p "$BACKUP_DIR"

while true; do
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  FILE="$BACKUP_DIR/roll_manager_$TS.sql.gz"
  echo "Creating backup: $FILE"
  pg_dump "$DATABASE_URL" | gzip > "$FILE"

  find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime +"$KEEP_DAYS" -delete || true

  sleep "$((INTERVAL_HOURS * 3600))"
done

