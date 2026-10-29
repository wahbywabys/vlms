import 'server-only';
import { callApi } from './api';
import type { Session } from './auth';
import { q1 } from './db';
import type { PublicLab } from './lab';

/** The V-Lab of a trade, with its public catalogue from the API (null when the API is unreachable). */
export async function labForTrade(s: Session, trade: string) {
  const row = await q1<{ code: string; title: string; title_ar: string | null }>(
    `SELECT code, title, title_ar FROM virtual_labs WHERE trade_id = $1 ORDER BY code LIMIT 1`, [trade]);
  if (!row) return null;
  const catalogue = await callApi<PublicLab>(s, `/v1/vlab/labs/${encodeURIComponent(row.code)}`).catch(() => null);
  return { ...row, catalogue };
}
