/**
 * End-to-end test against real Postgres (+ optional Redis).
 *   DATABASE_URL=postgres://postgres@localhost/vlms_test npm test
 * Skipped when DATABASE_URL is not set.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const LEARNER = '00000000-0000-0000-0000-0000000000b1';
const TRAINER = '00000000-0000-0000-0000-0000000000b2';
const SESSION = '00000000-0000-0000-0000-0000000000f1';

const token = (sub: string, roles: string[], inst = INST) =>
  new SignJWT({ inst, roles }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setExpirationTime('5m')
    .sign(new TextEncoder().encode(SECRET));

describe('V-Lab telemetry + evaluation API', { skip: !DB_URL && 'DATABASE_URL not set' }, () => {
  let db: Db;
  let base: string;
  let close: () => Promise<void>;
  let seq = 0;
  const now = Date.now();
  const e = (verb: string, objectRef?: string, value: Record<string, unknown> = {}) => ({
    seq: ++seq, occurredAt: new Date(now - 300_000 + seq * 1000).toISOString(), verb, objectRef, value,
  });

  const post = async (path: string, body: unknown, jwt: string) => {
    const res = await fetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };

  before(async () => {
    db = createPool(DB_URL);
    await db.query('DROP SCHEMA IF EXISTS vlms CASCADE');
    await db.query(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'));
    await db.query(readFileSync(new URL('../../db/seed.sql', import.meta.url), 'utf8'));
    const log = pino({ level: 'silent' });
    const realtime = createRealtime(process.env.REDIS_URL, log);
    const server = createApp({ db, realtime, log, jwtSecret: SECRET }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = async () => { server.closeAllConnections(); server.close(); await realtime.close(); };
  });
  after(async () => { await close(); await db.end(); });

  it('rejects unauthenticated and cross-tenant callers', async () => {
    const r1 = await fetch(`${base}/v1/vlab/sessions/${SESSION}/telemetry`, { method: 'POST' });
    assert.equal(r1.status, 401);
    const r2 = await post(`/v1/vlab/sessions/${SESSION}/telemetry`, { events: [e('ppe_donned')] },
      await token(LEARNER, ['student'], '00000000-0000-0000-0000-000000000999'));
    assert.equal(r2.status, 404);
    seq = 0;
  });

  it('ingests a batch, raises a live LOTO alert, and dedupes retries', async () => {
    const jwt = await token(LEARNER, ['student']);
    const batch = { events: [e('ppe_donned'), e('panel_opened'), e('loto_applied')] };
    const r = await post(`/v1/vlab/sessions/${SESSION}/telemetry`, batch, jwt);
    assert.equal(r.status, 202);
    assert.equal(r.body.accepted, 3);
    assert.equal(r.body.alerts.length, 1);
    assert.equal(r.body.alerts[0].criterionKey, 'loto');
    assert.equal(r.body.guardrail, null); // assessment mode records, doesn't block

    const retry = await post(`/v1/vlab/sessions/${SESSION}/telemetry`, batch, jwt);
    assert.equal(retry.body.accepted, 0);
    assert.equal(retry.body.duplicates, 3);
    assert.equal(retry.body.alerts.length, 0);
  });

  it('rejects future-dated events and malformed payloads', async () => {
    const jwt = await token(LEARNER, ['student']);
    const future = { seq: 999, occurredAt: new Date(Date.now() + 3_600_000).toISOString(), verb: 'measured' };
    const r = await post(`/v1/vlab/sessions/${SESSION}/telemetry`, { events: [future] }, jwt);
    assert.deepEqual(r.body.rejected, [{ seq: 999, reason: 'occurred_in_future' }]);
    const bad = await post(`/v1/vlab/sessions/${SESSION}/telemetry`, { events: [{ seq: 'x' }] }, jwt);
    assert.equal(bad.status, 400);
  });

  it('evaluates the session, fails on the gate, and updates competencies', async () => {
    const jwt = await token(LEARNER, ['student']);
    await post(`/v1/vlab/sessions/${SESSION}/telemetry`, {
      events: [
        e('measured', 'X1:L1-L2', { reading: 401.5, unit: 'V' }), e('measured', 'Q1:control_supply', { reading: 230 }),
        e('measured', 'S1:stop_pb', { reading: 0.1 }), e('measured', 'F2:95-96', { reading: 'OL' }),
        e('diagnosis_submitted', 'F2_overload', { faultCode: 'F-OL-OPEN' }),
      ],
    }, jwt);

    const r = await post(`/v1/vlab/sessions/${SESSION}/evaluate`, {}, await token(TRAINER, ['vocational_trainer']));
    assert.equal(r.status, 200);
    assert.equal(r.body.eventCount, 8);
    assert.deepEqual(r.body.gateFailures, ['loto']);
    assert.equal(r.body.passed, false);
    assert.equal(r.body.totalScore, 90);

    const { rows } = await db.query(
      `SELECT c.code, lc.level FROM learner_competencies lc JOIN competencies c ON c.id = lc.competency_id ORDER BY c.code`);
    assert.deepEqual(rows, [
      { code: 'ELEC-L3-U04-E1', level: 'not_yet' },     // gate failed → no credit for safe isolation
      { code: 'ELEC-L3-U04-E2', level: 'autonomous' },  // diagnosis + isolation path were perfect
    ]);

    const again = await post(`/v1/vlab/sessions/${SESSION}/evaluate`, {}, jwt);
    assert.equal(again.body.cached, true);
    assert.equal(again.body.totalScore, 90);

    const closed = await post(`/v1/vlab/sessions/${SESSION}/telemetry`, { events: [e('measured')] }, jwt);
    assert.equal(closed.status, 409);
  });
});
