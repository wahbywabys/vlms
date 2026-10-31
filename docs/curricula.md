# WABYS curricula 2026

The *WABYS Manual for Vocational Education & Applied Technology Curriculums*
(Master Curriculum Framework, first edition 2026) is loaded into VTC_LMS as
eight programmes. Each programme runs three years; each year has three domains:

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

## Where it lives

- `db/curricula/wabys-2026.json`: the manual as data. Every item has its code
  (`ELI-Y1-K-01`), year, domain, title and criteria in English and Arabic, and
  the PDF page it came from. Programme profiles (occupation, EQF level, hours,
  jobs, tracks, equipment, standards, capstone) are in the same file.
- `scripts/build-curricula.py` turns the JSON into
  `db/migrations/006_wabys_curricula.sql` and
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
