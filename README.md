# VTC_LMS — Vocational Training Centre Learning Management System

A working full-stack LMS for vocational training centres: competency-based
records, a virtual lab with live safety guardrails, a trainer's workshop-floor
tablet view, theory quizzes, work-based-learning logbooks with supervisor
sign-off, and a director's dashboard. English and Arabic (full right-to-left).

The workshop, work-based learning and assessment modules add: a tap-to-score
floor rubric with photo evidence, consumables stock linked to signed-off jobs,
QR safety passports that unlock a machine after a pre-check, geofenced OJT
hours with a signed apprentice logbook, skills heatmaps and radars against the
national standard, per-learner parametric questions, fault-finding on
schematics, and an early-warning dashboard. The blueprint (architecture, data
flows, DDL and screens) is in [docs/modules.md](docs/modules.md).

| Path | What it is |
|---|---|
| `app/` | **Next.js 16 web app** (App Router): sign-in, five role workspaces, EN/AR RTL, full-screen mode |
| `api/` | Express/TypeScript API: V-Lab sessions, telemetry, server-side multimeter, rubric engine, alerts, floor observations (tested) |
| `db/schema.sql` | PostgreSQL schema (schema `vtc`): users and roles, competencies, question bank, V-Labs, workshop assets, WBL logbooks |
| `db/seed.sql` | Reference data used by the API tests |
| `db/demo.sql` | Demo institution: five sign-in accounts, a cohort of 12, three weeks of history |
| `db/migrations/` | `001_trades.sql` (four trades), `002_workshop_wbl_assessment.sql` (the modules above) |
| `db/demo_modules.sql` | Demo data for the modules: machines and pre-checks, OJT shifts, schematics, parametric items, risk signals |
| `db/demo_curricula.sql` | Demo cohorts for the WABYS manual programmes (student.rmg@, .eim@, .prt@, .ait@, .cws@, and Rev 1.1: .iel@, .csn@, .rac@, .ham@, .oeq@, .ave@, .iem@) |
| `db/curricula/wabys-2026.json` | The WABYS curriculum manual Rev 1.1 as data (15 programmes, K/S/A, shared ETF/CPM units, study systems A/B, Arabic and English); see `docs/curricula.md` |
| `docs/` | Architecture and UI blueprint |
| `web/` | The clickable prototype and the 3D `MachineExplorer` it shares with the app |
| `app/src/components/modules/` | The module screens (React + Tailwind), shared with the prototype through `scripts/sync-modules.sh` |

## Run it in a training centre (local network, no internet needed)

[SETUP.md](SETUP.md) is the ready-to-use guide: one computer runs the server (`center/`, one-click installer for Windows, Linux and macOS), every phone, tablet and PC joins it over the centre Wi-Fi through `http://<server>/join`, and the server syncs to your own online hub (`hub/`) whenever it has internet, where any dashboard reads it through a REST/CSV/xAPI export API and webhooks.

## Run it for development

Prerequisites: Node 20+, PostgreSQL 15+, Redis 7 (optional; alerts are also stored in Postgres).

```bash
createdb vtc_lms
DATABASE_URL=postgres://postgres:postgres@localhost:5432/vtc_lms ./db/reset.sh   # schema + seed + demo data
(cd api && npm install) && (cd app && npm install)
./scripts/dev.sh            # API on :4000, app on http://localhost:3000
```

Sign in with any demo account (password `demo1234`), or use the one-click buttons on the sign-in page:

| Role | Email | Workspace |
|---|---|---|
| Student (CNC machining) | student@vtc.example | Progress, V-Lab fault test + 3D motor, theory quiz, applied assessment (own numbers, pin the fault), machine access (scan, pre-check, unlock), OJT logbook with geofenced check-in and photos |
| Student (automotive, electrical, welding) | student.auto@ / student.elec@ / student.weld@vtc.example | The same screens, for that trade's V-Lab, job cards and questions |
| Vocational trainer | trainer@vtc.example | Workshop floor (alerts, one-tap rubric with photos, offline outbox), machines and QR labels, stores, early warning, V-Lab exams, learner records, for every trade (switch with the trade bar) |
| Academic teacher | teacher@vtc.example | Question bank (draft → review → approved), new bilingual items, parametric question authoring with preview, competency matrix |
| Workplace supervisor | supervisor@vtc.example | Logbook sign-offs with photos, signed over the entry and its photo hashes |
| Director | director@vtc.example | Institution KPIs, attainment by unit, utilisation, compliance queue, IQA export, skills heatmap and radar, early warning |

### Trades (specialisations)

The demo centre teaches four trades: CNC machining, automotive mechanics, electrical installation and welding. Each has its own competency framework, cohort, workshop, job-card rubric, consumables, V-Lab fault test and questions. Staff switch trade with the trade bar under the top bar (the director also has "All trades"); a learner always sees their own cohort's trade. Each trade also has its own trainer (`trainer.auto@`, `trainer.elec@`, `trainer.weld@vtc.example`).

To add a trade:

1. Insert a row in `trades` (see `db/migrations/001_trades.sql`) and set `trade_id` on its framework, cohort, workshop and rubrics.
2. Give the workshop an observation rubric (`workshops.observation_rubric_id`); the trainer floor scores against it.
3. Write its V-Lab as one file in `api/src/labs/` (shaped like `cnc.ts`), list it in `api/src/labs/index.ts`, and seed its `virtual_labs`, `lab_faults` and rubric rows. `api/test/labs.test.ts` checks that every fault can be found and a careful attempt scores 100.
4. For the clickable prototype, add `web/src/prototype/trades/<id>.ts` and list it in `trades/index.ts`.
5. For the modules, add its machines, pre-check, task bill of materials and (optionally) a schematic and parametric items, as `db/demo_modules.sql` does for the four demo trades.

The module screens live once, in `app/src/components/modules/`. After changing one, run `./scripts/sync-modules.sh` to copy them into the prototype (`web/src/modules/`), then `npm run build:prototype` in `web/`. The prototype runs them on an in-memory API (`web/src/demo/demo.ts`) that uses the API's own engines.

To put it online, follow [DEPLOY.md](DEPLOY.md) (Railway: app, API, Postgres and Redis, with the schema applied on every deploy). `npm run migrate` in `api/` applies the same migrations locally.

Tests: `cd api && DATABASE_URL=postgres://…/vtc_lms_test npm test` (unit + integration against a real database).

## How the pieces connect

- **Auth.** Email + password checked against a bcrypt hash in Postgres (`pgcrypto crypt()`); the app keeps an httpOnly signed session cookie. When the browser calls the API it goes through `app/src/app/api/v1/[...path]`, which mints a 5-minute bearer token with the claims the API already verifies.
- **V-Lab.** The student's client sends every action as telemetry. Meter readings come from `POST /probe`, computed on the server from the hidden injected fault and the rig state derived from the stored stream. In guided mode the server blocks unsafe actions (they are never stored); in exam mode it stores them and raises a persisted alert on the trainer's rail. Scoring is the API's rubric engine.
- **Floor observations.** The trainer's tablet scoring becomes `observed`/`measured` events graded by the same rubric engine (`check` and `rating` rules), so physical and virtual evidence land on the competency profile the same way. Offline sign-offs queue in the browser and replay idempotently on `clientMutationId`.
- **Competencies.** Virtual evidence caps at *autonomous*; a supervisor's approval of a logbook entry verifies the competency and can lift an autonomous learner to *master*.
- **Logbooks.** GPS check-ins are judged inside/outside the site geofence by a database trigger. Each supervisor decision is its own row with a SHA-256 signature hash.
- **Modules.** See [docs/modules.md](docs/modules.md) for the endpoints (`/v1/safety/*`, `/v1/ojt/*`, `/v1/wbl/logbook`, `/v1/assessments`, `/v1/analytics/*`, `/v1/media`, `/v1/sync`, `/v1/xapi/statements`) and how each one decides.

## API

Also: `POST /v1/vlab/sessions` (start; learners get guided/sandbox with a random fault, trainers start exams with a chosen fault), `GET /v1/vlab/sessions/:id` (state; fault hidden from the learner until scored), `POST /v1/vlab/sessions/:id/probe` (meter reading), `GET /v1/alerts`, `POST /v1/alerts/:id/resolve`, `POST /v1/workshop/observations`.


`POST /v1/vlab/sessions/:sessionId/telemetry` (learner's client, bearer JWT)

```json
{ "events": [
  { "seq": 1, "occurredAt": "2026-11-02T08:00:01Z", "verb": "ppe_donned" },
  { "seq": 2, "occurredAt": "2026-11-02T08:00:09Z", "verb": "loto_applied", "objectRef": "Q1" },
  { "seq": 3, "occurredAt": "2026-11-02T08:01:30Z", "verb": "measured", "objectRef": "X1:L1-L2", "value": { "reading": 401.5, "unit": "V" } }
] }
```

→ `202 { accepted, duplicates, rejected[], lastSeq, alerts[], guardrail: "block" | null }`

- Batches of up to 500 events; retries are idempotent on `seq`.
- Rejects events dated in the future (>5 min skew), before the session, or after the exam time limit.
- Runs the rubric's safety-gate rules live; violations are published to `vlab:alerts:<institution>` for trainer tablets. In Guided mode the response tells the client to block the action.

`POST /v1/vlab/sessions/:sessionId/evaluate` (learner or staff)

→ `200 { totalScore, passed, gateFailures[], criteria[{ key, score, weight, gateFailed, evidenceSeqs, detail }] }`

- Deterministic re-scoring of the full telemetry stream against the session's rubric.
- Writes `rubric_evaluations`, appends `competency_evidence`, and raises `learner_competencies` (never lowers; failed gates give no credit; virtual evidence caps at *autonomous*).
- Idempotent: a second call returns the stored result.

Rubric rule types (`rubric_criteria.scoring`): `precedes`, `absent`, `fault_diagnosed`, `isolation_steps`, `measurement_tolerance`, `time`, `penalty_per`, and for floor observations `check` and `rating`.
