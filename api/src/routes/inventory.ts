/**
 * Workshop stores (consumables)
 *
 *   GET  /v1/workshop/consumables?trade=          stock, burn rate, booked demand, days of cover
 *   POST /v1/workshop/consumables/:id/movements   receipt, scrap or count adjustment
 *
 * Issues to practical tasks are automatic (task_consumables + a trigger on
 * workshop_observations); this endpoint is for the stores clerk.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { forbidden, HttpError, notFound } from '../lib/errors.js';

export const Movement = z.object({
  clientMutationId: z.string().uuid(),
  consumableId: z.string().uuid(),
  delta: z.number().refine((d) => d !== 0, 'delta must not be zero'),
  reason: z.enum(['receipt', 'scrap', 'adjustment']),
});
export type MovementBody = z.infer<typeof Movement>;

export async function recordMovement(tx: Tx, p: Principal, b: MovementBody) {
  const replay = await tx.query(`SELECT id FROM consumable_movements WHERE client_mutation_id = $1`, [b.clientMutationId]);
  if (replay.rows[0]) return { replayed: true, id: replay.rows[0].id };
  const c = await tx.query<{ on_hand: number }>(
    `SELECT c.on_hand::float FROM consumables c JOIN workshops w ON w.id = c.workshop_id WHERE c.id = $1 AND w.institution_id = $2 FOR UPDATE OF c`,
    [b.consumableId, p.institutionId]);
  if (!c.rows[0]) throw notFound('Consumable');
  if (c.rows[0].on_hand + b.delta < 0) throw new HttpError(422, 'insufficient_stock', `Only ${c.rows[0].on_hand} on hand`);
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO consumable_movements (consumable_id, delta, reason, user_id, client_mutation_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [b.consumableId, b.delta, b.reason, p.userId, b.clientMutationId]);
  return { replayed: false, id: rows[0]!.id };
}

export function inventoryRouter(deps: { db: Db }) {
  const router = Router();

  router.get('/v1/workshop/consumables', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p) && !p.roles.includes('director')) throw forbidden();
    const trade = typeof req.query['trade'] === 'string' && req.query['trade'] !== 'all' ? req.query['trade'] : null;
    const { rows } = await deps.db.query(
      `SELECT f.consumable_id AS id, f.trade_id AS "tradeId", f.sku, f.name, f.unit, f.on_hand AS "onHand", f.reorder_point AS "reorderPoint",
              f.lead_time_days AS "leadTimeDays", f.burn_per_day AS "burnPerDay", f.booked_7d AS "booked7d", f.shortfall_14d AS "shortfall14d",
              f.days_of_cover AS "daysOfCover", f.status, c.hazard_class AS "hazardClass",
              (SELECT string_agg(r.code, ', ') FROM task_consumables tc JOIN rubrics r ON r.id = tc.rubric_id WHERE tc.consumable_id = f.consumable_id) AS "usedBy"
         FROM v_consumable_forecast f JOIN consumables c ON c.id = f.consumable_id JOIN workshops w ON w.id = f.workshop_id
        WHERE w.institution_id = $1 AND ($2::text IS NULL OR f.trade_id = $2)
        ORDER BY CASE f.status WHEN 'critical' THEN 0 WHEN 'reorder' THEN 1 ELSE 2 END, f.days_of_cover NULLS LAST, f.sku`,
      [p.institutionId, trade]);
    res.json({ consumables: rows });
  });

  router.post('/v1/workshop/consumables/:id/movements', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p)) throw forbidden();
    const b = Movement.parse({ ...req.body, consumableId: req.params['id'] });
    const out = await withTx(deps.db, (tx) => recordMovement(tx, p, b));
    res.status(out.replayed ? 200 : 201).json(out);
  });

  return router;
}
