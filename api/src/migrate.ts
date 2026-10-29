/**
 * Brings the database schema up to date. Railway runs this before every API
 * deploy (preDeployCommand); locally run `npm run migrate`.
 *
 *   db/schema.sql, db/seed.sql   the base schema and reference data (applied once)
 *   db/migrations/NNN_*.sql      later changes, applied once each in name order
 *   db/demo.sql                  demo institution and accounts, only with --demo
 *                                or SEED_DEMO=true, and only once
 *   db/demo_trades.sql           demo cohorts for automotive, electrical and
 *                                welding (after demo.sql, same rule)
 *   db/demo_modules.sql          demo data for the workshop, OJT and assessment
 *                                modules (after demo_trades.sql, same rule)
 *
 * Applied files are recorded in public.vtc_migrations. A database built earlier
 * with db/reset.sh (schema present, no record) is adopted as already migrated.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';

const dbDir = resolve(process.env.DB_DIR ?? join(import.meta.dirname, '../../db'));
const withDemo = process.argv.includes('--demo') || process.env.SEED_DEMO === 'true';

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // One migrator at a time, even if two deploys overlap.
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['vtc_migrations']);
    await client.query(`CREATE TABLE IF NOT EXISTS public.vtc_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);

    const applied = new Set((await client.query<{ name: string }>('SELECT name FROM public.vtc_migrations')).rows.map((r) => r.name));
    if (applied.size === 0) await adoptExisting(client, applied);

    const extra = (await readdir(join(dbDir, 'migrations')).catch(() => [] as string[]))
      .filter((f) => f.endsWith('.sql')).sort().map((f) => `migrations/${f}`);
    const plan = ['schema.sql', 'seed.sql', ...extra, ...(withDemo ? ['demo.sql', 'demo_trades.sql', 'demo_modules.sql'] : [])];

    let ran = 0;
    for (const name of plan) {
      if (applied.has(name)) continue;
      const sql = await readFile(join(dbDir, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO public.vtc_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${name} failed: ${(err as Error).message}`);
      }
      console.log(`applied ${name}`);
      ran++;
    }
    console.log(ran ? `VTC_LMS database up to date (${ran} applied).` : 'VTC_LMS database already up to date.');
  } finally {
    await client.end();
  }
}

/** A schema built by db/reset.sh has no record; mark what it contains as applied. */
async function adoptExisting(client: pg.Client, applied: Set<string>) {
  const { rows } = await client.query<{ has_schema: boolean; has_demo: boolean; has_trades: boolean; has_trade_demo: boolean; has_modules: boolean; has_module_demo: boolean }>(
    `SELECT to_regclass('vtc.users') IS NOT NULL AS has_schema,
            to_regclass('vtc.users') IS NOT NULL AND EXISTS (SELECT 1 FROM vtc.users WHERE email = 'director@vtc.example') AS has_demo,
            to_regclass('vtc.trades') IS NOT NULL AS has_trades,
            to_regclass('vtc.users') IS NOT NULL AND EXISTS (SELECT 1 FROM vtc.users WHERE email = 'trainer.weld@vtc.example') AS has_trade_demo,
            to_regclass('vtc.machine_locks') IS NOT NULL AS has_modules,
            to_regclass('vtc.safety_prechecks') IS NOT NULL AND EXISTS (SELECT 1 FROM vtc.safety_prechecks) AS has_module_demo`)
    .catch(() => ({ rows: [{ has_schema: false, has_demo: false, has_trades: false, has_trade_demo: false, has_modules: false, has_module_demo: false }] }));
  const found = rows[0]!;
  if (!found.has_schema) return;
  const names = ['schema.sql', 'seed.sql', ...(found.has_trades ? ['migrations/001_trades.sql'] : []),
    ...(found.has_modules ? ['migrations/002_workshop_wbl_assessment.sql'] : []),
    ...(found.has_demo ? ['demo.sql'] : []), ...(found.has_trade_demo ? ['demo_trades.sql'] : []),
    ...(found.has_module_demo ? ['demo_modules.sql'] : [])];
  for (const n of names) {
    await client.query('INSERT INTO public.vtc_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [n]);
    applied.add(n);
  }
  console.log(`adopted existing schema (${names.join(', ')})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
