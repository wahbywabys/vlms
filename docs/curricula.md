# WABYS curricula 2026

The *WABYS Manual for Vocational Education & Applied Technology Curriculums*
(Master Curriculum Framework, Rev 1.1, 2026) is loaded into VTC_LMS as fifteen
programmes: the eight of the first edition and the seven PVTD programmes that
Rev 1.1 adds. Each programme runs three years; each year has three domains:

| Domain | In the manual | In VTC_LMS |
|---|---|---|
| **K** knowledge | Knowledge modules with theory hours and learning outcomes | element with `nominal_hours`, its outcomes as criteria |
| **S** skills | Practical competencies with a target level (L1 Assisted → L4 Expert/coach) and performance criteria | element with `target_level`, criteria |
| **A** attitudes | Professional attitudes with observable behaviours, each linked to one of the seven core attitudes (A1–A7) | element with `core_attitude`, criteria |

| Code | Programme | Trade id | 3D twin | Safety simulation |
|---|---|---|---|---|
| CNC | CNC Machining & Turning | `cnc` | CNC lathe, **CNC vertical machining centre**, grinder, motor | lathe, **VMC first-off**, grinder |
| AUT | Automotive Maintenance & Repair | `auto` | car engine | engine |
| ELI | Electrical Installations | `elec` | DOL starter panel, motor | panel |
| RMG | Ready-Made Garments & Fashion Production | `rmg` | **industrial lockstitch sewing machine** | **needle change and test seam** |
| EIM | Equipment Installation & Maintenance | `eim` | **pump and motor alignment rig**, motor | **LOTO and laser alignment** |
| PRT | Printing Technologies | `prt` | **sheetfed offset press** | **blanket wash** |
| AIT | Artificial Intelligence for Technicians | `ait` | **AI vision inspection cell** | **lens clean, retrain and validate** |
| CWS | 21st Century Work Skills | `cws` | (no machine: a cross-cutting programme) | |
| IEL | Industrial Electronics | `iel` | **electronics bench** (scope, generator, supply, isolation transformer, power board, soldering, ESD) | **replace a MOSFET on a power board** |
| CSN | Computer Systems & Networks | `csn` | **42U network rack and PC bench** | **fibre uplink and server drive** |
| RAC | Refrigeration & Air-Conditioning | `rac` | **split AC service rig** (outdoor and indoor units, manifold, recovery, nitrogen) | **recover, braze, pressure-test, recharge** |
| HAM | Home Appliances Maintenance | `ham` | **washing machine on the repair stand**, PAT tester | **will not drain** |
| OEQ | Office Equipment Maintenance | `oeq` | **laser MFP on a service cart**, toner vacuum | **fuser jam and toner** |
| AVE | Audio-Visual & Consumer Electronics | `ave` | **LED TV on the repair bench**, electronics bench | **TV with no power** |
| IEM | Industrial Electricity & Electrical Machines | `iem` | **motor rewinding station**, DOL panel, motor | **rewind and HV test** |

Every programme also has a **tool board**: a shadow board with the eight hand
tools and instruments of the trade (from the manual's training requirements).
Each tool is a part of the 3D model with its own briefing, specification and
safety note (`web/src/models/toolBoard.tsx`; the library is shared, each trade
picks its eight in `TRADE_TOOLS`).

## Rev 1.1

- **Shared units.** The Electro-technology Foundation (ETF) and the
  Cross-Program Modules (CPM) are written once in the manual and adopted by
  several programmes. They are copied into each adopting programme's tree under
  their shared codes (`ETF-…`, `CPM-…`) and shown with a "Shared unit" tag.
- **Two study systems.** System A (60 % practical) and System B (80 % practical,
  with its own training-unit plan). The programme page shows both, and the
  System B plan table under a fold.
- **Profile additions:** duration, PVTD reference occupation, the shared units
  adopted, and the core equipment list as "Training requirements".
- **Revised titles** for the original eight programmes are applied in place.
- `scripts/import-manual.py` reads the manual HTML
  (`db/curricula/source/wabys-manual-rev1.1.html`) into
  `db/curricula/wabys-2026.json`. The manual's K and S text is English only;
  `db/curricula/criteria-ar.json` holds the Arabic for each unique criterion
  (974). Have a subject expert review it.
- `scripts/build-curricula.py` writes `db/migrations/007_wabys_rev11.sql`
  (006 is left untouched because centres may already have applied it): profile
  updates by `program_code`, the new trades, frameworks, units, elements,
  criteria and machine types.
- Demo: one cohort per new programme with three students; sign in as
  `student.iel@vtc.example` (… `csn`, `rac`, `ham`, `oeq`, `ave`, `iem`),
  password `demo1234`.

## Where it lives

- `db/curricula/wabys-2026.json`: the manual as data. Every item has its code
  (`ELI-Y1-K-01`), year, domain, title and criteria in English and Arabic, and
  the PDF page it came from. Programme profiles (occupation, EQF level, hours,
  jobs, tracks, equipment, standards, capstone) are in the same file.
- `scripts/build-curricula.py` turns the JSON into
  `db/migrations/006_wabys_curricula.sql` (first edition), `007_wabys_rev11.sql` (Rev 1.1) and
  `app/public/templates/wabys-curricula-2026.xlsx` / `.csv`. Edit the JSON,
  never the generated files, then run it again.
- Migration 006 adds `trades.program_code`, `accent`, `profile`; the K/S/A
  columns on `competencies` (`ksa`, `year`, `target_level`, `core_attitude`,
  `description_ar`, `sort_order`); and the `core_attitudes` table. It creates a
  framework `WABYS-<CODE>-2026` per programme, effective 2026-09-01: unit
  `ELI-Y1-K` (Year 1 · Knowledge modules) → element `ELI-Y1-K-01` → criterion
  `ELI-Y1-K-01.1`. The older NTQF frameworks stay for existing progress data.
- Machine types for the new programmes are added there too and map to the new
  3D twins, so the machine register links real machines to them.

## Screens

- **Student → My programme** (`/student/curriculum`): the learner's own
  programme, its profile and every item by year and domain.
- **Trainer / Teacher → Curriculum**: the same for the programme chosen in the
  trade bar.
- **Director → Programmes & skills**: the same view for each programme, the
  editable skill tree, the Excel import, and a download of the full curricula.
- **Student → V-Lab**: programmes without a V-Lab fault rig still get the 3D &
  VR tab and the safety simulator.

All text follows the language toggle. The Arabic layer of the source PDF did
not extract cleanly, so the Arabic in the JSON was translated from the English
using the app's existing terminology; have a subject expert review it.

## Importing an edited copy

The Excel file uses the same columns as the programmes template plus Domain,
Year, Target level and Core attitude, so it can be imported from Director →
Programmes & skills → Import. Matching is by programme code (`program_code`, e.g.
`ELI`) or trade id, so re-importing updates in place.
