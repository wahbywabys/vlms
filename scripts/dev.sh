#!/usr/bin/env bash
# Start the VTC_LMS API (port 4000) and web app (port 3000) together.
# Needs Postgres with the demo database (db/reset.sh) and, optionally, Redis.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f api/.env ] || cp api/.env.example api/.env
[ -f app/.env.local ] || cp app/.env.example app/.env.local
(cd api && set -a && . ./.env && set +a && npx tsx watch src/server.ts) &
API=$!
trap 'kill $API 2>/dev/null' EXIT
cd app && npx next dev -p 3000
