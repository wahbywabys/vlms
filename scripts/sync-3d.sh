#!/usr/bin/env bash
# The 3D studio (explorer, lessons, safety simulator, models) is written once in
# web/src and runs in both the prototype and the Next app. The app's copies get
# 'use client' on the components; imports are relative, so nothing else changes.
# Edit web/src, then run this.
set -euo pipefail
cd "$(dirname "$0")/.."
W=web/src; A=app/src
mkdir -p $A/components $A/models $A/lessons $A/safety
mkdir -p $A/components/private
for f in MachineExplorer LessonPlayer LessonFx Infographics SafetySim fx LockerButton private/PrivateSpace private/Desk private/Study private/Practice private/Compare private/Locker; do
  { echo "'use client';"; cat "$W/components/$f.tsx"; } > "$A/components/$f.tsx"
done
# The app serves recorded voice-over from public/vo/ (a missing clip falls back to the speech voice);
# the prototype's bundler-relative new URL(..., import.meta.url) does not build under Next.
sed -i "s#new URL('vo/' + \(.*\) + '.mp3', import.meta.url).href#'/vo/' + \1 + '.mp3'#" $A/components/LessonPlayer.tsx
cp $W/components/{MachineExplorer,LessonPlayer,SafetySim}.css $W/components/{section,sfx,locker}.ts $W/components/locker.css $A/components/
cp $W/components/private/{model,store,ctx}.ts $W/components/private/PrivateSpace.css $A/components/private/
cp $W/models/*.tsx $W/models/textures.ts $W/models/briefs.ts $A/models/
sed "s#'\.\./models/#'./#" $W/prototype/motorAr.ts > $A/models/motorAr.ts
cp $W/lessons/*.ts $A/lessons/
cp $W/safety/*.ts $W/safety/*.tsx $A/safety/
echo "synced 3D studio into $A"
