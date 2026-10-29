#!/usr/bin/env bash
# Recreate the VTC_LMS demo database: schema + reference seed + demo data.
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/vtc_lms ./db/reset.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${DATABASE_URL:?set DATABASE_URL}"
migrations=()
for f in migrations/*.sql; do [ -e "$f" ] && migrations+=(-f "$f"); done
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS vtc CASCADE' -c 'DROP TABLE IF EXISTS public.vtc_migrations' \
  -f schema.sql -f seed.sql "${migrations[@]}" -f demo.sql -f demo_trades.sql -f demo_modules.sql
echo "VTC_LMS demo database ready."
