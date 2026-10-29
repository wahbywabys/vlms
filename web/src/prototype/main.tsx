import { StrictMode, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { DirectorDashboard } from './DirectorDashboard';
import { FullscreenIcon, useFullscreen } from './fullscreen';
import { tx } from './i18n';
import { LogoMark, Wordmark } from './Logo';
import { StoreProvider, useL, useStore, type Role } from './store';
import { TradeBar } from './TradeBar';
import type { Trade } from './trades';
import { StudentLab } from './StudentLab';
import { TrainerFloor } from './TrainerFloor';
import wabysLogoDark from './assets/wabys-logo-dark.png';
import wabysLogo from './assets/wabys-logo.png';
import './prototype.css';

/** The trainer and student follow the active trade; the director oversees all of them. */
const roles = (t: Trade) => [
  { id: 'trainer' as Role, initials: t.bay.trainerInitials, label: tx('Trainer', 'المدرب'), who: t.bay.trainer, device: tx('Tablet', 'جهاز لوحي') },
  { id: 'student' as Role, initials: t.learner.initials, label: tx('Student', 'الطالب'), who: t.learner.name, device: tx('Laptop', 'حاسوب محمول') },
  { id: 'director' as Role, initials: tx('SR', 'س'), label: tx('Director', 'المدير'), who: tx('Dr. Samia Rashad', 'د. سامية رشاد'), device: tx('Desktop', 'حاسوب مكتبي') },
];

function Shell() {
  const { role, setRole, alerts, lang, setLang, trade } = useStore();
  const { L, pick } = useL();
  const open = alerts.filter((a) => !a.resolution && a.trade === trade.id).length;
  const ROLES = roles(trade);
  const appRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(appRef);
  return (
    <div ref={appRef} className={`app ${fs.isFull ? 'is-full' : ''} ${fs.isFallback ? 'is-max' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="org" role="img" aria-label={L('WABYS for Training and Education', 'وابيز للتدريب والتعليم')}>
              <img className="org-logo org-light" src={wabysLogo} alt="" width={143} height={44} />
              <img className="org-logo org-dark" src={wabysLogoDark} alt="" width={143} height={44} />
            </span>
            <span className="brand-divider" aria-hidden="true" />
            <LogoMark />
            <div className="brand-text">
              <Wordmark />
              <span className="brand-sub">{L('Vocational Training Centre · ATS Cairo East', 'مركز التدريب المهني · مدرسة شرق القاهرة التطبيقية')}</span>
            </div>
          </div>

          <nav className="roles" aria-label={L('View as', 'العرض بصفة')}>
            {ROLES.map((r) => (
              <button key={r.id} type="button" aria-pressed={role === r.id} onClick={() => setRole(r.id)}
                title={`${pick(r.who)} · ${pick(r.device)}`}>
                <span className={`avatar av-${r.id}`} aria-hidden="true">{pick(r.initials)}</span>
                <span className="role-text">
                  <span className="role-label">{pick(r.label)}</span>
                  <span className="role-who">{pick(r.who)}</span>
                </span>
                {r.id === 'trainer' && open > 0 && <span className="badge" aria-label={L(`${open} open alerts`, `${open} تنبيهات مفتوحة`)}>{open}</span>}
              </button>
            ))}
          </nav>

          <div className="tools">
            <span className="chip sample" title={L('Every name and number in this prototype is illustrative', 'كل الأسماء والأرقام في هذا النموذج توضيحية')}>
              {L('Sample data', 'بيانات تجريبية')}
            </span>
            <div className="lang" role="radiogroup" aria-label="Language · اللغة">
              <button type="button" role="radio" aria-checked={lang === 'en'} lang="en" onClick={() => setLang('en')}>EN</button>
              <button type="button" role="radio" aria-checked={lang === 'ar'} lang="ar" onClick={() => setLang('ar')}>عربي</button>
            </div>
            <button type="button" className="fs-btn" aria-pressed={fs.isFull} onClick={() => void fs.toggle()}
              title={fs.isFull ? L('Exit full screen (Esc)', 'الخروج من ملء الشاشة (Esc)') : L('Full screen', 'ملء الشاشة')}>
              <FullscreenIcon exit={fs.isFull} />
              <span className="fs-text">{fs.isFull ? L('Exit full screen', 'خروج من ملء الشاشة') : L('Full screen', 'ملء الشاشة')}</span>
            </button>
          </div>
        </div>
      </header>
      <TradeBar />
      <main className="screen">
        {/* All three stay mounted so a half-finished V-Lab attempt or rubric survives a role switch. */}
        <div hidden={role !== 'trainer'}><TrainerFloor /></div>
        <div hidden={role !== 'student'}><StudentLab /></div>
        <div hidden={role !== 'director'}><DirectorDashboard /></div>
      </main>
      <footer className="app-foot">
        <img className="org-logo org-light" src={wabysLogo} alt="" width={78} height={24} />
        <img className="org-logo org-dark" src={wabysLogoDark} alt="" width={78} height={24} />
        <span>{L('VTC_LMS is a product of WABYS for Training and Education.', 'VTC_LMS منتج من وابيز للتدريب والتعليم.')}</span>
        <span className="muted">{L('Prototype · sample data only', 'نموذج أولي · بيانات تجريبية فقط')}</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><StoreProvider><Shell /></StoreProvider></StrictMode>,
);
