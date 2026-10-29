/**
 * Offline sync and xAPI export
 *
 *   POST /v1/sync              replay a device's queued writes in order
 *   GET  /v1/xapi/statements   learning records as xAPI 1.0.3 statements (for an LRS)
 *
 * Workshop tablets and apprentice phones keep an outbox (IndexedDB in the
 * PWA, SQLite in a native shell) of writes made while offline. Each carries
 * the clientMutationId it was minted with, so replaying a batch twice, or
 * after a partial failure, never double-counts. Items are applied one by one
 * in their own transaction: a rejected item is reported and the rest go on.
 * Media is uploaded first through POST /v1/media (also idempotent).
 */
import { Router, type Request } from 'express';
import { z, ZodError } from 'zod';
import { isStaff } from '../lib/auth.js';
import { withTx, type Db } from '../lib/db.js';
import { forbidden, HttpError } from '../lib/errors.js';
import { toStatements } from '../services/xapi.js';
import { syncHandlers } from './syncHandlers.js';

const Batch = z.object({
  deviceId: z.string().max(80).optional(),
  mutations: z.array(z.object({ type: z.enum(['observation', 'checkin', 'logbook', 'consumable']), payload: z.record(z.unknown()) })).min(1).max(100),
});

export function syncRouter(deps: { db: Db }) {
  const router = Router();

  router.post('/v1/sync', async (req: Request, res) => {
    const p = req.principal!;
    const { mutations } = Batch.parse(req.body);
    const results = [];
    for (const m of mutations) {
      const h = syncHandlers[m.type];
      const id = typeof m.payload['clientMutationId'] === 'string' ? m.payload['clientMutationId'] : null;
      try {
        if (!h.allowed(p)) throw forbidden();
        const body = h.schema.parse({ ...m.payload, ...(m.type === 'checkin' ? { queuedOffline: true } : {}) });
        const out = await withTx(deps.db, (tx) => h.apply(tx, p, body as never));
        results.push({ clientMutationId: id, type: m.type, status: out.replayed ? 'duplicate' : 'applied', result: out });
      } catch (err) {
        const e = err instanceof ZodError ? { status: 400, code: 'invalid_request' }
          : err instanceof HttpError ? { status: err.status, code: err.code, message: err.message } : null;
        if (!e) throw err;
        // 4xx: the item will never apply; the device should drop it and show why. 5xx bubbles up so it retries.
        results.push({ clientMutationId: id, type: m.type, status: 'rejected', error: e });
      }
    }
    res.json({ applied: results.filter((r) => r.status === 'applied').length, results });
  });

  const XQuery = z.object({ since: z.coerce.date().default(() => new Date(Date.now() - 7 * 86400_000)), limit: z.coerce.number().int().min(1).max(1000).default(200) });
  router.get('/v1/xapi/statements', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p) && !p.roles.includes('director') && !p.roles.includes('qa_auditor')) throw forbidden();
    const q = XQuery.parse(req.query);
    const statements = await toStatements(deps.db, p.institutionId, q.since, q.limit);
    res.setHeader('x-experience-api-version', '1.0.3');
    res.json({ statements, more: statements.length === q.limit ? `?since=${encodeURIComponent(statements.at(-1)!.timestamp)}` : '' });
  });

  return router;
}
