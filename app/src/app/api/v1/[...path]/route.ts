/**
 * Browser → API bridge. The browser holds only the httpOnly session cookie;
 * this route mints a short-lived bearer token for the VTC_LMS API and
 * forwards the call, so the API keeps verifying every request itself.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/api';
import { apiToken, getSession } from '@/lib/auth';

const ALLOWED = /^(vlab\/sessions(\/[0-9a-f-]{36}(\/(telemetry|probe|evaluate))?)?|alerts(\/[0-9a-f-]{36}\/resolve)?|workshop\/observations)$/;

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const path = (await ctx.params).path.join('/');
  if (!ALLOWED.test(path)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const res = await fetch(`${API_URL}/v1/${path}${req.nextUrl.search}`, {
    method: req.method,
    headers: { authorization: `Bearer ${await apiToken(s)}`, 'content-type': 'application/json' },
    body: req.method === 'GET' ? undefined : await req.text(),
    cache: 'no-store',
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: 'api_unavailable' }, { status: 503 });
  return new NextResponse(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
}

export { forward as GET, forward as POST };
