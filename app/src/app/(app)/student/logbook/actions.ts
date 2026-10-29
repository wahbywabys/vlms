'use server';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { db, q1 } from '@/lib/db';

async function myPlacement(userId: string) {
  return q1<{ id: string; latitude: number; longitude: number }>(
    `SELECT p.id, es.latitude, es.longitude FROM wbl_placements p JOIN employer_sites es ON es.id = p.site_id
      WHERE p.learner_id = $1 ORDER BY p.starts_on DESC LIMIT 1`, [userId]);
}

export async function addEntry(_prev: { ok?: boolean; error?: string } | null, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireRole('student');
  const p = await myPlacement(s.userId);
  if (!p) return { error: 'no_placement' };
  const workDate = String(form.get('work_date') ?? '');
  const hours = Number(form.get('hours'));
  const summary = String(form.get('summary') ?? '').trim();
  const comps = form.getAll('competency').map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || new Date(workDate) > new Date()) return { error: 'date' };
  if (!(hours > 0 && hours <= 16)) return { error: 'hours' };
  if (summary.length < 15) return { error: 'summary' };
  await db.query(
    `INSERT INTO wbl_logbook_entries (placement_id, work_date, hours, task_summary, competency_ids, status, submitted_at, client_mutation_id)
     VALUES ($1, $2, $3, $4, $5, 'submitted', now(), $6)`,
    [p.id, workDate, hours, summary, comps, String(form.get('mutation') || randomUUID())]);
  revalidatePath('/student/logbook');
  return { ok: true };
}

/** GPS check-in. The geofence verdict is computed by a database trigger, never by the client. */
export async function checkIn(fix: { latitude: number; longitude: number; accuracy: number | null; demo?: boolean }) {
  const s = await requireRole('student');
  const p = await myPlacement(s.userId);
  if (!p) return { error: 'no_placement' as const };
  // Demo button: a fix ~40 m from the site, as a phone on the shop floor would report.
  const lat = fix.demo ? p.latitude + 0.0003 : fix.latitude;
  const lon = fix.demo ? p.longitude - 0.0002 : fix.longitude;
  const row = await q1<{ inside_geofence: boolean; distance_m: number }>(
    `INSERT INTO wbl_checkins (placement_id, kind, device_time, latitude, longitude, accuracy_m, client_mutation_id)
     VALUES ($1, 'in', now(), $2, $3, $4, $5) RETURNING inside_geofence, distance_m`,
    [p.id, lat, lon, fix.demo ? 12 : fix.accuracy, randomUUID()]);
  revalidatePath('/student/logbook');
  return { inside: row!.inside_geofence, distance: Math.round(row!.distance_m) };
}
