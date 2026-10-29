/**
 * Workshop, OJT and assessment modules end to end, against the full demo
 * database (schema + migrations + demo data).
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

describe('workshop, OJT and assessment modules', { skip: !DB_URL && 'DATABASE_URL not set' }, () => {
  let db: Db;
  let base: string;
  let close: () => Promise<void>;
  const ids: Record<string, string> = {};
  const token = (email: string, roles: string[]) =>
    new SignJWT({ inst: INST, roles }).setProtectedHeader({ alg: 'HS256' }).setSubject(ids[email]!).setExpirationTime('5m')
      .sign(new TextEncoder().encode(SECRET));
  const call = async (method: string, path: string, who: [string, string[]] | null, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}),
        ...(who ? { authorization: `Bearer ${await token(...who)}` } : {}), ...headers },
      body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json, raw: text };
  };
  const learner = (email: string): [string, string[]] => [email, ['student']];
  const TRAINER: [string, string[]] = ['trainer@vtc.example', ['vocational_trainer']];
  const DIRECTOR: [string, string[]] = ['director@vtc.example', ['director']];

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

  const qrOf = async (tag: string) => (await db.query<{ qr_code: string }>(`SELECT qr_code FROM workshop_assets WHERE asset_tag = $1`, [tag])).rows[0]!.qr_code;
  const answersFor = async (attemptId: string, wrong: string[] = []) => {
    const { rows } = await db.query<{ items: { id: string; correct: string }[]; served: string[] }>(
      `SELECT pc.items, a.served_item_ids AS served FROM safety_precheck_attempts a JOIN safety_prechecks pc ON pc.id = a.precheck_id WHERE a.id = $1`, [attemptId]);
    return Object.fromEntries(rows[0]!.served.map((id) => [id, wrong.includes(id) ? 'zz' : rows[0]!.items.find((i) => i.id === id)!.correct]));
  };

  it('unlocks a machine after a passed QR pre-check and locks it again on release', async () => {
    const me = learner('learner07@vtc.example');
    const qr = await qrOf('CNC2-L07');
    const scan = await call('GET', `/v1/safety/scan/${qr}`, me);
    assert.equal(scan.status, 200);
    assert.equal(scan.body.eligible, true, JSON.stringify(scan.body.blockers));
    assert.equal(scan.body.machine.tag, 'CNC2-L07');
    // Learners cannot use the guessable asset tag instead of the printed code.
    assert.equal((await call('GET', '/v1/safety/scan/CNC2-L07', me)).status, 404);

    const pc = await call('POST', `/v1/safety/scan/${qr}/precheck`, me, {});
    assert.equal(pc.status, 201);
    assert.ok(pc.body.items.length >= 4);
    assert.ok(pc.body.items.every((i: Record<string, unknown>) => !('correct' in i)), 'answers never reach the phone');
    const sub = await call('POST', `/v1/safety/prechecks/${pc.body.attemptId}/submit`, me, { answers: await answersFor(pc.body.attemptId) });
    assert.equal(sub.status, 200);
    assert.equal(sub.body.result.passed, true);
    assert.equal(sub.body.lock.state, 'unlocked');            // virtual controller
    assert.match(sub.body.lock.pin, /^\d{6}$/);
    const asset = await db.query(`SELECT status::text FROM workshop_assets WHERE asset_tag = 'CNC2-L07'`);
    assert.equal(asset.rows[0].status, 'in_use');

    // Someone else cannot take the machine while it is unlocked.
    const other = await call('POST', `/v1/safety/scan/${qr}/precheck`, learner('learner11@vtc.example'), {});
    assert.equal(other.status, 403);
    assert.ok(other.body.details.blockers.includes('machine_in_use'));

    const rel = await call('POST', `/v1/safety/locks/${sub.body.lock.id}/release`, me, {});
    assert.equal(rel.status, 200);
    assert.equal((await db.query(`SELECT status::text FROM workshop_assets WHERE asset_tag = 'CNC2-L07'`)).rows[0].status, 'available');

    // The passport is still valid this shift: scanning again skips the quiz.
    const again = await call('POST', `/v1/safety/scan/${qr}/precheck`, me, {});
    assert.equal(again.body.reused, true);
    assert.equal(again.body.lock.state, 'unlocked');
  });

  it('fails a pre-check on a critical miss, raises an alert and enforces a cooldown', async () => {
    const me = learner('learner11@vtc.example');
    const qr = await qrOf('CNC2-L12');
    await db.query(`UPDATE machine_locks SET state = 'released', released_at = now() WHERE asset_id = (SELECT id FROM workshop_assets WHERE asset_tag = 'CNC2-L12') AND state = 'unlocked'`);
    await db.query(`UPDATE asset_checkouts SET returned_at = now() WHERE asset_id = (SELECT id FROM workshop_assets WHERE asset_tag = 'CNC2-L12') AND returned_at IS NULL`);
    await db.query(`UPDATE workshop_assets SET status = 'available' WHERE asset_tag = 'CNC2-L12'`);
    const pc = await call('POST', `/v1/safety/scan/${qr}/precheck`, me, {});
    assert.equal(pc.status, 201, JSON.stringify(pc.body));
    const sub = await call('POST', `/v1/safety/prechecks/${pc.body.attemptId}/submit`, me, { answers: await answersFor(pc.body.attemptId, ['cnc1']) });
    assert.equal(sub.body.result.passed, false);
    assert.deepEqual(sub.body.result.criticalMissed, ['cnc1']);
    assert.equal(sub.body.lock, null);
    const alert = await db.query(`SELECT detail FROM safety_alerts WHERE learner_id = $1 AND criterion_key = 'precheck'`, [ids['learner11@vtc.example']]);
    assert.match(alert.rows[0].detail, /CNC2-L12/);
    const retry = await call('POST', `/v1/safety/scan/${qr}/precheck`, me, {});
    assert.equal(retry.status, 429);
  });

  it('drives a hardware interlock: pending → PIN handshake → e-stop lockout', async () => {
    const me = learner('learner10@vtc.example');
    await db.query(`UPDATE workshop_assets SET controller_key_hash = encode(digest('test-controller-key-0001', 'sha256'), 'hex') WHERE asset_tag = 'CNC2-L11'`);
    await db.query(`UPDATE workshop_assets SET status = 'available' WHERE asset_tag = 'CNC2-L11'`);
    const qr = await qrOf('CNC2-L11');
    const pc = await call('POST', `/v1/safety/scan/${qr}/precheck`, me, {});
    assert.equal(pc.status, 201, JSON.stringify(pc.body));
    const sub = await call('POST', `/v1/safety/prechecks/${pc.body.attemptId}/submit`, me, { answers: await answersFor(pc.body.attemptId) });
    assert.equal(sub.body.lock.state, 'unlock_pending');
    const key = { 'x-machine-key': 'test-controller-key-0001' };
    assert.equal((await call('POST', '/v1/machines/CNC2-L11/handshake', null, { pin: '000000' }, { 'x-machine-key': 'wrong-key-wrong-key' })).status, 401);
    const badPin = sub.body.lock.pin === '000000' ? '111111' : '000000';
    assert.equal((await call('POST', '/v1/machines/CNC2-L11/handshake', null, { pin: badPin }, key)).status, 401);
    const ok = await call('POST', '/v1/machines/CNC2-L11/handshake', null, { pin: sub.body.lock.pin }, key);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.relay, 'on');
    const st = await call('GET', `/v1/safety/locks/${sub.body.lock.id}`, me);
    assert.equal(st.body.lock.state, 'unlocked');
    const hb = await call('POST', '/v1/machines/CNC2-L11/heartbeat', null, { relay: 'on', estop: true, detail: 'mushroom button' }, key);
    assert.equal(hb.body.revoked, sub.body.lock.id);
    assert.equal((await db.query(`SELECT status::text FROM workshop_assets WHERE asset_tag = 'CNC2-L11'`)).rows[0].status, 'locked_out');
  });

  it('logs OJT hours only for geofence-verified shifts', async () => {
    const me = learner('student.auto@vtc.example');
    const site = { latitude: 30.0561, longitude: 31.3300 };
    const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const inside = { kind: 'in', latitude: site.latitude + 0.0004, longitude: site.longitude, accuracyM: 12, deviceTime: at(300) };
    const cin = await call('POST', '/v1/ojt/checkins', me, { clientMutationId: randomUUID(), ...inside });
    assert.equal(cin.status, 201, JSON.stringify(cin.body));
    assert.equal(cin.body.inside, true);
    assert.ok(cin.body.distanceM > 30 && cin.body.distanceM < 60);
    assert.equal(cin.body.attendance.status, 'open');
    assert.equal((await call('POST', '/v1/ojt/checkins', me, { clientMutationId: randomUUID(), ...inside, deviceTime: at(290) })).status, 409);

    const mocked = await call('POST', '/v1/ojt/checkins', me, { clientMutationId: randomUUID(), ...inside, kind: 'out', isMocked: true, deviceTime: at(10) });
    assert.equal(mocked.status, 422);
    assert.equal(mocked.body.reason, 'mock_location');
    const fuzzy = await call('POST', '/v1/ojt/checkins', me, { clientMutationId: randomUUID(), ...inside, kind: 'out', accuracyM: 400, deviceTime: at(10) });
    assert.equal(fuzzy.body.reason, 'low_accuracy');

    const outId = randomUUID();
    const out = { clientMutationId: outId, kind: 'out', latitude: site.latitude + 0.01, longitude: site.longitude, accuracyM: 8, deviceTime: at(5) };
    const cout = await call('POST', '/v1/ojt/checkins', me, out);
    assert.equal(cout.status, 201);
    assert.equal(cout.body.inside, false);
    assert.equal(cout.body.attendance.verified, false);         // left the fence before checking out
    assert.ok(cout.body.attendance.flags.includes('checkout_outside'));
    assert.ok(Math.abs(cout.body.attendance.minutes - 295) <= 1);
    const replay = await call('POST', '/v1/ojt/checkins', me, out);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);

    // A clean shift counts.
    const before = cout.body.totals.verified_hours;
    await call('POST', '/v1/ojt/checkins', me, { clientMutationId: randomUUID(), ...inside, deviceTime: at(4) });
    const last = await call('POST', '/v1/ojt/checkins', me, { clientMutationId: randomUUID(), ...inside, kind: 'out', deviceTime: at(0.5) });
    assert.equal(last.body.attendance.verified, true);
    assert.ok(last.body.totals.verified_hours >= before);
  });

  it('serves each learner their own parametric numbers and grades schematic pins', async () => {
    const a = await call('POST', '/v1/assessments', learner('student.elec@vtc.example'), {});
    const b = await call('POST', '/v1/assessments', learner('learner.elec02@vtc.example'), {});
    assert.equal(a.status, 201);
    const pa = a.body.items.find((i: any) => i.type === 'parametric');
    const pb = b.body.items.find((i: any) => i.id === pa.id);
    assert.ok(pa && pb);
    assert.notEqual(pa.stem, pb.stem);
    assert.ok(!('key' in pa) && !('answer' in pa) && !('values' in pa), 'no answer and no hidden draws go to the learner');
    const hs = a.body.items.find((i: any) => i.type === 'hotspot');
    assert.ok(hs.schematic.svg.includes('OL 95'));
    assert.ok(!('regions' in hs) && !JSON.stringify(hs).includes('OL-95-96'), 'hotspot regions stay on the server');

    const inst = (await db.query(`SELECT answer_value::float AS v FROM question_instances WHERE assessment_id = $1 AND question_id = $2`, [a.body.assessmentId, pa.id])).rows[0];
    const responses: Record<string, unknown> = { [pa.id]: String(inst.v * 1.01), [hs.id]: { pins: [{ x: 402, y: 318 }] } };
    const res = await call('POST', `/v1/assessments/${a.body.assessmentId}/submit`, learner('student.elec@vtc.example'), { responses });
    assert.equal(res.status, 200);
    const gp = res.body.items.find((i: any) => i.id === pa.id);
    assert.equal(gp.correct, true);                              // inside the 2 % band
    const gh = res.body.items.find((i: any) => i.id === hs.id);
    assert.equal(gh.correct, true);
    assert.equal(gh.points, gh.maxPoints);
    const again = await call('POST', `/v1/assessments/${a.body.assessmentId}/submit`, learner('student.elec@vtc.example'), { responses });
    assert.equal(again.status, 409);
    // Another learner cannot submit someone else's sitting.
    assert.equal((await call('POST', `/v1/assessments/${a.body.assessmentId}/submit`, learner('learner.elec02@vtc.example'), { responses })).status, 404);
  });

  it('records a floor observation with a photo, issues materials and syncs an offline batch', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 64 }, (_, i) => i), 0xff, 0xd9]);
    const up = await call('POST', '/v1/media', TRAINER, jpeg, { 'content-type': 'image/jpeg', 'x-client-mutation-id': randomUUID(), 'x-captured-at': new Date().toISOString() });
    assert.equal(up.status, 201, up.raw);
    assert.match(up.body.sha256, /^[0-9a-f]{64}$/);
    const back = await fetch(`${base}/v1/media/${up.body.id}`, { headers: { authorization: `Bearer ${await token(...TRAINER)}` } });
    assert.deepEqual(new Uint8Array(await back.arrayBuffer()), jpeg);

    const obs = {
      clientMutationId: randomUUID(), learnerId: ids['learner03@vtc.example'], rubricCode: 'RB-JC-118', assetTag: 'CNC2-L03', taskRef: 'JC-118',
      checks: { ppe: true, safe_op: true }, ratings: { setup: 3, finish: 3, housekeeping: 4 }, measurements: { dia: 24.99 },
      media: [{ mediaId: up.body.id, criterionKey: 'finish' }],
    };
    const movement = { clientMutationId: randomUUID(), consumableId: (await db.query(`SELECT id FROM consumables WHERE sku = 'INS-CNMG-12'`)).rows[0].id, delta: 20, reason: 'receipt' };
    const batch = await call('POST', '/v1/sync', TRAINER, { mutations: [
      { type: 'observation', payload: obs }, { type: 'consumable', payload: movement }, { type: 'observation', payload: obs },
      { type: 'checkin', payload: { clientMutationId: randomUUID() } },
    ] });
    assert.equal(batch.status, 200);
    assert.deepEqual(batch.body.results.map((r: any) => r.status), ['applied', 'applied', 'duplicate', 'rejected']);
    const r0 = batch.body.results[0].result;
    assert.equal(r0.passed, true);
    assert.equal(r0.media, 1);
    assert.deepEqual(r0.issued.map((i: any) => i.sku).sort(), ['BAR-C45-30', 'CUT-FLUID-5', 'INS-CNMG-12']);
    const stock = await call('GET', '/v1/workshop/consumables?trade=cnc', TRAINER);
    assert.ok(stock.body.consumables.find((c: any) => c.sku === 'INS-CNMG-12').onHand > 20);
  });

  it('ranks learners by early-warning risk with reasons, and shows the skills heatmap', async () => {
    const ew = await call('GET', '/v1/analytics/early-warning', DIRECTOR);
    assert.equal(ew.status, 200);
    const list = ew.body.learners;
    assert.ok(list.length >= 30);
    assert.ok(list[0].probability >= list.at(-1).probability);
    const weld04 = list.find((l: any) => l.learnerId === ids['learner.weld04@vtc.example']);
    assert.equal(weld04.band, 'high');
    assert.ok(weld04.reasons[0].en.length > 5 && weld04.reasons[0].ar.length > 5);
    assert.equal((await call('POST', `/v1/analytics/early-warning/${weld04.snapshotId}/ack`, TRAINER, { note: 'Met learner, attendance plan agreed' })).status, 200);
    assert.equal((await call('GET', '/v1/analytics/early-warning', learner('student@vtc.example'))).status, 403);

    const sk = await call('GET', '/v1/analytics/skills?trade=weld', DIRECTOR);
    assert.ok(sk.body.units.length > 0 && sk.body.grid.length > 0);
    const radar = await call('GET', `/v1/analytics/skills/learners/${ids['student.weld@vtc.example']}`, learner('student.weld@vtc.example'));
    assert.ok(radar.body.radar.length >= 4);
    assert.ok(radar.body.history.length > 0);
  });

  it('exports xAPI statements', async () => {
    const x = await call('GET', `/v1/xapi/statements?since=${encodeURIComponent(new Date(Date.now() - 30 * 86400_000).toISOString())}&limit=50`, DIRECTOR);
    assert.equal(x.status, 200);
    assert.ok(x.body.statements.length > 0);
    assert.match(x.body.statements[0].verb.id, /^https?:\/\//);
  });
});
