#!/usr/bin/env python3
"""Turn helpshots/{ar,en}/*.png (from help-screenshots.cjs) into app/public/help/{ar,en}/*.webp."""
import glob, os
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..')
SKIP = {'trainer-score', 'student-machine-precheck', 'supervisor-signoff'}   # taken, not used by any guide
for lang in ['ar', 'en']:
    out = os.path.join(root, 'app/public/help', lang)
    os.makedirs(out, exist_ok=True)
    for f in glob.glob(f'helpshots/{lang}/*.png'):
        name = os.path.basename(f)[:-4]
        if name in SKIP:
            continue
        im = Image.open(f).convert('RGB')
        im.resize((540, int(im.height * 540 / im.width)), Image.LANCZOS).save(os.path.join(out, f'{name}.webp'), 'WEBP', quality=72)
