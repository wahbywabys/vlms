'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { SafetySim, type SimEvent } from '@/components/SafetySim';
import { FullscreenIcon, useFullscreen } from '@/components/fullscreen';
import { LEARNING } from '@/lib/learning';
import { TelemetryStrip } from './TelemetryStrip';

/** The trade's safety simulator jobs: learn the rules by trial and error at the machine. Loaded only in the browser (WebGL). */
export default function Safety({ trade, active }: { trade: string; active: boolean }) {
  const { lang, L, pick } = useL();
  const jobs = LEARNING[trade]?.safety ?? [];
  const [log, setLog] = useState<(SimEvent & { seq: number })[]>([]);
  const onEvent = useCallback((e: SimEvent) => setLog((l) => [{ ...e, seq: (l[0]?.seq ?? 0) + 1 }, ...l].slice(0, 6)), []);
  const [id, setId] = useState(jobs[0]?.id);
  const sc = jobs.find((s) => s.id === id) ?? jobs[0];
  // The machine stands in this trade's bay; keep the object stable so the scene does not rebuild.
  const scenario = useMemo(() => sc && { ...sc, model: { ...sc.model, env: sc.model.env && { ...sc.model.env, bay: trade as 'cnc' } } }, [sc, trade]);
  const stageRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stageRef);
  if (!scenario) return <p className="muted">{L('No safety simulator for this trade yet.', 'لا يوجد محاكي سلامة لهذه المهنة بعد.')}</p>;
  return (
    <div className="explore">
      {jobs.length > 1 && (
        <div className="model-switch" role="radiogroup" aria-label={L('Choose a job', 'اختر المهمة')}>
          {jobs.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === scenario.id} onClick={() => setId(s.id)}>
              <b>{pick(s.title)}</b><small>{pick(s.model.title).split(' · ')[0]}</small>
            </button>
          ))}
        </div>
      )}
      <div ref={stageRef} className={`explore-stage ${fs.isFull ? 'is-full' : ''} ${fs.isFallback ? 'is-max' : ''}`}>
        <button type="button" className="fs-btn fs-float" aria-pressed={fs.isFull} onClick={() => void fs.toggle()}
          title={fs.isFull ? L('Exit full screen (Esc)', 'الخروج من ملء الشاشة (Esc)') : L('Full screen', 'ملء الشاشة')}>
          <FullscreenIcon exit={fs.isFull} />
        </button>
        <SafetySim key={`${scenario.id}:${lang}`} scenario={scenario} lang={lang} active={active} onEvent={onEvent}
          height={fs.isFull ? '100vh' : 'min(700px, 80vh)'} />
      </div>
      <div className="explore-foot">
        <section className="vr-card">
          <strong>{L('How it works', 'كيف يعمل')}</strong>
          <ul>
            <li><b>{L('PPE', 'الوقاية')}</b> {L('Pick what to wear and what to take off. Wrong or missing PPE shows up when the job needs it.', 'اختر ما ترتديه وما تخلعه. الوقاية الخاطئة أو الناقصة تظهر عندما تحتاجها المهمة.')}</li>
            <li><b>{L('Order', 'الترتيب')}</b> {L('Steps are shuffled. Choose them in the order you think is safe; the student walks to the machine and does it.', 'الخطوات مخلوطة. اخترها بالترتيب الذي تراه آمنًا؛ يمشي المتدرب إلى الماكينة وينفّذها.')}</li>
            <li><b>{L('Score', 'الدرجة')}</b> {L('Each incident costs points by severity. Three stars means no incident and the right PPE.', 'كل حادث يخصم نقاطًا حسب خطورته. ثلاث نجوم تعني بلا حوادث وبالوقاية الصحيحة.')}</li>
          </ul>
        </section>
        <TelemetryStrip items={log.map((e) => ({ seq: e.seq, verb: e.verb, objectRef: e.objectRef }))}
          empty={L('Start the job to see the events this sends to your record.', 'ابدأ المهمة لترى الأحداث المرسلة إلى سجلك.')} />
      </div>
    </div>
  );
}
