// Copied from app/src/components/modules/EarlyWarning.tsx by scripts/sync-modules.sh. Edit the original, not this file.
'use client';
/**
 * Predictive early warning (trainer and director).
 *
 * One row per learner with the model's probability of not passing the final
 * practical, the top three reasons in plain words, and the signals behind
 * them: attendance, workshop rubric average and trend, safety gates, V-Lab,
 * theory quizzes and OJT pace. A trainer records the action they took
 * ("acknowledge"), which is kept with the day's snapshot for audit and for
 * refitting the model later.
 */
import { useState } from 'react';
import { cx, fmt, pickAr, type Bi, type Ui } from './types';

export interface RiskLearner {
  learnerId: string; name: string; nameAr: string | null; cohort: string; cohortAr: string | null; tradeId: string;
  probability: number; band: 'low' | 'watch' | 'high'; urgent: boolean; daysToFinal: number | null; reasons: Bi[];
  signals: Partial<Record<'attendanceRate' | 'floorAvg' | 'floorTrend' | 'gateFails' | 'vlabPassRate' | 'safetyViolations' | 'quizPct' | 'ojtPace' | 'daysInactive', number | null>>;
  snapshotId: string; acknowledged: boolean; actionNote: string | null;
}
export interface RiskData { model: string; learners: RiskLearner[]; trend: { day: string; high: number; watch: number }[] }

const BAND: Record<RiskLearner['band'], { en: string; ar: string; cls: string; icon: string }> = {
  high: { en: 'High risk', ar: 'خطر مرتفع', cls: 'bg-bad-soft text-bad', icon: '▲' },
  watch: { en: 'Watch', ar: 'مراقبة', cls: 'bg-amber-soft text-amber', icon: '◆' },
  low: { en: 'On track', ar: 'في المسار', cls: 'bg-ok-soft text-ok', icon: '●' },
};

export function EarlyWarning({ ui, data, onAck, canAck }: { ui: Ui; data: RiskData; canAck: boolean; onAck: (snapshotId: string, note: string) => Promise<void> }) {
  const { L } = ui;
  const [band, setBand] = useState<'all' | 'high' | 'watch'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [acked, setAcked] = useState<Record<string, string>>({});
  const counts = { high: data.learners.filter((l) => l.band === 'high').length, watch: data.learners.filter((l) => l.band === 'watch').length };
  const rows = data.learners.filter((l) => band === 'all' || l.band === band);

  return (
    <div className="flex flex-col gap-4 font-body text-ink">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile tone="bad" label={L('High risk', 'خطر مرتفع')} value={counts.high} sub={L(`${data.learners.filter((l) => l.urgent).length} with the final within 3 weeks`, `${data.learners.filter((l) => l.urgent).length} لديهم الاختبار النهائي خلال 3 أسابيع`)} />
        <Tile tone="amber" label={L('Watch', 'مراقبة')} value={counts.watch} sub={L('Trending the wrong way', 'يتجهون في الاتجاه الخطأ')} />
        <Tile tone="ok" label={L('On track', 'في المسار')} value={data.learners.length - counts.high - counts.watch} sub={L(`Model ${data.model} · recomputed daily`, `النموذج ${data.model} · يُحدَّث يوميًا`)} />
      </div>

      <div role="tablist" className="flex w-fit gap-1 rounded-xl bg-sunk p-1">
        {(['all', 'high', 'watch'] as const).map((b) => (
          <button key={b} role="tab" type="button" aria-selected={band === b} onClick={() => setBand(b)}
            className="tw-reset h-10 rounded-lg px-3 text-sm font-semibold text-ink-2 aria-selected:bg-sheet aria-selected:text-ink aria-selected:shadow-card">
            {b === 'all' ? L('Everyone', 'الجميع') : b === 'high' ? L('High', 'مرتفع') : L('Watch', 'مراقبة')}
          </button>
        ))}
      </div>

      <ul className="m-0 list-none p-0 flex flex-col gap-2">
        {rows.length === 0 && <li className="rounded-2xl bg-sheet p-4 text-ink-3 shadow-card">{L('No learners in this band.', 'لا يوجد متدربون في هذه الفئة.')}</li>}
        {rows.map((l) => {
          const b = BAND[l.band];
          const isOpen = open === l.learnerId;
          const note = acked[l.snapshotId] ?? l.actionNote;
          return (
            <li key={l.learnerId} className={cx('rounded-2xl bg-sheet shadow-card', l.band === 'high' && 'border-s-4 border-bad', l.band === 'watch' && 'border-s-4 border-amber-fill')}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : l.learnerId)}
                className="tw-reset grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 p-3 text-start">
                <Gauge p={l.probability} band={l.band} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-display text-lg">{pickAr(ui, l.name, l.nameAr)}</b>
                    <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', b.cls)}><span aria-hidden="true">{b.icon}</span> {pickAr(ui, b.en, b.ar)}</span>
                    {l.urgent && <span className="rounded-full bg-bad px-2 py-0.5 text-xs font-bold text-sheet">{L(`Final in ${l.daysToFinal} days`, `النهائي بعد ${l.daysToFinal} يومًا`)}</span>}
                    {note && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">✓ {L('Action logged', 'تم تسجيل إجراء')}</span>}
                  </span>
                  <span className="block truncate text-sm text-ink-2">{l.reasons.map((r) => pickAr(ui, r.en, r.ar)).join(' · ') || L('No warning signs', 'لا توجد مؤشرات تحذير')}</span>
                </span>
                <span className="text-sm text-ink-3">{pickAr(ui, l.cohort, l.cohortAr)} {isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-rule p-3">
                  <Signals ui={ui} s={l.signals} />
                  {note ? <p className="rounded-xl bg-ok-soft p-3 text-sm"><b>{L('Action', 'الإجراء')}:</b> <span dir="auto">{note}</span></p>
                    : canAck && <AckForm ui={ui} onSave={async (t) => { await onAck(l.snapshotId, t); setAcked((a) => ({ ...a, [l.snapshotId]: t })); }} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tile({ tone, label, value, sub }: { tone: 'bad' | 'amber' | 'ok'; label: string; value: number; sub: string }) {
  return (
    <div className="rounded-2xl bg-sheet p-4 shadow-card">
      <p className={cx('text-sm font-semibold', tone === 'bad' ? 'text-bad' : tone === 'amber' ? 'text-amber' : 'text-ok')}>{label}</p>
      <p className="font-display text-4xl font-bold">{value}</p>
      <p className="text-xs text-ink-3">{sub}</p>
    </div>
  );
}

function Gauge({ p, band }: { p: number; band: RiskLearner['band'] }) {
  const r = 22, c = Math.PI * r;
  return (
    <svg viewBox="0 0 56 34" className="w-14" role="img" aria-label={`${Math.round(p * 100)}%`}>
      <path d="M6 30 A22 22 0 0 1 50 30" fill="none" stroke="var(--rule)" strokeWidth="6" strokeLinecap="round" />
      <path d="M6 30 A22 22 0 0 1 50 30" fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${p * c} ${c}`}
        stroke={band === 'high' ? 'var(--bad)' : band === 'watch' ? 'var(--amber-fill)' : 'var(--ok)'} />
      <text x="28" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)" fontFamily="var(--f-display)">{Math.round(p * 100)}</text>
    </svg>
  );
}

/** Each signal against the threshold that starts to worry the model. */
function Signals({ ui, s }: { ui: Ui; s: RiskLearner['signals'] }) {
  const { L } = ui;
  const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const items: { k: string; label: string; v: string; bad: boolean | null }[] = [
    { k: 'att', label: L('Attendance (30 d)', 'الحضور (30 يومًا)'), v: pct(s.attendanceRate), bad: s.attendanceRate == null ? null : s.attendanceRate < 0.85 },
    { k: 'floor', label: L('Workshop rubric avg', 'متوسط تقييم الورشة'), v: s.floorAvg == null ? '—' : fmt(ui, s.floorAvg), bad: s.floorAvg == null ? null : s.floorAvg < 70 },
    { k: 'trend', label: L('Rubric trend', 'اتجاه التقييم'), v: s.floorTrend == null ? '—' : `${s.floorTrend > 0 ? '+' : ''}${fmt(ui, s.floorTrend)}`, bad: s.floorTrend == null ? null : s.floorTrend < -5 },
    { k: 'gate', label: L('Safety gate fails', 'إخفاقات شروط الأمان'), v: s.gateFails == null ? '—' : fmt(ui, s.gateFails), bad: s.gateFails == null ? null : s.gateFails > 0 },
    { k: 'vlab', label: L('V-Lab pass rate', 'نجاح المعمل الافتراضي'), v: pct(s.vlabPassRate), bad: s.vlabPassRate == null ? null : s.vlabPassRate < 0.6 },
    { k: 'quiz', label: L('Theory quizzes', 'الاختبارات النظرية'), v: s.quizPct == null ? '—' : `${Math.round(s.quizPct)}%`, bad: s.quizPct == null ? null : s.quizPct < 60 },
    { k: 'ojt', label: L('OJT pace', 'وتيرة التدريب الميداني'), v: pct(s.ojtPace), bad: s.ojtPace == null ? null : s.ojtPace < 0.85 },
    { k: 'idle', label: L('Days since assessed work', 'أيام منذ آخر عمل مُقيَّم'), v: s.daysInactive == null ? '—' : fmt(ui, s.daysInactive), bad: s.daysInactive == null ? null : s.daysInactive > 10 },
  ];
  return (
    <dl className="m-0 list-none p-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.k} className={cx('rounded-xl p-2', i.bad ? 'bg-bad-soft' : 'bg-sunk')}>
          <dt className="text-xs text-ink-3">{i.label}</dt>
          <dd className={cx('font-display text-xl font-bold', i.bad && 'text-bad')}>{i.bad ? '▼ ' : ''}{i.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function AckForm({ ui, onSave }: { ui: Ui; onSave: (note: string) => Promise<void> }) {
  const { L } = ui;
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const quick = [L('Called the learner and agreed a catch-up plan', 'اتصلت بالمتدرب واتفقنا على خطة تعويض'),
    L('Booked extra supervised workshop time', 'حجزت وقتًا إضافيًا في الورشة بإشراف'), L('Referred to the learner support officer', 'أحلته إلى مسؤول دعم المتدربين')];
  return (
    <form className="flex flex-col gap-2" onSubmit={async (e) => { e.preventDefault(); if (t.trim().length < 3) return; setBusy(true); await onSave(t.trim()).catch(() => undefined); setBusy(false); }}>
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => <button key={q} type="button" onClick={() => setT(q)} className="tw-reset rounded-full border border-rule bg-sunk px-3 py-1.5 text-xs">{q}</button>)}
      </div>
      <div className="flex gap-2">
        <input value={t} onChange={(e) => setT(e.target.value)} dir="auto" placeholder={L('What did you do?', 'ما الإجراء الذي اتخذته؟')}
          className="tw-reset h-12 min-w-0 flex-1 rounded-xl border-2 border-rule bg-sunk px-3" />
        <button type="submit" disabled={busy || t.trim().length < 3} className="tw-reset h-12 rounded-xl bg-navy px-4 font-semibold text-on-brand disabled:opacity-40">{L('Log action', 'سجّل الإجراء')}</button>
      </div>
    </form>
  );
}
