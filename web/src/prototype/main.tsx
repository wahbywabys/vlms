import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DirectorDashboard } from './DirectorDashboard';
import { tx } from './i18n';
import { StoreProvider, useL, useStore, type Role } from './store';
import { StudentLab } from './StudentLab';
import { TrainerFloor } from './TrainerFloor';
import './prototype.css';

const ROLES = [
  { id: 'trainer' as Role, label: tx('Trainer', 'المدرب'), who: tx('Eng. Huda Kamal · tablet', 'م. هدى كمال · جهاز لوحي') },
  { id: 'student' as Role, label: tx('Student', 'الطالب'), who: tx('Omar Lotfy · laptop', 'عمر لطفي · حاسوب محمول') },
  { id: 'director' as Role, label: tx('Director', 'المدير'), who: tx('Dr. Samia Rashad · desktop', 'د. سامية رشاد · حاسوب مكتبي') },
];

function Shell() {
  const { role, setRole, alerts, lang, setLang } = useStore();
  const { L, pick } = useL();
  const open = alerts.filter((a) => !a.resolution).length;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">V</span>
          <div>
            <strong>VLMS</strong>
            <span className="muted"> · {L('Applied Technology School, Cairo East', 'مدرسة التكنولوجيا التطبيقية، شرق القاهرة')}</span>
          </div>
          <span className="chip sample" title={L('Every name and number in this prototype is illustrative', 'كل الأسماء والأرقام في هذا النموذج توضيحية')}>
            {L('Sample data', 'بيانات تجريبية')}
          </span>
        </div>
        <div className="topbar-end">
          <nav className="roles" aria-label={L('View as', 'العرض بصفة')}>
            <span className="roles-label">{L('View as', 'العرض بصفة')}</span>
            {ROLES.map((r) => (
              <button key={r.id} type="button" aria-pressed={role === r.id} onClick={() => setRole(r.id)}>
                <span>{pick(r.label)}</span>
                {r.id === 'trainer' && open > 0 && <span className="badge" aria-label={L(`${open} open alerts`, `${open} تنبيهات مفتوحة`)}>{open}</span>}
                <small>{pick(r.who)}</small>
              </button>
            ))}
          </nav>
          <div className="lang" role="radiogroup" aria-label="Language · اللغة">
            <button type="button" role="radio" aria-checked={lang === 'en'} lang="en" onClick={() => setLang('en')}>EN</button>
            <button type="button" role="radio" aria-checked={lang === 'ar'} lang="ar" onClick={() => setLang('ar')}>عربي</button>
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
