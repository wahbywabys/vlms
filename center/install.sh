#!/usr/bin/env bash
# VTC_LMS centre server installer for Linux and macOS (Windows: "Install VTC_LMS.cmd").
# Safe to run again: it keeps your .env and data, and updates and restarts the server.
#   ./install.sh            install or update
#   ./install.sh --demo     first install with the demo centre and demo accounts
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  die "Docker is not installed. Linux: run  curl -fsSL https://get.docker.com | sh  (needs internet once). macOS: install Docker Desktop from https://www.docker.com/products/docker-desktop, open it once, then run this again."
fi
docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker (Linux: sudo systemctl start docker; macOS: open Docker Desktop), or run this with sudo."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing. Update Docker (it ships with Docker Desktop and docker-ce)."

# 2. This computer's address on the centre network
detect_ip() {
  local ip=""
  if command -v ip >/dev/null 2>&1; then ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}' | head -1); fi
  [ -z "$ip" ] && command -v ipconfig >/dev/null 2>&1 && ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  [ -z "$ip" ] && command -v hostname >/dev/null 2>&1 && ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "${ip:-127.0.0.1}"
}
rand() { head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-"$1"; }
setenv() {  # setenv KEY VALUE: replace or append in .env
  if grep -q "^$1=" .env; then sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak; else echo "$1=$2" >> .env; fi
}

IP=$(detect_ip)
if [ ! -f .env ]; then
  say "Creating settings (.env) for this server at $IP"
  cp .env.example .env
  setenv DB_PASSWORD "$(rand 32)"
  setenv SESSION_SECRET "$(rand 64)"
  setenv JWT_SECRET "$(rand 64)"
  setenv CENTER_IP "$IP"
  [ "${1:-}" = "--demo" ] && setenv SEED_DEMO true
else
  OLD=$(grep '^CENTER_IP=' .env | cut -d= -f2)
  if [ "$OLD" != "$IP" ]; then
    say "This computer's address changed from $OLD to $IP; updating .env"
    setenv CENTER_IP "$IP"
  fi
fi

# The address shown on the join page carries the port when it is not 80.
P=$(grep '^HTTP_PORT=' .env | cut -d= -f2)
setenv HTTP_PORT_SUFFIX "$([ "${P:-80}" = 80 ] || echo ":$P")"

# 3. Images: from the offline bundle, the registry, or built from this checkout
COMPOSE=(docker compose)
if ls images/*.tar* >/dev/null 2>&1; then
  say "Loading images from the offline bundle (no internet needed)"
  for f in images/*.tar*; do docker load -i "$f"; done
elif ! docker compose pull 2>/dev/null; then
  have_images() { for i in $(docker compose config --images); do docker image inspect "$i" >/dev/null 2>&1 || return 1; done; }
  if have_images; then
    say "No internet: using the images already on this computer"
  elif [ -f ../api/Dockerfile ]; then
    say "Building the images from the source code (first time: about 5-10 minutes, needs internet)"
    COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.build.yml)
    "${COMPOSE[@]}" build
  else
    die "Could not download the images. Connect to the internet once, or use the offline bundle (vtc-lms-center-offline.zip)."
  fi
fi

# 4. Start
say "Starting VTC_LMS"
"${COMPOSE[@]}" up -d --remove-orphans

printf 'Waiting for the server'
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "http://localhost:$(grep '^HTTP_PORT=' .env | cut -d= -f2)/join" 2>/dev/null; then ok=1; break; fi
  printf '.'; sleep 2
done
echo
[ "${ok:-}" = 1 ] || die "The server did not answer. See the logs:  docker compose logs --tail 50"

PORT=$(grep '^HTTP_PORT=' .env | cut -d= -f2)
ADDR="http://$IP$([ "$PORT" = 80 ] || echo ":$PORT")"
say "VTC_LMS is running."
cat <<MSG

  On every phone, tablet and laptop (connected to the centre Wi-Fi), open:

      $ADDR

  Join poster with QR code (show it on a screen or print it):  $ADDR/join
  Stop: docker compose stop     Start: docker compose start     Logs: docker compose logs -f
  Add an account: docker compose exec api npx tsx src/add-user.ts --email … --name … --role director --password …

MSG
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$ADDR/join" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then open "$ADDR/join" 2>/dev/null || true; fi
