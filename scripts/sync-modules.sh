#!/usr/bin/env bash
# The module screens (app/src/components/modules) are plain React + Tailwind
# with no app imports, so the clickable prototype runs the same files.
# web/src/modules is a copy: edit the app's files, then run this.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf web/src/modules && mkdir -p web/src/modules
for f in app/src/components/modules/*.ts app/src/components/modules/*.tsx; do
  { echo "// Copied from ${f} by scripts/sync-modules.sh. Edit the original, not this file."; cat "$f"; } > "web/src/modules/$(basename "$f")"
done
cp app/src/app/tw.css web/src/modules/tw.css
sed -i 's#@source "../components/modules";#@source "./";#; s#@source "./(app)";#@source "../prototype"; @source "../demo";#' web/src/modules/tw.css
echo "synced $(ls web/src/modules | wc -l) files"
