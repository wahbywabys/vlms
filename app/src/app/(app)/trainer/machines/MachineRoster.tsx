'use client';
/**
 * Trainer: scan a machine's QR sticker and see, for each learner of your
 * cohorts, whether they may use that real machine now. Works from the
 * qualification list saved on the tablet when the network is down; then
 * "Let them start" is recorded and checked by the server on reconnect.
 */
import { useState } from 'react';
import { useL } from '@/components/LangProvider';
import { blockerText, Scanner } from '@/components/modules/MachineAccess';
import { decide, findMachine, loadPack, packExpired, type OfflinePack, type PackMachine } from '@/components/modules/offlinePack';
import { decodeFrame, fetchPack, recordScan } from '@/lib/machineOffline';

export function MachineRoster({ userId }: { userId: string }) {
  const { L, lang } = useL();
  const ui = { L, lang };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hit, setHit] = useState<{ machine: PackMachine; pack: OfflinePack; live: boolean } | null>(null);
  const [recorded, setRecorded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'allowed'>('all');

  const onCode = async (code: string) => {
    setBusy(true); setErr(null); setRecorded({});
    const before = loadPack(userId)?.generatedAt;
    const pack = (await fetchPack()) ?? loadPack(userId);
    const live = !!pack && pack.generatedAt !== before;
    if (!pack || pack.forUser !== userId) setErr(L('No connection, and this tablet has no saved list yet. Connect once to the centre network.', 'لا يوجد اتصال، ولا توجد قائمة محفوظة على هذا الجهاز بعد. اتصل مرة بشبكة المركز.'));
    else {
      const machine = findMachine(pack, code);
      if (!machine) setErr(L('No machine has that code.', 'لا توجد ماكينة بهذا الرمز.'));
      else setHit({ machine, pack, live });
    }
    setBusy(false);
  };

  if (!hit) return (
    <div className="mx-auto w-full max-w-md">
      {err && <p className="notice notice-danger" role="alert">{err}</p>}
      <Scanner ui={ui} busy={busy} onCode={(c) => void onCode(c)} decodeFrame={decodeFrame}
        title={L('Scan a machine', 'امسح ماكينة')} hint={L('Point the camera at the QR sticker to see who may use this machine.', 'وجّه الكاميرا إلى ملصق QR لترى من يُسمح له باستخدام هذه الماكينة.')} />
    </div>
  );

  const { machine: m, pack, live } = hit;
  const expired = packExpired(pack);
  const rows = pack.people.map((p) => ({ p, d: decide(pack, m, p.id) }))
    .sort((a, b) => ['allowed', 'precheck', 'blocked'].indexOf(a.d.state) - ['allowed', 'precheck', 'blocked'].indexOf(b.d.state));
  const shown = rows.filter((r) => filter === 'all' || r.d.state === 'allowed');
  const STATE = { allowed: [L('Allowed', 'مسموح'), 'chip chip-on'], precheck: [L('Needs pre-check', 'يحتاج فحصًا مسبقًا'), 'chip'], blocked: [L('Not allowed', 'غير مسموح'), 'chip chip-danger'] } as const;
  const at = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <p className="muted small mono">{m.tag} · {m.centerCode} · {lang === 'ar' && m.workshopAr ? m.workshopAr : m.workshop}</p>
          <h2>{(lang === 'ar' && m.typeNameAr ? m.typeNameAr : m.typeName) ?? m.name}{m.brand ? ` · ${m.brand} ${m.model ?? ''}` : ''}</h2>
          {m.serial && <p className="muted small">S/N <span className="mono">{m.serial}</span> · {L('check it matches the nameplate', 'تأكد أنه يطابق لوحة البيانات')}</p>}
        </div>
        <button type="button" className="ghost" onClick={() => setHit(null)}>{L('Scan another', 'امسح أخرى')}</button>
      </header>
      {live ? <p className="notice notice-info">{L('Live from the server.', 'مباشر من الخادم.')}</p>
        : <p className="notice notice-danger">📡 {expired ? L('Offline, and the saved list is too old to trust. Connect to the centre network.', 'بدون اتصال، والقائمة المحفوظة قديمة جدًا. اتصل بشبكة المركز.')
          : L(`Offline · not yet confirmed. From the list saved at ${at(pack.generatedAt)}; the server re-checks every start you record.`, `بدون اتصال · لم يتأكد بعد. من القائمة المحفوظة في ${at(pack.generatedAt)}؛ يعيد الخادم فحص كل بدء تسجله.`)}</p>}
      {['maintenance', 'locked_out', 'retired'].includes(m.status) && <p className="notice notice-danger">{blockerText(ui, `machine_${m.status}`)}</p>}
      <div className="tabs" role="tablist">
        <button type="button" className={filter === 'all' ? 'primary' : 'ghost'} onClick={() => setFilter('all')}>{L(`Everyone (${rows.length})`, `الكل (${rows.length})`)}</button>
        <button type="button" className={filter === 'allowed' ? 'primary' : 'ghost'} onClick={() => setFilter('allowed')}>{L(`Allowed (${rows.filter((r) => r.d.state === 'allowed').length})`, `المسموح لهم (${rows.filter((r) => r.d.state === 'allowed').length})`)}</button>
      </div>
      <div className="scroll-x">
        <table className="data">
          <thead><tr><th>{L('Learner', 'المتدرب')}</th><th>{L('On this machine', 'على هذه الماكينة')}</th><th>{L('Why', 'السبب')}</th><th /></tr></thead>
          <tbody>{shown.map(({ p, d }) => (
            <tr key={p.id}>
              <td>{lang === 'ar' && p.nameAr ? p.nameAr : p.name}</td>
              <td><span className={STATE[d.state][1]}>{STATE[d.state][0]}</span>{d.passportUntil && <span className="muted small"> · {L('until', 'حتى')} {at(d.passportUntil)}</span>}</td>
              <td className="small">{d.reasons.map((b) => blockerText(ui, b)).join(' · ')}</td>
              <td>{!live && !expired && d.state === 'allowed' && (recorded[p.id]
                ? <span className="muted small">✓ {L('Recorded', 'تم التسجيل')}</span>
                : <button type="button" onClick={() => void recordScan(m.code, p.id, true, pack).then(() => setRecorded((r) => ({ ...r, [p.id]: true })))}>{L('Let them start', 'اسمح بالبدء')}</button>)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="muted small">{L('"Needs pre-check": the learner scans the machine on their phone and passes its short safety quiz (online, on the centre network).',
        '"يحتاج فحصًا مسبقًا": يمسح المتدرب الماكينة بهاتفه ويجتاز اختبار السلامة القصير (متصلًا بشبكة المركز).')}</p>
    </section>
  );
}
