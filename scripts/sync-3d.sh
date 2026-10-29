#!/usr/bin/env bash
# The 3D studio (explorer, lessons, safety simulator, models) is written once in
# web/src and runs in both the prototype and the Next app. The app's copies get
# 'use client' on the components; imports are relative, so nothing else changes.
# Edit web/src, then run this.
set -euo pipefail
cd "$(dirname "$0")/.."
W=web/src; A=app/src
mkdir -p $A/components $A/models $A/lessons $A/safety
for f in MachineExplorer LessonPlayer LessonFx Infographics SafetySim fx; do
  { echo "'use client';"; cat "$W/components/$f.tsx"; } > "$A/components/$f.tsx"
done
cp $W/components/{MachineExplorer,LessonPlayer,SafetySim}.css $W/components/{section,sfx}.ts $A/components/
cp $W/models/*.tsx $W/models/textures.ts $A/models/
sed "s#'\.\./models/#'./#" $W/prototype/motorAr.ts > $A/models/motorAr.ts
cp $W/lessons/*.ts $A/lessons/
cp $W/safety/*.ts $W/safety/*.tsx $A/safety/
echo "synced 3D studio into $A"
