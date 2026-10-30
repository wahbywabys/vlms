# In-app Instructions (تعليمات)

Every screen has an orange **تعليمات / Instructions** button: in the top bar of each workspace, and on the sign-in and join pages. It opens `/help`, which anyone can read without signing in, so a person who can't sign in yet can still find out how.

- `/help?for=<audience>` picks the tab: `everyone` (*Start here*), `student`, `trainer`, `teacher`, `supervisor`, `director` or `admin` (the centre computer). From a workspace, the button opens that role's tab.
- Each task is a guide that expands. A guide has a few numbered steps, and each step has a real screen (`app/public/help/{ar,en}/*.webp`) or a drawn picture (`components/HelpArt.tsx`). Tips are in the orange box.
- The copy lives in `app/src/lib/help.ts`, in English and Arabic. Write it simply, for people who are new to phones. Use the button names exactly as they appear on screen.
- On a centre server the app opens in Arabic (`DEFAULT_LANG=ar`). Everyone can switch with EN / عربي.

## When a screen changes

Retake the pictures against a running demo server (`center/install.sh --demo`):

```bash
BASE=http://localhost node scripts/help-screenshots.cjs ar
BASE=http://localhost node scripts/help-screenshots.cjs en
python3 scripts/help-screenshots.py      # helpshots/*.png -> app/public/help/{ar,en}/*.webp
```
