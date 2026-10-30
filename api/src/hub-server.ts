/**
 * Starts the VTC_LMS cloud hub (src/hub/app.ts). Applies db/hub.sql first; it
 * is idempotent. Needs DATABASE_URL, HUB_ADMIN_KEY and HUB_EXPORT_KEY.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pino } from 'pino';
import { createHubApp } from './hub/app.js';
import { createOutbound, outboundFromEnv } from './hub/outbound.js';
import { createPool } from './lib/db.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const need = (name: string) => {
  const v = process.env[name];
  if (!v || v.length < 24) throw new Error(`${name} must be set (>= 24 chars)`);
  return v;
};
const adminKey = need('HUB_ADMIN_KEY'), exportKey = need('HUB_EXPORT_KEY');
const db = createPool(process.env.DATABASE_URL, 'hub,public');
const dbDir = resolve(process.env.DB_DIR ?? join(import.meta.dirname, '../../db'));
await db.query(await readFile(join(dbDir, 'hub.sql'), 'utf8'));

const port = Number(process.env.PORT ?? 4100);
createHubApp({ db, log, adminKey, exportKey, outbound: createOutbound(outboundFromEnv(), log) })
  .listen(port, () => log.info({ port }, 'VTC_LMS cloud hub listening'));
