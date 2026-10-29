'use client';
import { useActionState, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { addEntry, checkIn } from './actions';

const ERR: Record<string, [string, string]> = {
  date: ['Pick a work date that is not in the future.', 'اختر تاريخ عمل ليس في المستقبل.'],
  hours: ['Hours must be between 0.5 and 16.', 'يجب أن تكون الساعات بين 0.5 و16.'],
  summary: ['Describe what you did in at least 15 characters.', 'صف ما قمت به في 15 حرفًا على الأقل.'],
  no_placement: ['You are not on a placement yet.', 'لست في تدريب ميداني بعد.'],
};

export function CheckIn() {
  const { L } = useL();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const report = (r: Awaited<ReturnType<typeof checkIn>>) => {
    setBusy(false);
    if ('error' in r) { setMsg({ ok: false, text: L('You are not on a placement yet.', 'لست في تدريب ميداني بعد.') }); return; }
    setMsg(r.inside ? { ok: true, text: L(`Checked in on site · ${r.distance} m from the site centre`, `تم تسجيل الحضور في الموقع · ${r.distance} م من مركز الموقع`) }
      : { ok: false, text: L(`Recorded, but outside the site geofence (${r.distance} m away). Your supervisor will see this.`, `سُجّل، لكن خارج نطاق الموقع (${r.distance} م). سيرى مشرفك ذلك.`) });
  };
  const real = () => {
    if (!navigator.geolocation) { setMsg({ ok: false, text: L('This device has no GPS.', 'هذا الجهاز لا يدعم GPS.') }); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => void checkIn({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }).then(report),
      () => { setBusy(false); setMsg({ ok: false, text: L('Location permission was refused.', 'تم رفض إذن الموقع.') }); },
      { enableHighAccuracy: true, timeout: 10000 });
  };
  return (
    <div className="form">
      <div className="form-actions">
        <button type="button" className="primary" onClick={real} disabled={busy}>{L('Check in with GPS', 'سجّل الحضور عبر GPS')}</button>
        <button type="button" onClick={() => { setBusy(true); void checkIn({ latitude: 0, longitude: 0, accuracy: null, demo: true }).then(report); }} disabled={busy}>
          {L('Demo: check in from the site', 'تجربة: سجّل الحضور من الموقع')}</button>
      </div>
      {msg && <p className={`notice ${msg.ok ? 'notice-info' : 'notice-block'}`} role="status">{msg.text}</p>}
    </div>
  );
}

export function NewEntry({ competencies }: { competencies: { id: string; code: string; title: string; title_ar: string | null }[] }) {
  const { L, ar } = useL();
  const [state, action, pending] = useActionState(addEntry, null);
  const err = state?.error ? ERR[state.error] : null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="form" key={state?.ok ? Date.now() : 'f'}>
      <input type="hidden" name="mutation" value={typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : ''} />
      <div className="form-row">
        <label className="field"><span>{L('Work date', 'تاريخ العمل')}</span><input type="date" name="work_date" defaultValue={today} max={today} dir="ltr" /></label>
        <label className="field"><span>{L('Hours', 'الساعات')}</span><input type="number" name="hours" step="0.5" min="0.5" max="16" defaultValue="7" dir="ltr" /></label>
      </div>
      <label className="field"><span>{L('What did you do?', 'ماذا فعلت؟')}</span><textarea name="summary" rows={3} dir="auto" /></label>
      <fieldset className="options"><legend className="eyebrow">{L('Competencies practised', 'الجدارات التي مارستها')}</legend>
        {competencies.map((c) => (
          <label key={c.id} className="q-opt"><input type="checkbox" name="competency" value={c.id} /> <span className="mono small">{c.code}</span> {ar(c.title, c.title_ar)}</label>
        ))}
      </fieldset>
      {err && <p className="notice notice-danger" role="alert">{L(err[0], err[1])}</p>}
      {state?.ok && <p className="notice notice-info" role="status">{L('Entry sent to your supervisor for sign-off.', 'أُرسل السجل إلى مشرفك للاعتماد.')}</p>}
      <div className="form-actions"><button type="submit" className="primary" disabled={pending}>{L('Submit for sign-off', 'أرسل للاعتماد')}</button></div>
    </form>
  );
}
