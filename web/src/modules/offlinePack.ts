// Copied from app/src/components/modules/offlinePack.ts by scripts/sync-modules.sh. Edit the original, not this file.
/**
 * Offline machine checks on the phone or tablet.
 *
 * The device keeps the last qualification pack it downloaded
 * (GET /v1/safety/offline-pack) and, when the server cannot be reached,
 * answers "may this person use this machine?" from it. Answers made this way
 * are shown as "not yet confirmed" and queued (outbox type `machine_scan`);
 * the server re-checks each one when the device reconnects and alerts the
 * trainer if it disagrees.
 *
 * Offline, "allowed" needs a safety passport that was already valid: the
 * pre-check quiz is graded only by the server. The pack is used for at most
 * its `validUntil` (12 h after download).
 */
export interface PackMachine { code: string; tag: string; name: string; status: string; brand: string | null; model: string | null; serial: string | null;
  workshop: string; workshopAr: string | null; centerCode: string; center: string; tradeId: string | null; typeName: string | null; typeNameAr: string | null;
  twinId: string | null; competencyId: string | null; competencyCode: string | null; hasPrecheck: boolean }
export interface PackPerson { id: string; name: string; nameAr: string | null; competencies: string[]; passports: { tag: string; validUntil: string }[] }
export interface OfflinePack { version: 1; generatedAt: string; validUntil: string; forUser: string; machines: PackMachine[]; people: PackPerson[] }

export type OfflineState = 'allowed' | 'precheck' | 'blocked';
export interface OfflineDecision { state: OfflineState; reasons: string[]; passportUntil: string | null }

const KEY = 'vtc_lms.offline-pack.v1';

export function loadPack(userId?: string): OfflinePack | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as OfflinePack | null;
    if (!p || p.version !== 1 || (userId && p.forUser !== userId)) return null;
    return p;
  } catch { return null; }
}
export function savePack(p: OfflinePack) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage full or blocked: offline checks unavailable */ } }
export function clearPack() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

/** Download a fresh pack when online; keep the cached one otherwise. */
export async function refreshPack(fetchPack: () => Promise<OfflinePack>): Promise<OfflinePack | null> {
  try { const p = await fetchPack(); savePack(p); return p; } catch { return loadPack(); }
}

export const packExpired = (p: OfflinePack, now = Date.now()) => new Date(p.validUntil).getTime() < now;

/** Accepts the bare code printed in the QR, or an older sticker's link (…?code=VTC-…). */
export const codeFromQr = (raw: string) => decodeURIComponent(/[?&]code=([^&#]+)/.exec(raw)?.[1] ?? raw).trim();

export function findMachine(p: OfflinePack, code: string): PackMachine | null {
  const c = codeFromQr(code).toUpperCase();
  return p.machines.find((m) => m.code.toUpperCase() === c || m.tag.toUpperCase() === c) ?? null;
}

/** The same rules the server applies, from the cached pack. */
export function decide(p: OfflinePack, m: PackMachine, personId: string, now = Date.now()): OfflineDecision {
  const person = p.people.find((x) => x.id === personId);
  const reasons: string[] = [];
  if (['maintenance', 'locked_out', 'retired'].includes(m.status)) reasons.push(`machine_${m.status}`);
  if (m.competencyId && !person?.competencies.includes(m.competencyId)) reasons.push('missing_competency');
  if (!m.hasPrecheck) reasons.push('no_precheck');
  const pass = person?.passports.find((x) => x.tag === m.tag && new Date(x.validUntil).getTime() > now) ?? null;
  if (reasons.length) return { state: 'blocked', reasons, passportUntil: pass?.validUntil ?? null };
  if (!pass) return { state: 'precheck', reasons: ['no_passport'], passportUntil: null };
  return { state: 'allowed', reasons: [], passportUntil: pass.validUntil };
}
