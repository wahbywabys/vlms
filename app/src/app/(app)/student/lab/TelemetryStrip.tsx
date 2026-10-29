'use client';
import { useL } from '@/components/LangProvider';

export function TelemetryStrip({ items, empty, title }: { items: { seq: number; verb: string; objectRef?: string | null; note?: string }[]; empty: string; title?: string }) {
  const { L } = useL();
  return (
    <section className="telemetry" aria-label={L('Telemetry', 'القياس عن بعد')}>
      <strong>{title ?? L('Telemetry sent to the LMS', 'أحداث القياس المرسلة إلى نظام إدارة التعلم')}</strong>
      {items.length === 0 ? <p className="muted">{empty}</p> : (
        <ol reversed dir="ltr">
          {items.map((e) => (
            <li key={e.seq} className="mono">#{e.seq} {e.verb}{e.objectRef ? ` → ${e.objectRef}` : ''}{e.note ? ` · ${e.note}` : ''}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
