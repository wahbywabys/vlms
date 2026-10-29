'use client';
/**
 * Apprentice mobile logbook (phone, one hand, often outdoors).
 *
 *   ┌ site · hours ring (verified / expected / required) ┐
 *   │ [ CHECK IN ]  geofence radar: you are 38 m from the gate (±12 m) │
 *   │ + New entry: date · hours stepper · what I did · 📷 photos/video │
 *   │ entries: submitted ▸ signed by the supervisor at 14:32 (#a1b2c3)  │
 *   └ recent shifts with verified / flagged badges ─────────────────────┘
 *
 * Check-in reads the phone's GPS fix (accuracy and the mock-location hint
 * where the platform exposes one) and the server judges it against the
 * site's geofence. Offline, the fix and the entry with its photos go to the
 * outbox and replay later; the server then flags them as offline replays.
 */
import { useRef, useState } from 'react';
import { compressImage, type Captured } from './media';
import { cx, fmt, pickAr, type Ui } from './types';

export interface OjtTotals { required_hours: number; verified_hours: number; unverified_hours: number; expected_hours: number; on_site: boolean | null }
export interface OjtShift { id: string; openedAt: string; closedAt: string | null; minutes: number | null; verified: boolean; status: string; flags: string[];
  inDistanceM: number | null; outDistanceM: number | null; site: string }
export interface LogEntry { id: string; workDate: string; hours: number; summary: string; status: string; media: { mediaId: string; type: string }[];
  signoff: { decision: string; comment: string | null; signedAt: string; hash: string } | null; queued?: boolean }
export interface Placement { site: string; siteAr?: string | null; employer: string; radiusM: number; latitude: number; longitude: number; supervisor: string }
export interface Fix { latitude: number; longitude: number; accuracyM: number | null; deviceTime: string; isMocked: boolean; source: 'gps' | 'network' | 'demo' }
export interface CheckinOutcome { accepted: boolean; inside?: boolean; distanceM?: number; radiusM?: number; reason: string | null; flags?: string[];
  queued?: boolean; totals?: OjtTotals | null }
export interface LogbookApi {
  checkin(kind: 'in' | 'out', fix: Fix): Promise<CheckinOutcome>;
  submit(entry: { workDate: string; hours: number; summary: string; latitude?: number; longitude?: number }, photos: Captured[]): Promise<{ queued: boolean; id?: string }>;
  /** Where the demo puts the phone when there is no real GPS (e.g. on a desktop). */
  demoFix?: (inside: boolean) => Fix;
  mediaUrl?: (id: string) => string;
}

const REASON: Record<string, [string, string]> = {
  outside_geofence: ['Outside the site boundary. Your hours will need the supervisor to confirm them.', 'خارج حدود الموقع. ستحتاج ساعاتك إلى تأكيد المشرف.'],
  low_accuracy: ['GPS too weak. Step outside or wait for a better fix.', 'إشارة GPS ضعيفة. اخرج إلى مكان مفتوح أو انتظر.'],
  mock_location: ['A mock-location app is on. Turn it off to check in.', 'تطبيق موقع وهمي مُفعّل. أوقفه لتسجيل الحضور.'],
  stale_replay: ['This check-in waited too long offline to count.', 'انتظر هذا التسجيل طويلًا دون اتصال فلم يُحتسب.'],
  already_checked_in: ['You are already checked in.', 'أنت مسجّل حضور بالفعل.'],
  not_checked_in: ['You are not checked in.', 'لم تسجّل حضورك بعد.'],
};
const FLAG: Record<string, [string, string]> = {
  offline_replay: ['sent later', 'أُرسل لاحقًا'], clock_skew: ['phone clock off', 'ساعة الهاتف غير مضبوطة'],
  impossible_travel: ['impossible travel', 'تنقل غير ممكن'], checkout_outside: ['left outside the fence', 'خروج خارج الحدود'], auto_closed: ['auto-closed', 'أُغلق تلقائيًا'],
};

const today = () => new Date().toISOString().slice(0, 10);

export function ApprenticeLogbook({ ui, api, placement, totals: initialTotals, shifts, entries, online }: {
  ui: Ui; api: LogbookApi; placement: Placement | null; totals: OjtTotals | null; shifts: OjtShift[]; entries: LogEntry[]; online: boolean;
}) {
  const { L } = ui;
  const [totals, setTotals] = useState(initialTotals);
  const [onSite, setOnSite] = useState(Boolean(initialTotals?.on_site));
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<(CheckinOutcome & { kind: 'in' | 'out'; fix: Fix }) | null>(null);
  const [mine, setMine] = useState(entries);
  const [form, setForm] = useState(false);

  const locate = () => new Promise<Fix>((res, rej) => {
    if (!navigator.geolocation) { if (api.demoFix) res(api.demoFix(true)); else rej(new Error('no_gps')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => res({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy, deviceTime: new Date(p.timestamp).toISOString(),
        // Android exposes mocked fixes on some browsers; elsewhere the server's travel and accuracy checks still apply.
        isMocked: Boolean((p.coords as GeolocationCoordinates & { mocked?: boolean }).mocked), source: 'gps' }),
      (e) => (api.demoFix ? res(api.demoFix(true)) : rej(e)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
  const check = async (kind: 'in' | 'out', fixOverride?: Fix) => {
    setBusy(true);
    try {
      const fix = fixOverride ?? await locate();
      const out = await api.checkin(kind, fix);
      setLast({ ...out, kind, fix });
      if (out.accepted || out.queued) setOnSite(kind === 'in');
      if (out.totals) setTotals(out.totals);
    } catch {
      setLast({ accepted: false, reason: 'low_accuracy', kind, fix: { latitude: 0, longitude: 0, accuracyM: null, deviceTime: new Date().toISOString(), isMocked: false, source: 'gps' } });
    }
    setBusy(false);
  };

  const req = totals?.required_hours ?? 0;
  const ver = totals?.verified_hours ?? 0, unv = totals?.unverified_hours ?? 0, exp = totals?.expected_hours ?? 0;
  const behind = exp > 0 && ver + unv < exp * 0.85;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 font-body text-ink">
      <section className="flex items-center gap-4 rounded-2xl bg-sheet p-4 shadow-card">
        <HoursRing ui={ui} required={req} verified={ver} unverified={unv} expected={exp} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-3">{L('On-the-job training', 'التدريب في موقع العمل')}</p>
          <h2 className="truncate font-display text-xl font-bold">{placement ? pickAr(ui, placement.site, placement.siteAr) : L('No placement today', 'لا يوجد تدريب ميداني اليوم')}</h2>
          {placement && <p className="truncate text-sm text-ink-2">{placement.employer} · {L(`supervisor ${placement.supervisor}`, `المشرف ${placement.supervisor}`)}</p>}
          <p className={cx('mt-1 text-sm font-semibold', behind ? 'text-bad' : 'text-ok')}>
            {behind ? L(`Behind plan: ${fmt(ui, ver + unv, 1)} of ${fmt(ui, exp, 1)} h expected by now`, `متأخر عن الخطة: ${fmt(ui, ver + unv, 1)} من ${fmt(ui, exp, 1)} ساعة متوقعة حتى الآن`)
              : L(`On track: ${fmt(ui, ver, 1)} h verified`, `في المسار: ${fmt(ui, ver, 1)} ساعة موثّقة`)}
          </p>
        </div>
      </section>

      {placement && (
        <section className="flex flex-col gap-3 rounded-2xl bg-sheet p-4 shadow-card">
          <button type="button" disabled={busy} onClick={() => void check(onSite ? 'out' : 'in')}
            className={cx('tw-reset flex h-20 w-full items-center justify-center gap-3 rounded-2xl font-display text-2xl font-bold text-white transition active:scale-[.98] disabled:opacity-60',
              onSite ? 'bg-navy' : 'bg-accent')}>
            <span aria-hidden="true">{onSite ? '⏏' : '📍'}</span>
            {busy ? L('Getting your location…', 'جارٍ تحديد موقعك…') : onSite ? L('Check out', 'تسجيل الانصراف') : L('Check in at site', 'تسجيل الحضور في الموقع')}
          </button>
          {!online && <p className="rounded-lg bg-amber-soft px-3 py-2 text-sm font-semibold text-amber">{L('Offline: your check-in is saved on the phone and sent when you are back online.', 'غير متصل: يُحفظ تسجيلك على الهاتف ويُرسل عند عودة الاتصال.')}</p>}
          {last && <Radar ui={ui} placement={placement} outcome={last} />}
          {api.demoFix && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="self-center font-semibold uppercase tracking-wider text-ink-3">{L('Demo GPS', 'GPS تجريبي')}</span>
              <button type="button" className="tw-reset h-9 rounded-lg border border-rule bg-sunk px-3" onClick={() => void check(onSite ? 'out' : 'in', api.demoFix!(true))}>{L('At the site', 'في الموقع')}</button>
              <button type="button" className="tw-reset h-9 rounded-lg border border-rule bg-sunk px-3" onClick={() => void check(onSite ? 'out' : 'in', api.demoFix!(false))}>{L('Down the road', 'على بُعد شارع')}</button>
              <button type="button" className="tw-reset h-9 rounded-lg border border-rule bg-sunk px-3" onClick={() => void check(onSite ? 'out' : 'in', { ...api.demoFix!(true), isMocked: true })}>{L('Mock-location app', 'تطبيق موقع وهمي')}</button>
            </div>
          )}
        </section>
      )}

      {form
        ? <EntryForm ui={ui} onCancel={() => setForm(false)} onSubmit={async (e, photos) => {
            const r = await api.submit({ ...e, ...(last?.fix.latitude ? { latitude: last.fix.latitude, longitude: last.fix.longitude } : {}) }, photos);
            setMine((m) => [{ id: r.id ?? `local-${Date.now()}`, workDate: e.workDate, hours: e.hours, summary: e.summary, status: 'submitted', queued: r.queued,
              media: photos.map((p, i) => ({ mediaId: p.url || String(i), type: p.blob.type.startsWith('video') ? 'video' : 'photo' })), signoff: null }, ...m]);
            setForm(false);
          }} />
        : <button type="button" onClick={() => setForm(true)} disabled={!placement}
            className="tw-reset flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rule-strong bg-sheet font-display text-xl font-bold text-ink-2 disabled:opacity-50">
            ＋ {L('New logbook entry', 'إدخال جديد في السجل')}
          </button>}

      <section className="flex flex-col gap-2" aria-label={L('My entries', 'إدخالاتي')}>
        <h3 className="px-1 font-display text-lg font-bold">{L('My entries', 'إدخالاتي')}</h3>
        {mine.length === 0 && <p className="px-1 text-sm text-ink-3">{L('No entries yet.', 'لا توجد إدخالات بعد.')}</p>}
        {mine.map((e) => <EntryCard key={e.id} ui={ui} e={e} mediaUrl={api.mediaUrl} />)}
      </section>

      {shifts.length > 0 && (
        <section className="flex flex-col gap-1 rounded-2xl bg-sheet p-3 shadow-card" aria-label={L('Recent shifts', 'الورديات الأخيرة')}>
          <h3 className="px-1 font-display text-lg font-bold">{L('Recent shifts', 'الورديات الأخيرة')}</h3>
          {shifts.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center gap-2 border-t border-rule px-1 py-2 text-sm first:border-t-0">
              <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', s.status === 'open' ? 'bg-accent' : s.verified ? 'bg-ok' : 'bg-amber-fill')} aria-hidden="true" />
              <span className="w-24 shrink-0 font-mono text-xs" dir="ltr">{new Date(s.openedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} {new Date(s.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="flex-1 truncate">{s.status === 'open' ? L('On site now', 'في الموقع الآن') : `${fmt(ui, (s.minutes ?? 0) / 60, 1)} h`}
                {s.flags.length > 0 && <span className="ms-1 text-xs text-amber">· {s.flags.map((f) => (FLAG[f] ? (ui.lang === 'ar' ? FLAG[f]![1] : FLAG[f]![0]) : f)).join(', ')}</span>}</span>
              <span className={cx('text-xs font-semibold', s.verified ? 'text-ok' : 'text-ink-3')}>{s.status === 'open' ? '' : s.verified ? L('Verified', 'موثّق') : L('Needs confirming', 'يحتاج تأكيدًا')}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function HoursRing({ ui, required, verified, unverified, expected }: { ui: Ui; required: number; verified: number; unverified: number; expected: number }) {
  const r = 34, c = 2 * Math.PI * r, f = (h: number) => (required ? Math.min(1, h / required) : 0) * c;
  const tick = required ? (expected / required) * 360 - 90 : -90;
  return (
    <svg viewBox="0 0 84 84" className="h-24 w-24 shrink-0" role="img" aria-label={ui.L(`${verified} of ${required} hours verified`, `${verified} من ${required} ساعة موثّقة`)}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--rule)" strokeWidth="9" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--amber-fill)" strokeWidth="9" transform="rotate(-90 42 42)" strokeDasharray={`${f(verified + unverified)} ${c}`} />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--ok)" strokeWidth="9" transform="rotate(-90 42 42)" strokeDasharray={`${f(verified)} ${c}`} />
      <line x1="42" y1="2" x2="42" y2="14" stroke="var(--ink)" strokeWidth="2.5" transform={`rotate(${tick + 90} 42 42)`} />
      <text x="42" y="42" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)" fontFamily="var(--f-display)">{Math.round(verified)}</text>
      <text x="42" y="56" textAnchor="middle" fontSize="9" fill="var(--ink-3)">/ {required} h</text>
    </svg>
  );
}

/** Where the fix fell against the geofence, to scale; the accuracy circle shows the GPS uncertainty. */
function Radar({ ui, placement, outcome }: { ui: Ui; placement: Placement; outcome: CheckinOutcome & { kind: 'in' | 'out'; fix: Fix } }) {
  const { L } = ui;
  const R = placement.radiusM;
  const dLat = (outcome.fix.latitude - placement.latitude) * 111_320;
  const dLon = (outcome.fix.longitude - placement.longitude) * 111_320 * Math.cos((placement.latitude * Math.PI) / 180);
  const scale = 40 / Math.max(R * 1.6, Math.hypot(dLat, dLon) * 1.15, 1);
  const x = 50 + dLon * scale, y = 50 - dLat * scale;
  const ok = outcome.accepted && outcome.inside !== false;
  const msg = outcome.queued ? L('Saved offline · sent when you reconnect', 'حُفظ دون اتصال · يُرسل عند عودة الاتصال')
    : outcome.reason && REASON[outcome.reason] ? (ui.lang === 'ar' ? REASON[outcome.reason]![1] : REASON[outcome.reason]![0])
    : outcome.kind === 'in' ? L('Checked in. Have a safe shift.', 'تم تسجيل الحضور. وردية آمنة.') : L('Checked out. Write up what you did today.', 'تم تسجيل الانصراف. اكتب ما قمت به اليوم.');
  return (
    <div className={cx('flex items-center gap-3 rounded-xl p-3', outcome.queued ? 'bg-amber-soft' : ok ? 'bg-ok-soft' : 'bg-bad-soft')} role="status">
      <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" aria-hidden="true">
        <circle cx="50" cy="50" r={R * scale} fill="var(--sheet)" stroke="var(--ok)" strokeWidth="1.5" strokeDasharray="4 3" />
        <rect x="46" y="46" width="8" height="8" rx="1.5" fill="var(--navy, var(--brand))" />
        {outcome.fix.accuracyM ? <circle cx={x} cy={y} r={Math.min(45, outcome.fix.accuracyM * scale)} fill="var(--blue)" opacity=".15" /> : null}
        {outcome.fix.latitude !== 0 && <circle cx={x} cy={y} r="4" fill={ok ? 'var(--ok)' : 'var(--bad)'} stroke="var(--sheet)" strokeWidth="1.5" />}
      </svg>
      <div className="min-w-0 text-sm">
        <p className={cx('font-semibold', outcome.queued ? 'text-amber' : ok ? 'text-ok' : 'text-bad')}>{msg}</p>
        {outcome.distanceM !== undefined && (
          <p className="mt-1 text-ink-2">{L(`${outcome.distanceM} m from the site centre (fence ${R} m)`, `${outcome.distanceM} م من مركز الموقع (الحد ${R} م)`)}
            {outcome.fix.accuracyM ? <> · ±{Math.round(outcome.fix.accuracyM)} m</> : null}</p>
        )}
        {outcome.flags && outcome.flags.length > 0 && <p className="mt-1 text-xs text-amber">{outcome.flags.map((f) => (FLAG[f] ? (ui.lang === 'ar' ? FLAG[f]![1] : FLAG[f]![0]) : f)).join(' · ')}</p>}
      </div>
    </div>
  );
}

function EntryForm({ ui, onSubmit, onCancel }: { ui: Ui; onCancel: () => void;
  onSubmit: (e: { workDate: string; hours: number; summary: string }, photos: Captured[]) => Promise<void> }) {
  const { L } = ui;
  const [workDate, setDate] = useState(today);
  const [hours, setHours] = useState(6);
  const [summary, setSummary] = useState('');
  const [photos, setPhotos] = useState<Captured[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const ok = summary.trim().length >= 15 && hours > 0;
  return (
    <form className="flex flex-col gap-3 rounded-2xl bg-sheet p-4 shadow-card" onSubmit={async (ev) => {
      ev.preventDefault(); if (!ok) return; setBusy(true); setErr(null);
      try { await onSubmit({ workDate, hours, summary: summary.trim() }, photos); } catch (e) { setErr((e as { message?: string }).message ?? L('Could not save', 'تعذّر الحفظ')); }
      setBusy(false);
    }}>
      <h3 className="font-display text-xl font-bold">{L('New entry', 'إدخال جديد')}</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">{L('Date', 'التاريخ')}
          <input type="date" value={workDate} max={today()} onChange={(e) => setDate(e.target.value)} className="tw-reset h-12 rounded-xl border-2 border-rule bg-sunk px-3 font-mono" />
        </label>
        <div className="flex flex-col gap-1 text-sm font-semibold">{L('Hours', 'الساعات')}
          <div className="flex h-12 items-center gap-1" dir="ltr">
            <button type="button" className="tw-reset h-12 w-12 rounded-xl border-2 border-rule bg-sunk text-xl" onClick={() => setHours((h) => Math.max(0.5, h - 0.5))} aria-label={L('Fewer hours', 'ساعات أقل')}>−</button>
            <output className="flex-1 text-center font-mono text-xl">{hours}</output>
            <button type="button" className="tw-reset h-12 w-12 rounded-xl border-2 border-rule bg-sunk text-xl" onClick={() => setHours((h) => Math.min(16, h + 0.5))} aria-label={L('More hours', 'ساعات أكثر')}>+</button>
          </div>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">{L('What did you do? (tasks, tools, what you learned)', 'ماذا فعلت؟ (المهام، العدد، ما تعلمته)')}
        <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} dir="auto"
          className="tw-reset rounded-xl border-2 border-rule bg-sunk p-3 text-base font-normal"
          placeholder={L('e.g. Replaced the front brake pads on a Hyundai Accent; torqued the caliper bolts to 88 N·m…', 'مثال: استبدلت تيل الفرامل الأمامي لسيارة هيونداي أكسنت؛ ربطت مسامير الكاليبر بعزم 88 نيوتن·م…')} />
        <span className={cx('text-xs font-normal', summary.trim().length >= 15 ? 'text-ok' : 'text-ink-3')}>{L(`${summary.trim().length} / 15 characters minimum`, `${summary.trim().length} / 15 حرفًا على الأقل`)}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((p, i) => (
          <span key={p.url} className="relative h-16 w-16 overflow-hidden rounded-xl border border-rule bg-sunk">
            {p.blob.type.startsWith('video') ? <video src={p.url} className="h-full w-full object-cover" muted /> : <img src={p.url} alt="" className="h-full w-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */}
            <button type="button" className="tw-reset absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-xs text-paper"
              aria-label={L('Remove', 'حذف')} onClick={() => setPhotos((ps) => ps.filter((_, k) => k !== i))}>✕</button>
          </span>
        ))}
        <button type="button" onClick={() => cam.current?.click()} disabled={photos.length >= 12}
          className="tw-reset flex h-16 items-center gap-2 rounded-xl border-2 border-rule bg-sunk px-4 font-semibold text-ink-2">📷 {L('Photo / video', 'صورة / فيديو')}</button>
        <input ref={cam} type="file" accept="image/*,video/*" capture="environment" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f) { const c = await compressImage(f); setPhotos((ps) => [...ps, c]); }
        }} />
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="tw-reset h-14 rounded-xl border-2 border-rule px-4 font-semibold">{L('Cancel', 'إلغاء')}</button>
        <button type="submit" disabled={!ok || busy} className="tw-reset h-14 flex-1 rounded-xl bg-accent font-display text-lg font-bold text-white disabled:opacity-40">
          {busy ? L('Sending…', 'جارٍ الإرسال…') : L('Send to my supervisor', 'أرسل إلى مشرفي')}</button>
      </div>
    </form>
  );
}

function EntryCard({ ui, e, mediaUrl }: { ui: Ui; e: LogEntry; mediaUrl?: (id: string) => string }) {
  const { L } = ui;
  const st = e.queued ? 'queued' : e.signoff?.decision ?? e.status;
  const tone = st === 'approved' ? 'bg-ok-soft text-ok' : st === 'rejected' ? 'bg-bad-soft text-bad' : st === 'revision_requested' ? 'bg-amber-soft text-amber' : st === 'queued' ? 'bg-amber-soft text-amber' : 'bg-blue-soft text-blue';
  const label: Record<string, [string, string]> = { approved: ['Signed off', 'معتمد'], rejected: ['Rejected', 'مرفوض'], revision_requested: ['Revise', 'يحتاج تعديل'],
    submitted: ['Waiting for supervisor', 'بانتظار المشرف'], queued: ['Queued offline', 'في الانتظار دون اتصال'], draft: ['Draft', 'مسودة'] };
  return (
    <article className="flex flex-col gap-2 rounded-2xl bg-sheet p-3 shadow-card">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-ink-3" dir="ltr">{e.workDate.slice(0, 10)} · {e.hours} h</span>
        <span className={cx('ms-auto rounded-full px-2 py-0.5 text-xs font-bold', tone)}>{ui.lang === 'ar' ? label[st]?.[1] ?? st : label[st]?.[0] ?? st}</span>
      </div>
      <p className="text-sm" dir="auto">{e.summary}</p>
      {e.media.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto">
          {e.media.map((m) => <span key={m.mediaId} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-sunk">
            {m.type === 'photo' && (mediaUrl || m.mediaId.startsWith('blob:')) ? <img src={m.mediaId.startsWith('blob:') ? m.mediaId : mediaUrl!(m.mediaId)} alt="" className="h-full w-full object-cover" loading="lazy" /> /* eslint-disable-line @next/next/no-img-element */
              : <span className="grid h-full place-items-center text-lg" aria-hidden="true">{m.type === 'video' ? '▶' : '📷'}</span>}</span>)}
        </div>
      )}
      {e.signoff && (
        <p className="border-t border-rule pt-2 text-xs text-ink-2">
          {L('Signed', 'وُقّع')} <span dir="ltr">{new Date(e.signoff.signedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {' · '}<span className="font-mono" title={e.signoff.hash}>#{e.signoff.hash.slice(0, 8)}</span>
          {e.signoff.comment && <> · <span dir="auto">“{e.signoff.comment}”</span></>}
        </p>
      )}
    </article>
  );
}
