/**
 * Browser-side calls to the VTC_LMS API through the /api/v1 bridge. Errors
 * come back as ApiFailure ({status, code, message, details}) so the module
 * screens can show the server's reason (not_eligible, cooldown, outside_geofence…).
 */
import type { ApiFailure } from '@/components/modules/MachineAccess';

export const API_BASE = '/api/v1';

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(API_BASE + path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  }).catch(() => null);
  if (!r) throw { status: 0, code: 'offline', message: 'No connection' } satisfies ApiFailure;
  const body = await r.json().catch(() => null) as (T & { error?: string; message?: string; details?: ApiFailure['details'] }) | null;
  if (!r.ok) throw { status: r.status, code: body?.error ?? 'error', message: body?.message, details: body?.details } satisfies ApiFailure;
  return body as T;
}
