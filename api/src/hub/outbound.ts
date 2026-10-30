/**
 * Pushes from the hub to the outside: signed webhooks for any dashboard or
 * automation tool, and xAPI statements to an LRS. Both are best effort: an
 * upload from a centre never fails because a dashboard is down, and the pull
 * API (export routes) always has the full data.
 */
import { createHmac } from 'node:crypto';
import type { Logger } from 'pino';

export interface OutboundConfig {
  webhookUrls: string[]; webhookSecret?: string;
  lrs?: { endpoint: string; username?: string; password?: string };
}

export function outboundFromEnv(env = process.env): OutboundConfig {
  const lrs = env['HUB_LRS_ENDPOINT']?.trim();
  return {
    webhookUrls: (env['HUB_WEBHOOK_URLS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    webhookSecret: env['HUB_WEBHOOK_SECRET'] || undefined,
    lrs: lrs ? { endpoint: lrs.replace(/\/+$/, ''), username: env['HUB_LRS_USERNAME'], password: env['HUB_LRS_PASSWORD'] } : undefined,
  };
}

export function createOutbound(cfg: OutboundConfig, log: Logger) {
  const post = async (url: string, body: string, headers: Record<string, string>) => {
    try {
      const r = await fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers }, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) log.warn({ url, status: r.status }, 'hub outbound: rejected');
    } catch (err) {
      log.warn({ url, err: (err as Error).message }, 'hub outbound: unreachable');
    }
  };
  return {
    /** POST {event, centerId, sentAt, data} to every webhook, signed with X-VTC-Signature: sha256=<hex HMAC of the body>. */
    async webhook(event: string, centerId: string, data: unknown) {
      if (!cfg.webhookUrls.length) return;
      const body = JSON.stringify({ event, centerId, sentAt: new Date().toISOString(), data });
      const sig: Record<string, string> = cfg.webhookSecret ? { 'x-vtc-signature': `sha256=${createHmac('sha256', cfg.webhookSecret).update(body).digest('hex')}` } : {};
      await Promise.all(cfg.webhookUrls.map((u) => post(u, body, { 'x-vtc-event': event, ...sig })));
    },
    async lrs(statements: unknown[]) {
      if (!cfg.lrs || !statements.length) return;
      const auth: Record<string, string> = cfg.lrs.username ? { authorization: `Basic ${Buffer.from(`${cfg.lrs.username}:${cfg.lrs.password ?? ''}`).toString('base64')}` } : {};
      await post(`${cfg.lrs.endpoint}/statements`, JSON.stringify(statements), { 'x-experience-api-version': '1.0.3', ...auth });
    },
  };
}
export type Outbound = ReturnType<typeof createOutbound>;
