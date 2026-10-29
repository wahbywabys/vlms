
import { LEVEL_LABEL, PageHead, type Level } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { currentTrade } from '@/lib/trade';
import { q } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';

export const metadata = { title: 'Competency matrix' };

const SHORT: Record<Level, string> = { not_yet: '–', novice: 'N', intermediate: 'I', autonomous: 'A', master: 'M' };

export default async function Matrix() {
  const s = await requireRole('academic_teacher');
  const trade = await currentTrade(s);
  const { L, ar, pick } = await getI18n();
  const elements = await q<{ id: string; code: string; title: string; title_ar: string | null }>(
    `SELECT c.id, c.code, c.title, c.title_ar FROM competencies c JOIN competency_frameworks f ON f.id = c.framework_id
      WHERE c.kind = 'element' AND f.trade_id = $1 ORDER BY c.code`, [trade]);
  const learners = await q<{ id: string; name: string; name_ar: string | null }>(
    `SELECT u.id, u.full_name AS name, u.full_name_ar AS name_ar FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
      WHERE u.institution_id = $1 AND EXISTS (SELECT 1 FROM v_user_trades ut WHERE ut.user_id = u.id AND ut.trade_id = $2)
      ORDER BY u.full_name`, [s.institutionId, trade]);
  const cells = await q<{ learner_id: string; competency_id: string; level: Level }>(
    `SELECT lc.learner_id, lc.competency_id, lc.level FROM learner_competencies lc JOIN users u ON u.id = lc.learner_id WHERE u.institution_id = $1`, [s.institutionId]);
  const at = new Map(cells.map((c) => [`${c.learner_id}|${c.competency_id}`, c.level]));
  const levels: Level[] = ['not_yet', 'novice', 'intermediate', 'autonomous', 'master'];
  return (
    <div className="page">
      <PageHead eyebrow={L('Academic teacher · Cohort', 'المعلم الأكاديمي · المجموعة')} title={L('Competency matrix', 'مصفوفة الجدارات')}
        sub={L('Every learner against every element, from all evidence: theory, V-Labs, floor observations and the workplace.', 'كل متدرب مقابل كل عنصر، من كل الأدلة: النظري والمعامل الافتراضية وملاحظات الورشة وموقع العمل.')} />
      <div className="matrix-legend">{levels.map((l) => <span key={l}><i className={`m-${l}`} />{SHORT[l]} · {pick(LEVEL_LABEL[l])}</span>)}</div>
      <section className="panel scroll-x">
        <table className="matrix">
          <thead><tr><th />{elements.map((e) => <th key={e.id} title={ar(e.title, e.title_ar)} scope="col">{e.code}</th>)}</tr></thead>
          <tbody>{learners.map((l) => (
            <tr key={l.id}><th scope="row">{ar(l.name, l.name_ar)}</th>
              {elements.map((e) => {
                const lv = at.get(`${l.id}|${e.id}`) ?? 'not_yet';
                return <td key={e.id} className={`m-${lv}`} title={`${ar(l.name, l.name_ar)} · ${e.code}: ${pick(LEVEL_LABEL[lv])}`}>{SHORT[lv]}</td>;
              })}</tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}
