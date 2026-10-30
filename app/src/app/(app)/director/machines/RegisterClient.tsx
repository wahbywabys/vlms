'use client';
import { useState } from 'react';
import { ImportBox } from '@/components/admin/ImportBox';
import { StickerSheet } from '@/components/admin/StickerSheet';
import { useL } from '@/components/LangProvider';
import { apiFetch } from '@/lib/browserApi';
import { MACHINE_COLUMNS } from '@/lib/sheetImport';

export interface RegMachine { tag: string; name: string; status: string; qrCode: string | null; brand: string | null; model: string | null; serial: string | null;
  year: number | null; photoId: string | null; centerCode: string; center: string; centerAr: string | null; workshop: string; workshopAr: string | null; tradeId: string | null;
  typeId: string | null; typeName: string | null; typeNameAr: string | null; twinId: string | null; twinMatch: 'exact' | 'similar' | null; precheckCode: string | null; competencyCode: string | null }
export interface Center { id: string; code: string; name: string; nameAr: string | null; region: string | null; workshops: { id: string; name: string; nameAr: string | null; tradeId: string | null; machines: number }[] }

export function RegisterClient({ initial, centers: initialCenters }: { initial: RegMachine[]; centers: Center[] }) {
  const { L, lang } = useL();
  const [machines, setMachines] = useState(initial);
  const [centers, setCenters] = useState(initialCenters);
  const [view, setView] = useState<'list' | 'stickers'>('list');
  const [center, setCenter] = useState('');
  const reload = async () => {
    const [m, c] = await Promise.all([apiFetch<{ machines: RegMachine[] }>('/admin/machines'), apiFetch<{ centers: Center[] }>('/admin/centers')]);
    setMachines(m.machines); setCenters(c.centers);
  };
  const ar = (en: string | null, a: string | null) => (lang === 'ar' && a ? a : en ?? '');
  const shown = machines.filter((m) => !center || m.centerCode === center);
  const noTwin = machines.filter((m) => !m.twinId).length;
  return (
    <div className="dash-grid">
      <section className="panel wide">
        <header className="panel-head no-print">
          <h2>{L(`${machines.length} machines in ${centers.length} centre(s)`, `${machines.length} ماكينة في ${centers.length} مركز`)}</h2>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'primary' : 'ghost'} onClick={() => setView('list')}>{L('Register', 'السجل')}</button>
            <button type="button" role="tab" aria-selected={view === 'stickers'} className={view === 'stickers' ? 'primary' : 'ghost'} onClick={() => setView('stickers')}>{L('QR stickers', 'ملصقات QR')}</button>
          </div>
        </header>
        {view === 'stickers' ? <StickerSheet machines={machines} /> : (
          <>
            <div className="form-row">
              <label className="field"><span>{L('Centre', 'المركز')}</span>
                <select value={center} onChange={(e) => setCenter(e.target.value)}>
                  <option value="">{L('All centres', 'كل المراكز')}</option>
                  {centers.map((c) => <option key={c.code} value={c.code}>{c.code} · {ar(c.name, c.nameAr)} ({c.workshops.reduce((n, w) => n + Number(w.machines), 0)})</option>)}
                </select></label>
            </div>
            {noTwin > 0 && <p className="muted small">{L(`${noTwin} machine(s) have no 3D twin yet; learners practise on the closest trade content.`, `${noTwin} ماكينة بدون نموذج ثلاثي الأبعاد بعد؛ يتدرب المتدربون على أقرب محتوى للتخصص.`)}</p>}
            <div className="scroll-x">
              <table className="data">
                <thead><tr><th>{L('Photo', 'صورة')}</th><th>{L('Asset tag', 'رقم الأصل')}</th><th>{L('Machine', 'الماكينة')}</th><th>{L('Brand · model · serial', 'الماركة · الموديل · التسلسلي')}</th>
                  <th>{L('Centre · workshop', 'المركز · الورشة')}</th><th>{L('3D twin', 'النموذج ثلاثي الأبعاد')}</th><th>{L('Safety gate', 'بوابة السلامة')}</th><th>{L('Status', 'الحالة')}</th></tr></thead>
                <tbody>{shown.map((m) => (
                  <tr key={m.tag}>
                    <td>{m.photoId ? <img className="thumb" src={`/api/v1/media/${m.photoId}`} alt="" loading="lazy" /> : <span className="muted">—</span>}</td>
                    <td className="mono">{m.tag}</td>
                    <td><b>{ar(m.typeName, m.typeNameAr) || m.name}</b><br /><span className="muted small">{m.name}</span></td>
                    <td>{[m.brand, m.model].filter(Boolean).join(' ') || <span className="muted">—</span>}{m.serial && <><br /><span className="mono small">S/N {m.serial}</span></>}</td>
                    <td>{m.centerCode}<br /><span className="muted small">{ar(m.workshop, m.workshopAr)}</span></td>
                    <td>{m.twinId ? <span className={m.twinMatch === 'exact' ? 'chip chip-on' : 'chip'}>{m.twinId}{m.twinMatch === 'similar' ? L(' · closest', ' · الأقرب') : ''}</span>
                      : <span className="muted small">{L('none yet', 'لا يوجد بعد')}</span>}</td>
                    <td className="small">{m.precheckCode ?? <span className="chip chip-danger">{L('No pre-check', 'لا فحص مسبق')}</span>}{m.competencyCode && <><br /><span className="mono">{m.competencyCode}</span></>}</td>
                    <td className="small">{m.status}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <div className="no-print">
        <ImportBox endpoint="/admin/machines/import" columns={MACHINE_COLUMNS} sheet="Machines" photos
          required={['centerCode', 'workshop', 'machineType', 'brand', 'model', 'serial']}
          template={{ xlsx: '/templates/machine-inventory-template.xlsx', csv: '/templates/machine-inventory-template.csv' }} onDone={() => void reload()} />
      </div>
    </div>
  );
}
