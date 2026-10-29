/**
 * Geofenced OJT (on-the-job training) attendance
 *
 *   POST /v1/ojt/checkins            check in or out from the apprentice's phone
 *   GET  /v1/ojt/attendance          the apprentice's shifts and verified hours
 *   POST /v1/ojt/attendance/:id/confirm   site supervisor confirms an unverified shift
 *
 * How a check-in is judged:
 *   1. The placement must belong to the caller and be running today.
 *   2. Hard refusals (nothing counts): a mocked location, a fix worse than
 *      MAX_ACCURACY_M, an offline replay older than 72 h.
 *   3. The fix is stored in wbl_checkins, where a database trigger computes
 *      the distance to the factory site and inside/outside the geofence
 *      (radius + the fix's accuracy, capped at 50 m). The client's opinion of
 *      where it is never counts.
 *   4. Check-in inside the fence opens a shift (ojt_attendance). Check-out
 *      closes it; the shift is `verified` only if both ends were inside and
 *      nothing suspicious was flagged (clock skew, impossible travel).
 *      Unverified shifts still show, and the supervisor can confirm them.
 *   5. A shift left open more than 12 h is auto-closed and needs a supervisor.
 *
 * Replays from the phone's offline queue are idempotent on clientMutationId.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Principal } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import type { Realtime } from '../lib/redis.js';
import { MAX_ACCURACY_M, MAX_ACCURACY_SLACK_M, MAX_SHIFT_MS, screen, type Fix } from '../services/geofence.js';

export const CheckIn = z.object({
  clientMutationId: z.string().uuid(),
  kind: z.enum(['in', 'out']),
  placementId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100_000).nullable().default(null),
  deviceTime: z.coerce.date(),
  /** Android `isFromMockProvider` / iOS `sourceInformation.isSimulatedBySoftware`. */
  isMocked: z.boolean().default(false),
  /** The phone queued this while offline and is replaying it now. */
  queuedOffline: z.boolean().default(false),
  source: z.enum(['gps', 'network', 'demo']).default('gps'),
});
export type CheckInBody = z.infer<typeof CheckIn>;

interface Placement { id: string; site_name: string; latitude: number; longitude: number; radius: number; required_hours: number }

const totals = async (tx: Tx | Db, placementId: string) =>
  (await tx.query<{ verified_hours: number; unverified_hours: number; expected_hours: number; required_hours: number }>(
    `SELECT verified_hours, unverified_hours, expected_hours, required_hours FROM v_ojt_hours WHERE placement_id = $1`, [placementId])).rows[0];

/** Closes shifts left open past MAX_SHIFT_MS: hours kept but unverified. */
async function autoClose(tx: Tx, placementId: string) {
  await tx.query(
    `UPDATE ojt_attendance SET status = 'auto_closed', closed_at = opened_at + make_interval(secs => $2), verified = false,
            flags = array_append(flags, 'no_checkout')
      WHERE placement_id = $1 AND status = 'open' AND opened_at < now() - make_interval(secs => $2)`,
    [placementId, MAX_SHIFT_MS / 1000]);
}

/** The check-in itself; also used by the offline sync endpoint. */
export async function recordCheckin(tx: Tx, p: Principal, b: CheckInBody, now = new Date()) {
  const replay = await tx.query(
    `SELECT c.id, c.kind, c.inside_geofence, c.distance_m, c.accepted, c.reject_reason, c.flags, c.placement_id
       FROM wbl_checkins c WHERE c.client_mutation_id = $1`, [b.clientMutationId]);
  if (replay.rows[0]) {
    const r = replay.rows[0];
    return { replayed: true, checkinId: r.id, accepted: r.accepted, inside: r.inside_geofence, distanceM: Math.round(r.distance_m),
      reason: r.reject_reason, flags: r.flags, totals: await totals(tx, r.placement_id) };
  }

  // 1. The placement: the caller's own, running today, with its site.
  const { rows } = await tx.query<Placement>(
    `SELECT p.id, es.name AS site_name, es.latitude, es.longitude, es.geofence_radius_m AS radius, p.required_hours
       FROM wbl_placements p JOIN employer_sites es ON es.id = p.site_id
      WHERE p.learner_id = $1 AND ($2::uuid IS NULL OR p.id = $2) AND $3::date BETWEEN p.starts_on AND p.ends_on
      ORDER BY p.starts_on DESC LIMIT 1
      FOR UPDATE OF p`,
    [p.userId, b.placementId ?? null, b.deviceTime]);
  const pl = rows[0];
  if (!pl) throw notFound('Active placement');
  await autoClose(tx, pl.id);

  // 2. Hard refusals and soft flags.
  const prev = (await tx.query<{ latitude: number; longitude: number; accuracy_m: number | null; device_time: Date }>(
    `SELECT latitude, longitude, accuracy_m, device_time FROM wbl_checkins
      WHERE placement_id = $1 AND accepted ORDER BY device_time DESC LIMIT 1`, [pl.id])).rows[0];
  const fix: Fix = { latitude: b.latitude, longitude: b.longitude, accuracyM: b.accuracyM, at: b.deviceTime };
  const s = screen(fix, { now, isMocked: b.isMocked, queuedOffline: b.queuedOffline,
    previous: prev ? { latitude: prev.latitude, longitude: prev.longitude, accuracyM: prev.accuracy_m, at: prev.device_time } : null });
  const refused = s.refuse[0] ?? null;

  // Open shift (if any) decides what an 'in' or 'out' means.
  const open = (await tx.query<{ id: string; opened_at: Date; flags: string[]; inside_in: boolean }>(
    `SELECT a.id, a.opened_at, a.flags, c.inside_geofence AS inside_in FROM ojt_attendance a JOIN wbl_checkins c ON c.id = a.checkin_id
      WHERE a.placement_id = $1 AND a.status = 'open'`, [pl.id])).rows[0];
  if (!refused && b.kind === 'in' && open) throw conflict('already_checked_in', 'You are already checked in');
  if (!refused && b.kind === 'out' && !open) throw conflict('not_checked_in', 'You are not checked in');

  // 3. Store the fix; the trigger fills distance_m and inside_geofence.
  const ins = await tx.query<{ id: string; distance_m: number; inside_geofence: boolean }>(
    `INSERT INTO wbl_checkins (placement_id, kind, device_time, latitude, longitude, accuracy_m, client_mutation_id,
                               accepted, flags, reject_reason, is_mocked, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, distance_m, inside_geofence`,
    [pl.id, b.kind, b.deviceTime, b.latitude, b.longitude, b.accuracyM, b.clientMutationId,
      !refused, s.flags, refused, b.isMocked, b.source]);
  const c = ins.rows[0]!;
  const geo = { inside: c.inside_geofence, distanceM: Math.round(c.distance_m), radiusM: pl.radius,
    toleranceM: Math.min(b.accuracyM ?? 0, MAX_ACCURACY_SLACK_M), site: pl.site_name };

  if (refused) {
    return { replayed: false, checkinId: c.id, accepted: false, reason: refused, flags: s.flags, ...geo, attendance: null,
      hint: refused === 'low_accuracy' ? `Location accuracy must be ${MAX_ACCURACY_M} m or better; step outside or near a window and retry` : undefined,
      totals: await totals(tx, pl.id) };
  }

  // 4. Open or close the shift.
  let attendance: Record<string, unknown> | null = null;
  if (b.kind === 'in') {
    if (c.inside_geofence) {
      const a = await tx.query(
        `INSERT INTO ojt_attendance (placement_id, checkin_id, opened_at, flags) VALUES ($1, $2, $3, $4)
         RETURNING id, opened_at AS "openedAt", status, flags`, [pl.id, c.id, b.deviceTime, s.flags]);
      attendance = a.rows[0]!;
    }
  } else {
    const flags = [...new Set([...open!.flags, ...s.flags])];
    const verified = open!.inside_in && c.inside_geofence && !flags.some((f) => f === 'clock_skew' || f === 'impossible_travel');
    if (b.deviceTime <= open!.opened_at) throw new HttpError(422, 'bad_time', 'Check-out is before check-in');
    const a = await tx.query(
      `UPDATE ojt_attendance SET checkout_id = $2, closed_at = $3, status = 'closed', verified = $4, flags = $5
        WHERE id = $1 RETURNING id, opened_at AS "openedAt", closed_at AS "closedAt", minutes, verified, status, flags`,
      [open!.id, c.id, b.deviceTime, verified, c.inside_geofence ? flags : [...flags, 'checkout_outside']]);
    attendance = a.rows[0]!;
  }
  return { replayed: false, checkinId: c.id, accepted: true, reason: c.inside_geofence ? null : 'outside_geofence', flags: s.flags,
    ...geo, attendance, totals: await totals(tx, pl.id) };
}

export function ojtRouter(deps: { db: Db; realtime: Realtime }) {
  const router = Router();

  router.post('/v1/ojt/checkins', async (req: Request, res) => {
    const p = req.principal!;
    if (!p.roles.includes('student')) throw forbidden('Only apprentices check in');
    const body = CheckIn.parse(req.body);
    const out = await withTx(deps.db, (tx) => recordCheckin(tx, p, body));
    if (!out.replayed && out.accepted) {
      await deps.realtime.publish(`ojt:${p.institutionId}`, { type: `checkin_${body.kind}`, learnerId: p.userId, inside: out.inside });
    }
    res.status(out.replayed ? 200 : out.accepted ? 201 : 422).json(out);
  });

  router.get('/v1/ojt/attendance', async (req: Request, res) => {
    const p = req.principal!;
    const learnerId = p.roles.includes('student') ? p.userId : z.string().uuid().parse(req.query['learnerId']);
    const { rows } = await deps.db.query(
      `SELECT a.id, a.opened_at AS "openedAt", a.closed_at AS "closedAt", a.minutes, a.verified, a.status, a.flags,
              ci.distance_m::int AS "inDistanceM", co.distance_m::int AS "outDistanceM", es.name AS site
         FROM ojt_attendance a JOIN wbl_placements pl ON pl.id = a.placement_id JOIN employer_sites es ON es.id = pl.site_id
         JOIN users u ON u.id = pl.learner_id
         JOIN wbl_checkins ci ON ci.id = a.checkin_id LEFT JOIN wbl_checkins co ON co.id = a.checkout_id
        WHERE pl.learner_id = $1 AND u.institution_id = $2 AND ($3 OR pl.supervisor_id = $4 OR pl.learner_id = $4)
        ORDER BY a.opened_at DESC LIMIT 60`,
      [learnerId, p.institutionId, p.roles.some((r) => r === 'vocational_trainer' || r === 'director'), p.userId]);
    const pl = await deps.db.query(`SELECT * FROM v_ojt_hours WHERE learner_id = $1 ORDER BY starts_on DESC LIMIT 1`, [learnerId]);
    res.json({ shifts: rows, totals: pl.rows[0] ?? null });
  });

  router.post('/v1/ojt/attendance/:id/confirm', async (req: Request, res) => {
    const p = req.principal!;
    const id = z.string().uuid().parse(req.params['id']);
    const { rowCount } = await deps.db.query(
      `UPDATE ojt_attendance a SET confirmed_by = $2 FROM wbl_placements pl
        WHERE a.id = $1 AND pl.id = a.placement_id AND pl.supervisor_id = $2 AND a.status <> 'open' AND NOT a.verified`, [id, p.userId]);
    if (!rowCount) throw notFound('Unverified shift');
    res.json({ id, confirmed: true });
  });

  return router;
}
