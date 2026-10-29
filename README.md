# VLMS — Vocational Learning Management System (reference scaffold)

| Path | What it is |
|---|---|
| `docs/architecture.md` | High-level architecture (Mermaid) and key flows |
| `docs/ui-blueprint.md` | UI/UX blueprint: Trainer Tablet Floor View, Student 3D Lab Explorer, Executive Dashboard |
| `db/schema.sql` | PostgreSQL schema: Users, Competencies, QuestionBank, VirtualLabSessions, WorkshopAssets, WBLLogbooks |
| `db/seed.sql` | Demo data: one school, a learner, a trainer, a DOL motor-starter V-Lab with an injected fault |
| `web/` | React Three Fiber `MachineExplorer` (exploded view, hotspots, X-ray, cutaway, kinetic) + demo motor model |
| `web/src/prototype/` | VTC_LMS clickable prototype, English and Arabic (RTL): role switcher over the Trainer Floor View, Student 3D Lab + V-Lab fault test, and Director dashboard, on sample data |
| `web/src/prototype/assets/` | VTC_LMS logo as SVG: `vtc-lms-mark.svg`, `vtc-lms-logo.svg` (light), `vtc-lms-logo-dark.svg` |
| `api/` | Node.js/TypeScript V-Lab telemetry ingestion + rubric evaluation API, with tests |

## Run it

Prerequisites: Node 20+, PostgreSQL 15+, Redis 7 (optional).

```bash
# Database
createdb vlms
psql -d vlms -f db/schema.sql -f db/seed.sql

# API (port 4000)
cd api && npm install
cp .env.example .env          # set DATABASE_URL, REDIS_URL, JWT_SECRET
npm run dev
DATABASE_URL=postgres://localhost/vlms_test npm test   # unit + integration tests

# 3D explorer demo (port 5173)
cd web && npm install && npm run dev

# Clickable prototype (three screens + role switcher)
cd web && npm run dev:prototype        # open /prototype.html#trainer, #student or #director
npm run build:prototype                # static build in web/dist-prototype/
```

The prototype needs no API or database. The V-Lab fault test scores attempts with
`api/src/services/rubricEngine.ts` itself (imported directly, rubric copied from
`RB-DOL-FAULT` in `db/seed.sql`), and the trainer tolerance field uses the same
`withinTolerance` helper, so scores match what the server would compute. Screens
share in-memory state: an exam-mode safety violation appears on the trainer's
alert rail, and every scored attempt appears on the director's evaluation list.

## API

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

Rubric rule types (`rubric_criteria.scoring`): `precedes`, `absent`, `fault_diagnosed`, `isolation_steps`, `measurement_tolerance`, `time`, `penalty_per`.
