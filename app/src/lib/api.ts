import 'server-only';
import { apiToken, type Session } from './auth';

export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`API ${status}`);
  }
}

/** Server-side call to the VTC_LMS API as the signed-in user. */
export async function callApi<T>(s: Session, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(API_URL + path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: { authorization: `Bearer ${await apiToken(s)}`, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
