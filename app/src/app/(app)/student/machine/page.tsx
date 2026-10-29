import { PageHead } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import { currentTrade } from '@/lib/trade';
import { MachineClient } from './MachineClient';

export const metadata = { title: 'Machine access' };
export const dynamic = 'force-dynamic';

/** Opened from the QR label on a machine (…/student/machine?code=VTC-…) or from the menu. */
export default async function MachinePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const s = await requireRole('student');
  const trade = await currentTrade(s, 'own');
  const { L } = await getI18n();
  const { code } = await searchParams;
  // Demo stand-in for walking up to a machine: its QR labels, one tap each.
  const labels = await q<{ code: string; label: string }>(
    `SELECT a.qr_code AS code, a.asset_tag AS label FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
      WHERE w.institution_id = $1 AND w.trade_id = $2 AND a.qr_code IS NOT NULL ORDER BY a.asset_tag LIMIT 8`, [s.institutionId, trade]);
  return (
    <div className="page">
      <PageHead eyebrow={L('Student · Workshop', 'الطالب · الورشة')} title={L('Machine access', 'تشغيل الماكينة')}
        sub={L('Scan the machine, pass its safety pre-check, and it unlocks for your session.', 'امسح الماكينة واجتز فحص السلامة المسبق، فتُفتح لك طوال جلستك.')} />
      <MachineClient code={code ?? null} labels={labels} />
    </div>
  );
}
