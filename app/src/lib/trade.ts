import 'server-only';
import { cookies } from 'next/headers';
import type { Session } from './auth';
import { q } from './db';

/**
 * Trades (specialisations) such as CNC machining or welding. A learner's trade
 * is their cohort's; staff pick one with the trade bar, which is kept in the
 * `trade` cookie. The director can also pick 'all'.
 */
export interface TradeRow { id: string; code: string; name: string; name_ar: string | null; icon: string | null }
export const TRADE_COOKIE = 'trade';

export async function trades() {
  return q<TradeRow>(`SELECT id, code, name, name_ar, icon FROM trades ORDER BY sort_order, id`);
}

/** Trades the user teaches or studies, in sort order. */
export async function userTrades(userId: string) {
  return (await q<{ trade_id: string }>(
    `SELECT v.trade_id FROM v_user_trades v JOIN trades t ON t.id = v.trade_id WHERE v.user_id = $1 ORDER BY t.sort_order`, [userId]))
    .map((r) => r.trade_id);
}

/**
 * The trade a page shows. 'own': the learner's cohort trade. 'pick': the staff
 * member's choice, else their first trade. 'all': as 'pick', but 'all' is allowed
 * and is the default.
 */
export async function currentTrade(s: Session, mode: 'own' | 'pick' | 'all' = 'pick'): Promise<string> {
  const [all, mine] = await Promise.all([trades(), userTrades(s.userId)]);
  if (mode === 'own' && mine[0]) return mine[0];
  const picked = (await cookies()).get(TRADE_COOKIE)?.value;
  if (picked === 'all' && mode === 'all') return 'all';
  if (picked && all.some((t) => t.id === picked)) return picked;
  if (mode === 'all') return 'all';
  return mine[0] ?? all[0]?.id ?? 'cnc';
}
