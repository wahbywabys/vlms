#!/usr/bin/env bash
# Recreate the VTC_LMS demo database: schema + reference seed + demo data.
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/vtc_lms ./db/reset.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${DATABASE_URL:?set DATABASE_URL}"
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS vtc CASCADE' -f schema.sql -f seed.sql -f demo.sql
echo "VTC_LMS demo database ready."
