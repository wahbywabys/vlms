'use client';
/**
 * WABYS 3D & VR Labs: every programme's digital twins, tool board, video
 * lessons and safety simulator jobs, for every role. Pick a programme, then a
 * tab. Panes mount on first visit and stay mounted (unmounting drei's <Html>
 * pins mid-session throws), so switching back is instant.
 */
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useL } from '@/components/LangProvider';
import type { Txt } from '@/lib/i18n';
import { LEARNING_META } from '@/lib/learningMeta';

const Explore = dynamic(() => import('@/app/(app)/student/lab/Explore'), { ssr: false, loading: () => <p className="muted">Loading 3D…</p> });
const Lessons = dynamic(() => import('@/app/(app)/student/lab/Lessons'), { ssr: false, loading: () => <p className="muted">Loading lessons…</p> });
const Safety = dynamic(() => import('@/app/(app)/student/lab/Safety'), { ssr: false, loading: () => <p className="muted">Loading the safety simulator…</p> });

type Tab = '3d' | 'lessons' | 'safety';
export interface LabProgramme { id: string; code: string; name: Txt }

export function LabsBrowser({ programmes, initial, eyebrow }: { programmes: LabProgramme[]; initial: string; eyebrow: Txt }) {
  const { L, pick } = useL();
  const [trade, setTrade] = useState(programmes.some((p) => p.id === initial) ? initial : programmes[0]!.id);
  const [tab, setTab] = useState<Tab>('3d');
  const [seen, setSeen] = useState<string[]>([`${trade}:3d`]);
  const show = (t: string, k: Tab) => { setTrade(t); setTab(k); setSeen((s) => (s.includes(`${t}:${k}`) ? s : [...s, `${t}:${k}`])); };
  const meta = LEARNING_META[trade]!;
  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: '3d', label: L('3D & VR', 'ثلاثي الأبعاد والواقع الافتراضي'), n: meta.models },
    ...(meta.lessons ? [{ id: 'lessons' as const, label: L('Video lessons', 'دروس الفيديو'), n: meta.lessons }] : []),
    { id: 'safety', label: L('Safety simulator', 'محاكي السلامة'), n: meta.safety },
  ];
  const cur = tabs.some((x) => x.id === tab) ? tab : '3d';
  return (
    <div className="lab labs-browser" style={{ ['--trade-accent' as string]: meta.accent }}>
      <div className="lab-head">
        <div>
          <p className="eyebrow">{pick(eyebrow)}</p>
          <h1>{L('WABYS 3D & VR Labs', 'معامل وابيز ثلاثية الأبعاد والواقع الافتراضي')}</h1>
          <p className="muted">{L(`${programmes.length} programmes: machines, tool boards and safety jobs. Choose a programme.`, `${programmes.length} تخصصًا: الماكينات ولوحات العدد ومهام السلامة. اختر التخصص.`)}</p>
        </div>
        <div className="tabs lab-tabs" role="tablist" aria-label={L('Lab activity', 'نشاط المعمل')}>
          {tabs.map((x, i) => (
            <button key={x.id} type="button" role="tab" aria-selected={cur === x.id} onClick={() => show(trade, x.id)}>
              {i + 1} · {x.label}<span className="tab-n">{x.n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="labs-programmes" role="radiogroup" aria-label={L('Programme', 'التخصص')}>
        {programmes.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === trade} onClick={() => show(p.id, cur)}
            style={{ ['--p-accent' as string]: LEARNING_META[p.id]?.accent }}>
            <b>{p.code}</b><span>{pick(p.name)}</span>
          </button>
        ))}
      </div>
      {programmes.map((p) => (
        <div key={p.id} hidden={p.id !== trade}>
          {seen.includes(`${p.id}:3d`) && <div hidden={cur !== '3d'}><Explore trade={p.id} active={p.id === trade && cur === '3d'} /></div>}
          {seen.includes(`${p.id}:lessons`) && <div hidden={cur !== 'lessons'}><Lessons trade={p.id} active={p.id === trade && cur === 'lessons'} /></div>}
          {seen.includes(`${p.id}:safety`) && <div hidden={cur !== 'safety'}><Safety trade={p.id} active={p.id === trade && cur === 'safety'} /></div>}
        </div>
      ))}
    </div>
  );
}
