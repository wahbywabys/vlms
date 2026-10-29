'use client';
/** Specialisation switcher under the top bar. Staff pick a trade; the director can also pick "All trades". */
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import type { Txt } from '@/lib/i18n';
import { useL } from './LangProvider';

export interface TradeChip { id: string; name: Txt; icon: string | null; code: string }
const ALL_ICON = 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z';

export function TradeIcon({ d, size = 20 }: { d: string | null; size?: number }) {
  return (
    <svg className="trade-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={d ?? ALL_ICON} />
    </svg>
  );
}

export function TradeBar({ trades, current, allowAll, fixed }: { trades: TradeChip[]; current: string; allowAll?: boolean; fixed?: boolean }) {
  const { L, pick } = useL();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (id: string) => {
    if (fixed || id === current) return;
    document.cookie = `trade=${id}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  };
  // On a phone the chips scroll sideways; keep the chosen one in view.
  const tabs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabs.current, btn = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !btn) return;
    const a = el.getBoundingClientRect(), b = btn.getBoundingClientRect();
    if (b.left < a.left || b.right > a.right) el.scrollLeft += b.left < a.left ? b.left - a.left - 8 : b.right - a.right + 8;
  }, [current]);
  const shown = fixed ? trades.filter((t) => t.id === current) : trades;
  return (
    <nav className="tradebar" aria-label={L('Specialisation', 'التخصص')} aria-busy={pending}>
      <div className="tradebar-inner">
        <span className="tradebar-label" id="tradebar-label">{L('Trade', 'التخصص')}</span>
        <div ref={tabs} className="trade-tabs" role="radiogroup" aria-labelledby="tradebar-label">
          {allowAll && !fixed && (
            <button type="button" role="radio" aria-checked={current === 'all'} onClick={() => choose('all')}>
              <TradeIcon d={ALL_ICON} />
              <span className="trade-name">{L('All trades', 'كل التخصصات')}</span>
            </button>
          )}
          {shown.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={current === t.id} onClick={() => choose(t.id)} title={`${pick(t.name)} · ${t.code}`}>
              <TradeIcon d={t.icon} />
              <span className="trade-name">{pick(t.name)}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
