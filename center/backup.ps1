# Save a full copy of the VTC_LMS database to backups\ (keep the 30 newest).
#   Restore: docker compose cp backups\<file>.sql db:/tmp/restore.sql
#            docker compose exec db psql -U vtc -d vtc_lms -f /tmp/restore.sql
Set-Location -Path $PSScriptRoot
New-Item -ItemType Directory -Force backups | Out-Null
$f = "backups\vtc-lms-$(Get-Date -Format yyyyMMdd-HHmm).sql"
docker compose exec -T db sh -c 'pg_dump -U vtc --clean --if-exists vtc_lms > /tmp/backup.sql'
docker compose cp db:/tmp/backup.sql $f
Get-ChildItem backups\vtc-lms-*.sql | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item
Write-Host "Saved $f"
