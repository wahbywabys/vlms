import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MachineExplorer, type ExplorerEvent } from './components/MachineExplorer';
import { inductionMotorParts } from './models/inductionMotor';

/**
 * Demo shell. In the LMS the events are buffered, given a monotonically
 * increasing `seq`, and flushed to POST /v1/vlab/sessions/:id/telemetry
 * (persisted to IndexedDB first when the tablet is offline).
 */
function Demo() {
  const [log, setLog] = useState<(ExplorerEvent & { seq: number; at: string })[]>([]);
  const onEvent = (e: ExplorerEvent) =>
    setLog((l) => [{ ...e, seq: (l[0]?.seq ?? 0) + 1, at: new Date().toLocaleTimeString() }, ...l].slice(0, 6));

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <MachineExplorer title="3-Phase Induction Motor · IEC 132M" assetTag="WS-ELEC-07 / MTR-0132"
        parts={inductionMotorParts} onEvent={onEvent} height={600} />
      <section className="telemetry" aria-label="Telemetry emitted">
        <strong>xAPI telemetry emitted</strong>
        {log.length === 0 ? <span> — interact with the model to see events</span> : (
          <ul>{log.map((e) => (
            <li key={e.seq}><code>#{e.seq} {e.at} {e.verb}{e.objectRef ? ` → ${e.objectRef}` : ''} {e.value ? JSON.stringify(e.value) : ''}</code></li>
          ))}</ul>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>);
