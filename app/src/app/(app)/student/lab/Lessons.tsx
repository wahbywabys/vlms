'use client';
import { useCallback, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { LessonPlayer, type LessonEvent } from '@/components/LessonPlayer';
import { LEARNING } from '@/lib/learning';
import { TelemetryStrip } from './TelemetryStrip';

/** The trade's interactive video lessons. Loaded only in the browser (WebGL). */
export default function Lessons({ trade, active }: { trade: string; active: boolean }) {
  const { lang, L, pick } = useL();
  const lessons = LEARNING[trade]?.lessons ?? [];
  const [current, setCurrent] = useState(lessons[0]?.id);
  // Players mount on first view and stay mounted, so a lesson in progress survives switching.
  const [opened, setOpened] = useState(current ? [current] : []);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [log, setLog] = useState<{ seq: number; verb: string; objectRef?: string; note?: string }[]>([]);
  const onEvent = useCallback((e: LessonEvent) => setLog((l) => [{ seq: (l[0]?.seq ?? 0) + 1, verb: e.verb, objectRef: e.objectRef,
    note: e.value && 'correct' in e.value ? (e.value.correct ? 'correct' : 'wrong') : e.value && 'score' in e.value ? `${e.value.score}%` : undefined }, ...l].slice(0, 6)), []);
  const choose = (id: string) => { setCurrent(id); setOpened((o) => (o.includes(id) ? o : [...o, id])); };
  return (
    <div className="lessons">
      <ol className="lesson-list">
        {lessons.map((ls, i) => (
          <li key={ls.id}>
            <button type="button" aria-current={ls.id === current} onClick={() => choose(ls.id)}>
              <span className="lesson-no">{i + 1}</span>
              <span className="lesson-body">
                <b>{pick(ls.title)}</b>
                <small>{Math.round(ls.duration / 60)} {L('min', 'دقيقة')} · {ls.chapters.length} {L('chapters', 'فصول')} · {ls.stops.length} {L('checkpoints', 'نقاط تحقق')} · {pick(ls.model.title).split(' · ')[0]}</small>
              </span>
              <span className={`lesson-state ${scores[ls.id] !== undefined ? 'done' : ''}`}>
                {scores[ls.id] !== undefined ? `${scores[ls.id]}%` : ls.id === current ? L('Now', 'الآن') : L('Start', 'ابدأ')}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {lessons.filter((ls) => opened.includes(ls.id)).map((ls) => (
        <div key={ls.id} hidden={ls.id !== current}>
          <LessonPlayer lesson={ls} lang={lang} active={active && ls.id === current} onEvent={onEvent}
            onComplete={(r) => setScores((m) => ({ ...m, [ls.id]: r.score }))} />
        </div>
      ))}
      <p className="lesson-note muted">{L('These lessons are rendered live on the 3D digital twin, so you can pause and look around any frame. Filmed workshop video can be dropped in later and keeps the same checkpoints, hotspots and scoring.',
        'هذه الدروس تُعرض مباشرة على التوأم الرقمي ثلاثي الأبعاد، فيمكنك الإيقاف والنظر حول أي لقطة. ويمكن لاحقًا إضافة فيديو مصوّر من الورشة مع الاحتفاظ بنفس نقاط التحقق والمعلومات والتقييم.')}</p>
      <TelemetryStrip items={log} empty={L('Start a lesson: checkpoint answers, hotspots and chapters are sent as telemetry.', 'ابدأ درسًا: إجابات نقاط التحقق والمعلومات والفصول تُرسل كأحداث قياس.')} />
    </div>
  );
}
