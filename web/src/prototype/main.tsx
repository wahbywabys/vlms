import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DirectorDashboard } from './DirectorDashboard';
import { tx } from './i18n';
import { LogoMark, Wordmark } from './Logo';
import { StoreProvider, useL, useStore, type Role } from './store';
import { StudentLab } from './StudentLab';
import { TrainerFloor } from './TrainerFloor';
import './prototype.css';

const ROLES = [
  { id: 'trainer' as Role, initials: tx('HK', 'ه'), label: tx('Trainer', 'المدرب'), who: tx('Eng. Huda Kamal', 'م. هدى كمال'), device: tx('Tablet', 'جهاز لوحي') },
  { id: 'student' as Role, initials: tx('OL', 'ع'), label: tx('Student', 'الطالب'), who: tx('Omar Lotfy', 'عمر لطفي'), device: tx('Laptop', 'حاسوب محمول') },
  { id: 'director' as Role, initials: tx('SR', 'س'), label: tx('Director', 'المدير'), who: tx('Dr. Samia Rashad', 'د. سامية رشاد'), device: tx('Desktop', 'حاسوب مكتبي') },
];

function Shell() {
  const { role, setRole, alerts, lang, setLang } = useStore();
  const { L, pick } = useL();
  const open = alerts.filter((a) => !a.resolution).length;
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
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
          </div>
        </div>
      </header>
      <main className="screen">
        {/* All three stay mounted so a half-finished V-Lab attempt or rubric survives a role switch. */}
        <div hidden={role !== 'trainer'}><TrainerFloor /></div>
        <div hidden={role !== 'student'}><StudentLab /></div>
        <div hidden={role !== 'director'}><DirectorDashboard /></div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><StoreProvider><Shell /></StoreProvider></StrictMode>,
);
