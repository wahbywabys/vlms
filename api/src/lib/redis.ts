import { Redis } from 'ioredis';
import type { Logger } from 'pino';

/**
 * Real-time fan-out. Redis is a side channel: Postgres is the system of
 * record, so a Redis outage degrades live dashboards but never loses data.
 */
export interface Realtime {
  appendTelemetry(sessionId: string, events: { seq: number; verb: string; objectRef?: string | null }[]): Promise<void>;
  publish(channel: string, message: unknown): Promise<void>;
  close(): Promise<void>;
}

export function createRealtime(url: string | undefined, log: Logger): Realtime {
  if (!url) return { appendTelemetry: async () => {}, publish: async () => {}, close: async () => {} };
  const redis = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  redis.on('error', (err) => log.warn({ err: err.message }, 'redis unavailable'));
  const safe = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'realtime publish failed');
    }
  };
  return {
    appendTelemetry: (sessionId, events) =>
      safe(async () => {
        const pipe = redis.pipeline();
        for (const e of events) {
          pipe.xadd(`vlab:telemetry:${sessionId}`, 'MAXLEN', '~', '5000', '*',
            'seq', String(e.seq), 'verb', e.verb, 'obj', e.objectRef ?? '');
        }
        pipe.expire(`vlab:telemetry:${sessionId}`, 60 * 60 * 6);
        await pipe.exec();
      }),
    publish: (channel, message) => safe(() => redis.publish(channel, JSON.stringify(message))),
    close: async () => void (await redis.quit()),
  };
}
