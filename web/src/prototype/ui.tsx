/** Shared layout pieces so every screen has the same page header, summary strip and card anatomy. */
import type { ReactNode } from 'react';

export function PageHeader({ crumbs, title, meta, actions }: { crumbs: string[]; title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>{crumbs.map((c) => <li key={c}>{c}</li>)}</ol>
        </nav>
        <h1>{title}</h1>
        {meta && <p className="page-meta">{meta}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export type Tone = 'neutral' | 'ok' | 'info' | 'warn' | 'bad';
export interface Stat { label: string; value: ReactNode; sub?: string; tone?: Tone; icon?: string }

export function StatStrip({ items, label }: { items: Stat[]; label: string }) {
  return (
    <ul className="stats" aria-label={label}>
      {items.map((s) => (
        <li key={s.label} className={`stat tone-${s.tone ?? 'neutral'}`}>
          {s.icon && <span className="stat-icon" aria-hidden="true">{s.icon}</span>}
          <span className="stat-body">
            <span className="stat-label">{s.label}</span>
            <span className="stat-value">{s.value}</span>
            {s.sub && <span className="stat-sub">{s.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CardHead({ title, sub, actions, id }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <header className="card-head">
      <div className="card-head-text">
        <h2 id={id}>{title}</h2>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </header>
  );
}
