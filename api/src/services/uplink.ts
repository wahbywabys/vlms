/**
 * Centre uplink: the training centre's local server talks to the cloud hub
 * whenever it has internet. Nothing here is needed for the centre to work;
 * with no internet each run fails quietly and the next one tries again.
 *
 * Every run (default once a minute):
 *   1. pulls writes that phones handed to the hub while away from the centre
 *      Wi-Fi, checks each relay token, and applies them exactly like
 *      POST /v1/sync (idempotent on clientMutationId), then acks them;
 *   2. uploads new learning records as xAPI statements, paged by the time
 *      this server stored them, so offline replays that arrive late still go;
 *   3. uploads the headline numbers and the learner roster.
 *
 * Status (last success, last error, counts) is kept in vtc.center_uplink and
 * shown on the centre's /join page.
 */
import type { Logger } from 'pino';
import type { Db } from '../lib/db.js';
import { relaySecret, verifyRelayToken } from '../lib/relayToken.js';
import { applyMutations, Mutations } from '../routes/sync.js';
import { centerKpis, currentRisk, learnerRoster } from './centerReport.js';
import { queryStatements } from './xapi.js';

export interface UplinkConfig { hubUrl: string; centerId: string; centerKey: string; intervalMs?: number; batch?: number; version?: string }

export function uplinkFromEnv(env = process.env): UplinkConfig | null {
  const hubUrl = env['CLOUD_HUB_URL']?.trim(), centerId = env['CENTER_ID']?.trim(), centerKey = env['CENTER_KEY']?.trim();
  if (!hubUrl || !centerId || !centerKey) return null;
  return { hubUrl: hubUrl.replace(/\/+$/, ''), centerId, centerKey, intervalMs: Number(env['UPLINK_INTERVAL_S'] ?? 60) * 1000, version: env['VTC_VERSION'] };
}

export async function runUplink(db: Db, cfg: UplinkConfig, log?: Logger) {
  const headers = { authorization: `Bearer ${cfg.centerKey}`, 'x-center-id': cfg.centerId, 'content-type': 'application/json',
    ...(cfg.version ? { 'x-vtc-version': cfg.version } : {}) };
  const hub = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${cfg.hubUrl}/hub/v1/centers/${encodeURIComponent(cfg.centerId)}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`hub ${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json() as Promise<any>;
  };
  await db.query('UPDATE center_uplink SET last_attempt_at = now()');
  try {
    // 1. Relayed writes from phones away from the centre.
    let relayed = 0;
    const secret = relaySecret(cfg.centerKey);
    const { items } = await hub('GET', '/relay') as { items: { seq: number; token: string; mutations: unknown }[] };
    const acked: number[] = [];
    for (const it of items) {
      const done = await db.query('SELECT 1 FROM center_relay_applied WHERE hub_seq = $1', [it.seq]);
      if (!done.rowCount) {
        let results: unknown;
        let userId: string | null = null;
        try {
          const p = await verifyRelayToken(secret, cfg.centerId, it.token);
          userId = p.userId;
          const active = await db.query('SELECT 1 FROM users WHERE id = $1 AND institution_id = $2 AND is_active', [p.userId, p.institutionId]);
          results = active.rowCount ? await applyMutations(db, p, Mutations.parse(it.mutations)) : { rejected: 'unknown_user' };
        } catch (err) {
          results = { rejected: (err as Error).message.slice(0, 200) };
        }
        await db.query('INSERT INTO center_relay_applied (hub_seq, user_id, results) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [it.seq, userId, JSON.stringify(results)]);
        relayed++;
      }
      acked.push(it.seq);
    }
    if (acked.length) await hub('POST', '/relay/ack', { seqs: acked });

    // 2. Learning records, as xAPI statements.
    const { rows: [state] } = await db.query<{ statements_cursor: Date }>('SELECT statements_cursor FROM center_uplink');
    let cursor = new Date(state!.statements_cursor);
    let sent = 0;
    const batch = cfg.batch ?? 500;
    for (;;) {
      const page = await queryStatements(db, { institutionId: null, since: cursor, limit: batch, by: 'received' });
      if (!page.length) break;
      await hub('POST', '/statements', { statements: page.map((r) => r.statement) });
      sent += page.length;
      const last = page.at(-1)!.receivedAt;
      // The cursor is inclusive (the hub keeps one copy per id). A full page that
      // all shares one timestamp would repeat forever, so step past it.
      cursor = last.getTime() === cursor.getTime() ? new Date(last.getTime() + 1) : last;
      await db.query('UPDATE center_uplink SET statements_cursor = $1, statements_sent = statements_sent + $2', [cursor, page.length]);
      if (page.length < batch) break;
    }

    // 3. Headline numbers and roster.
    const risk = await currentRisk(db);
    await hub('POST', '/snapshot', { kpis: await centerKpis(db, risk), learners: await learnerRoster(db, risk) });

    await db.query('UPDATE center_uplink SET last_success_at = now(), last_error = NULL, relay_applied = relay_applied + $1', [relayed]);
    log?.info({ sent, relayed }, 'uplink: synced with cloud hub');
    return { sent, relayed };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    await db.query('UPDATE center_uplink SET last_error = $1', [msg.slice(0, 500)]).catch(() => undefined);
    log?.debug({ err: msg }, 'uplink: hub not reachable, will retry');
    throw err;
  }
}

/** Run forever in the background of the API process. One run at a time. */
export function startUplink(db: Db, cfg: UplinkConfig, log: Logger) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await runUplink(db, cfg, log); } catch { /* recorded in center_uplink; retry next tick */ } finally { busy = false; }
  };
  const timer = setInterval(tick, Math.max(10_000, cfg.intervalMs ?? 60_000));
  timer.unref();
  setTimeout(tick, 5_000).unref();
  log.info({ hub: cfg.hubUrl, center: cfg.centerId }, 'uplink: cloud sync enabled');
  return () => clearInterval(timer);
}
