/**
 * Relay tokens let a phone that is away from the centre's Wi-Fi (an apprentice
 * at an employer site with mobile data) hand its queued writes to the cloud
 * hub. The centre signs one for the signed-in user while the phone is on the
 * centre network; the hub checks it before storing anything, and the centre
 * checks it again before applying the writes it pulls back down.
 *
 * Both sides derive the signing secret from the centre key, so the hub never
 * needs to store the key itself.
 */
import { createHmac } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { Principal, Role } from './auth.js';

export const relaySecret = (centerKey: string) => createHmac('sha256', centerKey).update('vtc-lms/relay/v1').digest('hex');
const audience = (centerId: string) => `vtc-hub:${centerId}`;

export async function signRelayToken(centerKey: string, centerId: string, p: Principal, ttl = '30d') {
  return new SignJWT({ inst: p.institutionId, roles: p.roles }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.userId).setAudience(audience(centerId)).setIssuedAt().setExpirationTime(ttl)
    .sign(new TextEncoder().encode(relaySecret(centerKey)));
}

/** Throws unless `token` was signed for `centerId` with the secret derived from its key. */
export async function verifyRelayToken(secret: string, centerId: string, token: string): Promise<Principal> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], audience: audience(centerId) });
  if (typeof payload.sub !== 'string' || typeof payload['inst'] !== 'string' || !Array.isArray(payload['roles'])) throw new Error('missing claims');
  return { userId: payload.sub, institutionId: payload['inst'], roles: payload['roles'] as Role[] };
}
