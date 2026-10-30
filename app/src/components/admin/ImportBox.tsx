'use client';
/**
 * Import from the Excel/CSV template: pick the file (and, for machines, the
 * photos it names), check it with a dry run, then import. Rows are applied
 * one by one on the server; the result lists every row that failed and why.
 */
import { useState } from 'react';
import { useL } from '@/components/LangProvider';
import { apiFetch } from '@/lib/browserApi';
import { readImportFile } from '@/lib/sheetImport';

export interface ImportResult { dryRun: boolean; created: number; updated: number; errors: number;
  results: { row: number; status: 'created' | 'updated' | 'error'; message?: string; tag?: string; twin?: string | null; twinMatch?: string | null; program?: string; code?: string }[] }

export function ImportBox({ endpoint, columns, sheet, required, template, photos, onDone }: {
  endpoint: string; columns: Record<string, string[]>; sheet: string; required: string[];
  template: { xlsx: string; csv: string };
  /** Machines: the photo files named in the "Photo file name" column are uploaded and linked. */
  photos?: boolean;
  onDone?: (r: ImportResult) => void;
}) {
  const { L } = useL();
  const [file, setFile] = useState<File | null>(null);
  const [pics, setPics] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [warn, setWarn] = useState<string[]>([]);

  const run = async (dryRun: boolean) => {
    if (!file) return;
    setErr(null); setRes(null); setBusy(dryRun ? L('Checking…', 'جارٍ الفحص…') : L('Importing…', 'جارٍ الاستيراد…'));
    try {
      const sheetRows = await readImportFile(file, columns, sheet, required);
      if (sheetRows.missing.length) throw new Error(L(`Missing column(s): ${sheetRows.missing.join(', ')}. Use the template.`, `أعمدة ناقصة: ${sheetRows.missing.join('، ')}. استخدم النموذج.`));
      if (!sheetRows.rows.length) throw new Error(L('The sheet has no rows.', 'الورقة لا تحتوي على صفوف.'));
      const w: string[] = [];
      if (sheetRows.unknownHeaders.length) w.push(L(`Ignored columns: ${sheetRows.unknownHeaders.join(', ')}`, `أعمدة تم تجاهلها: ${sheetRows.unknownHeaders.join('، ')}`));
      let rows = sheetRows.rows;
      if (photos) {
        const byName = new Map(pics.map((p) => [p.name.toLowerCase(), p]));
        const ids = new Map<string, string>();
        rows = [];
        for (const r of sheetRows.rows) {
          const { photo, ...rest } = r as Record<string, unknown> & { photo?: string };
          const f = photo ? byName.get(String(photo).toLowerCase()) : undefined;
          if (photo && !f) w.push(L(`Photo "${photo}" was not selected; that machine is imported without a photo.`, `الصورة "${photo}" لم تُختر؛ ستُستورد الماكينة بدون صورة.`));
          if (f && !dryRun && !ids.has(f.name)) {
            const r2 = await fetch('/api/v1/media', { method: 'POST', body: f, headers: { 'content-type': f.type || 'image/jpeg', 'x-client-mutation-id': crypto.randomUUID(),
              'x-captured-at': new Date(f.lastModified).toISOString(), 'x-kind': 'photo' } });
            if (r2.ok) ids.set(f.name, ((await r2.json()) as { id: string }).id);
            else w.push(L(`Photo "${f.name}" could not be uploaded.`, `تعذر رفع الصورة "${f.name}".`));
          }
          rows.push(f && ids.get(f.name) ? { ...rest, photoMediaId: ids.get(f.name) } : rest);
        }
      }
      setWarn([...new Set(w)]);
      const out = await apiFetch<ImportResult>(endpoint, { body: { rows, dryRun } });
      setRes(out);
      if (!dryRun) onDone?.(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : (e as { message?: string })?.message ?? L('Import failed.', 'فشل الاستيراد.'));
    }
    setBusy(null);
  };

  return (
    <section className="panel">
      <header className="panel-head"><h2>{L('Import from Excel or CSV', 'استيراد من Excel أو CSV')}</h2>
        <span className="muted small"><a href={template.xlsx} download>{L('Excel template', 'نموذج Excel')}</a> · <a href={template.csv} download>CSV</a></span></header>
      <div className="form-row">
        <label className="field"><span>{L('File (.xlsx or .csv)', 'الملف (.xlsx أو .csv)')}</span>
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRes(null); setErr(null); }} /></label>
        {photos && <label className="field"><span>{L('Machine photos (optional, several)', 'صور الماكينات (اختياري، أكثر من صورة)')}</span>
          <input type="file" accept="image/*" multiple onChange={(e) => setPics([...(e.target.files ?? [])])} /></label>}
      </div>
      <div className="form-actions">
        <button type="button" disabled={!file || !!busy} onClick={() => void run(true)}>{L('Check the file', 'افحص الملف')}</button>
        <button type="button" className="primary" disabled={!file || !!busy} onClick={() => void run(false)}>{busy ?? L('Import', 'استيراد')}</button>
      </div>
      {err && <p className="notice notice-danger" role="alert">{err}</p>}
      {warn.map((w) => <p key={w} className="muted small">⚠ {w}</p>)}
      {res && (
        <div aria-live="polite">
          <p className={res.errors ? 'notice notice-danger' : 'notice notice-info'}>
            {res.dryRun ? L('Check only, nothing saved: ', 'فحص فقط، لم يُحفظ شيء: ') : ''}
            {L(`${res.created} new · ${res.updated} updated · ${res.errors} with errors`, `${res.created} جديد · ${res.updated} محدّث · ${res.errors} بها أخطاء`)}
          </p>
          <div className="scroll-x">
            <table className="data">
              <thead><tr><th className="num">{L('Row', 'السطر')}</th><th>{L('Result', 'النتيجة')}</th><th>{L('Details', 'التفاصيل')}</th></tr></thead>
              <tbody>{res.results.filter((r) => r.status === 'error' || res.results.length <= 60).map((r) => (
                <tr key={r.row}>
                  <td className="num">{r.row + 1}</td>
                  <td>{r.status === 'error' ? <span className="chip chip-danger">{L('Error', 'خطأ')}</span>
                    : <span className="chip chip-on">{r.status === 'created' ? L('New', 'جديد') : L('Updated', 'محدّث')}</span>}</td>
                  <td>{r.message ?? [r.tag ?? r.code ?? r.program, r.twin ? `3D: ${r.twin}${r.twinMatch === 'similar' ? L(' (closest)', ' (الأقرب)') : ''}` : r.tag ? L('no 3D twin yet', 'لا يوجد نموذج ثلاثي الأبعاد بعد') : null].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="muted small">{L('Row numbers match the sheet (row 1 is the header).', 'أرقام السطور كما في الملف (السطر 1 هو العناوين).')}</p>
        </div>
      )}
    </section>
  );
}
