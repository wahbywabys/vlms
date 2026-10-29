'use client';
import { useCallback, useRef, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { MachineExplorer, type ExplorerEvent } from '@/components/MachineExplorer';
import { FullscreenIcon, useFullscreen } from '@/components/fullscreen';
import { inductionMotorParts } from '@/models/inductionMotor';
import { explorerStringsAr, inductionMotorPartsAr } from '@/models/motorAr';
import { TelemetryStrip } from './TelemetryStrip';

/** 3D explorer of the motor the starter drives. Loaded only in the browser (WebGL). */
export default function Explore() {
  const { lang, L } = useL();
  const [log, setLog] = useState<(ExplorerEvent & { seq: number })[]>([]);
  const onEvent = useCallback((e: ExplorerEvent) => setLog((l) => [{ ...e, seq: (l[0]?.seq ?? 0) + 1 }, ...l].slice(0, 5)), []);
  const stageRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stageRef);
  return (
    <div className="explore">
      <div ref={stageRef} className={`explore-stage ${fs.isFull ? 'is-full' : ''} ${fs.isFallback ? 'is-max' : ''}`}>
        <button type="button" className="fs-btn fs-float" aria-pressed={fs.isFull} onClick={() => void fs.toggle()}
          title={fs.isFull ? L('Exit full screen (Esc)', 'الخروج من ملء الشاشة (Esc)') : L('Full-screen 3D view', 'عرض ثلاثي الأبعاد بملء الشاشة')}>
          <FullscreenIcon exit={fs.isFull} />
          <span className="fs-text">{fs.isFull ? L('Exit', 'خروج') : L('Full screen', 'ملء الشاشة')}</span>
        </button>
        <MachineExplorer title={L('3-Phase Induction Motor · IEC 132M', 'محرك حثي ثلاثي الأطوار · IEC 132M')} assetTag="WS-ELEC-07 / MTR-0132"
          parts={lang === 'ar' ? inductionMotorPartsAr : inductionMotorParts} strings={lang === 'ar' ? explorerStringsAr : undefined}
          onEvent={onEvent} height="min(620px, 72vh)" />
      </div>
      <TelemetryStrip items={log.map((e) => ({ seq: e.seq, verb: e.verb, objectRef: e.objectRef }))}
        empty={L('Drag the explode slider, tap a numbered pin or switch view mode to see the events this sends.',
          'حرّك شريط التفكيك أو اضغط دبوسًا مرقّمًا أو غيّر وضع العرض لترى الأحداث المرسلة.')} />
    </div>
  );
}
