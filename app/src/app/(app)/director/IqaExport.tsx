'use client';
import { useState } from 'react';
import { useL } from '@/components/LangProvider';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hash-sealed export of evaluations so an auditor can check nothing changed after export. */
export function IqaExport({ institution, rows }: { institution: string; rows: Record<string, unknown>[] }) {
  const { L } = useL();
  const [pack, setPack] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const build = async () => {
    const hashed = await Promise.all(rows.map(async (r) => ({ ...r, sha256: await sha256(JSON.stringify(r)) })));
    const body = { institution, generatedAt: new Date().toISOString(), evaluations: hashed };
    setPack(JSON.stringify({ ...body, packSha256: await sha256(JSON.stringify(body)) }, null, 2));
    setCopied(false);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([pack ?? ''], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `vtc-lms-iqa-pack-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <button type="button" className="primary" onClick={() => void build()}>{L('Export IQA pack', 'تصدير حزمة ضمان الجودة')}</button>
      {pack && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="iqa-title">
          <div className="modal-card">
            <header className="panel-head"><h2 id="iqa-title">{L('IQA evidence pack', 'حزمة أدلة ضمان الجودة الداخلي')}</h2>
              <button type="button" className="ghost" onClick={() => setPack(null)}>{L('Close', 'إغلاق')}</button></header>
            <p className="muted small">{L(`${rows.length} evaluations from the database, each with a SHA-256 hash, plus a hash over the whole pack.`,
              `${rows.length} تقييمًا من قاعدة البيانات، لكل منها بصمة SHA-256، مع بصمة للحزمة كاملة.`)}</p>
            <textarea className="mono" dir="ltr" readOnly value={pack} rows={14} />
            <div className="form-actions">
              <button type="button" className="primary" onClick={download}>{L('Download JSON', 'تنزيل JSON')}</button>
              <button type="button" onClick={() => void navigator.clipboard.writeText(pack).then(() => setCopied(true)).catch(() => undefined)}>{copied ? L('Copied', 'تم النسخ') : L('Copy', 'نسخ')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
