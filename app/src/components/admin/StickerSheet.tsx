'use client';
/**
 * Printable QR stickers, one per real machine, filtered by centre and
 * workshop. The QR holds only the machine's code (VTC-…), never a web
 * address, so the same sticker works with the centre's local server, the
 * cloud, or a device that is offline: it is read by the scanner inside the
 * app, which checks the person against that machine.
 */
import { useMemo, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { QrCode } from '@/components/modules/WorkshopBoards';

export interface StickerMachine { tag: string; name: string; qrCode: string | null; centerCode: string | null; center: string | null; centerAr?: string | null;
  workshop: string | null; workshopAr?: string | null; typeName?: string | null; typeNameAr?: string | null; brand?: string | null; model?: string | null; serial?: string | null }

export function StickerSheet({ machines, institution }: { machines: StickerMachine[]; institution?: string }) {
  const { L, lang } = useL();
  const centers = useMemo(() => [...new Map(machines.filter((m) => m.centerCode).map((m) => [m.centerCode!, m])).values()], [machines]);
  const [center, setCenter] = useState(centers.length === 1 ? centers[0]!.centerCode! : '');
  const [workshop, setWorkshop] = useState('');
  const shops = [...new Set(machines.filter((m) => !center || m.centerCode === center).map((m) => m.workshop ?? ''))].filter(Boolean).sort();
  const list = machines.filter((m) => m.qrCode && (!center || m.centerCode === center) && (!workshop || m.workshop === workshop));
  const ar = (en: string | null | undefined, a: string | null | undefined) => (lang === 'ar' && a ? a : en ?? '');
  return (
    <div>
      <div className="form-row no-print">
        <label className="field"><span>{L('Centre', 'المركز')}</span>
          <select value={center} onChange={(e) => { setCenter(e.target.value); setWorkshop(''); }}>
            <option value="">{L('All centres', 'كل المراكز')}</option>
            {centers.map((c) => <option key={c.centerCode} value={c.centerCode!}>{c.centerCode} · {ar(c.center, c.centerAr)}</option>)}
          </select></label>
        <label className="field"><span>{L('Workshop', 'الورشة')}</span>
          <select value={workshop} onChange={(e) => setWorkshop(e.target.value)}>
            <option value="">{L('All workshops', 'كل الورش')}</option>
            {shops.map((w) => <option key={w} value={w}>{w}</option>)}
          </select></label>
        <div className="form-actions"><button type="button" className="primary" onClick={() => window.print()}>{L(`Print ${list.length} stickers`, `اطبع ${list.length} ملصق`)}</button></div>
      </div>
      <p className="muted small no-print">{L('Stick each label on the machine it names, next to its nameplate, and check the serial number matches before you stick it.',
        'الصق كل ملصق على الماكينة المكتوبة عليه بجوار لوحة بياناتها، وتأكد أن الرقم التسلسلي مطابق قبل اللصق.')}</p>
      <div className="stickers">
        {list.map((m) => (
          <figure key={m.tag} className="sticker" style={{ margin: 0 }}>
            <div className="s-head"><span>WABYS · VTC_LMS</span><span dir="rtl">{institution ?? m.centerCode}</span></div>
            <QrCode text={m.qrCode!} size={96} label={m.tag} />
            <figcaption>
              <div className="s-tag">{m.tag}</div>
              <div><b>{m.typeName ?? m.name}</b>{m.typeNameAr ? <span dir="rtl"> · {m.typeNameAr}</span> : null}</div>
              {(m.brand || m.model) && <div>{[m.brand, m.model].filter(Boolean).join(' ')}</div>}
              {m.serial && <div>S/N <span className="mono">{m.serial}</span></div>}
              <div>{m.centerCode} · {m.workshop}</div>
              <div className="mono" style={{ fontSize: 8 }}>{m.qrCode}</div>
            </figcaption>
            <div className="s-foot">Scan in the app before use · امسح من التطبيق قبل التشغيل</div>
          </figure>
        ))}
      </div>
      {!list.length && <p className="notice">{L('No machines with a QR code in this selection.', 'لا توجد ماكينات برمز QR في هذا الاختيار.')}</p>}
    </div>
  );
}
