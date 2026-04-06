#!/bin/sh
set -eu

if [ "${RUN_DB_BOOTSTRAP:-true}" = "true" ]; then
  node ./lib/db/bootstrap-db.mjs
fi

exec node --enable-source-maps ./artifacts/api-server/dist/index.mjs
