# VLMS — High-Level System Architecture

The platform is split into three domain engines (Pedagogical, Operational, Industrial Governance) behind one API gateway, sharing an identity service, an event bus and a single PostgreSQL system of record. Every learner-facing interaction, virtual or physical, becomes an xAPI statement that lands in the Learning Record Store and moves the learner's competency profile.

```mermaid
flowchart TB
  subgraph CLIENTS["Clients"]
    WEB["Next.js web app<br/>Teacher · Student · Director"]
    TAB["Trainer tablet PWA<br/>offline IndexedDB/SQLite outbox"]
    MOB["Supervisor mobile<br/>React Native · GPS · camera"]
    KIOSK["Workshop SOP kiosks"]
    VR["WebXR / 6DOF headsets"]
    IOT["Shop-floor IoT<br/>RFID readers · QR · PLC gateways"]
  end

  subgraph EDGE["Edge"]
    CDN["CDN<br/>glTF twins · video HLS · static"]
    GW["API gateway / BFF<br/>OIDC · LTI 1.3 launch · rate limits"]
    RT["Realtime hub<br/>WebSocket / SSE"]
  end

  subgraph PED["Pedagogical engine"]
    CONTENT["Lessons & interactive video"]
    QB["Question bank & assessment<br/>parameterised items · psychometrics"]
    COMP["Competency service<br/>CBT matrix · micro-credentials"]
    VLAB["V-Lab orchestrator<br/>modes · fault injection"]
    TEL["Telemetry ingestion<br/>+ rubric evaluator"]
    AI["AI item & feedback service<br/>Claude API · human review gate"]
  end

  subgraph OPS["Operational engine"]
    SCHED["Scheduling & booking"]
    ASSET["Assets & consumables"]
    ACCESS["Machine access control<br/>badge × competency gate"]
  end

  subgraph GOV["Industrial governance engine"]
    WBL["WBL placements & logbooks<br/>geofenced check-in"]
    HSE["HSE / safety compliance"]
    IQA["IQA & accreditation reporting"]
  end

  subgraph DATA["Data platform"]
    PG[("PostgreSQL<br/>system of record")]
    REDIS[("Redis<br/>sessions · streams · pub/sub")]
    S3[("Object storage<br/>evidence media · twins")]
    LRS[("Learning Record Store<br/>xAPI")]
    DWH[("Analytics warehouse<br/>heatmaps · KPIs")]
  end

  SYNC["Offline sync service<br/>idempotent outbox replay"]
  INTEROP["Interop adapters<br/>LTI 1.3 · SCORM 2004 · xAPI · Open Badges 3"]

  WEB & TAB & MOB & KIOSK & VR --> GW
  WEB & VR -.assets.-> CDN
  IOT --> ACCESS
  TAB & MOB --> SYNC --> GW
  GW --> CONTENT & QB & COMP & VLAB & TEL & SCHED & ASSET & WBL & HSE & IQA
  QB --> AI
  VLAB --> TEL
  TEL --> REDIS --> RT --> TAB & WEB
  ACCESS --> COMP
  ACCESS --> ASSET
  CONTENT & QB & COMP & VLAB & TEL & SCHED & ASSET & ACCESS & WBL & HSE & IQA --> PG
  WBL & ASSET --> S3
  TEL & QB & WBL --> LRS
  PG & LRS --> DWH --> IQA
  INTEROP <--> GW
```

## Key flows

| Flow | Path | Notes |
|---|---|---|
| V-Lab fault test | Learner client → `POST /telemetry` (batched, seq-numbered) → Postgres + Redis Stream → trainer tablet alert → `POST /evaluate` → rubric evaluation → competency evidence → LRS | Implemented in `api/` |
| Shop-floor observation | Trainer tablet (offline) → local outbox with `client_mutation_id` → sync on reconnect → rubric evaluation → competency evidence | Same rubric engine as V-Labs |
| Machine unlock | RFID tap → access service checks badge ⇒ user ⇒ `required_competency_id` ≥ autonomous & valid LOTO induction → relay unlock + `asset_checkouts` row | Fails closed when offline |
| OJT attendance | Mobile GPS fix → `wbl_checkins` trigger computes haversine distance vs. site geofence server-side | Client never decides `inside_geofence` |
| Logbook sign-off | Apprentice uploads entry + media → supervisor approves on mobile → immutable `wbl_signoffs` row with signature hash | IQA audit trail |
| Accreditation | Nightly ETL Postgres + LRS → warehouse → IQA dashboards, regional skill heatmaps | |

## Cross-cutting decisions

- **One rubric engine, two evidence sources.** The same scoring rules grade a V-Lab session and a physical workshop observation, so virtual and physical evidence are comparable on the competency matrix.
- **Safety gates are first-class.** Any rubric criterion can be a gate: failing it fails the attempt regardless of score and never counts as positive competency evidence.
- **Offline-first writes.** Every client-originated row carries a client-minted UUID and `client_mutation_id`; replays are idempotent.
- **Postgres is the system of record; Redis is a side channel.** A Redis outage degrades live dashboards but never loses telemetry.
- **Tenancy.** Every top-level row is scoped by `institution_id`; cross-tenant access returns 404, not 403.
- **AI-generated items require human approval** (enforced by a CHECK constraint on `questions`).
- **Scale path.** Redis Streams → Kafka and monthly telemetry partitions → TimescaleDB/ClickHouse when ingestion exceeds ~5k events/s.
