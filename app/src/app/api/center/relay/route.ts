/**
 * GET /api/center/relay: while a phone is on the centre's Wi-Fi it fetches a
 * relay token here (30 days). If it later queues writes away from the centre
 * (an apprentice at an employer site) and has mobile data, the outbox hands
 * them to the online hub with this token; the centre applies them when it
 * next syncs. 204 when this centre has no hub configured.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hubConfig, relayToken } from '@/lib/center';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const hub = hubConfig();
  if (!hub) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ hubUrl: hub.hubUrl, centerId: hub.centerId, token: await relayToken(s, hub.centerId, hub.centerKey) },
    { headers: { 'cache-control': 'no-store' } });
}
