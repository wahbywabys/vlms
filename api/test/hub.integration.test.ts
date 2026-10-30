/**
 * Centre → cloud hub sync, end to end: a centre server with the demo data
 * uploads to a hub (same Postgres, schema `hub`), a phone relays a check-in
 * through the hub while "away", and a dashboard reads the export API.
 *   DATABASE_URL=postgres://postgres@localhost/vtc_lms_test npm test
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { pino } from 'pino';
import { createHubApp } from '../src/hub/app.js';
import { createOutbound } from '../src/hub/outbound.js';
import { createPool, type Db } from '../src/lib/db.js';
import { signRelayToken } from '../src/lib/relayToken.js';
import { runUplink, type UplinkConfig } from '../src/services/uplink.js';

const DB_URL = process.env.DATABASE_URL;
const INST = '00000000-0000-0000-0000-0000000000a1';
const ADMIN = 'test-admin-key-test-admin-key', EXPORT = 'test-export-key-test-export-key';
const dbFile = (f: string) => readFileSync(new URL(`../../db/${f}`, import.meta.url), 'utf8');

describe('centre uplink and cloud hub', { skip: !DB_URL && 'DATABASE_URL not set' }, () => {
  let db: Db, hubDb: Db, hub: string, close: () => void, cfg: UplinkConfig;
  const hooks: { event: string; body: string; sig: string | null }[] = [];

  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(hub + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json: any = text;
    try { json = JSON.parse(text); } catch { /* csv */ }
    return { status: res.status, body: json, text, headers: res.headers };
  };
  const exp = { authorization: `Bearer ${EXPORT}` };

  before(async () => {
    db = createPool(DB_URL);
    await db.query('DROP SCHEMA IF EXISTS vtc CASCADE');
    await db.query('DROP SCHEMA IF EXISTS hub CASCADE');
    const migrations = readdirSync(new URL('../../db/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
    for (const f of ['schema.sql', 'seed.sql', ...migrations.map((m) => `migrations/${m}`), 'demo.sql', 'demo_trades.sql', 'demo_modules.sql']) {
      await db.query(dbFile(f));
    }
    hubDb = createPool(DB_URL, 'hub,public');
    await hubDb.query(dbFile('hub.sql'));
    const log = pino({ level: process.env.TEST_LOG ?? 'silent' });
    // A webhook receiver standing in for a dashboard.
    const { createServer } = await import('node:http');
    const sink = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c)).on('end', () => { hooks.push({ event: String(req.headers['x-vtc-event']), body, sig: (req.headers['x-vtc-signature'] as string) ?? null }); res.end('ok'); });
    }).listen(0);
    await new Promise((r) => sink.once('listening', r));
    const outbound = createOutbound({ webhookUrls: [`http://127.0.0.1:${(sink.address() as AddressInfo).port}/hook`], webhookSecret: 'whsec' }, log);
    const server = createHubApp({ db: hubDb, log, adminKey: ADMIN, exportKey: EXPORT, outbound }).listen(0);
    await new Promise((r) => server.once('listening', r));
    hub = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => { server.closeAllConnections(); server.close(); sink.close(); };
  });
  after(async () => { close(); await db.end(); await hubDb.end(); });

  it('registers a centre only with the admin key', async () => {
    assert.equal((await call('POST', '/hub/v1/admin/centers', { id: 'cairo-east', name: 'Cairo East' })).status, 401);
    const r = await call('POST', '/hub/v1/admin/centers', { id: 'cairo-east', name: 'Cairo East' }, { authorization: `Bearer ${ADMIN}` });
    assert.equal(r.status, 201);
    assert.match(r.body.centerKey, /^vtc_ck_[0-9a-f]{48}$/);
    assert.equal((await call('POST', '/hub/v1/admin/centers', { id: 'cairo-east', name: 'x' }, { authorization: `Bearer ${ADMIN}` })).status, 409);
    cfg = { hubUrl: hub, centerId: 'cairo-east', centerKey: r.body.centerKey, batch: 100 };
  });

  it('uploads records, numbers and roster, and sends each record once', async () => {
    const first = await runUplink(db, cfg);
    assert.ok(first.sent > 100, `sent ${first.sent}`);
    const stored = (await hubDb.query<{ n: number }>('SELECT count(*)::int AS n FROM statements')).rows[0]!.n;
    assert.ok(stored > 100 && stored <= first.sent);
    const again = await runUplink(db, cfg);
    assert.ok(again.sent < 5, 'only the inclusive cursor row is resent');
    assert.equal((await hubDb.query<{ n: number }>('SELECT count(*)::int AS n FROM statements')).rows[0]!.n, stored);
    const st = await db.query('SELECT last_success_at, last_error FROM center_uplink');
    assert.ok(st.rows[0].last_success_at);
    assert.equal(st.rows[0].last_error, null);
  });

  it('serves the export API to a dashboard with the export key', async () => {
    assert.equal((await call('GET', '/hub/v1/export/kpis')).status, 401);
    const kpis = await call('GET', '/hub/v1/export/kpis?latest=true', undefined, exp);
    assert.equal(kpis.status, 200);
    assert.equal(kpis.body.count, 1);
    assert.equal(kpis.body.data[0].center_id, 'cairo-east');
    assert.equal(kpis.body.data[0].learners, 38);
    const trades = await call('GET', '/hub/v1/export/trades', undefined, exp);
    assert.deepEqual(trades.body.data.map((t: { trade: string }) => t.trade), ['auto', 'cnc', 'elec', 'weld']);
    const csv = await call('GET', `/hub/v1/export/learners?format=csv&key=${EXPORT}`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type')!, /text\/csv/);
    assert.ok(csv.text.replace(/^\uFEFF/, '').startsWith('center_id,learner_id,'));   // fetch's text() drops the BOM that Excel needs
    assert.equal(csv.text.trim().split('\r\n').length, 39);
    const act = await call('GET', '/hub/v1/export/activity?limit=5', undefined, exp);
    assert.equal(act.body.count, 5);
    assert.ok(['vlab', 'observation', 'ojt', 'precheck'].includes(act.body.data[0].kind));
    const x = await call('GET', '/hub/v1/xapi/statements?limit=10', undefined, exp);
    assert.equal(x.headers.get('x-experience-api-version'), '1.0.3');
    assert.equal(x.body.statements.length, 10);
    assert.match(x.body.more, /since=/);
    const centers = await call('GET', '/hub/v1/export/centers', undefined, exp);
    assert.equal(centers.body.data[0].learners, 38);
    assert.equal((await call('GET', '/hub/v1/openapi.json')).body.openapi, '3.1.0');
  });

  it('signs webhooks for each upload', async () => {
    await new Promise((r) => setTimeout(r, 200));
    const snap = hooks.find((h) => h.event === 'center.snapshot');
    assert.ok(snap, 'snapshot webhook delivered');
    const { createHmac } = await import('node:crypto');
    assert.equal(snap.sig, `sha256=${createHmac('sha256', 'whsec').update(snap.body).digest('hex')}`);
    assert.ok(hooks.some((h) => h.event === 'statements.created'));
  });

  it('relays a check-in from a phone away from the centre and applies it once', async () => {
    const { rows: [u] } = await db.query<{ id: string }>(`SELECT id FROM users WHERE email = 'student.auto@vtc.example'`);
    const token = await signRelayToken(cfg.centerKey, cfg.centerId, { userId: u!.id, institutionId: INST, roles: ['student'] });
    const id = randomUUID();
    const mutation = { type: 'checkin', payload: { clientMutationId: id, kind: 'in', latitude: 30.0565, longitude: 31.33, accuracyM: 10,
      deviceTime: new Date(Date.now() - 3600_000).toISOString() } };
    const forged = await signRelayToken('some-other-key', cfg.centerId, { userId: u!.id, institutionId: INST, roles: ['student'] });
    assert.equal((await call('POST', '/hub/v1/relay', { centerId: cfg.centerId, mutations: [mutation] }, { authorization: `Bearer ${forged}` })).status, 401);
    const pre = await call('OPTIONS', '/hub/v1/relay', undefined, { origin: 'http://192.168.1.20' });
    assert.equal(pre.headers.get('access-control-allow-origin'), '*');
    const r = await call('POST', '/hub/v1/relay', { centerId: cfg.centerId, mutations: [mutation] }, { authorization: `Bearer ${token}` });
    assert.equal(r.status, 202);

    const run = await runUplink(db, cfg);
    assert.equal(run.relayed, 1);
    const c = await db.query('SELECT inside_geofence FROM wbl_checkins WHERE client_mutation_id = $1', [id]);
    assert.equal(c.rowCount, 1);
    const applied = await db.query(`SELECT results FROM center_relay_applied`);
    assert.equal(applied.rows[0].results[0].status, 'applied');
    assert.equal((await hubDb.query('SELECT 1 FROM relay WHERE delivered_at IS NULL')).rowCount, 0);
    assert.equal((await runUplink(db, cfg)).relayed, 0);
    // The check-in, stored today with a device time an hour ago, still reaches the hub.
    const act = await hubDb.query(`SELECT 1 FROM statements WHERE kind = 'ojt' AND statement->'context'->'extensions' ? $1 AND received_at > now() - interval '1 minute'`,
      [`${process.env.XAPI_BASE_IRI ?? 'https://vtc-lms.example/xapi'}/ext/ref`]);
    assert.ok(act.rowCount! >= 1);
  });

  it('records the error and keeps working offline when the hub is unreachable', async () => {
    await assert.rejects(runUplink(db, { ...cfg, hubUrl: 'http://127.0.0.1:9' }));
    const st = await db.query('SELECT last_error FROM center_uplink');
    assert.match(st.rows[0].last_error, /fetch failed|ECONNREFUSED/);
    await assert.rejects(runUplink(db, { ...cfg, centerKey: 'wrong' }), /401/);
  });
});
