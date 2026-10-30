// Copied from app/src/components/modules/MachineAccess.tsx by scripts/sync-modules.sh. Edit the original, not this file.
'use client';
/**
 * QR safety passport, learner side (phone).
 *
 *   scan the QR label on the machine ─▶ machine card (eligible? blockers?)
 *     ─▶ 3–5 question pre-check, one big-tap question per screen
 *     ─▶ pass: unlock card with PIN / token and the session countdown,
 *              "Finished, lock the machine" button
 *        fail: what was wrong and why, cool-down before a retry
 *
 * A passport from earlier in the shift skips the quiz. The parent supplies
 * the calls (`api`), so the same screen runs against the API in the app and
 * against the in-memory engines in the prototype.
 *
 * The QR sticker holds only the machine's code. When the server cannot be
 * reached, `offline` answers from the qualification list saved on the device:
 * the answer is marked "not yet confirmed" and the scan is queued, so the
 * server checks it again when the device reconnects.
 */
import { useEffect, useRef, useState } from 'react';
import { codeFromQr, type OfflineDecision, type PackMachine } from './offlinePack';
import { cx, pickAr, type Bi, type Ui } from './types';

export interface MachineInfo {
  machine: { tag: string; name: string; status: string; workshop: string; workshopAr: string | null; controller: 'hardware' | 'virtual';
    requiredCompetency: { code: string; title: string } | null;
    /** The real machine, from the machine register. */
    center?: string | null; typeName?: string | null; typeNameAr?: string | null; brand?: string | null; model?: string | null; serial?: string | null;
    photoId?: string | null; twin?: { id: string; match: string | null } | null };
  precheck: { code: string; title: string; titleAr: string | null; questions: number; unlockMinutes: number } | null;
  eligible: boolean; blockers: string[];
  passport: { id: string; validUntil: string } | null;
  lock: LockView | null;
}
export interface LockView { id: string; state: string; sessionEndsAt: string | null; tokenExpiresAt: string | null; unlockedAt: string | null; token?: string; pin?: string }
export interface ServedQuestion { id: string; critical?: boolean; prompt: Bi; options: { id: string; en: string; ar: string }[] }
export type StartResult =
  | { reused: true; passport: { id: string; validUntil: string }; lock: LockView }
  | { reused: false; attemptId: string; expiresAt: string; title: string; titleAr: string | null; items: ServedQuestion[] };
export interface SubmitResult {
  result: { score: number; passed: boolean; criticalMissed: string[]; wrong: { id: string; why?: Bi }[] };
  passport: { id: string; validUntil: string } | null; lock: LockView | null;
}
/** Offline fallback: the decision from the saved list, and a way to queue the scan for confirmation. */
export interface MachineOffline {
  check: (code: string) => { machine: PackMachine; decision: OfflineDecision; packAt: string; expired: boolean } | null | 'no_pack';
  record: (code: string, allowed: boolean) => Promise<void>;
}
export interface MachineApi {
  scan(code: string): Promise<MachineInfo>;
  start(code: string): Promise<StartResult>;
  submit(attemptId: string, answers: Record<string, string>): Promise<SubmitResult>;
  release(lockId: string): Promise<void>;
}
/** Errors from the api carry the server's code (not_eligible, cooldown, expired…) and details. */
export interface ApiFailure { status: number; code: string; message?: string; details?: { blockers?: string[]; retryAfterS?: number } }

const BLOCKER: Record<string, Bi> = {
  missing_competency: { en: 'You are not yet signed off on the competency this machine needs', ar: 'لم تُعتمد بعد في الجدارة التي تتطلبها هذه الماكينة' },
  machine_locked_out: { en: 'The machine is locked out (LOTO or a fault)', ar: 'الماكينة مقفلة (عزل أو عطل)' },
  machine_maintenance: { en: 'The machine is down for maintenance', ar: 'الماكينة في الصيانة' },
  machine_retired: { en: 'This machine is no longer in service', ar: 'هذه الماكينة خارج الخدمة' },
  machine_in_use: { en: 'Someone else is using this machine', ar: 'شخص آخر يستخدم هذه الماكينة' },
  no_precheck: { en: 'No pre-check is set up for this machine', ar: 'لا يوجد فحص مسبق مُعدّ لهذه الماكينة' },
  no_passport: { en: 'No safety passport for this machine yet: take its pre-check when the network is back, or ask your trainer', ar: 'لا يوجد تصريح سلامة لهذه الماكينة بعد: أجرِ الفحص المسبق عند عودة الشبكة أو اسأل مدربك' },
};
export const blockerText = (ui: Ui, b: string) => pickAr(ui, BLOCKER[b]?.en ?? b, BLOCKER[b]?.ar);

type Step = { at: 'scan' } | { at: 'machine'; info: MachineInfo; code: string }
  | { at: 'quiz'; info: MachineInfo; code: string; attemptId: string; items: ServedQuestion[]; answers: Record<string, string>; i: number }
  | { at: 'failed'; info: MachineInfo; code: string; res: SubmitResult; items: ServedQuestion[]; answers: Record<string, string> }
  | { at: 'unlocked'; info: MachineInfo; code: string; lock: LockView; validUntil: string | null; reused: boolean }
  | { at: 'done'; info: MachineInfo }
  | { at: 'offline'; code: string; machine: PackMachine; decision: OfflineDecision; packAt: string; expired: boolean };

export function MachineAccess({ ui, api, initialCode, demoCodes, offline, decodeFrame, photoUrl, twinHref }: { ui: Ui; api: MachineApi; initialCode?: string | null;
  /** Demo only: QR codes the learner can "scan" with a tap. */
  demoCodes?: { code: string; label: string }[];
  offline?: MachineOffline;
  /** Reads a QR from a camera frame where the browser has no BarcodeDetector (iPhone, Firefox). */
  decodeFrame?: FrameDecoder;
  photoUrl?: (mediaId: string) => string;
  /** Link to practise on the machine's 3D twin. */
  twinHref?: (twinId: string) => string }) {
  const { L } = ui;
  const [step, setStep] = useState<Step>({ at: 'scan' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fail = (e: unknown) => {
    const f = e as ApiFailure;
    if (f?.code === 'cooldown') setErr(L(`Read the safety card, then try again in ${f.details?.retryAfterS ?? 60} s.`, `اقرأ بطاقة السلامة ثم حاول بعد ${f.details?.retryAfterS ?? 60} ثانية.`));
    else if (f?.code === 'not_eligible') setErr(L('This machine cannot be unlocked for you now.', 'لا يمكن فتح هذه الماكينة لك الآن.'));
    else if (f?.code === 'expired') setErr(L('The pre-check timed out. Scan the machine again.', 'انتهى وقت الفحص. امسح الماكينة مرة أخرى.'));
    else if (f?.status === 404) setErr(L('No machine has that code.', 'لا توجد ماكينة بهذا الرمز.'));
    else setErr(f?.message ?? L('Something went wrong. Try again.', 'حدث خطأ. حاول مرة أخرى.'));
  };
  const scan = async (raw: string) => {
    const code = codeFromQr(raw);
    setBusy(true); setErr(null);
    try { setStep({ at: 'machine', info: await api.scan(code), code }); } catch (e) {
      const f = e as ApiFailure;
      const unreachable = f?.status === 0 || f?.code === 'offline' || f?.code === 'api_unavailable' || f?.status === 503;
      const local = unreachable && offline ? offline.check(code) : null;
      if (local && local !== 'no_pack') {
        setStep({ at: 'offline', code, ...local });
        if (!local.expired) void offline!.record(code, local.decision.state === 'allowed').catch(() => undefined);
      } else if (unreachable) {
        setErr(local === 'no_pack'
          ? L('No connection, and this device has no saved list yet. Connect once to the centre network so it can download one.', 'لا يوجد اتصال، ولا توجد قائمة محفوظة على هذا الجهاز بعد. اتصل مرة بشبكة المركز ليحمّلها.')
          : L('No connection, and this machine is not in the saved list.', 'لا يوجد اتصال، وهذه الماكينة ليست في القائمة المحفوظة.'));
      } else fail(e);
    }
    setBusy(false);
  };
  useEffect(() => { if (initialCode) void scan(initialCode); }, [initialCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (s: Extract<Step, { at: 'machine' | 'failed' }>) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.start(s.code);
      if (r.reused) setStep({ at: 'unlocked', info: s.info, code: s.code, lock: r.lock, validUntil: r.passport.validUntil, reused: true });
      else setStep({ at: 'quiz', info: s.info, code: s.code, attemptId: r.attemptId, items: r.items, answers: {}, i: 0 });
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const answer = async (s: Extract<Step, { at: 'quiz' }>, opt: string) => {
    const answers = { ...s.answers, [s.items[s.i]!.id]: opt };
    if (s.i + 1 < s.items.length) { setStep({ ...s, answers, i: s.i + 1 }); return; }
    setStep({ ...s, answers }); setBusy(true); setErr(null);
    try {
      const res = await api.submit(s.attemptId, answers);
      if (res.result.passed && res.lock) setStep({ at: 'unlocked', info: s.info, code: s.code, lock: res.lock, validUntil: res.passport?.validUntil ?? null, reused: false });
      else setStep({ at: 'failed', info: s.info, code: s.code, res, items: s.items, answers });
    } catch (e) { fail(e); }
    setBusy(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 font-body text-ink">
      {err && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 font-semibold text-bad">{err}</p>}

      {step.at === 'scan' && <Scanner ui={ui} busy={busy} onCode={(c) => void scan(c)} demoCodes={demoCodes} decodeFrame={decodeFrame} />}

      {step.at === 'offline' && <OfflineCard ui={ui} s={step} onAgain={() => { setErr(null); setStep({ at: 'scan' }); }} onRetry={() => void scan(step.code)} />}

      {step.at === 'machine' && (
        <MachineCard ui={ui} info={step.info} photoUrl={photoUrl} twinHref={twinHref}>
          {step.info.lock && ['unlocked', 'unlock_pending'].includes(step.info.lock.state)
            ? <Big onClick={() => setStep({ at: 'unlocked', info: step.info, code: step.code, lock: step.info.lock!, validUntil: step.info.passport?.validUntil ?? null, reused: true })}>
                {L('Back to my session', 'العودة إلى جلستي')}</Big>
            : step.info.eligible
              ? <Big busy={busy} onClick={() => void start(step)}>
                  {step.info.passport ? L('Unlock (passport valid)', 'فتح (التصريح ساري)') : L(`Start ${step.info.precheck?.questions ?? 3}-question pre-check`, `ابدأ الفحص المسبق (${step.info.precheck?.questions ?? 3} أسئلة)`)}
                </Big>
              : <ul className="m-0 list-none p-0 flex flex-col gap-2">{step.info.blockers.map((b) => (
                  <li key={b} className="flex gap-2 rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad"><span aria-hidden="true">⛔</span>{pickAr(ui, BLOCKER[b]?.en ?? b, BLOCKER[b]?.ar)}
                    {b === 'missing_competency' && step.info.machine.requiredCompetency && <span className="font-mono"> ({step.info.machine.requiredCompetency.code})</span>}</li>
                ))}</ul>}
          <button type="button" className="tw-reset mt-1 h-11 text-sm font-semibold text-ink-3 underline" onClick={() => { setErr(null); setStep({ at: 'scan' }); }}>{L('Scan another machine', 'امسح ماكينة أخرى')}</button>
        </MachineCard>
      )}

      {step.at === 'quiz' && (() => {
        const q = step.items[step.i]!;
        return (
          <section className="flex flex-col gap-3 rounded-2xl bg-sheet p-4 shadow-card" aria-live="polite">
            <div className="flex items-center gap-2">
              {step.items.map((it, k) => <span key={it.id} className={cx('h-2 flex-1 rounded-full', k < step.i ? 'bg-ok' : k === step.i ? 'bg-accent' : 'bg-rule')} />)}
            </div>
            <p className="font-mono text-xs uppercase tracking-wider text-ink-3">{step.info.machine.tag} · {L(`Question ${step.i + 1} of ${step.items.length}`, `السؤال ${step.i + 1} من ${step.items.length}`)}
              {q.critical && <span className="ms-2 rounded-full bg-amber-fill px-2 py-0.5 font-body font-bold normal-case tracking-normal text-on-amber">{L('Must be right', 'يجب أن تكون صحيحة')}</span>}</p>
            <h2 className="font-display text-2xl font-bold leading-tight">{pickAr(ui, q.prompt.en, q.prompt.ar)}</h2>
            <div className="flex flex-col gap-2">
              {q.options.map((o) => (
                <button key={o.id} type="button" disabled={busy} onClick={() => void answer(step, o.id)}
                  className={cx('tw-reset min-h-16 rounded-xl border-2 px-4 py-3 text-start text-lg font-semibold transition active:scale-[.98]',
                    step.answers[q.id] === o.id ? 'border-accent bg-accent-soft' : 'border-rule bg-sunk')}>
                  {pickAr(ui, o.en, o.ar)}
                </button>
              ))}
            </div>
            {step.i > 0 && <button type="button" className="tw-reset h-11 text-sm font-semibold text-ink-3" onClick={() => setStep({ ...step, i: step.i - 1 })}>← {L('Previous', 'السابق')}</button>}
          </section>
        );
      })()}

      {step.at === 'failed' && (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-bad bg-sheet p-4 shadow-card">
          <h2 className="font-display text-2xl font-bold text-bad">✗ {L('Machine stays locked', 'تبقى الماكينة مقفلة')}</h2>
          <p className="text-ink-2">{step.res.result.criticalMissed.length
            ? L('You missed a must-know safety question. Your trainer has been told.', 'أخطأت في سؤال سلامة أساسي. تم إبلاغ مدربك.')
            : L(`Score ${step.res.result.score}%. Review the points below, then try again.`, `الدرجة ${step.res.result.score}%. راجع النقاط أدناه ثم حاول مرة أخرى.`)}</p>
          <ul className="m-0 list-none p-0 flex flex-col gap-2">
            {step.res.result.wrong.map((w) => {
              const q = step.items.find((i) => i.id === w.id);
              return (
                <li key={w.id} className="rounded-xl bg-bad-soft p-3 text-sm">
                  <p className="font-semibold">{q ? pickAr(ui, q.prompt.en, q.prompt.ar) : w.id}</p>
                  {w.why && <p className="mt-1 text-ink-2">{pickAr(ui, w.why.en, w.why.ar)}</p>}
                </li>
              );
            })}
          </ul>
          <Big busy={busy} onClick={() => void start(step)}>{L('Try again', 'حاول مرة أخرى')}</Big>
        </section>
      )}

      {step.at === 'unlocked' && <Unlocked ui={ui} s={step} busy={busy} onRelease={async () => {
        setBusy(true);
        try { await api.release(step.lock.id); setStep({ at: 'done', info: step.info }); } catch (e) { fail(e); }
        setBusy(false);
      }} />}

      {step.at === 'done' && (
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-sheet p-6 text-center shadow-card">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-ok-soft text-3xl text-ok" aria-hidden="true">🔒</span>
          <h2 className="font-display text-2xl font-bold">{L(`${step.info.machine.tag} locked`, `تم قفل ${step.info.machine.tag}`)}</h2>
          <p className="text-ink-2">{L('Clean down the station and return the tools.', 'نظّف المحطة وأعد العدد.')}</p>
          <Big onClick={() => setStep({ at: 'scan' })}>{L('Scan another machine', 'امسح ماكينة أخرى')}</Big>
        </section>
      )}
    </div>
  );
}

function Big({ children, onClick, busy, tone = 'accent' }: { children: React.ReactNode; onClick: () => void; busy?: boolean; tone?: 'accent' | 'bad' }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={cx('tw-reset h-16 w-full rounded-xl px-5 font-display text-xl font-bold text-white transition active:scale-[.98] disabled:opacity-50',
        tone === 'bad' ? 'bg-bad' : 'bg-accent')}>
      {busy ? '…' : children}
    </button>
  );
}

function MachineCard({ ui, info, children, photoUrl, twinHref }: { ui: Ui; info: MachineInfo; children: React.ReactNode;
  photoUrl?: (id: string) => string; twinHref?: (id: string) => string }) {
  const { L } = ui;
  const m = info.machine;
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-sheet p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className={cx('grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl', info.eligible ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')} aria-hidden="true">⚙</span>
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-3">{info.machine.tag} · {pickAr(ui, info.machine.workshop, info.machine.workshopAr)}</p>
          <h2 className="font-display text-2xl font-bold leading-tight">{info.machine.name}</h2>
          <p className="text-sm text-ink-2">
            {info.machine.controller === 'hardware' ? L('Interlock: hardware relay', 'القفل: مرحّل كهربائي') : L('Interlock: trainer confirms', 'القفل: يؤكده المدرب')}
            {info.precheck && <> · {L(`${info.precheck.unlockMinutes} min session`, `جلسة ${info.precheck.unlockMinutes} دقيقة`)}</>}
          </p>
        </div>
      </div>
      {(m.brand || m.serial || m.photoId) && (
        <div className="flex items-center gap-3 rounded-xl bg-sunk p-2 text-sm">
          {m.photoId && photoUrl && <img src={photoUrl(m.photoId)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
          <div className="min-w-0">
            <p className="font-semibold">{pickAr(ui, m.typeName, m.typeNameAr)}{m.brand ? ` · ${m.brand} ${m.model ?? ''}` : ''}</p>
            {m.serial && <p className="text-ink-2">{L('Serial', 'الرقم التسلسلي')} <span className="font-mono" dir="ltr">{m.serial}</span> · {L('check it matches the nameplate', 'تأكد أنه يطابق لوحة البيانات')}</p>}
          </div>
        </div>
      )}
      {m.twin && twinHref && <a href={twinHref(m.twin.id)} className="text-sm font-semibold text-accent underline">
        {m.twin.match === 'similar' ? L('Practise first on the closest 3D twin', 'تدرّب أولًا على أقرب نموذج ثلاثي الأبعاد') : L('Practise first on its 3D twin', 'تدرّب أولًا على نموذجها ثلاثي الأبعاد')} →</a>}
      {info.passport && <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">✓ {L(`Safety passport valid until ${new Date(info.passport.validUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, `تصريح السلامة ساري حتى ${new Date(info.passport.validUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`)}</p>}
      {children}
    </section>
  );
}

function Unlocked({ ui, s, busy, onRelease }: { ui: Ui; s: Extract<Step, { at: 'unlocked' }>; busy: boolean; onRelease: () => void }) {
  const { L } = ui;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ends = s.lock.sessionEndsAt ? new Date(s.lock.sessionEndsAt).getTime() : s.lock.tokenExpiresAt ? new Date(s.lock.tokenExpiresAt).getTime() : null;
  const left = ends ? Math.max(0, Math.round((ends - now) / 1000)) : null;
  const pending = s.lock.state === 'unlock_pending';
  const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-ok bg-sheet p-4 shadow-card" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-ok text-3xl text-sheet" aria-hidden="true">🔓</span>
        <div>
          <h2 className="font-display text-2xl font-bold text-ok">{pending ? L('Passport issued', 'تم إصدار التصريح') : L(`${s.info.machine.tag} unlocked`, `تم فتح ${s.info.machine.tag}`)}</h2>
          <p className="text-sm text-ink-2">{s.reused ? L('Passport from earlier in this shift', 'تصريح من وقت سابق في هذه الوردية') : L('Pre-check passed', 'اجتزت الفحص المسبق')}</p>
        </div>
      </div>
      {pending && (s.lock.pin || s.lock.token) && (
        <div className="rounded-xl bg-navy p-4 text-center text-on-brand">
          <p className="text-sm opacity-80">{L('Enter this PIN on the machine keypad (or hold your phone to the reader)', 'أدخل هذا الرقم على لوحة الماكينة (أو قرّب هاتفك من القارئ)')}</p>
          <p className="font-mono text-5xl font-bold tracking-[.3em]" dir="ltr">{s.lock.pin ?? '······'}</p>
          {left !== null && <p className="mt-1 text-sm opacity-80">{L(`Valid for ${mmss(left)}`, `صالح لمدة ${mmss(left)}`)}</p>}
        </div>
      )}
      {!pending && left !== null && (
        <div className="text-center">
          <p className="text-sm text-ink-3">{L('Session time left', 'الوقت المتبقي للجلسة')}</p>
          <p className={cx('font-mono text-6xl font-bold', left < 300 ? 'text-bad' : 'text-ink')} dir="ltr">{mmss(left)}</p>
        </div>
      )}
      <Big tone="bad" busy={busy} onClick={onRelease}>{L('Finished · lock the machine', 'انتهيت · اقفل الماكينة')}</Big>
    </section>
  );
}

export type FrameDecoder = (frame: ImageData) => string | null;

/** Camera QR scanning with BarcodeDetector, or `decodeFrame` on browsers without it; manual code entry everywhere. */
export function Scanner({ ui, busy, onCode, demoCodes, decodeFrame, title, hint }: { ui: Ui; busy: boolean; onCode: (c: string) => void; demoCodes?: { code: string; label: string }[];
  decodeFrame?: FrameDecoder; title?: string; hint?: string }) {
  const { L } = ui;
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'off' | 'on' | 'unsupported'>('off');
  const [code, setCode] = useState('');
  useEffect(() => {
    if (camera !== 'on') return;
    let stream: MediaStream | null = null, stop = false;
    const Detector = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if ((!Detector && !decodeFrame) || !navigator.mediaDevices) { setCamera('unsupported'); return; }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const det = Detector ? new Detector({ formats: ['qr_code'] }) : {
      detect: async (v: HTMLVideoElement) => {
        if (!ctx || !v.videoWidth) return [];
        const w = Math.min(640, v.videoWidth), h = Math.round(v.videoHeight * (w / v.videoWidth));
        canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h);
        const raw = decodeFrame!(ctx.getImageData(0, 0, w, h));
        return raw ? [{ rawValue: raw }] : [];
      },
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream; await video.current.play();
        while (!stop) {
          const found = await det.detect(video.current).catch(() => []);
          const raw = found[0]?.rawValue;
          if (raw) { onCode(codeFromQr(raw)); break; }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch { setCamera('unsupported'); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera, onCode, decodeFrame]);
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-sheet p-4 shadow-card">
      <h2 className="font-display text-2xl font-bold">{title ?? L('Scan the machine', 'امسح الماكينة')}</h2>
      <p className="text-ink-2">{hint ?? L('Point your camera at the QR label on the machine to take its safety pre-check.', 'وجّه الكاميرا إلى ملصق QR على الماكينة لإجراء فحص السلامة المسبق.')}</p>
      {camera === 'on'
        ? <video ref={video} muted playsInline className="aspect-square w-full rounded-xl bg-ink object-cover" />
        : <button type="button" onClick={() => setCamera('on')} disabled={camera === 'unsupported'}
            className="tw-reset grid aspect-[4/3] w-full place-items-center rounded-xl border-2 border-dashed border-rule-strong bg-sunk text-ink-2 disabled:opacity-60">
            <span className="flex flex-col items-center gap-2"><span className="text-5xl" aria-hidden="true">⌗</span>
              <span className="font-semibold">{camera === 'unsupported' ? L('Camera scanning is not available here; type the code', 'المسح بالكاميرا غير متاح هنا؛ اكتب الرمز') : L('Tap to open the camera', 'اضغط لفتح الكاميرا')}</span></span>
          </button>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) onCode(code); }}>
        <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VTC-…" aria-label={L('Machine code', 'رمز الماكينة')}
          className="tw-reset h-14 min-w-0 flex-1 rounded-xl border-2 border-rule bg-sunk px-4 font-mono text-lg" />
        <button type="submit" disabled={busy || !code.trim()} className="tw-reset h-14 rounded-xl bg-navy px-5 font-bold text-on-brand disabled:opacity-50">{L('Go', 'تم')}</button>
      </form>
      {demoCodes && demoCodes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{L('Demo: tap a machine label', 'عرض تجريبي: اضغط على ملصق ماكينة')}</p>
          <div className="flex flex-wrap gap-2">
            {demoCodes.map((d) => <button key={d.code} type="button" disabled={busy} onClick={() => onCode(d.code)}
              className="tw-reset h-11 rounded-lg border border-rule bg-sunk px-3 font-mono text-sm">{d.label}</button>)}
          </div>
        </div>
      )}
    </section>
  );
}

/** The answer from the list saved on the device, while the server cannot be reached. */
function OfflineCard({ ui, s, onAgain, onRetry }: { ui: Ui; s: Extract<Step, { at: 'offline' }>; onAgain: () => void; onRetry: () => void }) {
  const { L } = ui;
  const ok = s.decision.state === 'allowed' && !s.expired;
  const at = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <section className={cx('flex flex-col gap-3 rounded-2xl border-2 bg-sheet p-4 shadow-card', ok ? 'border-amber-fill' : 'border-bad')} aria-live="polite">
      <p className="rounded-lg bg-amber-fill px-3 py-1.5 text-sm font-bold text-on-amber">📡 {L('Offline · not yet confirmed', 'بدون اتصال · لم يتأكد بعد')}</p>
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-ink-3">{s.machine.tag} · {pickAr(ui, s.machine.workshop, s.machine.workshopAr)}</p>
        <h2 className="font-display text-2xl font-bold leading-tight">{pickAr(ui, s.machine.typeName ?? s.machine.name, s.machine.typeNameAr)}</h2>
        {s.machine.serial && <p className="text-sm text-ink-2">{s.machine.brand} {s.machine.model} · S/N <span className="font-mono" dir="ltr">{s.machine.serial}</span></p>}
      </div>
      {ok ? (
        <div className="rounded-xl bg-ok-soft p-3 text-ok">
          <p className="font-display text-xl font-bold">✓ {L('Allowed on this machine', 'مسموح لك بهذه الماكينة')}</p>
          <p className="text-sm">{L(`Safety passport valid until ${at(s.decision.passportUntil!)}. Show this screen to your trainer before you start.`, `تصريح السلامة ساري حتى ${at(s.decision.passportUntil!)}. اعرض هذه الشاشة على مدربك قبل البدء.`)}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-display text-xl font-bold text-bad">⛔ {L('Not allowed now', 'غير مسموح الآن')}</p>
          {s.expired ? <p className="rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad">{L('The saved list is too old to trust. Connect to the centre network first.', 'القائمة المحفوظة قديمة جدًا. اتصل بشبكة المركز أولًا.')}</p>
            : s.decision.reasons.map((b) => <p key={b} className="rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad">{blockerText(ui, b)}</p>)}
        </div>
      )}
      <p className="text-xs text-ink-3">{L(`From the list saved on this device at ${at(s.packAt)}. The server checks this scan again when the device reconnects, and tells your trainer if it disagrees.`,
        `من القائمة المحفوظة على هذا الجهاز في ${at(s.packAt)}. يعيد الخادم فحص هذا المسح عند عودة الاتصال، ويبلغ مدربك إذا اختلفت النتيجة.`)}</p>
      <Big onClick={onRetry}>{L('Try the network again', 'جرّب الشبكة مرة أخرى')}</Big>
      <button type="button" className="tw-reset h-11 text-sm font-semibold text-ink-3 underline" onClick={onAgain}>{L('Scan another machine', 'امسح ماكينة أخرى')}</button>
    </section>
  );
}
