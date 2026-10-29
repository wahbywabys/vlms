# Deploy VTC_LMS on Railway

This guide sets up VTC_LMS on [Railway](https://railway.com) with four services in one project.

| Service | What it is | Public? |
|---|---|---|
| **app** | The Next.js web app people sign in to (`app/`) | Yes, this is the link you share |
| **api** | The VTC_LMS API (`api/`). It updates the database schema before every deploy. | No, the app reaches it over Railway's private network |
| **Postgres** | The system of record | No |
| **Redis** | Optional live updates channel | No |

Both code services build from this repository with the Dockerfiles in `app/` and `api/`. Their settings are kept in the repo as `app/railway.json` and `api/railway.json`, so a push to `main` redeploys only the service whose files changed.

You need a Railway account on a plan that can run four services (the Hobby plan is enough). You also need the GitHub repository `wahbywabys/vlms` connected to Railway.

## 1. Create the project and the database

1. In Railway, click **New Project**, choose **Deploy from GitHub repo**, and pick `wahbywabys/vlms`. Railway creates one service. You will turn it into the API in step 3.
2. In the project, click **+ Create**, choose **Database**, then **PostgreSQL**.
3. Click **+ Create** again, choose **Database**, then **Redis**. You can skip Redis; the app works without it.

## 2. Create the two secrets

The app and the API share two secrets, and each must be at least 32 characters long. Generate them on your computer:

```bash
openssl rand -hex 32   # use the output as SESSION_SECRET
openssl rand -hex 32   # use the output as JWT_SECRET
```

In the project, open **Settings**, then **Shared Variables**, and add both:

| Name | Value |
|---|---|
| `SESSION_SECRET` | the first value (signs the browser sign-in cookie) |
| `JWT_SECRET` | the second value (signs the short-lived tokens the app sends to the API) |

Keep these values private. If one leaks, replace it here and redeploy both services. Everyone will have to sign in again.

## 3. Set up the API service

Open the service Railway created from GitHub.

1. Under **Settings**, rename it to `api`. The app finds the API by this name, so spell it exactly.
2. Under **Settings**, find **Config-as-code** and set the Railway config file to `/api/railway.json`. Leave **Root Directory** empty, because the build needs the `db/` folder as well as `api/`.
3. Under **Variables**, add:

| Name | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (leave out if you skipped Redis) |
| `JWT_SECRET` | `${{shared.JWT_SECRET}}` |
| `PORT` | `4000` |
| `SEED_DEMO` | `true` to load the demo centre and the five demo accounts, or `false` for an empty system |

Do not give the API a public domain. Only the app needs to reach it.

## 4. Add the app service

1. In the project, click **+ Create**, choose **GitHub Repo**, and pick `wahbywabys/vlms` again.
2. Under **Settings**, rename it to `app` and set the Railway config file to `/app/railway.json`. Leave **Root Directory** empty.
3. Under **Variables**, add:

| Name | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `SESSION_SECRET` | `${{shared.SESSION_SECRET}}` |
| `JWT_SECRET` | `${{shared.JWT_SECRET}}` |
| `API_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |

4. Under **Settings**, then **Networking**, click **Generate Domain**. This creates the public address, something like `vtc-lms-app.up.railway.app`. You can add your own domain here later.

## 5. Deploy and check

1. Click **Deploy** (or press the deploy button Railway shows for staged changes). Railway builds both services.
2. Open the **api** service, then the latest deployment's logs. The pre-deploy step should print:

   ```
   applied schema.sql
   applied seed.sql
   applied migrations/001_trades.sql
   applied demo.sql
   applied demo_trades.sql
   VTC_LMS database up to date (5 applied).
   ```

   The API is healthy when `/healthz` answers. Railway waits for that before switching traffic.
3. Open the app's domain. You should see the sign-in page with the WABYS and VTC_LMS logos.
4. With `SEED_DEMO=true`, sign in with any demo account. The password for all of them is `demo1234`.

| Email | Role |
|---|---|
| student@vtc.example | Student (CNC machining) |
| student.auto@vtc.example | Student (automotive) |
| student.elec@vtc.example | Student (electrical) |
| student.weld@vtc.example | Student (welding) |
| trainer@vtc.example | Vocational trainer |
| teacher@vtc.example | Academic teacher |
| supervisor@vtc.example | Workplace supervisor |
| director@vtc.example | Director |

The demo password is public, because it is written in this repository and shown on the sign-in page. Treat a demo deployment as a showcase only, and do not put real learner data in it.

## How the database is kept up to date

Before each API deploy, Railway runs `npx tsx src/migrate.ts` (`npm run migrate` in `api/`). It applies, once each and in this order:

1. `db/schema.sql` and `db/seed.sql` (the base schema and reference data)
2. every file in `db/migrations/` in name order, for example `db/migrations/001_trades.sql`
3. `db/demo.sql` and then `db/demo_trades.sql` (the automotive, electrical and welding cohorts), only when `SEED_DEMO=true`

Each file runs in a transaction and is recorded in the table `public.vtc_migrations`. If a file fails, the deploy stops and the running version stays live. To change the schema later, add a new numbered file to `db/migrations/` and push. Do not edit `schema.sql` after the first deploy, because that file is never run again.

To load the demo data into a deployment that started without it, set `SEED_DEMO=true` on the API and redeploy.

## Run the same containers on your computer

```bash
docker build -f api/Dockerfile -t vtc-api .
docker build -f app/Dockerfile -t vtc-app .
```

Both builds run from the repository root. For day-to-day development, use `scripts/dev.sh` as described in the README.

## Before real learners use it

- Set `SEED_DEMO=false` before the first deploy, or start a fresh Postgres, so the public demo accounts never exist.
- There is no screen yet for creating users. Add the first accounts with SQL. In Railway, open the Postgres service's **Data** tab or run `railway connect Postgres`. Passwords are stored as bcrypt hashes: `crypt('the-password', gen_salt('bf', 10))`.
- Turn on Railway's Postgres backups for the database.
