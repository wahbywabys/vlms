import 'server-only';
import { createHmac } from 'node:crypto';
import { SignJWT } from 'jose';
import { headers } from 'next/headers';
import { q1 } from './db';
import type { Session } from './auth';

/**
 * The training centre's local server: the address devices join on, and the
 * optional link to the online hub (CLOUD_HUB_URL, CENTER_ID, CENTER_KEY, the
 * same values the API's uplink uses).
 */
export const hubConfig = () => {
  const hubUrl = process.env.CLOUD_HUB_URL?.trim().replace(/\/+$/, ''), centerId = process.env.CENTER_ID?.trim(), centerKey = process.env.CENTER_KEY?.trim();
  return hubUrl && centerId && centerKey ? { hubUrl, centerId, centerKey } : null;
};

/** Addresses to show on the join page: CENTER_URL / CENTER_HTTPS_URL from the installer, else the address this page was opened on. */
export async function centerAddresses() {
  const h = await headers();
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http';
  const seen = `${proto}://${h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost'}`;
  const http = process.env.CENTER_URL?.trim() || (proto === 'http' ? seen : null);
  const https = process.env.CENTER_HTTPS_URL?.trim() || (proto === 'https' ? seen : null);
  return { http, https, wifi: process.env.CENTER_WIFI?.trim() || null, name: process.env.CENTER_NAME?.trim() || null };
}

export interface UplinkStatus {
  last_success_at: Date | null; last_attempt_at: Date | null; last_error: string | null; statements_sent: string; relay_applied: string;
}
export async function uplinkStatus() {
  return (await q1<UplinkStatus>('SELECT last_success_at, last_attempt_at, last_error, statements_sent, relay_applied FROM center_uplink').catch(() => undefined)) ?? null;
}

/** Same derivation and claims as api/src/lib/relayToken.ts. */
export async function relayToken(s: Session, centerId: string, centerKey: string) {
  const secret = createHmac('sha256', centerKey).update('vtc-lms/relay/v1').digest('hex');
  return new SignJWT({ inst: s.institutionId, roles: s.roles }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.userId).setAudience(`vtc-hub:${centerId}`).setIssuedAt().setExpirationTime('30d')
    .sign(new TextEncoder().encode(secret));
}
