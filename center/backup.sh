#!/usr/bin/env bash
# Save a full copy of the VTC_LMS database to backups/ (keep the 30 newest).
#   Restore: docker compose exec -T db psql -U vtc -d vtc_lms < backups/<file>.sql
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
f="backups/vtc-lms-$(date +%Y%m%d-%H%M).sql"
docker compose exec -T db pg_dump -U vtc --clean --if-exists vtc_lms > "$f"
ls -1t backups/vtc-lms-*.sql | tail -n +31 | xargs -r rm -f
echo "Saved $f"
