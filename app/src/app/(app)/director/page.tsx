import Link from 'next/link';
import { AssessmentTable } from '@/components/AssessmentTable';
import { AutoRefresh } from '@/components/AutoRefresh';
import { PageHead, Stat } from '@/components/ui';
import { requireRole } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { getI18n } from '@/lib/i18n-server';
import type { AssessmentRow } from '@/lib/queries';
import { IqaExport } from './IqaExport';

export const metadata = { title: 'Institution overview' };
export const dynamic = 'force-dynamic';

export default async function DirectorPage() {
  const s = await requireRole('director');
  const t = await getI18n();
  const { L, ar, num } = t;
  const inst = s.institutionId;

  const k = (await q1<{
    learners: number; attain: number | null; pass30: number | null; attempts30: number; alerts30: number; open_alerts: number;
    wbl_pct: number | null; pending: number; stale: number; util: number | null; in_review: number; overdue_service: number; low_stock: number;
  }>(
    `SELECT
       (SELECT count(*)::int FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student' WHERE u.institution_id = $1) AS learners,
       (SELECT round(100.0 * count(*) FILTER (WHERE lc.level IN ('autonomous', 'master')) / NULLIF(count(*), 0), 1)::float
          FROM learner_competencies lc JOIN users u ON u.id = lc.learner_id WHERE u.institution_id = $1) AS attain,
       (SELECT round(100.0 * count(*) FILTER (WHERE e.passed) / NULLIF(count(*), 0), 1)::float
          FROM rubric_evaluations e JOIN users u ON u.id = e.learner_id
         WHERE u.institution_id = $1 AND e.evaluated_at > now() - interval '30 days') AS pass30,
       (SELECT count(*)::int FROM rubric_evaluations e JOIN users u ON u.id = e.learner_id
         WHERE u.institution_id = $1 AND e.evaluated_at > now() - interval '30 days') AS attempts30,
       (SELECT count(*)::int FROM safety_alerts WHERE institution_id = $1 AND raised_at > now() - interval '30 days') AS alerts30,
       (SELECT count(*)::int FROM safety_alerts WHERE institution_id = $1 AND resolved_at IS NULL) AS open_alerts,
       (SELECT round(avg(100.0 * v.approved_hours / NULLIF(v.required_hours, 0)), 1)::float FROM v_wbl_hours_progress v
          JOIN users u ON u.id = v.learner_id WHERE u.institution_id = $1) AS wbl_pct,
       (SELECT count(*)::int FROM wbl_logbook_entries e JOIN wbl_placements p ON p.id = e.placement_id JOIN users u ON u.id = p.learner_id
         WHERE u.institution_id = $1 AND e.status = 'submitted') AS pending,
       (SELECT count(*)::int FROM wbl_logbook_entries e JOIN wbl_placements p ON p.id = e.placement_id JOIN users u ON u.id = p.learner_id
         WHERE u.institution_id = $1 AND e.status = 'submitted' AND e.submitted_at < now() - interval '5 days') AS stale,
       (SELECT round(avg(utilisation_pct), 1)::float FROM v_asset_utilisation_30d v JOIN workshop_assets a ON a.id = v.asset_id
          JOIN workshops w ON w.id = a.workshop_id WHERE w.institution_id = $1 AND a.category = 'machine' AND v.utilisation_pct > 0) AS util,
       (SELECT count(*)::int FROM questions WHERE institution_id = $1 AND status = 'in_review') AS in_review,
       (SELECT count(*)::int FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
         WHERE w.institution_id = $1 AND a.next_service_due < current_date AND a.status <> 'retired') AS overdue_service,
       (SELECT count(*)::int FROM consumables c JOIN workshops w ON w.id = c.workshop_id WHERE w.institution_id = $1 AND c.on_hand < c.reorder_point) AS low_stock`,
    [inst]))!;

  const units = await q<{ code: string; title: string; title_ar: string | null; pct: number; learners: number; safety: boolean }>(
    `SELECT u.code, u.title, u.title_ar, u.is_safety_critical AS safety,
            round(100.0 * count(*) FILTER (WHERE lc.level IN ('autonomous', 'master')) / NULLIF(count(*), 0))::int AS pct,
            count(DISTINCT lc.learner_id)::int AS learners
       FROM competencies u JOIN competencies e ON e.parent_id = u.id
       JOIN learner_competencies lc ON lc.competency_id = e.id JOIN users x ON x.id = lc.learner_id AND x.institution_id = $1
      WHERE u.kind = 'unit' GROUP BY u.id ORDER BY pct`, [inst]);

  const assets = await q<{ asset_tag: string; name: string; workshop: string; pct: number }>(
    `SELECT v.asset_tag, v.name, v.workshop, v.utilisation_pct::float AS pct
       FROM v_asset_utilisation_30d v JOIN workshop_assets a ON a.id = v.asset_id JOIN workshops w ON w.id = a.workshop_id
      WHERE w.institution_id = $1 AND a.category = 'machine' ORDER BY v.utilisation_pct DESC LIMIT 10`, [inst]);

  const latest = await q<AssessmentRow & { learner: string; learner_ar: string | null }>(
    `SELECT e.subject_type AS kind, e.subject_id AS id, COALESCE(l.title, r.title) AS title, l.title_ar, s.mode::text AS mode,
            e.total_score::float AS score, e.passed, e.gate_failures, e.evaluated_at AS at,
            ev.full_name AS assessor, ev.full_name_ar AS assessor_ar, u.full_name AS learner, u.full_name_ar AS learner_ar
       FROM rubric_evaluations e JOIN rubrics r ON r.id = e.rubric_id JOIN users u ON u.id = e.learner_id
       LEFT JOIN virtual_lab_sessions s ON e.subject_type = 'vlab_session' AND s.id = e.subject_id
       LEFT JOIN virtual_labs l ON l.id = s.lab_id LEFT JOIN users ev ON ev.id = e.evaluator_id
      WHERE u.institution_id = $1 ORDER BY e.evaluated_at DESC LIMIT 12`, [inst]);

  const instRow = await q1<{ name: string; name_ar: string | null }>(`SELECT name, name_ar FROM institutions WHERE id = $1`, [inst]);
  const queue = [
    { warn: k.open_alerts > 0, text: L(`${k.open_alerts} open safety alert${k.open_alerts === 1 ? '' : 's'} on the workshop floor`, `${k.open_alerts} تنبيه سلامة مفتوح في الورشة`), href: '/director/learners' },
    { warn: k.stale > 0, text: L(`${k.pending} logbook entries awaiting supervisor sign-off (${k.stale} older than 5 days)`, `${k.pending} سجلات بانتظار اعتماد المشرف (${k.stale} أقدم من 5 أيام)`) },
    { warn: k.in_review > 0, text: L(`${k.in_review} question${k.in_review === 1 ? '' : 's'} in review; AI-drafted items need a human approver`, `${k.in_review} سؤال قيد المراجعة؛ الأسئلة المولدة بالذكاء الاصطناعي تحتاج اعتمادًا بشريًا`) },
    { warn: k.overdue_service > 0, text: L(`${k.overdue_service} machine${k.overdue_service === 1 ? '' : 's'} past service date`, `${k.overdue_service} ماكينة تجاوزت موعد الصيانة`) },
    { warn: k.low_stock > 0, text: L(`${k.low_stock} consumable${k.low_stock === 1 ? '' : 's'} below reorder point`, `${k.low_stock} من المستهلكات تحت حد إعادة الطلب`) },
  ];
  const iqaRows = latest.map((e) => ({ learner: e.learner, assessment: e.title, source: e.kind, mode: e.mode, score: e.score, passed: e.passed, gateFailures: e.gate_failures, evaluatedAt: e.at }));

  return (
    <div className="dash">
      <AutoRefresh ms={10000} />
      <PageHead eyebrow={L('Director · Institutional health', 'المدير · صحة المؤسسة')} title={ar(instRow?.name, instRow?.name_ar)}
        sub={L('Live from the system of record. Refreshes every 10 seconds.', 'مباشرة من سجل النظام. تتحدث كل 10 ثوانٍ.')}>
        <IqaExport institution={instRow?.name ?? ''} rows={iqaRows} />
      </PageHead>

      <div className="kpis">
        <Stat label={L('Competency attainment', 'تحقق الجدارات')} value={num(k.attain ?? 0)} unit="%" sub={L(`${k.learners} learners · autonomous+`, `${k.learners} متدربًا · مستقل فأعلى`)} />
        <Stat label={L('Assessment pass rate · 30 d', 'نسبة النجاح · 30 يومًا')} value={num(k.pass30 ?? 0)} unit="%" sub={L(`${k.attempts30} scored assessments`, `${k.attempts30} تقييمًا`)}
          tone={(k.pass30 ?? 0) < 70 ? 'warn' : 'ok'} />
        <Stat label={L('Safety incidents · 30 d', 'حوادث السلامة · 30 يومًا')} value={k.alerts30} sub={L(`${k.open_alerts} open now`, `${k.open_alerts} مفتوحة الآن`)} tone={k.open_alerts ? 'bad' : undefined} />
        <Stat label={L('Placement hours', 'ساعات التدريب الميداني')} value={num(k.wbl_pct ?? 0)} unit="%" sub={L('of required hours, approved', 'من الساعات المطلوبة، معتمدة')} />
        <Stat label={L('Machine utilisation · 30 d', 'استغلال الماكينات · 30 يومًا')} value={num(k.util ?? 0)} unit="%" sub={L('booked ÷ 8 h days', 'المحجوز ÷ 8 ساعات يوميًا')} />
      </div>

      <div className="dash-grid">
        <section className="panel">
          <header className="panel-head"><h2>{L('Attainment by unit', 'التحقق حسب الوحدة')}</h2>
            <span className="muted">{L('% of element records at autonomous or above', '% سجلات العناصر بمستوى مستقل فأعلى')}</span></header>
          <ul className="bars">
            {units.map((u) => (
              <li key={u.code}>
                <span className="bar-label"><b>{u.code}</b><small>{ar(u.title, u.title_ar)}</small></span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${u.pct}%` }} /><span className="bar-mark" style={{ insetInlineStart: '60%' }} /></span>
                <span className="bar-val">{u.pct}%</span>
                {u.pct < 60 ? <span className="flag flag-warn">▲ {L('Below 60%', 'أقل من 60%')}</span> : <span />}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <header className="panel-head"><h2>{L('Machine utilisation · 30 days', 'استغلال الماكينات · 30 يومًا')}</h2>
            <span className="muted">{L('booked ÷ available hours', 'الساعات المحجوزة ÷ المتاحة')}</span></header>
          <ul className="bars">
            {assets.map((a) => {
              const flag = a.pct > 85 ? L('Bottleneck', 'اختناق') : a.pct < 35 ? L('Under-used', 'استغلال ضعيف') : null;
              return (
                <li key={a.asset_tag}>
                  <span className="bar-label"><b>{a.asset_tag}</b><small>{a.workshop}</small></span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.min(100, a.pct)}%` }} />
                    <span className="bar-mark" style={{ insetInlineStart: '35%' }} /><span className="bar-mark" style={{ insetInlineStart: '85%' }} /></span>
                  <span className="bar-val">{Math.round(a.pct)}%</span>
                  {flag ? <span className={`flag ${a.pct > 85 ? 'flag-warn' : 'flag-info'}`}>{a.pct > 85 ? '▲' : '▽'} {flag}</span> : <span />}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel">
          <header className="panel-head"><h2>{L('Compliance & IQA', 'الامتثال وضمان الجودة الداخلي')}</h2></header>
          <ul className="queue">
            {queue.map((c) => (
              <li key={c.text} className={c.warn ? 'q-warn' : 'q-ok'}>
                <span className="q-icon" aria-hidden="true">{c.warn ? '▲' : '✓'}</span>
                <span className="q-text">{c.text}</span>
                {c.href && c.warn ? <Link className="button" href={c.href}>{L('Review', 'مراجعة')}</Link> : <span />}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <header className="panel-head"><h2>{L('Where the evidence comes from', 'مصادر الأدلة')}</h2></header>
          <EvidenceMix inst={inst} />
        </section>

        <section className="panel wide">
          <header className="panel-head"><h2>{L('Latest evaluations', 'أحدث التقييمات')}</h2>
            <span className="muted">{L('V-Lab attempts and floor observations, scored by the same rubric engine', 'محاولات المعمل الافتراضي وملاحظات الورشة، مقيّمة بنفس محرك المعايير')}</span></header>
          <AssessmentTable rows={latest} t={t} learnerCol />
        </section>
      </div>
    </div>
  );
}

async function EvidenceMix({ inst }: { inst: string }) {
  const { L, num } = await getI18n();
  const rows = await q<{ source_type: string; n: number }>(
    `SELECT e.source_type, count(*)::int AS n FROM competency_evidence e JOIN users u ON u.id = e.learner_id
      WHERE u.institution_id = $1 GROUP BY 1`, [inst]);
  const evals = await q<{ subject_type: string; n: number }>(
    `SELECT e.subject_type, count(*)::int AS n FROM rubric_evaluations e JOIN users u ON u.id = e.learner_id
      WHERE u.institution_id = $1 GROUP BY 1`, [inst]);
  const signed = await q1<{ n: number }>(
    `SELECT count(*)::int AS n FROM wbl_signoffs s JOIN wbl_logbook_entries e ON e.id = s.entry_id JOIN wbl_placements p ON p.id = e.placement_id
      JOIN users u ON u.id = p.learner_id WHERE u.institution_id = $1`, [inst]);
  const get = (list: { n: number }[], key: string, field: 'source_type' | 'subject_type') =>
    (list as Record<string, unknown>[]).find((r) => r[field] === key)?.['n'] as number | undefined ?? 0;
  const items = [
    { label: L('V-Lab attempts scored', 'محاولات افتراضية مقيّمة'), n: get(evals, 'vlab_session', 'subject_type') },
    { label: L('Workshop observations', 'ملاحظات الورشة'), n: get(evals, 'workshop_observation', 'subject_type') },
    { label: L('Signed logbook entries', 'سجلات تدريب معتمدة'), n: signed?.n ?? 0 },
    { label: L('Competency evidence rows (live)', 'سجلات أدلة الجدارة (مباشرة)'), n: rows.reduce((a, r) => a + r.n, 0) },
  ];
  return (
    <ul className="queue">
      {items.map((i) => <li key={i.label} className="q-ok"><span className="q-icon" aria-hidden="true">■</span><span className="q-text">{i.label}</span><b dir="ltr">{num(i.n)}</b></li>)}
    </ul>
  );
}
