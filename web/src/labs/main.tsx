/**
 * WABYS 3D & VR labs: every programme's digital twins, tool board and safety
 * simulator jobs on one page, with no server. Mirrors app/src/lib/learning.ts.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MachineExplorer } from '../components/MachineExplorer';
import { SafetySim } from '../components/SafetySim';
import { benchGrinder } from '../models/benchGrinder';
import { carEngine } from '../models/carEngine';
import { cncLathe } from '../models/cncLathe';
import { cncMill } from '../models/cncMill';
import { electronicsBench } from '../models/electronicsBench';
import { modelParts, tx, type ModelDef, type Txt } from '../models/kit';
import { laserMfp } from '../models/laserMfp';
import { lockstitch } from '../models/lockstitch';
import { migWelder } from '../models/migWelder';
import { motorRewind } from '../models/motorRewind';
import { networkRack } from '../models/networkRack';
import { offsetPress } from '../models/offsetPress';
import { pumpRig } from '../models/pumpRig';
import { splitAc } from '../models/splitAc';
import { starterPanel } from '../models/starterPanel';
import { TOOL_BOARDS } from '../models/toolBoard';
import { tvBench } from '../models/tvBench';
import { visionCell } from '../models/visionCell';
import { washingMachine } from '../models/washingMachine';
import { motorModel } from '../prototype/motorAr';
import { FullscreenIcon, useFullscreen } from '../prototype/fullscreen';
import { SAFETY_SCENARIOS } from '../safety';
import './labs.css';

type Lang = 'en' | 'ar';
interface Prog { id: string; code: string; name: Txt; accent: string; models: ModelDef[] }

const P = (id: string, code: string, en: string, ar: string, accent: string, models: ModelDef[]): Prog =>
  ({ id, code, name: tx(en, ar), accent, models: [...models, TOOL_BOARDS[id]!] });

const PROGRAMMES: Prog[] = [
  P('cnc', 'CNC', 'CNC Machining & Turning', 'التشغيل بالتحكم الرقمي والخراطة', '#2f8fd8', [cncLathe, cncMill, benchGrinder, motorModel]),
  P('auto', 'AUT', 'Automotive Maintenance & Repair', 'صيانة وإصلاح السيارات', '#d9463b', [carEngine]),
  P('elec', 'ELI', 'Electrical Installations', 'التركيبات الكهربائية', '#e8a70a', [starterPanel, motorModel]),
  P('weld', 'WLD', 'Welding & Fabrication', 'اللحام والتشكيل', '#f06721', [migWelder, benchGrinder]),
  P('rmg', 'RMG', 'Ready-Made Garments', 'الملابس الجاهزة', '#c2417a', [lockstitch]),
  P('eim', 'EIM', 'Equipment Installation & Maintenance', 'تركيب وصيانة المعدات', '#3a9d5d', [pumpRig, motorModel]),
  P('prt', 'PRT', 'Printing Technologies', 'تكنولوجيا الطباعة', '#7a4fd1', [offsetPress]),
  P('ait', 'AIT', 'AI for Technicians', 'الذكاء الاصطناعي للفنيين', '#0f9fb0', [visionCell]),
  P('iel', 'IEL', 'Industrial Electronics', 'الإلكترونيات الصناعية', '#f08c00', [electronicsBench]),
  P('csn', 'CSN', 'Computer Systems & Networks', 'نظم وشبكات الحاسب', '#1098ad', [networkRack]),
  P('rac', 'RAC', 'Refrigeration & Air-Conditioning', 'التبريد وتكييف الهواء', '#4dabf7', [splitAc]),
  P('ham', 'HAM', 'Home Appliances Maintenance', 'صيانة الأجهزة المنزلية', '#e64980', [washingMachine]),
  P('oeq', 'OEQ', 'Office Equipment Maintenance', 'صيانة المعدات المكتبية', '#5c7cfa', [laserMfp]),
  P('ave', 'AVE', 'Audio-Visual & Consumer Electronics', 'الأجهزة السمعية والبصرية', '#ae3ec9', [tvBench, electronicsBench]),
  P('iem', 'IEM', 'Industrial Electricity & Electrical Machines', 'الكهرباء الصناعية والآلات الكهربائية', '#fab005', [motorRewind, starterPanel, motorModel]),
];

function App() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language.startsWith('ar') ? 'ar' : 'en'));
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [progId, setProgId] = useState('rac');
  const [tab, setTab] = useState<'3d' | 'safety'>('3d');
  const prog = PROGRAMMES.find((p) => p.id === progId)!;
  const jobs = SAFETY_SCENARIOS[prog.id] ?? [];
  const [modelId, setModelId] = useState(prog.models[0]!.id);
  const [jobId, setJobId] = useState(jobs[0]?.id);
  useEffect(() => { setModelId(prog.models[0]!.id); setJobId(jobs[0]?.id); }, [prog]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
  const model = prog.models.find((m) => m.id === modelId) ?? prog.models[0]!;
  const job = jobs.find((j) => j.id === jobId) ?? jobs[0];
  const scenario = useMemo(() => job && { ...job, model: { ...job.model, env: job.model.env && { ...job.model.env, bay: prog.id as 'cnc' } } }, [job, prog.id]);
  const stageRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stageRef);

  return (
    <div className="labs" style={{ ['--accent' as string]: prog.accent }}>
      <header className="labs-top">
        <div>
          <p className="labs-eyebrow">WABYS · VTC_LMS</p>
          <h1>{L('3D & VR labs', 'معامل ثلاثية الأبعاد والواقع الافتراضي')}</h1>
        </div>
        <div className="labs-lang" role="group" aria-label="Language">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          <button type="button" aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>عربي</button>
        </div>
      </header>

      <label className="labs-pick">
        <span>{L('Programme', 'التخصص')}</span>
        <select value={progId} onChange={(e) => setProgId(e.target.value)}>
          {PROGRAMMES.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name[lang]}</option>)}
        </select>
      </label>

      <div className="labs-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === '3d'} onClick={() => setTab('3d')}>{L('3D & VR', 'ثلاثي الأبعاد والواقع الافتراضي')} <em>{prog.models.length}</em></button>
        <button type="button" role="tab" aria-selected={tab === 'safety'} onClick={() => setTab('safety')} disabled={!jobs.length}>{L('Safety simulator', 'محاكي السلامة')} <em>{jobs.length}</em></button>
      </div>

      <div className="labs-switch" role="radiogroup">
        {tab === '3d'
          ? prog.models.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={m.id === model.id} onClick={() => setModelId(m.id)}>
              <b>{m.title[lang]}</b><small>{m.assetTag}</small>
            </button>))
          : jobs.map((j) => (
            <button key={j.id} type="button" role="radio" aria-checked={j.id === job?.id} onClick={() => setJobId(j.id)}>
              <b>{j.title[lang]}</b><small>{j.model.title[lang]}</small>
            </button>))}
      </div>

      <div ref={stageRef} className={`labs-stage ${fs.isFull ? 'is-full' : ''} ${fs.isFallback ? 'is-max' : ''}`}>
        <button type="button" className="labs-fs" aria-pressed={fs.isFull} onClick={() => void fs.toggle()} title={L('Full screen', 'ملء الشاشة')}>
          <FullscreenIcon exit={fs.isFull} />
        </button>
        {tab === '3d' && (
          <MachineExplorer key={`${model.id}:${lang}`} title={model.title[lang]} assetTag={model.assetTag} parts={modelParts(model, lang)}
            view={model.view} params={model.params} runParams={model.runParams} active
            env={model.env && { ...model.env, bay: prog.id as 'cnc' }} lang={lang} height={fs.isFull ? '100vh' : 'min(680px, 78vh)'} />
        )}
        {tab === 'safety' && scenario && (
          <SafetySim key={`${scenario.id}:${lang}`} scenario={scenario} lang={lang} active height={fs.isFull ? '100vh' : 'min(720px, 82vh)'} />
        )}
      </div>

      <section className="labs-help">
        <h2>{L('How to use it', 'طريقة الاستخدام')}</h2>
        <ul>
          <li>{L('Drag to turn the machine, pinch or scroll to zoom. Tap any part, label or numbered pin for what it is, what it does and its safety note.', 'اسحب لتدوير الماكينة، وقرّب بإصبعين أو بعجلة الفأرة. اضغط على أي جزء أو رقم لتعرف ما هو وماذا يفعل وتعليمات السلامة.')}</li>
          <li>{L('The tool board holds the trade\'s hand tools and instruments: tap each one to learn it.', 'لوحة العدد فيها العدد اليدوية وأجهزة القياس للتخصص: اضغط على كل أداة لتتعلمها.')}</li>
          <li>{L('VR: tap "Enter VR". On a headset the machine stands in front of you at real size. On a phone, turn it sideways, put it in a Cardboard viewer and turn your head (motion needs the page opened over https).', 'الواقع الافتراضي: اضغط «دخول الواقع الافتراضي». في النظارة تقف الماكينة أمامك بحجمها الحقيقي. على الهاتف أدره أفقيًا وضعه في نظارة Cardboard وحرّك رأسك (تتبع الحركة يحتاج فتح الصفحة عبر https).')}</li>
          <li>{L('Safety simulator: choose your PPE, then pick the steps in the order you think is safe. A wrong step shows what happens in a real workshop.', 'محاكي السلامة: اختر معدات الوقاية ثم اختر الخطوات بالترتيب الآمن. الخطوة الخاطئة تُظهر ما يحدث في الورشة الحقيقية.')}</li>
        </ul>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
