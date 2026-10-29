/** Specialisation switcher under the top bar. The director gets an extra "All trades" view. */
import { useEffect, useRef } from 'react';
import { useL, useStore } from './store';
import { TRADES, type Trade } from './trades';

export function TradeIcon({ trade, size = 20 }: { trade: Trade; size?: number }) {
  return (
    <svg className="trade-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={trade.icon} />
    </svg>
  );
}

export function TradeBar() {
  const { role, trade, setTrade, dirTrade, setDirTrade, alerts } = useStore();
  const { L, pick } = useL();
  const isDir = role === 'director';
  const current = isDir ? dirTrade : trade.id;
  const choose = (id: string) => {
    if (isDir) setDirTrade(id);
    if (id !== 'all') setTrade(id);
  };
  // On a phone the chips scroll sideways; keep the chosen one in view.
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabs.current, btn = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !btn) return;
    const a = el.getBoundingClientRect(), b = btn.getBoundingClientRect();
    if (b.left < a.left || b.right > a.right) el.scrollLeft += b.left < a.left ? b.left - a.left - 8 : b.right - a.right + 8;
  }, [current, role]);
  const openFor = (id: string) => alerts.filter((a) => !a.resolution && a.trade === id).length;
  return (
    <nav className="tradebar" aria-label={L('Specialisation', 'التخصص')}>
      <div className="tradebar-inner">
        <span className="tradebar-label" id="tradebar-label">{L('Trade', 'التخصص')}</span>
        <div ref={tabs} className="trade-tabs" role="radiogroup" aria-labelledby="tradebar-label">
          {isDir && (
            <button type="button" role="radio" aria-checked={current === 'all'} onClick={() => choose('all')}>
              <svg className="trade-icon" viewBox="0 0 24 24" width={20} height={20} aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>
              <span className="trade-name">{L('All trades', 'كل التخصصات')}</span>
            </button>
          )}
          {TRADES.map((t) => {
            const n = role === 'trainer' ? openFor(t.id) : 0;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={current === t.id} onClick={() => choose(t.id)}
                title={`${pick(t.name)} · ${t.framework.code}`}>
                <TradeIcon trade={t} />
                <span className="trade-name">{pick(t.name)}</span>
                {n > 0 && <span className="trade-dot" aria-label={L(`${n} open alerts`, `${n} تنبيهات مفتوحة`)}>{n}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
