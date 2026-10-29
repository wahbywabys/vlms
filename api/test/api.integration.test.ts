/**
 * End-to-end test against real Postgres (+ optional Redis).
 *   DATABASE_URL=postgres://postgres@localhost/vtc_lms_test npm test
 * Skipped when DATABASE_URL is not set.
 */
import assert from 'node:assert/strict';
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
    await db.query('DROP SCHEMA IF EXISTS vtc CASCADE');
    await db.query(readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'));
    await db.query(readFileSync(new URL('../../db/seed.sql', import.meta.url), 'utf8'));
    for (const m of readdirSync(new URL('../../db/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort()) {
      await db.query(readFileSync(new URL(`../../db/migrations/${m}`, import.meta.url), 'utf8'));
    }
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

  it('starts a guided practice session, reads the meter server-side and blocks unsafe actions', async () => {
    const jwt = await token(LEARNER, ['student']);
    const get = async (path: string) => {
      const r = await fetch(base + path, { headers: { authorization: `Bearer ${jwt}` } });
      return { status: r.status, body: (await r.json()) as any };
    };
    const denied = await post('/v1/vlab/sessions', { labCode: 'VLAB-DOL-STARTER', mode: 'assessment' }, jwt);
    assert.equal(denied.status, 403); // learners cannot start their own exam

    const created = await post('/v1/vlab/sessions', { labCode: 'VLAB-DOL-STARTER', mode: 'guided' }, jwt);
    assert.equal(created.status, 201);
    const id = created.body.sessionId;
    const at = () => new Date().toISOString();

    const state = await get(`/v1/vlab/sessions/${id}`);
    assert.equal(state.body.mode, 'guided');
    assert.deepEqual(state.body.faults, []); // fault stays hidden from the learner

    // Opening the panel before LOTO breaks a gate: guided mode blocks it and stores nothing.
    const blocked = await post(`/v1/vlab/sessions/${id}/telemetry`, { events: [{ seq: 1, occurredAt: at(), verb: 'panel_opened' }] }, jwt);
    assert.equal(blocked.body.guardrail, 'block');
    assert.equal(blocked.body.accepted, 0);
    assert.deepEqual(blocked.body.rejected, [{ seq: 1, reason: 'blocked_by_guardrail' }]);

    const closed = await post(`/v1/vlab/sessions/${id}/probe`, { seq: 2, occurredAt: at(), testPoint: 'F2:95-96' }, jwt);
    assert.equal(closed.status, 409); // inside the panel, door shut

    // Measuring before PPE is on is blocked too.
    const noPpe = await post(`/v1/vlab/sessions/${id}/probe`, { seq: 3, occurredAt: at(), testPoint: 'X1:L1-L2' }, jwt);
    assert.equal(noPpe.body.meter, null);
    assert.equal(noPpe.body.guardrail, 'block');

    await post(`/v1/vlab/sessions/${id}/telemetry`, { events: [{ seq: 4, occurredAt: at(), verb: 'ppe_donned' }] }, jwt);
    const supply = await post(`/v1/vlab/sessions/${id}/probe`, { seq: 5, occurredAt: at(), testPoint: 'X1:L1-L2' }, jwt);
    assert.equal(supply.body.meter.display, '401.2 V');

    await post(`/v1/vlab/sessions/${id}/telemetry`, { events: [
      { seq: 6, occurredAt: at(), verb: 'loto_applied', objectRef: 'Q1' },
      { seq: 7, occurredAt: at(), verb: 'panel_opened', objectRef: 'panel' },
    ] }, jwt);
    const after = await get(`/v1/vlab/sessions/${id}`);
    assert.deepEqual(after.body.rig, { ppe: true, locked: true, panelOpen: true, replaced: [] });
    assert.equal(after.body.events.length, 4);

    const done = await post(`/v1/vlab/sessions/${id}/evaluate`, {}, jwt);
    assert.equal(done.status, 200);
    const revealed = await get(`/v1/vlab/sessions/${id}`);
    assert.equal(revealed.body.faults.length, 1); // revealed once scored
  });

  it('scores a floor observation with the same engine and raises a gate alert', async () => {
    await db.query(`INSERT INTO rubrics (id, code, title) VALUES ('00000000-0000-0000-0000-0000000000e2', 'RB-OBS-TEST', 'Obs')`);
    await db.query(`INSERT INTO rubric_criteria (rubric_id, key, label, weight, is_gate, scoring) VALUES
      ('00000000-0000-0000-0000-0000000000e2', 'ppe', 'PPE worn', 5, true, '{"rule":"check","objectRef":"ppe"}'),
      ('00000000-0000-0000-0000-0000000000e2', 'setup', 'Setup', 20, false, '{"rule":"rating","objectRef":"setup"}'),
      ('00000000-0000-0000-0000-0000000000e2', 'dia', 'Diameter', 35, false, '{"rule":"measurement_tolerance","objectRef":"dia","expected":24.9895,"absTol":0.0105}')`);
    const jwt = await token(TRAINER, ['vocational_trainer']);
    const body = { clientMutationId: '00000000-0000-4000-8000-000000000001', learnerId: LEARNER, rubricCode: 'RB-OBS-TEST',
      checks: { ppe: false }, ratings: { setup: 3 }, measurements: { dia: 24.99 } };
    const r = await post('/v1/workshop/observations', body, jwt);
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.gateFailures, ['ppe']);
    assert.equal(r.body.passed, false);
    assert.equal(r.body.criteria.dia.score, 100);
    assert.equal(r.body.criteria.setup.score, 75);

    const replay = await post('/v1/workshop/observations', body, jwt);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);

    const learnerTry = await post('/v1/workshop/observations', { ...body, clientMutationId: '00000000-0000-4000-8000-000000000002' },
      await token(LEARNER, ['student']));
    assert.equal(learnerTry.status, 403);

    const list = await fetch(`${base}/v1/alerts`, { headers: { authorization: `Bearer ${jwt}` } }).then((x) => x.json()) as any;
    const sources = list.alerts.map((a: any) => a.source).sort();
    assert.deepEqual(sources, ['observation', 'vlab']); // the exam LOTO alert + this PPE gate
    const res = await post(`/v1/alerts/${list.alerts[0].id}/resolve`, { resolution: 'Stopped the machine, briefed the learner' }, jwt);
    assert.equal(res.status, 200);
  });
});
