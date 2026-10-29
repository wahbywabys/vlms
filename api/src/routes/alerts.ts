/**
 * Trainer alert rail
 *
 *   GET  /v1/alerts?status=open|all     safety alerts for the caller's institution (staff)
 *   POST /v1/alerts/:alertId/resolve    record how the trainer resolved one
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff } from '../lib/auth.js';
import type { Db } from '../lib/db.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import type { Realtime } from '../lib/redis.js';

const ListQuery = z.object({ status: z.enum(['open', 'all']).default('open'), limit: z.coerce.number().int().min(1).max(200).default(50) });
const Resolve = z.object({ resolution: z.string().trim().min(2).max(500) });

export function alertsRouter(deps: { db: Db; realtime: Realtime }) {
  const router = Router();

  router.get('/v1/alerts', async (req: Request, res) => {
    const p = req.principal!;
    // Directors see the rail read-only; resolving stays with floor staff.
    if (!isStaff(p) && !p.roles.includes('director')) throw forbidden();
    const q = ListQuery.parse(req.query);
    const { rows } = await deps.db.query(
      `SELECT a.id, a.source, a.session_id AS "sessionId", a.criterion_key AS "criterionKey", a.verb, a.detail,
              a.raised_at AS "raisedAt", a.resolved_at AS "resolvedAt", a.resolution,
              u.id AS "learnerId", u.full_name AS "learnerName", u.full_name_ar AS "learnerNameAr"
         FROM safety_alerts a JOIN users u ON u.id = a.learner_id
        WHERE a.institution_id = $1 AND ($2 = 'all' OR a.resolved_at IS NULL)
        ORDER BY a.resolved_at IS NULL DESC, a.raised_at DESC
        LIMIT $3`,
      [p.institutionId, q.status, q.limit]);
    res.json({ alerts: rows });
  });

  router.post('/v1/alerts/:alertId/resolve', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p)) throw forbidden();
    const alertId = z.string().uuid().parse(req.params['alertId']);
    const { resolution } = Resolve.parse(req.body);
    const { rows } = await deps.db.query<{ resolved_at: Date | null; institution_id: string }>(
      `SELECT resolved_at, institution_id FROM safety_alerts WHERE id = $1`, [alertId]);
    if (!rows[0] || rows[0].institution_id !== p.institutionId) throw notFound('Alert');
    if (rows[0].resolved_at) throw conflict('already_resolved', 'Alert is already resolved');
    await deps.db.query(
      `UPDATE safety_alerts SET resolved_at = now(), resolved_by = $2, resolution = $3 WHERE id = $1`,
      [alertId, p.userId, resolution]);
    await deps.realtime.publish(`vlab:alerts:${p.institutionId}`, { type: 'alert_resolved', alertId });
    res.json({ id: alertId, resolved: true });
  });

  return router;
}
