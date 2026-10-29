# VTC_LMS — Vocational Training Centre Learning Management System

A working full-stack LMS for vocational training centres: competency-based
records, a virtual lab with live safety guardrails, a trainer's workshop-floor
tablet view, theory quizzes, work-based-learning logbooks with supervisor
sign-off, and a director's dashboard. English and Arabic (full right-to-left).

| Path | What it is |
|---|---|
| `app/` | **Next.js 16 web app** (App Router): sign-in, five role workspaces, EN/AR RTL, full-screen mode |
| `api/` | Express/TypeScript API: V-Lab sessions, telemetry, server-side multimeter, rubric engine, alerts, floor observations (tested) |
| `db/schema.sql` | PostgreSQL schema (schema `vtc`): users and roles, competencies, question bank, V-Labs, workshop assets, WBL logbooks |
| `db/seed.sql` | Reference data used by the API tests |
| `db/demo.sql` | Demo institution: five sign-in accounts, a cohort of 12, three weeks of history |
| `docs/` | Architecture and UI blueprint |
| `web/` | The clickable prototype and the 3D `MachineExplorer` it shares with the app |

## Run it

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
| Student | student@vtc.example | Progress, V-Lab fault test + 3D motor, theory quiz, logbook with GPS check-in |
| Vocational trainer | trainer@vtc.example | Workshop floor (alerts, one-tap rubric, offline outbox), V-Lab exams, learner records |
| Academic teacher | teacher@vtc.example | Question bank (draft → review → approved), new bilingual items, competency matrix |
| Workplace supervisor | supervisor@vtc.example | Logbook sign-offs with signed, immutable decisions |
| Director | director@vtc.example | Institution KPIs, attainment by unit, utilisation, compliance queue, IQA export |

Tests: `cd api && DATABASE_URL=postgres://…/vtc_lms_test npm test` (unit + integration against a real database).

## How the pieces connect

- **Auth.** Email + password checked against a bcrypt hash in Postgres (`pgcrypto crypt()`); the app keeps an httpOnly signed session cookie. When the browser calls the API it goes through `app/src/app/api/v1/[...path]`, which mints a 5-minute bearer token with the claims the API already verifies.
- **V-Lab.** The student's client sends every action as telemetry. Meter readings come from `POST /probe`, computed on the server from the hidden injected fault and the rig state derived from the stored stream. In guided mode the server blocks unsafe actions (they are never stored); in exam mode it stores them and raises a persisted alert on the trainer's rail. Scoring is the API's rubric engine.
- **Floor observations.** The trainer's tablet scoring becomes `observed`/`measured` events graded by the same rubric engine (`check` and `rating` rules), so physical and virtual evidence land on the competency profile the same way. Offline sign-offs queue in the browser and replay idempotently on `clientMutationId`.
- **Competencies.** Virtual evidence caps at *autonomous*; a supervisor's approval of a logbook entry verifies the competency and can lift an autonomous learner to *master*.
- **Logbooks.** GPS check-ins are judged inside/outside the site geofence by a database trigger. Each supervisor decision is its own row with a SHA-256 signature hash.

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
