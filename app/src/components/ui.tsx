/** Small presentational pieces shared by server and client pages. */
import type { ReactNode } from 'react';
import { tx, type I18n, type Txt } from '@/lib/i18n';

export type Level = 'not_yet' | 'novice' | 'intermediate' | 'autonomous' | 'master';
export const LEVEL_LABEL: Record<Level, Txt> = {
  not_yet: tx('Not yet', 'لم يصل بعد'), novice: tx('Novice', 'مبتدئ'), intermediate: tx('Intermediate', 'متوسط'),
  autonomous: tx('Autonomous', 'مستقل'), master: tx('Master', 'متمكن'),
};
const LEVEL_STEP: Record<Level, number> = { not_yet: 0, novice: 1, intermediate: 2, autonomous: 3, master: 4 };

export function LevelMeter({ level, t }: { level: Level; t: I18n }) {
  const n = LEVEL_STEP[level];
  return (
    <span className={`level lv-${level}`} title={t.pick(LEVEL_LABEL[level])}>
      <span className="level-steps" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
      <span className="level-text">{t.pick(LEVEL_LABEL[level])}</span>
    </span>
  );
}

export function Stat({ label, value, unit, sub, tone }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`kpi stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" dir="ltr">{value}{unit && <small>{unit}</small>}</span>
      {sub && <span className="kpi-delta">{sub}</span>}
    </div>
  );
}

export function Result({ passed, gates, t }: { passed: boolean; gates?: string[]; t: I18n }) {
  return (
    <span className={`res ${passed ? 'res-pass' : 'res-fail'}`}>
      {passed ? `✓ ${t.L('Pass', 'ناجح')}` : `✗ ${t.L('Not yet', 'لم يجتز بعد')}${gates?.length ? ` · ${t.L('gate', 'شرط أمان')}: ${gates.join(', ')}` : ''}`}
    </span>
  );
}

export const MODE_LABEL: Record<string, Txt> = {
  guided: tx('Guided', 'موجّه'), sandbox: tx('Sandbox', 'تجريبي حر'), assessment: tx('Exam', 'امتحان'),
};

export function PageHead({ eyebrow, title, sub, children }: { eyebrow: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty muted">{children}</p>;
}
