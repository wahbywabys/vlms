import type { I18n } from '@/lib/i18n';
import type { CompetencyRow } from '@/lib/queries';
import { LevelMeter } from './ui';

/** Elements grouped under their unit, each with the learner's level. */
export function CompetencyTable({ rows, t }: { rows: CompetencyRow[]; t: I18n }) {
  const { L, ar, date } = t;
  const units = [...new Map(rows.map((r) => [r.unit_code, r])).values()];
  return (
    <div className="scroll-x">
      <table className="comp">
        <thead><tr><th>{L('Competency', 'الجدارة')}</th><th>{L('Level', 'المستوى')}</th><th className="num">{L('Evidence', 'الأدلة')}</th><th>{L('Last assessed', 'آخر تقييم')}</th></tr></thead>
        {units.map((u) => (
          <tbody key={u.unit_code}>
            <tr className="unit-row"><th colSpan={4}><span className="mono">{u.unit_code}</span> {ar(u.unit_title, u.unit_title_ar)}</th></tr>
            {rows.filter((r) => r.unit_code === u.unit_code).map((r) => (
              <tr key={r.code}>
                <td><span className="mono code">{r.code.replace(`${u.unit_code}-`, '')}</span> {ar(r.title, r.title_ar)}
                  {r.is_safety_critical && <span className="gate">{L('Safety', 'أمان')}</span>}
                  {r.verified && <span className="verified" title={L('Verified in the workplace', 'تم التحقق في موقع العمل')}>✓ {L('workplace', 'موقع العمل')}</span>}</td>
                <td><LevelMeter level={r.level} t={t} /></td>
                <td className="num">{r.evidence_count}</td>
                <td className="muted">{r.last_assessed_at ? date(r.last_assessed_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
