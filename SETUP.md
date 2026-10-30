# VTC_LMS for a training centre: setup guide

One computer in the centre is the **VTC_LMS server**. Every phone, tablet, laptop and PC joins the centre Wi-Fi and opens the server's address in a browser. Trainees, trainers, teachers, supervisors and managers all use the same address with their own accounts. No internet is needed. The trainer sees trainees live, and the manager sees the centre dashboard, on the local network.

When the server has internet, it uploads everything to **your online hub**. The hub runs on your own server, next to your quality system, and your dashboard (Wisdom, Power BI, Excel, Grafana or your quality system) reads it through an API.

```
 phones / tablets / laptops ──Wi-Fi──▶  CENTRE SERVER (one PC)  ──internet, when available──▶  YOUR HUB (your server)  ──API──▶  dashboard
   (browser, no app store)             app + database, works offline                          central database             Wisdom / BI / quality system
```

**What "the centre Wi-Fi" means.** It is any ordinary Wi-Fi router in the centre. Devices only need to be connected to the same router as the server, so they can reach each other. The router does not need internet. If it does have internet, the server uses it to sync. Nothing else changes.

---

## Try it at home first (one laptop + any router, no internet)

A home router works exactly like the centre's, even with no SIM card or internet line: it still creates a Wi-Fi network that your devices share. The laptop plays the server.

1. **While you still have internet** (any connection, once): install Docker Desktop (step A2) and run `Install VTC_LMS (demo).cmd` from the package. This downloads everything and starts the server. If you are using the offline package, you don't need internet for this step.
2. **Switch to the home router.** Connect the laptop and your phone to the router's Wi-Fi. Windows will show "No internet". That is fine. Run `Install VTC_LMS (demo).cmd` again. It finds the laptop's new address (for example `http://192.168.8.100`), opens the firewall, sets the network to *Private*, and opens the join page.
3. **On the phone** (on the same Wi-Fi, with mobile data turned off so you are sure it uses the router), scan the QR code on the laptop screen. Sign in as `student@vtc.example`. On a second phone or a browser tab, sign in as `trainer@vtc.example`, and on the laptop as `director@vtc.example`. All passwords are `demo1234`. What the student does appears on the trainer's floor screen and the manager's dashboard.
4. **Later, give the router or laptop internet.** If you have set up the hub (part C), the join page turns to *Synced* within a minute, and the data appears on your online server.

---

## A. Install the centre server (about 15 minutes, once)

**You need:** a PC that stays on during training hours, with Windows 10/11 (64-bit, 8 GB RAM) or Linux (Ubuntu 22.04+). Connect it to the centre router with a cable if you can.

1. **Fix the server's address.** In the router's admin page, open *DHCP reservation* (sometimes called *Static lease*) and reserve the server PC's current IP address, for example `192.168.1.10`. This way the address on your posters never changes.
2. **Install Docker.**
   - Windows: install [Docker Desktop](https://www.docker.com/products/docker-desktop/), restart, open it once, and turn on *Settings → General → Start Docker Desktop when you sign in*.
   - Linux: run `curl -fsSL https://get.docker.com | sh`.
3. **Copy the VTC_LMS package** to the PC and unzip it. Use `vtc-lms-center-offline-<version>.zip` if the PC has no internet at all; it already contains everything.
4. **Run the installer.**
   - Windows: double-click **`Install VTC_LMS.cmd`** and click *Yes* on the admin prompt. To try it with sample data first, use `Install VTC_LMS (demo).cmd` instead.
   - Linux/macOS: `./install.sh`, or `./install.sh --demo` for sample data.

   The installer creates the secrets, finds the PC's address, opens the firewall, starts the server and opens the **join page** (`http://<server-ip>/join`).
5. **Create the real accounts.** Run these in the package folder. Use `--role` with `student`, `vocational_trainer`, `academic_teacher`, `industry_supervisor` or `director`, and add `--cohort "<cohort name>"` for trainees.
   ```
   docker compose exec api npx tsx src/add-user.ts --email manager@centre.org --name "Centre Manager" --role director --password "ChangeMe-2026"
   ```
   The demo install already has accounts such as `director@vtc.example`, `trainer@vtc.example` and `student@vtc.example`, all with the password `demo1234`.

## B. Connect the devices (1 minute per device)

1. Connect the device to the **centre Wi-Fi**.
2. Scan the QR code on the join page with the camera, or type the address, for example `http://192.168.1.10`. To print the page for the workshop wall, click *Print this page*.
3. Sign in.
4. Add it to the home screen:
   - **Android (Chrome):** ⋮ → *Add to Home screen*.
   - **iPhone/iPad (Safari):** Share → *Add to Home Screen*.
   - **Windows/Mac (Chrome/Edge):** the install icon in the address bar.

**Optional "full app" mode** is for apprentices who also use the app away from the centre, and for a true installed app. It needs the secure address:

1. In the server's `.env`, set `CENTER_HTTPS_URL=https://192.168.1.10` (use your server's address) and run `docker compose up -d`.
2. On each device, open the join page, tap **Download certificate**, and install it once:
   - **Android:** Settings → Security → *Install a certificate* → *CA certificate*.
   - **iPhone:** Settings → *Profile Downloaded* → Install, then Settings → General → About → *Certificate Trust Settings* → turn it on.
   - **Windows:** double-click the file → *Install Certificate* → *Local Machine* → *Trusted Root Certification Authorities*.
3. From then on, use `https://<server-ip>`.

**Without internet:** everything works, including the live trainer floor, the manager dashboard, quizzes, V-Labs and logbooks. If a device loses Wi-Fi for a moment, its records wait on the device and are sent when it reconnects.

## C. Sync to your own online server (the hub)

The hub is a small service with its own Postgres database. Run it on your server with Docker (Linux) or with Node 22 + PostgreSQL.

1. **Install the hub** on your server. Copy the `hub/` folder (or `vtc-lms-hub-<version>.zip`) and run:
   ```
   ./install.sh hub.your-domain.org      # gets a free HTTPS certificate; point that DNS name at the server first
   # or ./install.sh                     # serves http://127.0.0.1:4100 for your existing nginx/IIS/Apache to proxy
   ```
   It prints `HUB_ADMIN_KEY` and `HUB_EXPORT_KEY`. Keep both private.
   *Without Docker:* `cd api && npm ci`, then
   `DATABASE_URL=postgres://… HUB_ADMIN_KEY=… HUB_EXPORT_KEY=… PORT=4100 npm run hub`,
   and proxy `https://hub.your-domain.org` to `http://127.0.0.1:4100`.
2. **Register each centre** once. Choose a short id for it:
   ```
   curl -X POST https://hub.your-domain.org/hub/v1/admin/centers \
     -H "Authorization: Bearer <HUB_ADMIN_KEY>" -H "Content-Type: application/json" \
     -d '{"id":"cairo-east","name":"VTC Cairo East"}'
   ```
   The answer contains `centerKey`. It is shown only once.
3. **Connect the centre server.** In the centre's `.env`, set:
   ```
   CLOUD_HUB_URL=https://hub.your-domain.org
   CENTER_ID=cairo-east
   CENTER_KEY=<centerKey>
   ```
   Then run `docker compose up -d` (on Windows, run the installer again).

From now on, every minute that the centre server has internet, it does three things:
- It uploads the new learning records: V-Lab work, workshop-floor rubric scores, OJT check-ins and machine safety pre-checks.
- It uploads the centre's headline numbers and the learner roster with each learner's risk band.
- It picks up records that phones sent to the hub while they were away from the centre.

Nothing is lost while it is offline; it catches up when the internet returns. The join page shows *Synced* with the last upload time.

**Phones away from the centre** (for example, apprentices at an employer site with mobile data) send their check-ins and logbook entries straight to the hub. The centre applies them on its next sync. Photos wait until the phone is back on the centre Wi-Fi.

## D. Link your dashboard (Wisdom or any API-linked tool)

Base URL: `https://hub.your-domain.org/hub/v1`. Authenticate with `Authorization: Bearer <HUB_EXPORT_KEY>`. Tools that can only paste a URL can add `?key=<HUB_EXPORT_KEY>` instead. Every table is JSON by default, or CSV with `&format=csv`, which works in Excel, Power BI and Google Sheets with Arabic names intact.

| Endpoint | What you get |
|---|---|
| `/export/centers` | Each centre, when it last synced, learners, records, items waiting |
| `/export/kpis?latest=true` | Per centre: learners, staff, active learners (7 d), V-Lab sessions and pass rate, workshop floor average, open safety alerts, OJT check-ins, risk low/watch/high. Leave out `latest` for history (`since`, `until`). |
| `/export/trades` | The same per trade (CNC, automotive, electrical, welding…) |
| `/export/learners` | Roster: name (EN/AR), cohort, trade, risk band, last activity |
| `/export/activity?since=…` | Every learning record, one row each (learner, activity, verb, score, pass/fail, time) |
| `/xapi/statements` | The same as xAPI 1.0.3 statements, for a Learning Record Store |
| `/openapi.json` | Machine-readable API description (no key needed). Many tools import it directly. |

Example: `https://hub.your-domain.org/hub/v1/export/kpis?latest=true&format=csv&key=<HUB_EXPORT_KEY>`

**Push instead of pull:** in the hub's `.env`, set `HUB_WEBHOOK_URLS=https://your-quality-system/endpoint`. The hub then POSTs `{event, centerId, sentAt, data}` on every upload, with the events `statements.created` and `center.snapshot`. Each POST is signed with the header `X-VTC-Signature: sha256=<HMAC-SHA256 of the body with HUB_WEBHOOK_SECRET>`. To copy every record to an LRS, set `HUB_LRS_ENDPOINT`, `HUB_LRS_USERNAME` and `HUB_LRS_PASSWORD`. Then run `docker compose up -d`.

## E. Day to day

Run these in the package folder on the server.

| Task | Command |
|---|---|
| Stop / start | `docker compose stop` / `docker compose start` (it also starts by itself with the PC) |
| Update to a new version | Unzip the new package over the old folder (your `.env` stays), then run the installer again |
| Back up the data | `./backup.sh` (Windows: `powershell -File backup.ps1`). Copy `backups/` somewhere safe each week. |
| See what's wrong | `docker compose ps` and `docker compose logs --tail 50 app api` |

| Problem | Fix |
|---|---|
| A phone can't open the address | Is it on the centre Wi-Fi (not mobile data)? On Windows, run the installer again; it opens the firewall and sets the network to *Private*. Some routers have *AP/client isolation*; turn it off. |
| The address changed | Reserve it in the router (step A1), then run the installer again; it updates the address. |
| Sign-in fails over `http://` | Leave `COOKIE_SECURE` unset; it is only for special proxy setups. |
| The join page says "Waiting for internet" | Check the internet on the server and that `CLOUD_HUB_URL` opens in a browser on the server. The error is shown under the status. |
| Docker images can't be downloaded | Use the offline package, or make the `vtc-lms-api` and `vtc-lms-app` packages public on GitHub (Packages → Package settings → Change visibility). |
