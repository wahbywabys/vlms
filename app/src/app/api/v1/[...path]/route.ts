/**
 * Browser → API bridge. The browser holds only the httpOnly session cookie;
 * this route mints a short-lived bearer token for the VTC_LMS API and
 * forwards the call, so the API keeps verifying every request itself.
 * Bodies pass through as bytes, so photo uploads (POST media) and
 * media downloads work as well as JSON.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/api';
import { apiToken, getSession } from '@/lib/auth';

const ID = '[0-9a-f-]{36}';
const ALLOWED = new RegExp('^(' + [
  'vlab/labs(/[A-Z0-9-]+)?', `vlab/sessions(/${ID}(/(telemetry|probe|evaluate))?)?`, `alerts(/${ID}/resolve)?`,
  'workshop/observations', `workshop/consumables(/${ID}/movements)?`,
  'safety/scan/[A-Za-z0-9-]+(/precheck)?', `safety/prechecks/${ID}/submit`, `safety/locks/${ID}(/release)?`, 'safety/machines',
  'ojt/checkins', `ojt/attendance(/${ID}/confirm)?`, `wbl/logbook(/${ID}/signoff)?`, `media(/${ID})?`,
  `assessments(/${ID}/submit)?`, 'questions/preview', `analytics/early-warning(/${ID}/ack)?`, `analytics/skills(/learners/${ID})?`,
  'sync', 'xapi/statements', 'private(/(items|history))?',
].join('|') + ')$');
/** Request headers the API reads besides auth: media metadata and idempotency keys. */
const PASS_HEADERS = ['content-type', 'x-client-mutation-id', 'x-captured-at', 'x-kind', 'x-width', 'x-height', 'x-lat', 'x-lon'];

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const path = (await ctx.params).path.join('/');
  if (!ALLOWED.test(path)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const headers: Record<string, string> = { authorization: `Bearer ${await apiToken(s)}`, 'content-type': 'application/json' };
  for (const h of PASS_HEADERS) { const v = req.headers.get(h); if (v) headers[h] = v; }
  const res = await fetch(`${API_URL}/v1/${path}${req.nextUrl.search}`, {
    method: req.method, headers,
    body: req.method === 'GET' ? undefined : await req.arrayBuffer(),
    cache: 'no-store',
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: 'api_unavailable' }, { status: 503 });
  const out = new Headers({ 'content-type': res.headers.get('content-type') ?? 'application/json' });
  for (const h of ['cache-control', 'etag', 'content-disposition']) { const v = res.headers.get(h); if (v) out.set(h, v); }
  return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: out });
}

export { forward as GET, forward as POST, forward as PUT };
