/**
 * Private space end to end, against the full demo database.
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
const dbFile = (f: string) => readFileSync(new URL(`../../db/${f}`, import.meta.url), 'utf8');

describe('private space', { skip: !DB_URL && 'DATABASE_URL not set' }, () => {
  let db: Db;
  let base: string;
  let close: () => Promise<void>;
  const ids: Record<string, string> = {};
  const token = (email: string, roles: string[]) =>
    new SignJWT({ inst: INST, roles }).setProtectedHeader({ alg: 'HS256' }).setSubject(ids[email]!).setExpirationTime('5m')
      .sign(new TextEncoder().encode(SECRET));
  const call = async (method: string, path: string, who: [string, string[]], body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${await token(...who)}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as any };
  };
  const ME: [string, string[]] = ['student@vtc.example', ['student']];
  const OTHER: [string, string[]] = ['student.auto@vtc.example', ['student']];
  const TRAINER: [string, string[]] = ['trainer@vtc.example', ['vocational_trainer']];
  const empty = { v: 1, items: [], cards: {}, history: [], goals: [], activity: {} };

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
  after(async () => { await close?.(); await db?.end(); });

  it('starts empty and saves with an optimistic revision', async () => {
    const first = await call('GET', '/v1/private', ME);
    assert.equal(first.status, 200);
    assert.equal(first.body.rev, 0);
    assert.deepEqual(first.body.state.items, []);

    const goals = [{ id: 'g1', text: 'Know the lathe', done: false, at: new Date().toISOString() }];
    const put = await call('PUT', '/v1/private', ME, { rev: 0, state: { ...empty, goals } });
    assert.equal(put.status, 200);
    assert.equal(put.body.rev, 1);

    // A second device still on rev 0 is told what is stored instead of overwriting it.
    const stale = await call('PUT', '/v1/private', ME, { rev: 0, state: empty });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.conflict.rev, 1);
    assert.equal(stale.body.conflict.state.goals[0].text, 'Know the lathe');
  });

  it('takes "Save to my locker" drops and refreshes a part saved twice', async () => {
    const drop = { kind: 'part', title: { en: 'Chuck', ar: 'الظرف' }, ref: { asset: 'CNC-LATHE-01', part: 'chuck' }, body: 'Grips the bar', tags: ['lathe'] };
    const a = await call('POST', '/v1/private/items', ME, drop);
    assert.equal(a.status, 201);
    const b = await call('POST', '/v1/private/items', ME, { ...drop, tags: ['revise'] });
    assert.equal(b.body.item.id, a.body.item.id);
    assert.deepEqual(b.body.item.tags, ['lathe', 'revise']);
    const note = await call('POST', '/v1/private/history', ME, { id: 'h1', at: new Date().toISOString(), kind: 'lesson', ref: 'cnc-l1', title: { en: 'L1', ar: 'د1' }, score: 67 });
    assert.equal(note.status, 201);
    const again = await call('POST', '/v1/private/history', ME, { id: 'h1', at: new Date().toISOString(), kind: 'lesson', ref: 'cnc-l1', title: { en: 'L1', ar: 'د1' }, score: 67 });
    assert.equal(again.body.rev, note.body.rev, 'the same attempt is kept once');
    const got = await call('GET', '/v1/private', ME);
    assert.equal(got.body.state.items.length, 1);
    assert.equal(got.body.state.history.length, 1);
    assert.equal(got.body.state.goals.length, 1, 'drops keep what the space already had');
  });

  it('is private to its learner', async () => {
    const other = await call('GET', '/v1/private', OTHER);
    assert.equal(other.body.state.items.length, 0);
    const staff = await call('GET', '/v1/private', TRAINER);
    assert.equal(staff.status, 403);
    const bad = await call('POST', '/v1/private/items', ME, { kind: 'virus', title: { en: 'x', ar: 'x' } });
    assert.equal(bad.status, 400);
  });
});
