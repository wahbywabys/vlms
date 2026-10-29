'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useL } from '@/components/LangProvider';
import { FAULTS } from '@/lib/dol';

export function StartExam({ learners }: { learners: { id: string; name: string; nameAr: string | null }[] }) {
  const { L, pick, ar } = useL();
  const router = useRouter();
  const [learnerId, setLearner] = useState('');
  const [fault, setFault] = useState(FAULTS[0]!.code);
  const [minutes, setMinutes] = useState(30);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch('/api/v1/vlab/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ labCode: 'VLAB-DOL-STARTER', mode: 'assessment', learnerId, faultCode: fault, timeLimitS: minutes * 60 }),
    });
    setBusy(false);
    const who = learners.find((x) => x.id === learnerId);
    setMsg(r.ok ? { ok: true, text: L(`Exam started for ${who?.name}. It is waiting in their V-Lab.`, `بدأ الامتحان لـ ${ar(who?.name, who?.nameAr)}. وهو بانتظاره في المعمل الافتراضي.`) }
      : { ok: false, text: L('Could not start the exam.', 'تعذّر بدء الامتحان.') });
    if (r.ok) router.refresh();
  };
  return (
    <div className="exam-form">
      <label className="field"><span>{L('Learner', 'المتدرب')}</span>
        <select value={learnerId} onChange={(e) => setLearner(e.target.value)}>
          <option value="">{L('Choose…', 'اختر…')}</option>
          {learners.map((l) => <option key={l.id} value={l.id}>{ar(l.name, l.nameAr)}</option>)}
        </select></label>
      <label className="field"><span>{L('Fault to inject', 'العطل المزروع')}</span>
        <select value={fault} onChange={(e) => setFault(e.target.value)}>
          {FAULTS.map((f) => <option key={f.code} value={f.code}>{f.code} · {pick(f.title)}</option>)}
        </select></label>
      <label className="field"><span>{L('Time limit (minutes)', 'الزمن المسموح (دقيقة)')}</span>
        <input type="number" min={5} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} dir="ltr" /></label>
      <button type="button" className="primary" disabled={!learnerId || busy} onClick={() => void start()}>{L('Start exam', 'ابدأ الامتحان')}</button>
      {msg && <p className={`notice ${msg.ok ? 'notice-info' : 'notice-danger'}`} role="status">{msg.text}</p>}
    </div>
  );
}
