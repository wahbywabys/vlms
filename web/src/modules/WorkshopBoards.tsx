// Copied from app/src/components/modules/WorkshopBoards.tsx by scripts/sync-modules.sh. Edit the original, not this file.
'use client';
/**
 * Trainer boards for the workshop office tablet.
 *
 *  MachineBoard  every machine with its live interlock state (locked,
 *                unlock pending, unlocked + who and time left), passports
 *                and failed pre-checks today, a remote stop, and the QR
 *                label to print and stick on the machine.
 *  StoresBoard   consumables with burn rate, booked demand from the next
 *                7 days of workshop bookings, days of cover against the
 *                supplier lead time, and a one-tap goods receipt.
 */
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { cx, fmt, pickAr, type Ui } from './types';

export interface MachineRow { tag: string; name: string; status: string; qrCode: string | null; tradeId: string; hardware: boolean; controllerSeenAt: string | null;
  precheckCode: string | null; competencyCode: string | null; lockId: string | null; lockState: string | null; sessionEndsAt: string | null; unlockedAt: string | null;
  learnerId: string | null; learnerName: string | null; learnerNameAr: string | null; validPassports: number; failedToday: number }

export function QrCode({ text, size = 120, label }: { text: string; size?: number; label?: string }) {
  const path = useMemo(() => {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d, n: n + 8 };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${path.n} ${path.n}`} width={size} height={size} role="img" aria-label={label ?? text} shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" /><path d={path.d} fill="#000" />
    </svg>
  );
}

export function MachineBoard({ ui, machines, onStop, scanUrl }: { ui: Ui; machines: MachineRow[]; onStop: (lockId: string, reason: string) => Promise<void>;
  /** The link printed in the QR label: the learner's phone opens it and lands on the pre-check. */
  scanUrl: (qrCode: string) => string }) {
  const { L } = ui;
  const [now, setNow] = useState(() => Date.now());
  const [labels, setLabels] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const state = (m: MachineRow) => (m.status === 'maintenance' || m.status === 'locked_out' ? 'out' : m.lockState === 'unlocked' ? 'on' : m.lockState === 'unlock_pending' ? 'pending' : 'locked');
  const TXT = { on: [L('Unlocked', 'مفتوحة'), 'bg-ok text-sheet'], pending: [L('Waiting for PIN', 'بانتظار الرقم'), 'bg-amber-fill text-on-amber'],
    locked: [L('Locked', 'مقفلة'), 'bg-sunk text-ink-2'], out: [L('Out of service', 'خارج الخدمة'), 'bg-bad text-sheet'] } as const;
  const live = machines.filter((m) => state(m) === 'on').length;
  return (
    <div className="flex flex-col gap-3 font-body text-ink">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-ink-2">{L(`${live} of ${machines.length} machines running · interlock follows the safety passport`, `${live} من ${machines.length} ماكينة تعمل · القفل يتبع تصريح السلامة`)}</p>
        <button type="button" onClick={() => setLabels((x) => !x)} className="tw-reset ms-auto h-11 rounded-xl border-2 border-rule bg-sheet px-4 font-semibold">
          {labels ? L('Back to the board', 'العودة إلى اللوحة') : L('Print QR labels', 'اطبع ملصقات QR')}</button>
        {labels && <button type="button" onClick={() => window.print()} className="tw-reset h-11 rounded-xl bg-navy px-4 font-semibold text-on-brand">{L('Print', 'طباعة')}</button>}
      </div>
      {labels ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {machines.filter((m) => m.qrCode).map((m) => (
            <figure key={m.tag} className="m-0 flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-rule-strong bg-white p-3 text-center text-black">
              <p className="text-xs font-bold uppercase tracking-wider">{L('Scan before use', 'امسح قبل الاستخدام')} · امسح قبل الاستخدام</p>
              <QrCode text={scanUrl(m.qrCode!)} size={132} label={m.tag} />
              <figcaption><b className="font-mono">{m.tag}</b><br /><span className="text-xs">{m.name}</span><br /><span className="font-mono text-[10px]">{m.qrCode}</span></figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {machines.map((m) => {
            const st = state(m);
            const left = m.sessionEndsAt ? Math.max(0, Math.round((new Date(m.sessionEndsAt).getTime() - now) / 1000)) : null;
            return (
              <article key={m.tag} className={cx('flex flex-col gap-2 rounded-2xl bg-sheet p-3 shadow-card', st === 'on' && 'ring-2 ring-ok')}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold">{m.tag}</p>
                    <p className="truncate text-sm text-ink-2">{m.name}</p>
                  </div>
                  <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold', TXT[st][1])}>{st === 'on' ? '🔓' : st === 'out' ? '⛔' : '🔒'} {TXT[st][0]}</span>
                </div>
                {(st === 'on' || st === 'pending') && (
                  <div className="flex items-center gap-2 rounded-xl bg-sunk p-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{pickAr(ui, m.learnerName, m.learnerNameAr)}</span>
                    {left !== null && <span className={cx('font-mono text-lg font-bold', left < 300 ? 'text-bad' : '')} dir="ltr">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}
                    <button type="button" onClick={() => void onStop(m.lockId!, 'stopped remotely by trainer')}
                      className="tw-reset h-11 rounded-lg bg-bad px-3 text-sm font-bold text-sheet">{L('Stop', 'إيقاف')}</button>
                  </div>
                )}
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                  <span>{m.hardware ? L(`Relay ${m.controllerSeenAt ? '· seen ' + new Date(m.controllerSeenAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '· offline'}`, `مرحّل ${m.controllerSeenAt ? '· آخر اتصال ' + new Date(m.controllerSeenAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '· غير متصل'}`) : L('Virtual interlock', 'قفل افتراضي')}</span>
                  {m.competencyCode && <span>{L('needs', 'يتطلب')} <span className="font-mono">{m.competencyCode}</span></span>}
                  <span>{L(`${m.validPassports} passport(s) valid`, `${m.validPassports} تصريح ساري`)}</span>
                  {m.failedToday > 0 && <span className="font-semibold text-bad">{L(`${m.failedToday} failed pre-check(s) today`, `${m.failedToday} فحص مسبق راسب اليوم`)}</span>}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface StockRow { id: string; tradeId: string; sku: string; name: string; unit: string; onHand: number; reorderPoint: number; leadTimeDays: number;
  burnPerDay: number; booked7d: number; shortfall14d: number; daysOfCover: number | null; status: 'critical' | 'reorder' | 'ok'; hazardClass: string | null; usedBy: string | null }

export function StoresBoard({ ui, items, onReceive }: { ui: Ui; items: StockRow[]; onReceive: (id: string, qty: number) => Promise<void> }) {
  const { L } = ui;
  const [rows, setRows] = useState(items);
  useEffect(() => setRows(items), [items]);
  const [recv, setRecv] = useState<{ id: string; qty: string } | null>(null);
  const crit = rows.filter((r) => r.status === 'critical').length, reorder = rows.filter((r) => r.status === 'reorder').length;
  const S = { critical: [L('Order now', 'اطلب الآن'), 'bg-bad text-sheet', '▲'], reorder: [L('Reorder', 'أعد الطلب'), 'bg-amber-fill text-on-amber', '◆'], ok: [L('OK', 'متوفر'), 'bg-ok-soft text-ok', '●'] } as const;
  return (
    <div className="flex flex-col gap-3 font-body text-ink">
      <p className="text-ink-2">{L(`${crit} run out before the next delivery could arrive · ${reorder} at reorder point. Stock is issued automatically when a trainer signs off a job.`,
        `${crit} سينفد قبل وصول التوريد التالي · ${reorder} عند حد إعادة الطلب. يُصرف المخزون تلقائيًا عند اعتماد المدرب لمهمة.`)}</p>
      <div className="overflow-x-auto rounded-2xl bg-sheet shadow-card">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-xs text-ink-3">
            <tr className="border-b border-rule text-start">
              <th className="p-3 text-start font-semibold">{L('Item', 'الصنف')}</th>
              <th className="p-3 text-end font-semibold">{L('On hand', 'المتوفر')}</th>
              <th className="p-3 text-end font-semibold">{L('Use / day', 'الاستهلاك اليومي')}</th>
              <th className="p-3 text-end font-semibold">{L('Booked, 7 days', 'المحجوز، 7 أيام')}</th>
              <th className="p-3 font-semibold">{L('Days of cover vs lead time', 'أيام التغطية مقابل مدة التوريد')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cover = r.daysOfCover ?? 99, span = Math.max(14, r.leadTimeDays * 2);
              return (
                <tr key={r.id} className="border-b border-rule last:border-b-0">
                  <td className="p-3">
                    <p className="font-semibold">{r.name} {r.hazardClass && <span className="ms-1 rounded bg-amber-soft px-1 text-[10px] font-bold text-amber" title={r.hazardClass}>⚠</span>}</p>
                    <p className="font-mono text-xs text-ink-3">{r.sku}{r.usedBy ? ` · ${r.usedBy}` : ''}</p>
                  </td>
                  <td className="p-3 text-end font-mono" dir="ltr">{fmt(ui, r.onHand, r.onHand % 1 ? 1 : 0)} {r.unit}</td>
                  <td className="p-3 text-end font-mono" dir="ltr">{fmt(ui, r.burnPerDay, 1)}</td>
                  <td className="p-3 text-end font-mono" dir="ltr">{fmt(ui, r.booked7d, 1)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="relative h-3 flex-1 rounded-full bg-sunk" dir="ltr" title={L(`${fmt(ui, cover, 1)} days of cover; supplier lead time ${r.leadTimeDays} days`, `${fmt(ui, cover, 1)} يوم تغطية؛ مدة التوريد ${r.leadTimeDays} يوم`)}>
                        <div className={cx('absolute inset-y-0 left-0 rounded-full', r.status === 'critical' ? 'bg-bad' : r.status === 'reorder' ? 'bg-amber-fill' : 'bg-ok')} style={{ width: `${Math.min(100, (cover / span) * 100)}%` }} />
                        <div className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: `${(r.leadTimeDays / span) * 100}%` }} />
                      </div>
                      <span className={cx('w-24 rounded-full px-2 py-0.5 text-center text-xs font-bold', S[r.status][1])}><span aria-hidden="true">{S[r.status][2]}</span> {S[r.status][0]}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-3">{r.daysOfCover == null ? L('No recent use', 'لا استهلاك حديث') : L(`${fmt(ui, cover, 1)} d cover · lead ${r.leadTimeDays} d`, `${fmt(ui, cover, 1)} يوم تغطية · توريد ${r.leadTimeDays} يوم`)}
                      {r.shortfall14d > 0 && <span className="font-semibold text-bad"> · {L(`short ${fmt(ui, r.shortfall14d, 1)} in 14 d`, `عجز ${fmt(ui, r.shortfall14d, 1)} خلال 14 يومًا`)}</span>}</p>
                  </td>
                  <td className="p-3 text-end">
                    {recv?.id === r.id ? (
                      <form className="flex justify-end gap-1" onSubmit={async (e) => { e.preventDefault(); const q = Number(recv.qty); if (!(q > 0)) return;
                        await onReceive(r.id, q); setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, onHand: x.onHand + q, status: x.onHand + q > x.reorderPoint ? 'ok' : x.status } : x))); setRecv(null); }}>
                        <input autoFocus inputMode="decimal" value={recv.qty} onChange={(e) => setRecv({ id: r.id, qty: e.target.value })} dir="ltr" aria-label={L('Quantity received', 'الكمية المستلمة')}
                          className="tw-reset h-10 w-20 rounded-lg border-2 border-rule bg-sunk px-2 text-end font-mono" />
                        <button type="submit" className="tw-reset h-10 rounded-lg bg-navy px-3 text-xs font-bold text-on-brand">{L('Add', 'أضف')}</button>
                      </form>
                    ) : <button type="button" onClick={() => setRecv({ id: r.id, qty: String(Math.max(1, Math.ceil(r.reorderPoint * 2 - r.onHand))) })}
                        className="tw-reset h-10 rounded-lg border-2 border-rule px-3 text-xs font-semibold">{L('Receive', 'استلام')}</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
