import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DirectorDashboard } from './DirectorDashboard';
import { StoreProvider, useStore, type Role } from './store';
import { StudentLab } from './StudentLab';
import { TrainerFloor } from './TrainerFloor';
import './prototype.css';

const ROLES: { id: Role; label: string; who: string }[] = [
  { id: 'trainer', label: 'Trainer', who: 'Eng. Huda Kamal · tablet' },
  { id: 'student', label: 'Student', who: 'Omar Lotfy · laptop' },
  { id: 'director', label: 'Director', who: 'Dr. Samia Rashad · desktop' },
];

function Shell() {
  const { role, setRole, alerts } = useStore();
  const open = alerts.filter((a) => !a.resolution).length;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">V</span>
          <div>
            <strong>VLMS</strong>
            <span className="muted"> · Applied Technology School, Cairo East</span>
          </div>
          <span className="chip sample" title="Every name and number in this prototype is illustrative">Sample data</span>
        </div>
        <nav className="roles" aria-label="View as">
          <span className="roles-label">View as</span>
          {ROLES.map((r) => (
            <button key={r.id} type="button" aria-pressed={role === r.id} onClick={() => setRole(r.id)}>
              <span>{r.label}</span>
              {r.id === 'trainer' && open > 0 && <span className="badge" aria-label={`${open} open alerts`}>{open}</span>}
              <small>{r.who}</small>
            </button>
          ))}
        </nav>
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
