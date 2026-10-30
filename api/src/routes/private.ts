/**
 * Private space: a student's own locker, flashcards, practice history and goals
 *
 *   GET  /v1/private            the caller's space and its revision
 *   PUT  /v1/private            replace it; 409 with the stored copy when `rev` is stale
 *   POST /v1/private/items      drop one thing in the locker ("Save to my locker")
 *   POST /v1/private/history    keep one finished attempt (lesson, safety run, practice)
 *
 * Every route works on the caller's own row only. There is deliberately no way
 * for staff to read another learner's space.
 */
import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { forbidden, HttpError } from '../lib/errors.js';

const MAX_BYTES = 6 * 1024 * 1024;
const LIMITS = { items: 300, history: 400 };

const txt = z.object({ en: z.string().max(2000), ar: z.string().max(2000) });
const State = z.object({
  v: z.literal(1),
  items: z.array(z.object({ id: z.string().max(80), kind: z.string().max(20), at: z.string().max(40), title: txt }).passthrough()).max(LIMITS.items),
  cards: z.record(z.object({ box: z.number().int().min(0).max(5), due: z.string().max(40), seen: z.number().int().min(0), right: z.number().int().min(0) })),
  history: z.array(z.object({ id: z.string().max(80), at: z.string().max(40), kind: z.string().max(20), ref: z.string().max(200), title: txt, score: z.number().min(0).max(100) }).passthrough()).max(LIMITS.history),
  goals: z.array(z.object({ id: z.string().max(80), text: z.string().max(200), done: z.boolean(), at: z.string().max(40) })).max(40),
  activity: z.record(z.object({ reviews: z.number().int().min(0), mins: z.number().int().min(0), practice: z.number().int().min(0) })),
});
const Put = z.object({ rev: z.number().int().min(0), state: State });
const Drop = z.object({
  kind: z.enum(['part', 'lesson', 'safety', 'result', 'note', 'photo', 'link', 'mistake']),
  title: txt,
  body: z.union([z.string().max(8000), txt]).optional(),
  ref: z.record(z.string().max(200)).optional(),
  value: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(30)).max(12).optional(),
  url: z.string().url().max(2000).optional(),
});
const Attempt = State.shape.history.element;

/** jsonb does not keep key order, so compare refs key by key. */
const sameRef = (a: Record<string, string> | undefined, b: Record<string, string> | undefined) =>
  !!a && !!b && Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

export function privateRouter(deps: { db: Db }) {
  const router = Router();
  const learnerOf = (req: Request) => {
    const p = req.principal!;
    if (!p.roles.includes('student')) throw forbidden('The Private space belongs to students');
    return p.userId;
  };
  /** Load (creating on first use) and lock the caller's row for a read-modify-write. */
  const withRow = <T>(learner: string, f: (row: { state: any; rev: number }, tx: Tx) => Promise<T>) => withTx(deps.db, async (tx) => {
    await tx.query(`INSERT INTO private_spaces (learner_id) VALUES ($1) ON CONFLICT DO NOTHING`, [learner]);
    const { rows } = await tx.query<{ state: any; rev: number }>(`SELECT state, rev FROM private_spaces WHERE learner_id = $1 FOR UPDATE`, [learner]);
    return f(rows[0]!, tx);
  });
  const save = (tx: Tx, learner: string, state: unknown) => {
    const json = JSON.stringify(state);
    if (json.length > MAX_BYTES) throw new HttpError(413, 'too_large', 'Your locker is full: remove some photos first');
    return tx.query<{ rev: number }>(`UPDATE private_spaces SET state = $2::jsonb, rev = rev + 1, updated_at = now() WHERE learner_id = $1 RETURNING rev`, [learner, json]);
  };

  router.get('/v1/private', async (req, res) => {
    const learner = learnerOf(req);
    const { rows } = await deps.db.query<{ state: unknown; rev: number }>(`SELECT state, rev FROM private_spaces WHERE learner_id = $1`, [learner]);
    res.set('cache-control', 'no-store').json(rows[0] ?? { state: { v: 1, items: [], cards: {}, history: [], goals: [], activity: {} }, rev: 0 });
  });

  router.put('/v1/private', async (req, res) => {
    const learner = learnerOf(req);
    const body = Put.parse(req.body);
    const out = await withRow(learner, async (row, tx) => {
      if (row.rev !== body.rev) return { conflict: { state: row.state, rev: row.rev } };
      const { rows } = await save(tx, learner, body.state);
      return { rev: rows[0]!.rev };
    });
    if ('conflict' in out) res.status(409).json({ error: 'stale_revision', ...out });
    else res.json(out);
  });

  router.post('/v1/private/items', async (req, res) => {
    const learner = learnerOf(req);
    const d = Drop.parse(req.body);
    const out = await withRow(learner, async (row, tx) => {
      const items: any[] = row.state.items ?? [];
      const body = d.body === undefined ? undefined : typeof d.body === 'string' ? d.body : `${d.body.en}\n${d.body.ar}`;
      // Saving the same part or lesson again refreshes it rather than adding a copy (same rule as the client).
      const same = d.ref && d.kind !== 'result' && d.kind !== 'note'
        ? items.find((i) => i.kind === d.kind && sameRef(i.ref, d.ref)) : undefined;
      const item = { id: same?.id ?? randomUUID(), kind: d.kind, at: new Date().toISOString(), title: d.title, ref: d.ref, value: d.value, url: d.url,
        body: body ?? same?.body, tags: [...new Set([...(same?.tags ?? []), ...(d.tags ?? [])])].slice(0, 12), pinned: same?.pinned };
      const state = { ...row.state, items: [item, ...items.filter((i) => i.id !== item.id)].slice(0, LIMITS.items) };
      const { rows } = await save(tx, learner, state);
      return { item, rev: rows[0]!.rev };
    });
    res.status(201).json(out);
  });

  router.post('/v1/private/history', async (req, res) => {
    const learner = learnerOf(req);
    const a = Attempt.parse(req.body);
    const out = await withRow(learner, async (row, tx) => {
      const history: any[] = row.state.history ?? [];
      if (history.some((h) => h.id === a.id)) return { rev: row.rev };
      const { rows } = await save(tx, learner, { ...row.state, history: [a, ...history].slice(0, LIMITS.history) });
      return { rev: rows[0]!.rev };
    });
    res.status(201).json(out);
  });

  return router;
}
