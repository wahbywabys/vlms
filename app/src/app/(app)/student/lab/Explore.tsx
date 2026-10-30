'use client';
import { useCallback, useRef, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { MachineExplorer, type ExplorerEvent } from '@/components/MachineExplorer';
import { FullscreenIcon, useFullscreen } from '@/components/fullscreen';
import { LEARNING } from '@/lib/learning';
import { modelParts } from '@/models/kit';
import { TelemetryStrip } from './TelemetryStrip';

/** The trade's 3D digital twins, with a machine switcher and VR. Loaded only in the browser (WebGL). */
export default function Explore({ trade, active }: { trade: string; active: boolean }) {
  const { lang, L, pick } = useL();
  const models = LEARNING[trade]?.models ?? [];
  const [log, setLog] = useState<(ExplorerEvent & { seq: number })[]>([]);
  const onEvent = useCallback((e: ExplorerEvent) => setLog((l) => [{ ...e, seq: (l[0]?.seq ?? 0) + 1 }, ...l].slice(0, 5)), []);
  const [modelId, setModelId] = useState(models[0]?.id);
  // Each machine mounts on first view and then stays mounted (drei's <Html> pins throw if unmounted mid-session).
  const [opened, setOpened] = useState(modelId ? [modelId] : []);
  const choose = (id: string) => { setModelId(id); setOpened((o) => (o.includes(id) ? o : [...o, id])); onEvent({ verb: 'part_selected', objectRef: `model:${id}` }); };
  const stageRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stageRef);
  return (
    <div className="explore">
      {models.length > 1 && (
        <div className="model-switch" role="radiogroup" aria-label={L('Choose a machine', 'اختر الماكينة')}>
          {models.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={m.id === modelId} onClick={() => choose(m.id)}>
              <b>{pick(m.title).split(' · ')[0]}</b><small>{m.assetTag}</small>
            </button>
          ))}
        </div>
      )}
      <div ref={stageRef} className={`explore-stage ${fs.isFull ? 'is-full' : ''} ${fs.isFallback ? 'is-max' : ''}`}>
        <button type="button" className="fs-btn fs-float" aria-pressed={fs.isFull} onClick={() => void fs.toggle()}
          title={fs.isFull ? L('Exit full screen (Esc)', 'الخروج من ملء الشاشة (Esc)') : L('Full-screen 3D view', 'عرض ثلاثي الأبعاد بملء الشاشة')}>
          <FullscreenIcon exit={fs.isFull} />
          <span className="fs-text">{fs.isFull ? L('Exit', 'خروج') : L('Full screen', 'ملء الشاشة')}</span>
        </button>
        {models.filter((m) => opened.includes(m.id)).map((m) => (
          <div key={m.id} hidden={m.id !== modelId} className="explore-model">
            <MachineExplorer title={pick(m.title)} assetTag={m.assetTag} parts={modelParts(m, lang)} view={m.view}
              params={m.params} runParams={m.runParams} active={active && m.id === modelId}
              env={m.env && { ...m.env, bay: trade as 'cnc' }} lang={lang} onEvent={onEvent} height="min(660px, 76vh)" />
          </div>
        ))}
      </div>
      <div className="explore-foot">
        <section className="vr-card">
          <strong>{L('Virtual reality', 'الواقع الافتراضي')}</strong>
          <ul>
            <li><b>{L('Headset', 'نظارة VR')}</b> {L('Meta Quest, Pico or a PC headset: open this page in the headset browser and press Enter VR. The machine stands on the floor in front of you.', 'Meta Quest أو Pico أو نظارة حاسوب: افتح الصفحة في متصفح النظارة واضغط «دخول الواقع الافتراضي»، فتظهر الماكينة على الأرض أمامك.')}</li>
            <li><b>{L('Phone', 'الهاتف')}</b> {L('Without a headset, Enter VR shows a side-by-side stereo view for a Cardboard-style viewer.', 'دون نظارة يعرض الزر عرضًا مجسمًا مزدوجًا لنظارة من نوع Cardboard.')}</li>
          </ul>
        </section>
        <TelemetryStrip items={log.map((e) => ({ seq: e.seq, verb: e.verb, objectRef: e.objectRef }))}
          empty={L('Drag the explode slider, tap a numbered pin or switch view mode to see the events this sends.',
            'حرّك شريط التفكيك أو اضغط دبوسًا مرقّمًا أو غيّر وضع العرض لترى الأحداث المرسلة.')} />
      </div>
    </div>
  );
}
