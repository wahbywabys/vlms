/**
 * QR / RFID safety passports and machine interlocks
 *
 * Learner (phone, after scanning the QR label on a machine):
 *   GET  /v1/safety/scan/:code                  machine, eligibility, current passport and unlock
 *   POST /v1/safety/scan/:code/precheck         serve a pre-check quiz (or reuse a valid passport)
 *   POST /v1/safety/prechecks/:attemptId/submit grade it; on a pass issue a passport + unlock token
 *   GET  /v1/safety/locks/:lockId               state of an unlock (the phone polls this)
 *   POST /v1/safety/locks/:lockId/release       finished: lock the machine again
 *
 * Staff (trainer tablet):
 *   GET  /v1/safety/machines                    every machine with its live unlock
 *   POST /v1/safety/locks/:lockId/release       with {revoke:true} = remote stop, revokes the passport
 *
 * Interlock controller (machine side, X-Machine-Key header, no user token):
 *   GET  /v1/machines/:tag/lock                 the live unlock, for controllers that poll
 *   POST /v1/machines/:tag/handshake            {token | pin}: energise the machine
 *   POST /v1/machines/:tag/heartbeat            {relay, estop}: report state; an e-stop revokes the unlock
 *
 * Unlock signals also go out on Redis channel `machine:<tag>`. A machine with
 * no controller key registered is driven by a virtual controller (the demo
 * rigs): its unlock goes straight to 'unlocked'.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import type { Realtime } from '../lib/redis.js';
import { gradePrecheck, serve, type PrecheckItem } from '../services/precheck.js';
import * as repo from '../services/vlabRepository.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const TOKEN_TTL_S = 120;
const LEVEL_OK = ['novice', 'intermediate', 'autonomous', 'master'];

interface AssetRow {
  id: string; asset_tag: string; name: string; name_ar: string | null; status: string; category: string;
  institution_id: string; workshop: string; workshop_ar: string | null; trade_id: string | null;
  required_competency_id: string | null; competency_code: string | null; competency_title: string | null;
  precheck_id: string | null; controller_key_hash: string | null; digital_twin_lab_id: string | null;
  brand: string | null; model_no: string | null; serial_no: string | null; photo_media_id: string | null; center: string | null;
  type_name: string | null; type_name_ar: string | null; twin_id: string | null; twin_match: string | null;
}
interface PrecheckRow {
  id: string; code: string; title: string; title_ar: string | null; items: PrecheckItem[];
  draw_count: number; pass_mark: number; passport_hours: number; unlock_minutes: number; cooldown_s: number;
}

const ASSET_SQL = `
  SELECT a.id, a.asset_tag, a.name, NULL::text AS name_ar, a.status::text, a.category, w.institution_id,
         w.name AS workshop, w.name_ar AS workshop_ar, w.trade_id, a.required_competency_id,
         c.code AS competency_code, c.title AS competency_title, a.precheck_id, a.controller_key_hash, a.digital_twin_lab_id,
         a.brand, a.model_no, a.serial_no, a.photo_media_id, ctr.name AS center,
         mt.name AS type_name, mt.name_ar AS type_name_ar, mt.model_id AS twin_id, mt.twin_match
    FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
    LEFT JOIN centers ctr ON ctr.id = w.center_id LEFT JOIN machine_types mt ON mt.id = a.machine_type_id
    LEFT JOIN competencies c ON c.id = a.required_competency_id`;

async function assetByCode(db: Db | Tx, code: string, p: Principal): Promise<AssetRow> {
  // Learners must scan the printed QR code; staff may also type the asset tag.
  const { rows } = await db.query<AssetRow>(
    `${ASSET_SQL} WHERE w.institution_id = $2 AND (a.qr_code = $1 OR ($3 AND a.asset_tag = $1))`,
    [code, p.institutionId, isStaff(p)]);
  if (!rows[0]) throw notFound('Machine');
  return rows[0];
}

async function loadPrecheck(db: Db | Tx, id: string): Promise<PrecheckRow> {
  const { rows } = await db.query<PrecheckRow>(
    `SELECT id, code, title, title_ar, items, draw_count, pass_mark::float, passport_hours, unlock_minutes, cooldown_s
       FROM safety_prechecks WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('Pre-check');
  return rows[0];
}

/** Reasons the machine may not be unlocked for this learner right now (empty = eligible). */
async function blockers(db: Db | Tx, a: AssetRow, learnerId: string): Promise<string[]> {
  const out: string[] = [];
  if (a.status === 'maintenance' || a.status === 'locked_out' || a.status === 'retired') out.push(`machine_${a.status}`);
  const live = await db.query<{ learner_id: string }>(
    `SELECT learner_id FROM machine_locks WHERE asset_id = $1 AND state IN ('unlock_pending', 'unlocked')`, [a.id]);
  if (live.rows[0] && live.rows[0].learner_id !== learnerId) out.push('machine_in_use');
  if (a.required_competency_id) {
    const lv = await db.query<{ level: string }>(
      `SELECT level::text FROM learner_competencies WHERE learner_id = $1 AND competency_id = $2`, [learnerId, a.required_competency_id]);
    if (!lv.rows[0] || !LEVEL_OK.includes(lv.rows[0].level)) out.push('missing_competency');
  }
  if (!a.precheck_id) out.push('no_precheck');
  return out;
}

async function validPassport(db: Db | Tx, assetId: string, learnerId: string) {
  const { rows } = await db.query<{ id: string; valid_until: Date; issued_at: Date }>(
    `SELECT id, valid_until, issued_at FROM safety_passports
      WHERE asset_id = $1 AND learner_id = $2 AND revoked_at IS NULL AND valid_until > now()
      ORDER BY valid_until DESC LIMIT 1`, [assetId, learnerId]);
  return rows[0] ?? null;
}

const lockView = (l: Record<string, unknown>) => ({
  id: l['id'], state: l['state'], issuedAt: l['issued_at'], tokenExpiresAt: l['token_expires_at'],
  unlockedAt: l['unlocked_at'], sessionEndsAt: l['session_ends_at'], releasedAt: l['released_at'], reason: l['reason'],
});

export function safetyRouter(deps: { db: Db; realtime: Realtime }) {
  const router = Router();
  const signal = (tag: string, msg: Record<string, unknown>) => deps.realtime.publish(`machine:${tag}`, { tag, ...msg, at: new Date().toISOString() });

  /** Issues an unlock for a learner holding a valid passport. Runs inside `tx`. */
  async function issueUnlock(tx: Tx, a: AssetRow, learnerId: string, passportId: string, unlockMinutes: number) {
    const token = randomBytes(24).toString('base64url');
    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const virtual = !a.controller_key_hash;
    const { rows } = await tx.query(
      `INSERT INTO machine_locks (asset_id, learner_id, passport_id, state, token_hash, pin_code, token_expires_at,
                                  unlocked_at, session_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7),
               CASE WHEN $8 THEN now() END, CASE WHEN $8 THEN now() + make_interval(mins => $9) END)
       RETURNING *`,
      [a.id, learnerId, passportId, virtual ? 'unlocked' : 'unlock_pending', sha256(token), pin, TOKEN_TTL_S, virtual, unlockMinutes])
      .catch((e: { code?: string }) => {
        if (e.code === '23505') throw conflict('machine_in_use', 'Someone else is using this machine');
        throw e;
      });
    const lock = rows[0]!;
    if (virtual) await energise(tx, a, lock['id'] as string, learnerId);
    return { lock, token, pin, virtual };
  }

  /** Machine is live: open a checkout and mark it in use. */
  async function energise(tx: Tx, a: AssetRow, lockId: string, learnerId: string) {
    const co = await tx.query<{ id: string }>(
      `INSERT INTO asset_checkouts (asset_id, user_id, access_granted, condition_out) VALUES ($1, $2, true, 'unlocked via safety passport')
       RETURNING id`, [a.id, learnerId]);
    await tx.query(`UPDATE machine_locks SET checkout_id = $2 WHERE id = $1`, [lockId, co.rows[0]!.id]);
    await tx.query(`UPDATE workshop_assets SET status = 'in_use' WHERE id = $1`, [a.id]);
  }

  async function release(tx: Tx, lockId: string, by: string, state: 'released' | 'revoked', reason: string) {
    const { rows } = await tx.query<{ asset_id: string; checkout_id: string | null; passport_id: string | null; learner_id: string }>(
      `UPDATE machine_locks SET state = $2, released_at = now(), released_by = $3, reason = $4
        WHERE id = $1 AND state IN ('unlock_pending', 'unlocked') RETURNING asset_id, checkout_id, passport_id, learner_id`,
      [lockId, state, by, reason]);
    const l = rows[0];
    if (!l) throw conflict('not_live', 'This unlock has already ended');
    if (l.checkout_id) await tx.query(`UPDATE asset_checkouts SET returned_at = now(), condition_in = $2 WHERE id = $1 AND returned_at IS NULL`, [l.checkout_id, reason]);
    await tx.query(`UPDATE workshop_assets SET status = 'available' WHERE id = $1 AND status = 'in_use'`, [l.asset_id]);
    if (state === 'revoked' && l.passport_id) {
      await tx.query(`UPDATE safety_passports SET revoked_at = now(), revoked_by = $2, revoke_reason = $3 WHERE id = $1`, [l.passport_id, by, reason]);
    }
    return l;
  }

  router.get('/v1/safety/scan/:code', async (req: Request, res) => {
    const p = req.principal!;
    await deps.db.query('SELECT expire_machine_locks()');
    const a = await assetByCode(deps.db, String(req.params['code']), p);
    const learnerId = p.userId;
    const [why, passport, live, pc] = await Promise.all([
      blockers(deps.db, a, learnerId), validPassport(deps.db, a.id, learnerId),
      deps.db.query(`SELECT * FROM machine_locks WHERE asset_id = $1 AND state IN ('unlock_pending', 'unlocked')`, [a.id]),
      a.precheck_id ? loadPrecheck(deps.db, a.precheck_id) : null,
    ]);
    const mine = live.rows[0] && live.rows[0]['learner_id'] === learnerId ? lockView(live.rows[0]) : null;
    res.json({
      machine: { tag: a.asset_tag, name: a.name, status: a.status, workshop: a.workshop, workshopAr: a.workshop_ar, tradeId: a.trade_id,
        requiredCompetency: a.competency_code ? { code: a.competency_code, title: a.competency_title } : null,
        controller: a.controller_key_hash ? 'hardware' : 'virtual',
        // The real machine, from the register, so the learner can check it is the one in front of them.
        center: a.center, typeName: a.type_name, typeNameAr: a.type_name_ar, brand: a.brand, model: a.model_no, serial: a.serial_no,
        photoId: a.photo_media_id, twin: a.twin_id ? { id: a.twin_id, match: a.twin_match } : null },
      precheck: pc ? { code: pc.code, title: pc.title, titleAr: pc.title_ar, questions: Math.max(pc.draw_count, pc.items.filter((i) => i.critical).length), unlockMinutes: pc.unlock_minutes } : null,
      eligible: why.length === 0, blockers: why,
      passport: passport ? { id: passport.id, validUntil: passport.valid_until } : null,
      lock: mine,
    });
  });

  router.post('/v1/safety/scan/:code/precheck', async (req: Request, res) => {
    const p = req.principal!;
    if (!p.roles.includes('student')) throw forbidden('Only learners take machine pre-checks');
    const out = await withTx(deps.db, async (tx) => {
      await tx.query('SELECT expire_machine_locks()');
      const a = await assetByCode(tx, String(req.params['code']), p);
      const why = await blockers(tx, a, p.userId);
      if (why.length) {
        await tx.query(`INSERT INTO asset_checkouts (asset_id, user_id, access_granted, denial_reason) VALUES ($1, $2, false, $3)`,
          [a.id, p.userId, why.includes('missing_competency') && a.competency_code ? `missing competency ${a.competency_code}` : why.join(', ')]);
        throw new HttpError(403, 'not_eligible', 'This machine cannot be unlocked for you now', { blockers: why });
      }
      const pc = await loadPrecheck(tx, a.precheck_id!);
      // A passport from earlier in the shift skips the quiz.
      const passport = await validPassport(tx, a.id, p.userId);
      if (passport) {
        const live = await tx.query(`SELECT * FROM machine_locks WHERE asset_id = $1 AND learner_id = $2 AND state IN ('unlock_pending', 'unlocked')`, [a.id, p.userId]);
        if (live.rows[0]) return { reused: true, passport: { id: passport.id, validUntil: passport.valid_until }, lock: lockView(live.rows[0]) };
        const u = await issueUnlock(tx, a, p.userId, passport.id, pc.unlock_minutes);
        return { reused: true, passport: { id: passport.id, validUntil: passport.valid_until }, lock: { ...lockView(u.lock), token: u.token, pin: u.pin }, signal: u };
      }
      const last = await tx.query<{ submitted_at: Date }>(
        `SELECT submitted_at FROM safety_precheck_attempts WHERE learner_id = $1 AND asset_id = $2 AND passed = false
          AND submitted_at > now() - make_interval(secs => $3) ORDER BY submitted_at DESC LIMIT 1`, [p.userId, a.id, pc.cooldown_s]);
      if (last.rows[0]) {
        const wait = Math.ceil(pc.cooldown_s - (Date.now() - last.rows[0].submitted_at.getTime()) / 1000);
        throw new HttpError(429, 'cooldown', `Read the safety card, then try again in ${wait} s`, { retryAfterS: wait });
      }
      const attempt = await tx.query<{ id: string; expires_at: Date }>(
        `INSERT INTO safety_precheck_attempts (precheck_id, asset_id, learner_id, served_item_ids) VALUES ($1, $2, $3, '{}') RETURNING id, expires_at`,
        [pc.id, a.id, p.userId]);
      const items = serve({ items: pc.items, drawCount: pc.draw_count, passMark: pc.pass_mark }, attempt.rows[0]!.id);
      await tx.query(`UPDATE safety_precheck_attempts SET served_item_ids = $2 WHERE id = $1`, [attempt.rows[0]!.id, items.map((i) => i.id)]);
      return { reused: false, attemptId: attempt.rows[0]!.id, expiresAt: attempt.rows[0]!.expires_at, title: pc.title, titleAr: pc.title_ar, items };
    });
    if ('signal' in out && out.signal) {
      const { signal: u, ...body } = out;
      await signal(String(req.params['code']), { type: 'unlock', lockId: u.lock['id'], tokenHash: u.lock['token_hash'], virtual: u.virtual });
      res.status(201).json(body);
      return;
    }
    res.status(201).json(out);
  });

  const Submit = z.object({ answers: z.record(z.string().max(8)) });
  router.post('/v1/safety/prechecks/:attemptId/submit', async (req: Request, res) => {
    const p = req.principal!;
    const attemptId = z.string().uuid().parse(req.params['attemptId']);
    const { answers } = Submit.parse(req.body);
    const out = await withTx(deps.db, async (tx) => {
      const { rows } = await tx.query<{ precheck_id: string; asset_id: string; learner_id: string; served_item_ids: string[]; submitted_at: Date | null; expired: boolean }>(
        `SELECT precheck_id, asset_id, learner_id, served_item_ids, submitted_at, expires_at < now() AS expired
           FROM safety_precheck_attempts WHERE id = $1 FOR UPDATE`, [attemptId]);
      const at = rows[0];
      if (!at || at.learner_id !== p.userId) throw notFound('Pre-check attempt');
      if (at.submitted_at) throw conflict('already_submitted', 'This pre-check was already submitted');
      if (at.expired) throw new HttpError(410, 'expired', 'The pre-check timed out; scan the machine again');
      const pc = await loadPrecheck(tx, at.precheck_id);
      const result = gradePrecheck({ items: pc.items, drawCount: pc.draw_count, passMark: pc.pass_mark }, at.served_item_ids, answers);
      await tx.query(
        `UPDATE safety_precheck_attempts SET answers = $2, score = $3, passed = $4, critical_missed = $5, submitted_at = now() WHERE id = $1`,
        [attemptId, answers, result.score, result.passed, result.criticalMissed]);
      const a = (await tx.query<AssetRow>(`${ASSET_SQL} WHERE a.id = $1`, [at.asset_id])).rows[0]!;
      if (!result.passed) {
        if (result.criticalMissed.length) {
          await repo.insertAlerts(tx, [{ institutionId: p.institutionId, learnerId: p.userId, source: 'rfid', criterionKey: 'precheck',
            detail: `Failed the safety pre-check at ${a.asset_tag} (critical: ${result.criticalMissed.join(', ')})` }]);
        }
        await tx.query(`INSERT INTO asset_checkouts (asset_id, user_id, access_granted, denial_reason) VALUES ($1, $2, false, 'safety pre-check not passed')`, [a.id, p.userId]);
        return { result, passport: null, lock: null };
      }
      const why = await blockers(tx, a, p.userId);
      if (why.length) throw new HttpError(403, 'not_eligible', 'This machine cannot be unlocked for you now', { blockers: why });
      const pass = await tx.query<{ id: string; valid_until: Date }>(
        `INSERT INTO safety_passports (learner_id, asset_id, precheck_id, attempt_id, valid_until)
         VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5)) RETURNING id, valid_until`,
        [p.userId, a.id, pc.id, attemptId, pc.passport_hours]);
      const u = await issueUnlock(tx, a, p.userId, pass.rows[0]!.id, pc.unlock_minutes);
      return { result, passport: { id: pass.rows[0]!.id, validUntil: pass.rows[0]!.valid_until }, lock: { ...lockView(u.lock), token: u.token, pin: u.pin }, u, tag: a.asset_tag };
    });
    if ('u' in out && out.u) {
      const { u, tag, ...body } = out;
      await signal(tag, { type: 'unlock', lockId: u.lock['id'], tokenHash: u.lock['token_hash'], virtual: u.virtual });
      res.json(body);
      return;
    }
    res.json(out);
  });

  router.get('/v1/safety/locks/:lockId', async (req: Request, res) => {
    const p = req.principal!;
    await deps.db.query('SELECT expire_machine_locks()');
    const { rows } = await deps.db.query(
      `SELECT l.*, a.asset_tag FROM machine_locks l JOIN workshop_assets a ON a.id = l.asset_id
        JOIN users u ON u.id = l.learner_id WHERE l.id = $1 AND u.institution_id = $2`, [z.string().uuid().parse(req.params['lockId']), p.institutionId]);
    const l = rows[0];
    if (!l || (l['learner_id'] !== p.userId && !isStaff(p))) throw notFound('Unlock');
    res.json({ lock: { ...lockView(l), tag: l['asset_tag'] } });
  });

  const Release = z.object({ reason: z.string().trim().max(300).optional(), revoke: z.boolean().default(false) });
  router.post('/v1/safety/locks/:lockId/release', async (req: Request, res) => {
    const p = req.principal!;
    const lockId = z.string().uuid().parse(req.params['lockId']);
    const body = Release.parse(req.body ?? {});
    if (body.revoke && !isStaff(p)) throw forbidden('Only staff can revoke');
    const out = await withTx(deps.db, async (tx) => {
      const { rows } = await tx.query<{ learner_id: string; asset_tag: string; institution_id: string }>(
        `SELECT l.learner_id, a.asset_tag, u.institution_id FROM machine_locks l JOIN workshop_assets a ON a.id = l.asset_id
           JOIN users u ON u.id = l.learner_id WHERE l.id = $1 FOR UPDATE OF l`, [lockId]);
      const l = rows[0];
      if (!l || l.institution_id !== p.institutionId || (l.learner_id !== p.userId && !isStaff(p))) throw notFound('Unlock');
      const reason = body.reason ?? (body.revoke ? 'stopped remotely by trainer' : 'finished by learner');
      await release(tx, lockId, p.userId, body.revoke ? 'revoked' : 'released', reason);
      if (body.revoke) {
        await repo.insertAlerts(tx, [{ institutionId: p.institutionId, learnerId: l.learner_id, source: 'rfid', criterionKey: 'remote_stop',
          detail: `${l.asset_tag} stopped remotely: ${reason}` }]);
      }
      return l;
    });
    await signal(out.asset_tag, { type: 'lock', lockId, reason: body.revoke ? 'revoked' : 'released' });
    res.json({ id: lockId, state: body.revoke ? 'revoked' : 'released' });
  });

  router.get('/v1/safety/machines', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p) && !p.roles.includes('director')) throw forbidden();
    const trade = typeof req.query['trade'] === 'string' && req.query['trade'] !== 'all' ? req.query['trade'] : null;
    await deps.db.query('SELECT expire_machine_locks()');
    const { rows } = await deps.db.query(
      `SELECT a.asset_tag AS tag, a.name, a.status::text, a.qr_code AS "qrCode", w.trade_id AS "tradeId",
              (a.controller_key_hash IS NOT NULL) AS hardware, a.controller_seen_at AS "controllerSeenAt",
              pc.code AS "precheckCode", c.code AS "competencyCode",
              l.id AS "lockId", l.state::text AS "lockState", l.session_ends_at AS "sessionEndsAt", l.unlocked_at AS "unlockedAt",
              u.id AS "learnerId", u.full_name AS "learnerName", u.full_name_ar AS "learnerNameAr",
              (SELECT count(*)::int FROM safety_passports sp WHERE sp.asset_id = a.id AND sp.revoked_at IS NULL AND sp.valid_until > now()) AS "validPassports",
              (SELECT count(*)::int FROM safety_precheck_attempts x WHERE x.asset_id = a.id AND x.passed = false AND x.submitted_at::date = current_date) AS "failedToday",
              ctr.code AS "centerCode", ctr.name AS center, ctr.name_ar AS "centerAr", w.name AS workshop, w.name_ar AS "workshopAr",
              a.brand, a.model_no AS model, a.serial_no AS serial, mt.name AS "typeName", mt.name_ar AS "typeNameAr"
         FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
         LEFT JOIN centers ctr ON ctr.id = w.center_id LEFT JOIN machine_types mt ON mt.id = a.machine_type_id
         LEFT JOIN safety_prechecks pc ON pc.id = a.precheck_id
         LEFT JOIN competencies c ON c.id = a.required_competency_id
         LEFT JOIN machine_locks l ON l.asset_id = a.id AND l.state IN ('unlock_pending', 'unlocked')
         LEFT JOIN users u ON u.id = l.learner_id
        WHERE w.institution_id = $1 AND a.category = 'machine' AND ($2::text IS NULL OR w.trade_id = $2)
        ORDER BY a.asset_tag`, [p.institutionId, trade]);
    res.json({ machines: rows });
  });

  return router;
}

/**
 * Interlock controller endpoints. Mounted before user auth: a controller
 * authenticates with its own key (X-Machine-Key), whose SHA-256 is on the asset.
 */
export function machineControllerRouter(deps: { db: Db; realtime: Realtime }) {
  const router = Router();

  async function controller(req: Request) {
    const key = req.header('x-machine-key') ?? '';
    const { rows } = await deps.db.query<{ id: string; controller_key_hash: string | null; institution_id: string; asset_tag: string }>(
      `SELECT a.id, a.controller_key_hash, w.institution_id, a.asset_tag FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
        WHERE a.asset_tag = $1`, [String(req.params['tag'])]);
    const a = rows[0];
    const ok = a?.controller_key_hash && key.length >= 16
      && timingSafeEqual(Buffer.from(sha256(key)), Buffer.from(a.controller_key_hash));
    if (!a || !ok) throw new HttpError(401, 'unauthenticated', 'Unknown machine or key');
    await deps.db.query(`UPDATE workshop_assets SET controller_seen_at = now() WHERE id = $1`, [a.id]);
    return a;
  }

  router.get('/v1/machines/:tag/lock', async (req: Request, res) => {
    const a = await controller(req);
    await deps.db.query('SELECT expire_machine_locks()');
    const { rows } = await deps.db.query(
      `SELECT l.id, l.state::text, l.token_hash AS "tokenHash", l.token_expires_at AS "tokenExpiresAt", l.session_ends_at AS "sessionEndsAt",
              u.safety_badge_uid AS "badgeUid"
         FROM machine_locks l JOIN users u ON u.id = l.learner_id
        WHERE l.asset_id = $1 AND l.state IN ('unlock_pending', 'unlocked')`, [a.id]);
    res.json({ lock: rows[0] ?? null });
  });

  const Handshake = z.object({ token: z.string().min(16).max(64).optional(), pin: z.string().regex(/^\d{6}$/).optional() })
    .refine((b) => b.token || b.pin, 'token or pin required');
  router.post('/v1/machines/:tag/handshake', async (req: Request, res) => {
    const a = await controller(req);
    const body = Handshake.parse(req.body);
    const out = await withTx(deps.db, async (tx) => {
      await tx.query('SELECT expire_machine_locks()');
      const { rows } = await tx.query<{ id: string; learner_id: string; token_hash: string; pin_code: string; passport_id: string }>(
        `SELECT l.id, l.learner_id, l.token_hash, l.pin_code, l.passport_id FROM machine_locks l
          WHERE l.asset_id = $1 AND l.state = 'unlock_pending' FOR UPDATE`, [a.id]);
      const l = rows[0];
      if (!l) throw conflict('no_pending_unlock', 'No unlock is waiting for this machine');
      const match = body.token ? sha256(body.token) === l.token_hash : body.pin === l.pin_code;
      if (!match) throw new HttpError(401, 'bad_token', 'Token does not match');
      const pc = await tx.query<{ unlock_minutes: number }>(
        `SELECT pc.unlock_minutes FROM safety_passports sp JOIN safety_prechecks pc ON pc.id = sp.precheck_id WHERE sp.id = $1`, [l.passport_id]);
      const co = await tx.query<{ id: string }>(
        `INSERT INTO asset_checkouts (asset_id, user_id, access_granted, condition_out) VALUES ($1, $2, true, 'unlocked via safety passport') RETURNING id`,
        [a.id, l.learner_id]);
      await tx.query(
        `UPDATE machine_locks SET state = 'unlocked', unlocked_at = now(), checkout_id = $2, pin_code = NULL,
                session_ends_at = now() + make_interval(mins => $3) WHERE id = $1`, [l.id, co.rows[0]!.id, pc.rows[0]?.unlock_minutes ?? 120]);
      await tx.query(`UPDATE workshop_assets SET status = 'in_use' WHERE id = $1`, [a.id]);
      return { lockId: l.id };
    });
    await deps.realtime.publish(`machine:${a.asset_tag}`, { type: 'unlocked', lockId: out.lockId });
    res.json({ relay: 'on', ...out });
  });

  const Heartbeat = z.object({ relay: z.enum(['on', 'off']), estop: z.boolean().default(false), detail: z.string().max(200).optional() });
  router.post('/v1/machines/:tag/heartbeat', async (req: Request, res) => {
    const a = await controller(req);
    const hb = Heartbeat.parse(req.body);
    let revoked: string | null = null;
    if (hb.estop) {
      revoked = await withTx(deps.db, async (tx) => {
        const { rows } = await tx.query<{ id: string; learner_id: string; checkout_id: string | null; passport_id: string | null }>(
          `UPDATE machine_locks SET state = 'revoked', released_at = now(), reason = 'emergency stop pressed'
            WHERE asset_id = $1 AND state IN ('unlock_pending', 'unlocked') RETURNING id, learner_id, checkout_id, passport_id`, [a.id]);
        const l = rows[0];
        if (!l) return null;
        if (l.checkout_id) await tx.query(`UPDATE asset_checkouts SET returned_at = now(), condition_in = 'emergency stop' WHERE id = $1`, [l.checkout_id]);
        await tx.query(`UPDATE workshop_assets SET status = 'locked_out' WHERE id = $1`, [a.id]);
        await repo.insertAlerts(tx, [{ institutionId: a.institution_id, learnerId: l.learner_id, source: 'rfid', criterionKey: 'estop',
          detail: `Emergency stop on ${a.asset_tag}${hb.detail ? `: ${hb.detail}` : ''}; machine locked out until a trainer inspects it` }]);
        return l.id;
      });
      await deps.realtime.publish(`vlab:alerts:${a.institution_id}`, { type: 'estop', tag: a.asset_tag });
    }
    res.json({ ok: true, revoked });
  });

  return router;
}
