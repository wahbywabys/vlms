# Programmes, the machine register and QR stickers

## Programmes and skills (Director → Programmes & skills)
A programme is a row in `trades`; its skills are the competency tree (unit → element → criterion) of the
programme's framework, made on first use as `<CODE>-PROG`. Add them one by one or import
`app/public/templates/programmes-template.xlsx` (API: `/v1/admin/programs*`, `api/src/routes/admin.ts`).
A new programme appears in every trade picker; its 3D studio, lessons and V-Lab stay empty until content is added.

## The machine register (Director → Machine register)
Each centre (`centers`) fills `machine-inventory-template.xlsx`: one row per real machine with centre, workshop,
machine type, brand, model, serial number and photo file name. The import creates centres and workshops as needed,
gives each machine an asset tag and a random QR code, and links it to a `machine_types` row, which names its 3D twin
(`model_id`, `exact` or closest `similar`). Re-importing matches machines by asset tag, else serial number, and keeps
their sticker. Photos are uploaded through `/v1/media` and shown when the machine is scanned.

Rebuild the templates after changing machine types: `python3 scripts/make-templates.py`.

## QR stickers and scanning
Stickers (Trainer → Machines → QR stickers, or the register) are filtered by centre and workshop. The QR holds only the
machine code (`VTC-…`), never a URL, so the same sticker works against the centre's local server, the cloud, or offline.
It is read by the scanner inside the app (BarcodeDetector, or jsQR on iPhone/Firefox).

- Learner scan: the existing safety pre-check flow (`/v1/safety/scan/:code`), now showing the real machine and its twin.
- Trainer scan: everyone in the trainer's cohorts with Allowed / Needs pre-check / Not allowed for that machine.

## Offline
`GET /v1/safety/offline-pack` gives the device the machines plus, for each person it may check, their gating skills and
valid safety passports (valid 12 h). With no server, the device decides from it (`components/modules/offlinePack.ts`),
shows "not yet confirmed", and queues a `machine_scan` in the outbox. On reconnect `/v1/sync` re-checks it against the
server (`offline_machine_scans`); if offline said allowed and the server says not, a safety alert goes to the trainer.
Offline, "allowed" needs a passport that was already valid: the pre-check quiz is only graded by the server.
