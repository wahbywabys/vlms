# VTC_LMS — Core UI/UX Blueprint

Three screens carry most of the system's daily value. Each is designed around the place it is used: a noisy workshop floor, a learner's laptop or tablet, and a director's office.

Shared design rules:

- **Touch targets ≥ 44 px**, ≥ 56 px on the trainer tablet (gloved hands).
- **High contrast, dark-capable UI** for workshop lighting and glare; status is always encoded in shape + colour, never colour alone.
- **Offline is a normal state**, not an error: every screen shows sync state, and every write is queued locally.
- **Safety first in the visual hierarchy**: safety gates and HSE alerts are the top-most layer and cannot be dismissed without an action.
- **RTL-ready** (Arabic) layouts via logical CSS properties.

---

## 1. Trainer Tablet Floor View

**Who / where:** Vocational trainer walking the workshop with a 10–12" tablet, often gloved, sometimes offline.
**Job:** Observe 12–20 learners at their stations, score practical tasks in one tap, sign off safety, capture evidence.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CNC Bay 2 · Mechatronics Y2-B · 09:40      ● Online  ⟳ 0 queued   [⚠ 1] │  ← sync state + live alert count
├──────────────────────────────┬───────────────────────────────────────────┤
│  FLOOR MAP (station grid)    │  STATION 4 · Omar L. · Job card JC-118    │
│ ┌────┐┌────┐┌────┐┌────┐     │  Task: Turn Ø25 h7 shaft, Ra 1.6          │
│ │ 1 ✓││ 2 ●││ 3 ●││ 4 ◉│     │ ─────────────────────────────────────────│
│ └────┘└────┘└────┘└────┘     │  PPE          [✓ Pass] [✗ Fail]   GATE    │
│ ┌────┐┌────┐┌────┐┌────┐     │  Machine setup [1][2][3][4]               │
│ │ 5 ⚠││ 6 ●││ 7 ○││ 8 ●│     │  Safe operation[1][2][3][4]       GATE    │
│ └────┘└────┘└────┘└────┘     │  Tolerance     Ø [24.98] mm  ±0.021 ✓     │
│                              │  Surface finish[1][2][3][4]               │
│  ✓ done ● working ⚠ alert    │  Housekeeping  [1][2][3][4]               │
│  ○ idle ◉ selected           │ ─────────────────────────────────────────│
│                              │  [📷 Evidence] [🎙 Note]   Score 86  PASS │
│  ⚠ Stn 5: guard open while   │  [ Sign off & next station  → ]           │
│    spindle running (RFID)    │                                           │
├──────────────────────────────┴───────────────────────────────────────────┤
│ Tools out: 3 · Consumables: Ø30 bar 4.2 m left (reorder 5 m) · Next: 10:30│
└──────────────────────────────────────────────────────────────────────────┘
```

Key interactions:

- **One-tap rubric rows.** Each criterion is a segmented control (1–4 or Pass/Fail); gate criteria are pinned to the top and marked `GATE`.
- **Tolerance capture:** numeric pad pre-filled with nominal and tolerance; the field turns green/red live (`withinTolerance` shared with the backend).
- **Evidence:** camera opens with an annotation layer (arrow, circle, measurement callout); photo is hashed and queued.
- **Live alerts** from V-Lab telemetry and machine RFID gateways slide in at the left; tapping one jumps to that station.
- **Station status tiles** use shape + colour so they read at arm's length.
- **Offline:** the header pill switches to `○ Offline · 7 queued`; nothing else changes.

---

## 2. Student 3D Lab Explorer

**Who / where:** Apprentice on a laptop, school tablet or VR headset, before or between workshop sessions.
**Job:** Understand a machine (explode, inspect, cut away, run), then practise a procedure or fault test.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Unit ELEC-L3-U04 · DOL Motor Starter        Guided ▸ Sandbox ▸ Exam     │  ← mode switcher
├───────────────────────────────────────────────────────┬──────────────────┤
│  3-Phase Induction Motor · IEC 132M    [X-ray][Cut][Run]│ COMPONENT 7     │
│                                                       │ DE bearing        │
│            ②③      ⑧                                  │ 6206-2Z/C3        │
│         ╭──╮  ╭────────╮                              │ 30×62×16 mm       │
│         │▒▒│④ │ stator │  ⑨    ⑦  ╭──╮               │ Induction-heat    │
│         ╰──╯  ╰────────╯ ═══════●══│  │⑤              │ to 110 °C         │
│                                    ╰──╯               │ ⚠ Heat gloves     │
│                                                       │ [Datasheet →]     │
│  [Assemble] ━━━━━━━━━━━━━━━━━━━━●━━  [Explode]  100% │ ① Terminal cover  │
│                                                       │ ② Fan cowl …      │
├───────────────────────────────────────────────────────┴──────────────────┤
│ Task 2/5 · Measure supply voltage at X1 L1–L2   🔧 Multimeter ▾  ⏱ 08:12 │  ← guided step / exam timer
└──────────────────────────────────────────────────────────────────────────┘
```

Key interactions (implemented in `web/src/components/MachineExplorer.tsx`):

- **Exploded-view slider** with staged disassembly order; Assemble/Explode buttons animate it.
- **Numbered hotspot pins** that travel with their part; tapping opens a spec card with safety notes and datasheet link. The part list mirrors the pins for keyboard/screen-reader use.
- **View modes:** X-ray, cross-section cutaway, kinetic run.
- **Telemetry:** every interaction emits an xAPI-shaped event (`exploded`, `hotspot_viewed`, `part_selected`, `view_mode_changed`).
- **Mode switcher:** Guided (step prompts + guardrails that *block* unsafe actions), Sandbox (free variables, crash/wear physics), Exam (no hints, timer, trainer-injected hidden faults; unsafe actions are *recorded* not blocked).
- **QR sync:** scanning the physical machine's QR opens this view on the matching digital twin.

---

## 3. Executive Analytics Dashboard

**Who / where:** Centre director and QA auditor at a desktop, weekly reviews and accreditation visits.
**Job:** See institutional health at a glance, spot bottlenecks and compliance gaps, export evidence for auditors.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ATS Cairo East ▾   Term 1 2026/27 ▾   All trades ▾          [Export IQA] │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│ Competency   │ Workshop     │ WBL hours    │ Safety       │ Employer     │
│ attainment   │ utilisation  │ on track     │ incidents    │ satisfaction │
│ 72% ▲4       │ 64% ▼2       │ 81%          │ 3 ▼1         │ 4.3/5        │
├──────────────┴──────────────┴──────────────┼──────────────┴──────────────┤
│ REGIONAL SKILL HEATMAP                     │ ASSET UTILISATION (30 d)    │
│            U01 U02 U03 U04 U05 U06         │ CNC-01  ████████████ 92% ⚠ │
│ Cairo      ███ ██▓ ██░ █▓░ ███ ██▓         │ CNC-02  ███████████  88%   │
│ Giza       ██▓ ██░ █░░ ██▓ ██▓ █▓░         │ Weld-03 ████         31%   │
│ Alex       ███ ███ ██▓ ██▓ ███ ██░         │ PLC-R1  ██████       47%   │
│ (% learners ≥ autonomous)                  │ → bottleneck: add CNC slot  │
├────────────────────────────────────────────┼─────────────────────────────┤
│ COMPLIANCE & IQA                           │ ITEM QUALITY (question bank) │
│ ⚠ 14 logbooks awaiting sign-off > 7 days   │ 1 240 items · 38 flagged     │
│ ⚠ 2 trainers' LOTO certification expiring  │ p < 0.2 or D < 0.2           │
│ ✓ Sampling plan 12/12 units verified       │ [Review flagged →]           │
└────────────────────────────────────────────┴─────────────────────────────┘
```

Key interactions:

- **KPI strip** with trend vs. last term; each tile drills into its own report.
- **Regional skill heatmap** (from `v_regional_skill_heatmap`), competency units × regions, cell = % learners at autonomous or above.
- **Asset utilisation** (from `v_asset_utilisation_30d`) flags >85% as a bottleneck and <35% as under-used capital.
- **Compliance queue** lists actionable gaps (overdue sign-offs, expiring certifications, missing evidence).
- **Item quality** surfaces psychometrically flagged questions (`question_psychometrics.flagged`).
- **Export IQA** produces an evidence pack per learner/unit: evaluations, telemetry summaries, signed logbook entries, all with hashes.
