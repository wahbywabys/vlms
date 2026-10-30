/**
 * Programmes admin, the machine register import, and offline machine scans,
 * against the full demo database.
 *   DATABASE_URL=postgres://postgres@localhost/vtc_lms_test npm test
 * Skipped when DATABASE_URL is not set.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { SignJWT } from 'jose';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { createPool, type Db } from '../src/lib/db.js';
import { createRealtime } from '../src/lib/redis.js';

const DB_URL = process.env.DATABASE_URL;
const SECRET = 'test-secret-test-secret-test-secret!!';
const INST = '00000000-0000-0000-0000-0000000000a1';
const dbFile = (f: string) => readFileSync(new URL(`../../db/${f}`, import.meta.url), 'utf8');

describe('programmes admin, machine register and offline scans', { skip: !DB_URL && 'DATABASE_URL not set' }, () => {
  let db: Db;
  let base: string;
  let close: () => Promise<void>;
  const ids: Record<string, string> = {};
  const token = (email: string, roles: string[]) =>
    new SignJWT({ inst: INST, roles }).setProtectedHeader({ alg: 'HS256' }).setSubject(ids[email]!).setExpirationTime('5m')
      .sign(new TextEncoder().encode(SECRET));
  const call = async (method: string, path: string, who: [string, string[]], body?: unknown) => {
    const res = await fetch(base + path, {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${await token(...who)}` },
    });
    return { status: res.status, body: await res.json() as any };
  };
  const DIRECTOR: [string, string[]] = ['director@vtc.example', ['director']];
  const TRAINER: [string, string[]] = ['trainer@vtc.example', ['vocational_trainer']];
  const learner = (email: string): [string, string[]] => [email, ['student']];

  before(async () => {
    db = createPool(DB_URL);
    await db.query('DROP SCHEMA IF EXISTS vtc CASCADE');
    const migrations = readdirSync(new URL('../../db/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of ['schema.sql', 'seed.sql', ...migrations.map((m) => `migrations/${m}`), 'demo.sql', 'demo_trades.sql', 'demo_modules.sql']) {
      await db.query(dbFile(f));
    }
    for (const r of (await db.query<{ id: string; email: string }>(`SELECT id, email::text FROM users`)).rows) ids[r.email] = r.id;
    const log = pino({ level: process.env.TEST_LOG ?? 'silent' });
    const realtime = createRealtime(process.env.REDIS_URL, log);
    const server = createApp({ db, realtime, log, jwtSecret: SECRET }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = async () => { server.closeAllConnections(); server.close(); await realtime.close(); };
  });
  after(async () => { await close(); await db.end(); });

  it('gives every demo workshop a centre and every demo machine a type', async () => {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM workshop_assets WHERE category = 'machine' AND machine_type_id IS NULL`);
    assert.equal(rows[0].n, 0);
    const ws = await db.query(`SELECT count(*)::int AS n FROM workshops WHERE center_id IS NULL`);
    assert.equal(ws.rows[0].n, 0);
  });

  it('adds a programme with its skill tree from import rows, and reports bad rows', async () => {
    const rows = [
      { programCode: 'PLMB', programName: 'Plumbing', programNameAr: 'السباكة' },
      { programCode: 'PLMB', competencyCode: 'PLMB-U01', level: 'Unit', title: 'Install water supply pipework', safetyCritical: 'No', hours: 40 },
      { programCode: 'PLMB', competencyCode: 'PLMB-U01-E1', level: 'element', parentCode: 'PLMB-U01', title: 'Cut and join copper pipe', titleAr: 'قطع ووصل المواسير النحاس' },
      { programCode: 'PLMB', competencyCode: 'PLMB-U01-E1-PC1', level: 'criterion', parentCode: 'PLMB-U01-E1', title: 'Uses the blowtorch safely', safetyCritical: 'Yes' },
      { programCode: 'PLMB', competencyCode: 'PLMB-U02-E1', level: 'element', parentCode: 'PLMB-U09', title: 'Orphan' },
      { programCode: 'PLMB', competencyCode: 'PLMB-X', level: 'criterion', parentCode: 'PLMB-U01', title: 'Wrong parent kind' },
    ];
    const dry = await call('POST', '/v1/admin/programs/import', DIRECTOR, { rows, dryRun: true });
    assert.equal(dry.status, 200);
    assert.equal(dry.body.errors, 2);
    assert.equal((await db.query(`SELECT 1 FROM trades WHERE id = 'plmb'`)).rows.length, 0, 'a dry run saves nothing');

    const out = await call('POST', '/v1/admin/programs/import', DIRECTOR, { rows });
    assert.equal(out.body.created, 4, JSON.stringify(out.body.results));
    assert.match(out.body.results[4].message, /PLMB-U09/);
    assert.match(out.body.results[5].message, /must be a element/);
    const list = await call('GET', '/v1/admin/programs', DIRECTOR);
    const plmb = list.body.programs.find((p: any) => p.id === 'plmb');
    assert.equal(plmb.nameAr, 'السباكة');
    assert.equal(plmb.competencies.length, 3);
    assert.equal(plmb.competencies.find((c: any) => c.code === 'PLMB-U01-E1-PC1').safetyCritical, true);

    // Re-importing updates in place instead of duplicating.
    const again = await call('POST', '/v1/admin/programs/import', DIRECTOR, { rows: rows.slice(0, 2) });
    assert.equal(again.body.updated, 2);
    assert.equal((await call('GET', '/v1/admin/programs', TRAINER)).status, 403);
  });

  it('registers real machines from the inventory template and maps each to a 3D twin', async () => {
    const rows = [
      { centerCode: 'ALX-01', centerName: 'VTC Alexandria', workshop: 'Turning shop', machineType: 'CNC lathe', brand: 'Emco', model: 'Concept Turn 250', serial: 'EM-2201', year: 2019 },
      { centerCode: 'ALX-01', centerName: 'VTC Alexandria', workshop: 'Turning shop', machineType: 'مخرطة يدوية', brand: 'Harrison', model: 'M300', serial: 'H-77', status: 'Maintenance' },
      { centerCode: 'ALX-01', workshop: 'Turning shop', machineType: 'Spaceship', brand: 'X', model: 'Y', serial: 'Z' },
      { centerCode: 'ALX-01', workshop: 'Turning shop', machineType: 'cnc_lathe', brand: 'Emco', model: 'Concept Turn 250', serial: '' },
    ];
    const out = await call('POST', '/v1/admin/machines/import', DIRECTOR, { rows });
    assert.equal(out.status, 200);
    assert.equal(out.body.created, 2, JSON.stringify(out.body.results));
    assert.equal(out.body.errors, 2);
    const [lathe, manual] = out.body.results;
    assert.equal(lathe.tag, 'ALX-01-CNCLAT-01');
    assert.equal(lathe.twin, 'cnc-lathe');
    assert.equal(lathe.twinMatch, 'exact');
    assert.equal(manual.twinMatch, 'similar');
    assert.match(lathe.qrCode, /^VTC-[0-9A-F]{10}$/);
    assert.match(out.body.results[2].message, /Unknown machine type/);

    const m = await db.query(`SELECT a.status::text, pc.code, w.trade_id, c.code AS center FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
      JOIN centers c ON c.id = w.center_id LEFT JOIN safety_prechecks pc ON pc.id = a.precheck_id WHERE a.serial_no = 'H-77'`);
    assert.deepEqual(m.rows[0], { status: 'maintenance', code: 'PC-CNC-LATHE', trade_id: 'cnc', center: 'ALX-01' });

    // The same serial again updates the machine and keeps its sticker.
    const again = await call('POST', '/v1/admin/machines/import', DIRECTOR, { rows: [{ ...rows[0], model: 'Concept Turn 260' }] });
    assert.equal(again.body.updated, 1);
    assert.equal(again.body.results[0].qrCode, lathe.qrCode);
    const centers = await call('GET', '/v1/admin/centers', DIRECTOR);
    assert.ok(centers.body.centers.some((c: any) => c.code === 'ALX-01' && c.workshops[0].machines === 2));

    // Scanning the new machine shows the real machine from the register.
    const scan = await call('GET', `/v1/safety/scan/${lathe.qrCode}`, learner('learner07@vtc.example'));
    assert.equal(scan.body.machine.brand, 'Emco');
    assert.equal(scan.body.machine.serial, 'EM-2201');
    assert.equal(scan.body.machine.twin.id, 'cnc-lathe');
  });

  it('serves an offline pack and confirms offline scans when the device reconnects', async () => {
    const me = learner('student@vtc.example');
    const pack = await call('GET', '/v1/safety/offline-pack', me);
    assert.equal(pack.status, 200);
    assert.equal(pack.body.people.length, 1, 'a learner gets only themselves');
    const l04 = pack.body.machines.find((m: any) => m.tag === 'CNC2-L04');
    assert.ok(l04.code);
    assert.ok(pack.body.people[0].passports.some((x: any) => x.tag === 'CNC2-L04'));
    const trainerPack = await call('GET', '/v1/safety/offline-pack', TRAINER);
    assert.ok(trainerPack.body.people.length > 5);

    // student@ holds a passport for CNC2-L04 in the demo data: an offline "allowed" is confirmed.
    const ok = await call('POST', '/v1/sync', me, { mutations: [{ type: 'machine_scan', payload: {
      clientMutationId: randomUUID(), code: l04.code, scannedAt: new Date().toISOString(), offlineAllowed: true } }] });
    assert.equal(ok.body.results[0].status, 'applied', JSON.stringify(ok.body));
    assert.equal(ok.body.results[0].result.confirmed, true, JSON.stringify(ok.body.results[0].result));

    // A machine the learner has no passport for: offline said allowed, server says not → alert.
    const other = pack.body.machines.find((m: any) => m.tag === 'CNC2-L03');
    const id = randomUUID();
    const bad = await call('POST', '/v1/sync', me, { mutations: [{ type: 'machine_scan', payload: {
      clientMutationId: id, code: other.code, scannedAt: new Date().toISOString(), offlineAllowed: true } }] });
    assert.equal(bad.body.results[0].result.confirmed, false);
    assert.ok(bad.body.results[0].result.reasons.includes('no_passport'));
    const alert = await db.query(`SELECT detail FROM safety_alerts WHERE criterion_key = 'offline_scan' AND learner_id = $1`, [ids['student@vtc.example']]);
    assert.match(alert.rows[0].detail, /CNC2-L03/);
    const replay = await call('POST', '/v1/sync', me, { mutations: [{ type: 'machine_scan', payload: {
      clientMutationId: id, code: other.code, scannedAt: new Date().toISOString(), offlineAllowed: true } }] });
    assert.equal(replay.body.results[0].status, 'duplicate');

    // Learners cannot record scans for someone else.
    const forOther = await call('POST', '/v1/sync', me, { mutations: [{ type: 'machine_scan', payload: {
      clientMutationId: randomUUID(), code: other.code, learnerId: ids['learner11@vtc.example'], scannedAt: new Date().toISOString(), offlineAllowed: false } }] });
    assert.equal(forOther.body.results[0].status, 'rejected');
  });
});
