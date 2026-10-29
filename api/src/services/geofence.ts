/**
 * Geofence checks for OJT attendance. The database trigger on wbl_checkins
 * is the authority for inside/outside (it uses the stored site coordinates);
 * this module adds the checks that need the previous fix or the device's
 * report, and is shared with the prototype so its demo judges fixes the same.
 */
export interface Fix {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  at: Date;
}
export interface Site { latitude: number; longitude: number; radiusM: number }

/** Fixes worse than this are refused outright: indoors on a phone, move to a window. */
export const MAX_ACCURACY_M = 100;
/** Slack added to the radius: the fix's own accuracy, capped (same as the DB trigger). */
export const MAX_ACCURACY_SLACK_M = 50;
/** Faster than this between two fixes is not a bus ride; flag it. */
export const MAX_TRAVEL_KMH = 250;
/** Device clock further than this from the server clock is flagged (live check-ins only). */
export const MAX_CLOCK_SKEW_MS = 10 * 60_000;
/** Offline check-ins can be replayed up to this long after the fact. */
export const MAX_OFFLINE_AGE_MS = 72 * 3600_000;
/** An attendance left open longer than this is closed automatically and needs a supervisor. */
export const MAX_SHIFT_MS = 12 * 3600_000;

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export function judge(site: Site, fix: Fix) {
  const distanceM = haversineM(fix.latitude, fix.longitude, site.latitude, site.longitude);
  const slackM = Math.min(fix.accuracyM ?? 0, MAX_ACCURACY_SLACK_M);
  return { distanceM, slackM, inside: distanceM <= site.radiusM + slackM };
}

export type Flag = 'low_accuracy' | 'mock_location' | 'clock_skew' | 'impossible_travel' | 'offline_replay' | 'stale_replay';

/** Hard refusals come first; the rest are recorded as flags for the coordinator. */
export function screen(fix: Fix, opts: { now: Date; isMocked?: boolean; queuedOffline?: boolean; previous?: Fix | null }) {
  const refuse: Flag[] = [];
  const flags: Flag[] = [];
  if (opts.isMocked) refuse.push('mock_location');
  if ((fix.accuracyM ?? 0) > MAX_ACCURACY_M) refuse.push('low_accuracy');
  const skew = opts.now.getTime() - fix.at.getTime();
  if (opts.queuedOffline) {
    flags.push('offline_replay');
    if (skew > MAX_OFFLINE_AGE_MS) refuse.push('stale_replay');
  } else if (Math.abs(skew) > MAX_CLOCK_SKEW_MS) flags.push('clock_skew');
  if (opts.previous) {
    const hours = Math.abs(fix.at.getTime() - opts.previous.at.getTime()) / 3600_000;
    const km = haversineM(fix.latitude, fix.longitude, opts.previous.latitude, opts.previous.longitude) / 1000;
    if (hours > 0 && km > 1 && km / hours > MAX_TRAVEL_KMH) flags.push('impossible_travel');
  }
  return { refuse, flags };
}
