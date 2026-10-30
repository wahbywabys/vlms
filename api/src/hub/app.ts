/**
 * VTC_LMS cloud hub: where every training centre's local server uploads when
 * it has internet, and where an external dashboard (Wisdom, Power BI, Looker
 * Studio, Grafana, Excel, an LRS…) reads from. Schema: db/hub.sql.
 *
 *   POST /hub/v1/admin/centers                    register a centre, get its key       (HUB_ADMIN_KEY)
 *   GET  /hub/v1/centers/:id/relay                writes waiting for that centre        (centre key)
 *   POST /hub/v1/centers/:id/relay/ack            the centre applied them               (centre key)
 *   POST /hub/v1/centers/:id/statements           learning records as xAPI statements   (centre key)
 *   POST /hub/v1/centers/:id/snapshot             headline numbers and learner roster   (centre key)
 *   POST /hub/v1/relay                            a phone away from its centre hands over queued writes (relay token, CORS)
 *   GET  /hub/v1/export/{centers,kpis,trades,learners,activity}   JSON or ?format=csv  (HUB_EXPORT_KEY)
 *   GET  /hub/v1/xapi/statements                  xAPI 1.0.3 statement feed             (HUB_EXPORT_KEY)
 *   GET  /hub/v1/openapi.json                     machine-readable description of the export API
 *
 * The export key goes in `Authorization: Bearer <key>`, or in ?key=<key> for
 * tools that can only fetch a URL (Excel/Power Query web source, Google Sheets).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import { z, ZodError } from 'zod';
import type { Db } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { relaySecret, verifyRelayToken } from '../lib/relayToken.js';
import { toCsv } from './csv.js';
import { openapi } from './openapi.js';
import type { Outbound } from './outbound.js';

export interface HubDeps { db: Db; log: Logger; adminKey: string; exportKey: string; outbound: Outbound }

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(sha256(a)), y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
};
const bearer = (req: Request) => {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
};
const unauth = () => new HttpError(401, 'unauthenticated', 'Missing or wrong key');

const Statement = z.object({
  id: z.string().uuid(),
  actor: z.object({ account: z.object({ name: z.string().max(80) }), name: z.string().max(200).optional() }).passthrough(),
  verb: z.object({ id: z.string().max(300), display: z.record(z.string()).optional() }).passthrough(),
  object: z.object({ id: z.string().max(500), definition: z.object({ name: z.record(z.string()).optional(), type: z.string().optional() }).passthrough().optional() }).passthrough(),
  result: z.object({ score: z.object({ raw: z.number().optional() }).passthrough().optional(), success: z.boolean().optional() }).passthrough().optional(),
  timestamp: z.string().datetime({ offset: true }),
}).passthrough();
const Snapshot = z.object({
  kpis: z.array(z.object({ institutionId: z.string().uuid(), takenAt: z.string().datetime({ offset: true }) }).passthrough()).max(50),
  learners: z.array(z.object({
    learnerId: z.string().uuid(), institutionId: z.string().uuid(), name: z.string().max(200), nameAr: z.string().max(200).nullable().optional(),
    cohort: z.string().max(200).nullable().optional(), trade: z.string().max(40).nullable().optional(), riskBand: z.string().max(10).nullable().optional(),
    riskProbability: z.number().nullable().optional(), lastActiveAt: z.string().nullable().optional(),
  })).max(20_000),
});
const RelayBody = z.object({
  centerId: z.string().max(48),
  mutations: z.array(z.object({ type: z.enum(['observation', 'checkin', 'logbook', 'consumable']), payload: z.record(z.unknown()) })).min(1).max(100),
});
const ExportQuery = z.object({
  center: z.string().max(48).optional(), format: z.enum(['json', 'csv']).default('json'),
  since: z.coerce.date().optional(), until: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(10_000).default(1000),
});

export function createHubApp(deps: HubDeps) {
  const { db } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // Phones post relays from the centre's own address (http://192.168.x.x), so that route allows any origin.
  app.use('/hub/v1/relay', (req, res, next) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'authorization, content-type');
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });
  // Dashboards running in a browser may read the export API directly.
  app.use(['/hub/v1/export', '/hub/v1/xapi', '/hub/v1/openapi.json'], (req, res, next) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'authorization, x-experience-api-version');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });
  app.use(express.json({ limit: '20mb' }));

  app.get('/healthz', async (_req, res) => { await db.query('SELECT 1'); res.json({ ok: true }); });
  app.get('/hub/v1/openapi.json', (req, res) => res.json(openapi(`${req.protocol}://${req.get('host')}`)));

  // ---- admin --------------------------------------------------------------
  app.post('/hub/v1/admin/centers', async (req, res) => {
    const key = bearer(req);
    if (!key || !sameSecret(key, deps.adminKey)) throw unauth();
    const b = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,47}$/), name: z.string().min(1).max(200), rotate: z.boolean().default(false) }).parse(req.body);
    const centerKey = `vtc_ck_${randomBytes(24).toString('hex')}`;
    const { rows } = await db.query(
      `INSERT INTO centers (id, name, key_hash, relay_secret) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, key_hash = EXCLUDED.key_hash, relay_secret = EXCLUDED.relay_secret WHERE $5
       RETURNING id`, [b.id, b.name, sha256(centerKey), relaySecret(centerKey), b.rotate]);
    if (!rows.length) throw new HttpError(409, 'exists', 'A centre with this id exists; send "rotate": true to issue a new key');
    res.status(201).json({ centerId: b.id, centerKey, note: 'Shown once. Put it in the centre server .env as CENTER_KEY.' });
  });

  // ---- centre uplink ------------------------------------------------------
  const center = async (req: Request, _res: Response, next: NextFunction) => {
    const key = bearer(req);
    const id = String(req.params['id']);
    const { rows } = await db.query<{ key_hash: string }>('SELECT key_hash FROM centers WHERE id = $1', [id]);
    if (!key || !rows[0] || !sameSecret(sha256(key), rows[0].key_hash)) return next(unauth());
    await db.query('UPDATE centers SET last_seen_at = now(), app_version = coalesce($2, app_version) WHERE id = $1', [id, req.get('x-vtc-version') ?? null]);
    next();
  };

  app.get('/hub/v1/centers/:id/relay', center, async (req, res) => {
    const { rows } = await db.query(
      `SELECT seq::int, token, mutations FROM relay WHERE center_id = $1 AND delivered_at IS NULL ORDER BY seq LIMIT 200`, [req.params['id']]);
    res.json({ items: rows });
  });
  app.post('/hub/v1/centers/:id/relay/ack', center, async (req, res) => {
    const { seqs } = z.object({ seqs: z.array(z.number().int()).max(1000) }).parse(req.body);
    const r = await db.query(`UPDATE relay SET delivered_at = now() WHERE center_id = $1 AND seq = ANY($2) AND delivered_at IS NULL`, [req.params['id'], seqs]);
    res.json({ acked: r.rowCount });
  });

  app.post('/hub/v1/centers/:id/statements', center, async (req, res) => {
    const id = String(req.params['id']);
    const { statements } = z.object({ statements: z.array(Statement).max(2000) }).parse(req.body);
    const fresh = [];
    for (const s of statements) {
      const kind = s.object.definition?.type?.split('/').at(-1) ?? null;
      const r = await db.query(
        `INSERT INTO statements (id, center_id, learner_id, learner, verb, activity, activity_name, kind, score, success, occurred_at, statement)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
        [s.id, id, s.actor.account.name, s.actor.name ?? null, s.verb.display?.['en-US'] ?? s.verb.id.split('/').at(-1), s.object.id,
          s.object.definition?.name?.['en-US'] ?? null, kind, s.result?.score?.raw ?? null, s.result?.success ?? null, s.timestamp, s]);
      if (r.rowCount) fresh.push(s);
    }
    res.json({ received: statements.length, stored: fresh.length });
    if (fresh.length) {
      void deps.outbound.webhook('statements.created', id, { statements: fresh });
      void deps.outbound.lrs(fresh);
    }
  });

  app.post('/hub/v1/centers/:id/snapshot', center, async (req, res) => {
    const id = String(req.params['id']);
    const b = Snapshot.parse(req.body);
    for (const k of b.kpis) {
      await db.query(`INSERT INTO snapshots (center_id, institution_id, taken_at, kpis) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [id, k.institutionId, k.takenAt, k]);
    }
    if (b.learners.length) {
      await db.query(
        `INSERT INTO learners (center_id, learner_id, institution_id, name, name_ar, cohort, trade, risk_band, risk_probability, last_active_at, updated_at)
         SELECT $1, x."learnerId", x."institutionId", x.name, x."nameAr", x.cohort, x.trade, x."riskBand", x."riskProbability", x."lastActiveAt", now()
           FROM jsonb_to_recordset($2::jsonb) AS x("learnerId" uuid, "institutionId" uuid, name text, "nameAr" text, cohort text, trade text,
                "riskBand" text, "riskProbability" numeric, "lastActiveAt" timestamptz)
         ON CONFLICT (center_id, learner_id) DO UPDATE SET institution_id = EXCLUDED.institution_id, name = EXCLUDED.name, name_ar = EXCLUDED.name_ar,
           cohort = EXCLUDED.cohort, trade = EXCLUDED.trade, risk_band = EXCLUDED.risk_band, risk_probability = EXCLUDED.risk_probability,
           last_active_at = EXCLUDED.last_active_at, updated_at = now()`, [id, JSON.stringify(b.learners)]);
    }
    res.json({ kpis: b.kpis.length, learners: b.learners.length });
    void deps.outbound.webhook('center.snapshot', id, { kpis: b.kpis });
  });

  // ---- phone relay ----------------------------------------------------------
  app.post('/hub/v1/relay', async (req, res) => {
    const token = bearer(req);
    if (!token) throw unauth();
    const b = RelayBody.parse(req.body);
    const { rows } = await db.query<{ relay_secret: string }>('SELECT relay_secret FROM centers WHERE id = $1', [b.centerId]);
    if (!rows[0]) throw unauth();
    const p = await verifyRelayToken(rows[0].relay_secret, b.centerId, token).catch(() => { throw unauth(); });
    const pending = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM relay WHERE center_id = $1 AND user_id = $2 AND delivered_at IS NULL`, [b.centerId, p.userId]);
    if (pending.rows[0]!.n >= 500) throw new HttpError(429, 'relay_full', 'Too many writes waiting for this centre');
    const r = await db.query<{ seq: string }>(`INSERT INTO relay (center_id, user_id, token, mutations) VALUES ($1, $2, $3, $4) RETURNING seq`,
      [b.centerId, p.userId, token, JSON.stringify(b.mutations)]);
    res.status(202).json({ queued: b.mutations.length, seq: Number(r.rows[0]!.seq) });
  });

  // ---- export for dashboards ----------------------------------------------
  const exporter = (req: Request, _res: Response, next: NextFunction) => {
    const key = bearer(req) ?? (typeof req.query['key'] === 'string' ? req.query['key'] : null);
    if (!key || !sameSecret(key, deps.exportKey)) return next(unauth());
    next();
  };
  const send = (res: Response, name: string, format: 'json' | 'csv', rows: Record<string, unknown>[], columns?: string[]) => {
    if (format === 'csv') {
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `inline; filename="vtc-${name}.csv"`);
      res.send('﻿' + toCsv(rows, columns));          // BOM so Excel reads Arabic names correctly
    } else {
      res.json({ data: rows, count: rows.length });
    }
  };

  app.get('/hub/v1/export/centers', exporter, async (req, res) => {
    const q = ExportQuery.parse(req.query);
    const { rows } = await db.query(
      `SELECT c.id AS center_id, c.name AS center, c.last_seen_at, c.app_version,
              (SELECT max(taken_at) FROM snapshots s WHERE s.center_id = c.id) AS last_snapshot_at,
              (SELECT count(*)::int FROM learners l WHERE l.center_id = c.id) AS learners,
              (SELECT count(*)::int FROM statements st WHERE st.center_id = c.id) AS statements,
              (SELECT count(*)::int FROM relay r WHERE r.center_id = c.id AND r.delivered_at IS NULL) AS relay_waiting
         FROM centers c WHERE ($1::text IS NULL OR c.id = $1) ORDER BY c.id`, [q.center ?? null]);
    send(res, 'centers', q.format, rows);
  });

  /** Headline numbers over time, one row per centre (institution) per upload. Latest only with ?latest=true. */
  app.get('/hub/v1/export/kpis', exporter, async (req, res) => {
    const q = ExportQuery.parse(req.query);
    const latest = req.query['latest'] === 'true';
    const { rows } = await db.query(
      `SELECT ${latest ? 'DISTINCT ON (s.center_id, s.institution_id)' : ''} s.center_id, s.institution_id, s.kpis->>'institution' AS institution,
              s.taken_at, (s.kpis->>'learners')::int AS learners, (s.kpis->>'staff')::int AS staff,
              (s.kpis->>'activeLearners7d')::int AS active_learners_7d, (s.kpis->>'vlabSessions7d')::int AS vlab_sessions_7d,
              (s.kpis->>'vlabPassRate30d')::numeric AS vlab_pass_rate_30d, (s.kpis->>'floorObservations7d')::int AS floor_observations_7d,
              (s.kpis->>'floorAvg30d')::numeric AS floor_avg_30d, (s.kpis->>'openSafetyAlerts')::int AS open_safety_alerts,
              (s.kpis->>'ojtCheckins7d')::int AS ojt_checkins_7d, (s.kpis#>>'{risk,low}')::int AS risk_low,
              (s.kpis#>>'{risk,watch}')::int AS risk_watch, (s.kpis#>>'{risk,high}')::int AS risk_high
         FROM snapshots s
        WHERE ($1::text IS NULL OR s.center_id = $1) AND ($2::timestamptz IS NULL OR s.taken_at >= $2) AND ($3::timestamptz IS NULL OR s.taken_at < $3)
        ORDER BY ${latest ? 's.center_id, s.institution_id, s.taken_at DESC' : 's.taken_at DESC'} LIMIT $4`,
      [q.center ?? null, q.since ?? null, q.until ?? null, q.limit]);
    send(res, 'kpis', q.format, rows);
  });

  /** Per-trade numbers from each centre's latest upload. */
  app.get('/hub/v1/export/trades', exporter, async (req, res) => {
    const q = ExportQuery.parse(req.query);
    const { rows } = await db.query(
      `SELECT s.center_id, s.institution_id, s.taken_at, t->>'trade' AS trade, (t->>'learners')::int AS learners,
              (t->>'floorAvg30d')::numeric AS floor_avg_30d, (t->>'vlabPassRate30d')::numeric AS vlab_pass_rate_30d, (t->>'atRisk')::int AS at_risk
         FROM (SELECT DISTINCT ON (center_id, institution_id) * FROM snapshots
                WHERE ($1::text IS NULL OR center_id = $1) ORDER BY center_id, institution_id, taken_at DESC) s,
              jsonb_array_elements(s.kpis->'trades') t
        ORDER BY s.center_id, trade`, [q.center ?? null]);
    send(res, 'trades', q.format, rows);
  });

  app.get('/hub/v1/export/learners', exporter, async (req, res) => {
    const q = ExportQuery.parse(req.query);
    const { rows } = await db.query(
      `SELECT center_id, learner_id, institution_id, name, name_ar, cohort, trade, risk_band, risk_probability, last_active_at, updated_at
         FROM learners WHERE ($1::text IS NULL OR center_id = $1) ORDER BY center_id, name LIMIT $2`, [q.center ?? null, q.limit]);
    send(res, 'learners', q.format, rows);
  });

  /** Every learning record, flat (one row per statement). Page with ?since=<received_at of the last row>. */
  app.get('/hub/v1/export/activity', exporter, async (req, res) => {
    const q = ExportQuery.parse(req.query);
    const { rows } = await db.query(
      `SELECT id, center_id, learner_id, learner, kind, verb, activity, activity_name, score, success, occurred_at, received_at
         FROM statements
        WHERE ($1::text IS NULL OR center_id = $1) AND ($2::timestamptz IS NULL OR received_at > $2) AND ($3::timestamptz IS NULL OR occurred_at < $3)
        ORDER BY received_at, id LIMIT $4`, [q.center ?? null, q.since ?? null, q.until ?? null, q.limit]);
    send(res, 'activity', q.format, rows);
  });

  /** xAPI 1.0.3 statement feed, the shape an LRS returns (statements + more). */
  app.get('/hub/v1/xapi/statements', exporter, async (req, res) => {
    const q = ExportQuery.parse(req.query);
    const limit = Math.min(q.limit, 1000);
    const { rows } = await db.query<{ statement: unknown; received_at: Date }>(
      `SELECT statement, received_at FROM statements WHERE ($1::text IS NULL OR center_id = $1) AND ($2::timestamptz IS NULL OR received_at > $2)
        ORDER BY received_at, id LIMIT $3`, [q.center ?? null, q.since ?? null, limit]);
    res.setHeader('x-experience-api-version', '1.0.3');
    const last = rows.at(-1);
    res.json({ statements: rows.map((r) => r.statement), more: rows.length === limit && last
      ? `/hub/v1/xapi/statements?since=${encodeURIComponent(new Date(last.received_at).toISOString())}${q.center ? `&center=${q.center}` : ''}` : '' });
  });

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof ZodError) res.status(400).json({ error: 'invalid_request', issues: err.issues });
    else if (err instanceof HttpError) res.status(err.status).json({ error: err.code, message: err.message });
    else if (err?.type === 'entity.too.large') res.status(413).json({ error: 'too_large' });
    else if (err?.type === 'entity.parse.failed') res.status(400).json({ error: 'invalid_json' });
    else { deps.log.error({ err, path: req.path }, 'hub: unhandled error'); res.status(500).json({ error: 'internal' }); }
  };
  app.use(onError);
  return app;
}
