import { PageHead } from '@/components/ui';
import type { LogEntry, OjtShift, OjtTotals } from '@/components/modules/ApprenticeLogbook';
import { callApi } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { q1 } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { LogbookClient } from './LogbookClient';

export const metadata = { title: 'Logbook' };
export const dynamic = 'force-dynamic';

/** Apprentice phone logbook: geofenced check-in/out, entries with photos and video, supervisor sign-offs. */
export default async function Logbook() {
  const s = await requireRole('student');
  const { L } = await getI18n();
  const placement = await q1<{ site: string; employer: string; radiusM: number; latitude: number; longitude: number; supervisor: string; supervisorAr: string | null }>(
    `SELECT es.name AS site, em.name AS employer, es.geofence_radius_m::int AS "radiusM", es.latitude::float, es.longitude::float,
            su.full_name AS supervisor, su.full_name_ar AS "supervisorAr"
       FROM wbl_placements p JOIN employer_sites es ON es.id = p.site_id JOIN employers em ON em.id = es.employer_id
       JOIN users su ON su.id = p.supervisor_id
      WHERE p.learner_id = $1 AND current_date BETWEEN p.starts_on AND p.ends_on ORDER BY p.starts_on DESC LIMIT 1`, [s.userId]);
  const [att, log] = await Promise.all([
    callApi<{ shifts: OjtShift[]; totals: OjtTotals | null }>(s, '/v1/ojt/attendance').catch(() => ({ shifts: [], totals: null })),
    callApi<{ entries: LogEntry[] }>(s, '/v1/wbl/logbook').catch(() => ({ entries: [] })),
  ]);
  return (
    <div className="page">
      <PageHead eyebrow={L('Student · Work-based learning', 'الطالب · التعلم في موقع العمل')} title={L('My logbook', 'سجل تدريبي')}
        sub={L('Check in when you arrive, write up what you did, and your supervisor signs it off.', 'سجّل حضورك عند الوصول، واكتب ما قمت به، ويعتمده مشرفك.')} />
      <LogbookClient placement={placement ? { ...placement, supervisor: placement.supervisor } : null} totals={att.totals} shifts={att.shifts} entries={log.entries} />
    </div>
  );
}
