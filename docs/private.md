# Private: the student's own space

A section of the student workspace (app: `/student/private`; prototype: Student → 🔒 Private) where a learner studies, practises, compares and keeps things. Only the learner can see it. Nothing in it is graded, shown to staff, or fed into competency levels, analytics or the early-warning model.

| Tab | What it does |
| --- | --- |
| My desk | Cards due today, locker size, focused minutes this week, study streak, best practice score; goals; a focus timer (15/25/45 min) that logs minutes; a 7-day chart; pinned items; latest attempts. |
| Study | Every machine part with a briefing becomes a flashcard (what it is / what it does) on a Leitner schedule (boxes 1–5; back after 0, 1, 3, 7, 14 days). "In my own words" notes are saved per part. A printable study sheet per machine. The trade's lessons and safety simulations with the learner's best score. |
| Practice | Ungraded quizzes built from the parts, the lessons' checkpoints, the safety simulators' rules and the learner's own saved mistakes. Wrong answers can go to the locker as "My mistake" cards to redo. |
| Compare | My attempts (V-Lab, lessons, safety runs, practice): trend line plus any two attempts side by side, criterion by criterion. Machines: two digital twins side by side in 3D with one explode slider and a facts table. Parts: any two parts with their briefings, specs, notes and card level. |
| My locker | Parts, lessons, safety runs, V-Lab results, notes, photos (downscaled on the device), links and mistakes; search, kinds, tags, pins, sort, a detail drawer and a JSON export. |

**Save to my locker** appears on a part's briefing in the 3D explorer, at the end of a lesson and of a safety simulation, and on a V-Lab result. Finished lessons, safety runs and (in the prototype) V-Lab attempts are also recorded privately so Compare can show progress.

## Where the code lives

- Shared UI (written once in `web/src`, copied to `app/src` by `scripts/sync-3d.sh`): `components/private/` (PrivateSpace, Desk, Study, Practice, Compare, Locker, model.ts, store.ts), `components/locker.ts` (window events) and `components/LockerButton.tsx`.
- Prototype: `web/src/prototype/StudentPrivate.tsx` keeps one space per trade in `localStorage` and seeds a week of sample study.
- App: `app/src/app/(app)/student/private/` (server page adds scored V-Lab sessions to compare), `components/LockerBridge.tsx` (posts drops and attempts from any student screen).
- API: `api/src/routes/private.ts` — `GET/PUT /v1/private` (whole document, optimistic `rev`, 409 returns the stored copy to merge), `POST /v1/private/items`, `POST /v1/private/history`. Students only; the caller's own row only.
- Database: `db/migrations/003_private_space.sql` — `private_spaces(learner_id, state jsonb, rev, updated_at)`.
