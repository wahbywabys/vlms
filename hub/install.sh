#!/usr/bin/env bash
# Install or update the VTC_LMS online hub on a Linux server with Docker.
#   ./install.sh                  hub on http://127.0.0.1:4100 (proxy it from your web server)
#   ./install.sh hub.example.org  also serve https://hub.example.org with a Let's Encrypt certificate
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo "Install Docker first: curl -fsSL https://get.docker.com | sh"; exit 1; }
rand() { head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-"$1"; }
setenv() { if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }
if [ ! -f .env ]; then
  cp .env.example .env
  setenv DB_PASSWORD "$(rand 32)"
  setenv HUB_ADMIN_KEY "vtc_admin_$(rand 40)"
  setenv HUB_EXPORT_KEY "vtc_export_$(rand 40)"
  setenv HUB_WEBHOOK_SECRET "$(rand 40)"
fi
[ -n "${1:-}" ] && setenv HUB_DOMAIN "$1"
PROFILE=(); [ -n "$(grep '^HUB_DOMAIN=' .env | cut -d= -f2)" ] && PROFILE=(--profile https)
have_images() { for i in $(docker compose config --images); do docker image inspect "$i" >/dev/null 2>&1 || return 1; done; }
docker compose pull db hub 2>/dev/null || have_images || docker compose build hub
docker compose "${PROFILE[@]}" up -d
for _ in $(seq 1 60); do curl -fsS http://127.0.0.1:"$(grep '^HUB_LOCAL_PORT=' .env | cut -d= -f2)"/healthz >/dev/null 2>&1 && break; sleep 2; done
echo
echo "VTC_LMS hub is running."
grep -E '^(HUB_DOMAIN|HUB_ADMIN_KEY|HUB_EXPORT_KEY|HUB_WEBHOOK_SECRET)=' .env
echo "Keep these keys private. Next: register each centre (see SETUP.md, part C)."
