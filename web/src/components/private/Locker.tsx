/** My locker: everything the student keeps, with search, kinds, tags, pins, notes, photos, links and an export. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Txt } from '../../models/kit';
import { usePv } from './ctx';
import { findLesson, findPart, findScenario, LIMITS, machineName, type LockerItem, type LockerKind } from './model';

export const KIND_LABEL: Record<LockerKind, Txt> = {
  part: { en: 'Machine part', ar: 'قطعة ماكينة' },
  lesson: { en: 'Lesson', ar: 'درس' },
  safety: { en: 'Safety run', ar: 'محاكاة سلامة' },
  result: { en: 'Result', ar: 'نتيجة' },
  note: { en: 'Note', ar: 'ملاحظة' },
  photo: { en: 'Photo', ar: 'صورة' },
  link: { en: 'Link or video', ar: 'رابط أو فيديو' },
  mistake: { en: 'My mistake', ar: 'خطأ لي' },
};
const ICON: Record<LockerKind, string> = {
  part: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  lesson: 'M4 5h16v12H4zM10 9l4 2-4 2zM8 21h8',
  safety: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4',
  result: 'M5 20V10M12 20V4M19 20v-7',
  note: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6',
  photo: 'M4 7h3l2-2h6l2 2h3v12H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  mistake: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16v.5',
};

export function KindIcon({ kind }: { kind: LockerKind }) {
  return (
    <span className={`pv-kind k-${kind}`} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={ICON[kind]} /></svg>
    </span>
  );
}

type Sort = 'new' | 'old' | 'az';
type Adding = null | 'note' | 'link' | 'photo';

export function Locker() {
  const { L, pick, state, update, focus, date, lang } = usePv();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<LockerKind | 'all' | 'pinned'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('new');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<Adding>(null);
  useEffect(() => { if (focus.item) { setOpen(focus.item); setKind('all'); setQ(''); setTag(null); } }, [focus.item]);

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of state.items) for (const t of i.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [state.items]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = state.items.filter((i) =>
      (kind === 'all' || (kind === 'pinned' ? i.pinned : i.kind === kind))
      && (!tag || i.tags.includes(tag))
      && (!needle || [i.title.en, i.title.ar, i.body ?? '', ...i.tags].join(' ').toLowerCase().includes(needle)));
    return list.sort((a, b) => (sort === 'az' ? pick(a.title).localeCompare(pick(b.title), lang) : sort === 'old' ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at))
      || Number(!!b.pinned) - Number(!!a.pinned));
  }, [state.items, kind, tag, q, sort, pick, lang]);
  const kinds = (Object.keys(KIND_LABEL) as LockerKind[]).filter((k) => state.items.some((i) => i.kind === k));
  const item = state.items.find((i) => i.id === open);

  const patch = (id: string, p: Partial<LockerItem>) => update((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  const remove = (id: string) => { update((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) })); setOpen(null); };
  const exportAll = () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-locker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="pv-locker">
      <div className="pv-locker-bar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Search my locker', 'ابحث في خزانتي')} aria-label={L('Search my locker', 'ابحث في خزانتي')} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={L('Sort', 'الترتيب')}>
          <option value="new">{L('Newest first', 'الأحدث أولًا')}</option>
          <option value="old">{L('Oldest first', 'الأقدم أولًا')}</option>
          <option value="az">{L('A to Z', 'أبجديًا')}</option>
        </select>
        <div className="pv-add">
          <button type="button" onClick={() => setAdding('note')}>＋ {L('Note', 'ملاحظة')}</button>
          <button type="button" onClick={() => setAdding('photo')}>＋ {L('Photo', 'صورة')}</button>
          <button type="button" onClick={() => setAdding('link')}>＋ {L('Link or video', 'رابط أو فيديو')}</button>
          <button type="button" className="pv-ghost" onClick={exportAll} disabled={!state.items.length} title={L('Download everything as a file you keep', 'نزّل كل شيء كملف تحتفظ به')}>{L('Export', 'تصدير')}</button>
        </div>
      </div>
      <div className="pv-chips" role="radiogroup" aria-label={L('Show', 'اعرض')}>
        <button type="button" role="radio" aria-checked={kind === 'all'} onClick={() => setKind('all')}>{L('Everything', 'الكل')} <span>{state.items.length}</span></button>
        <button type="button" role="radio" aria-checked={kind === 'pinned'} onClick={() => setKind('pinned')}>📌 {L('Pinned', 'المثبّتة')} <span>{state.items.filter((i) => i.pinned).length}</span></button>
        {kinds.map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{pick(KIND_LABEL[k])} <span>{state.items.filter((i) => i.kind === k).length}</span></button>)}
      </div>
      {tags.length > 0 && (
        <div className="pv-tags" aria-label={L('Tags', 'الوسوم')}>
          {tags.map(([t, n]) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>#{t} <small>{n}</small></button>)}
        </div>
      )}

      {adding && <AddForm kind={adding} onDone={(id) => { setAdding(null); if (id) setOpen(id); }} />}

      {shown.length ? (
        <ul className="pv-items">
          {shown.map((i) => (
            <li key={i.id} className={`pv-item k-${i.kind} ${i.pinned ? 'is-pinned' : ''}`}>
              <button type="button" className="pv-item-open" onClick={() => setOpen(i.id)}>
                {i.image && <img src={i.image} alt="" />}
                <span className="pv-item-head"><KindIcon kind={i.kind} /><small>{pick(KIND_LABEL[i.kind])} · {date(i.at)}</small></span>
                <b>{pick(i.title)}</b>
                {typeof i.value?.score === 'number' && <span className={`pv-score ${i.value.score >= 80 ? 'ok' : i.value.score >= 50 ? 'mid' : 'low'}`}>{Math.round(i.value.score)}</span>}
                {i.body && <span className="pv-snip">{i.body}</span>}
                {i.tags.length > 0 && <span className="pv-item-tags">{i.tags.slice(0, 3).map((t) => <i key={t}>#{t}</i>)}</span>}
              </button>
              <button type="button" className="pv-pin" aria-pressed={!!i.pinned} aria-label={i.pinned ? L('Unpin', 'ألغِ التثبيت') : L('Pin', 'ثبّت')}
                onClick={() => patch(i.id, { pinned: !i.pinned })}>📌</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pv-card pv-empty-big">
          <b>{state.items.length ? L('Nothing matches', 'لا شيء يطابق') : L('Your locker is empty', 'خزانتك فارغة')}</b>
          <span>{state.items.length ? L('Try another search, kind or tag.', 'جرّب بحثًا أو نوعًا أو وسمًا آخر.')
            : L('Press “Save to my locker” on any machine part in 3D, at the end of a lesson or safety simulation, or on a V-Lab result. Or add your own notes, photos and links here.',
              'اضغط «احفظ في خزانتي» على أي قطعة في العرض ثلاثي الأبعاد، أو في نهاية درس أو محاكاة سلامة، أو على نتيجة المعمل الافتراضي. أو أضف ملاحظاتك وصورك وروابطك هنا.')}</span>
        </div>
      )}

      {item && <Detail item={item} onClose={() => setOpen(null)} patch={(p) => patch(item.id, p)} remove={() => remove(item.id)} />}
    </div>
  );
}

function AddForm({ kind, onDone }: { kind: Exclude<Adding, null>; onDone: (id?: string) => void }) {
  const { L, add } = usePv();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [err, setErr] = useState('');
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  const okUrl = !url || /^https?:\/\/\S+$/i.test(url.trim());
  const can = kind === 'note' ? !!(title.trim() || body.trim()) : kind === 'link' ? !!url.trim() && okUrl : !!image;
  const submit = () => {
    if (!can) return;
    const t = title.trim() || (kind === 'link' ? url.trim().replace(/^https?:\/\//, '').slice(0, 60) : kind === 'photo' ? L('Photo', 'صورة') : body.trim().split('\n')[0]!.slice(0, 60));
    const item = add({ kind, title: { en: t, ar: t }, body: body.trim() || undefined, tags: [], image, url: url.trim() || undefined });
    onDone(item.id);
  };
  return (
    <form className="pv-card pv-addform" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <h3>{kind === 'note' ? L('New note', 'ملاحظة جديدة') : kind === 'photo' ? L('Add a photo', 'أضف صورة') : L('Add a link or video', 'أضف رابطًا أو فيديو')}</h3>
      {kind === 'photo' && (
        <label className="pv-file">
          <input type="file" accept="image/*" capture="environment" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setErr('');
            try { setImage(await shrink(f)); if (!title) setTitle(f.name.replace(/\.[a-z]+$/i, '')); } catch { setErr(L('That file could not be read as a picture.', 'تعذّرت قراءة هذا الملف كصورة.')); }
          }} />
          {image ? <img src={image} alt="" /> : <span>{L('Take or choose a photo: your work, a gauge reading, a drawing…', 'التقط أو اختر صورة: عملك، قراءة جهاز، رسمة…')}</span>}
        </label>
      )}
      {kind === 'link' && (
        <label className="pv-field"><span>{L('Address', 'العنوان')}</span>
          <input type="url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" ref={first} aria-invalid={!okUrl} /></label>
      )}
      <label className="pv-field"><span>{L('Title', 'العنوان')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} ref={kind === 'link' ? undefined : first} /></label>
      <label className="pv-field"><span>{kind === 'note' ? L('Note', 'الملاحظة') : L('Why I kept it', 'لماذا احتفظت به')}</span>
        <textarea rows={kind === 'note' ? 5 : 2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={LIMITS.body} /></label>
      {err && <p className="pv-err">{err}</p>}
      <div className="pv-actions">
        <button type="submit" className="pv-primary" disabled={!can}>{L('Put in my locker', 'ضعه في خزانتي')}</button>
        <button type="button" onClick={() => onDone()}>{L('Cancel', 'إلغاء')}</button>
      </div>
    </form>
  );
}

/** Downscale a photo to a JPEG small enough to keep with the rest of the locker. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    for (const [max, q] of [[1280, 0.78], [960, 0.7], [720, 0.62], [520, 0.55]] as const) {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', q);
      if (data.length <= LIMITS.image) return data;
    }
    throw new Error('too big');
  } finally { URL.revokeObjectURL(url); }
}

function Detail({ item, onClose, patch, remove }: { item: LockerItem; onClose: () => void; patch: (p: Partial<LockerItem>) => void; remove: () => void }) {
  const { L, pick, catalog, date, go, attempts } = usePv();
  const [body, setBody] = useState(item.body ?? '');
  const [tagText, setTagText] = useState('');
  const [sure, setSure] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { setBody(item.body ?? ''); setSure(false); close.current?.focus(); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  const part = item.kind === 'part' || item.ref?.card ? findPart(catalog, item.ref?.card ? { model: item.ref.card.split('/')[0]!, part: item.ref.card.split('/')[1]! } : item.ref) : undefined;
  const lesson = item.ref?.lesson ? findLesson(catalog, item.ref.lesson) : undefined;
  const scenario = item.ref?.scenario ? findScenario(catalog, item.ref.scenario) : undefined;
  const title = part && item.kind === 'part' ? part.name : item.title;
  const tries = attempts.filter((a) => a.ref === (lesson?.id ?? scenario?.id ?? item.ref?.lab));
  const crit = Array.isArray(item.value?.criteria) ? item.value.criteria as { key: string; label: Txt; score: number }[] : [];
  const q = item.kind === 'mistake' ? item.value?.q as { options: Txt[]; answer: number; explain?: Txt; context?: Txt } | undefined : undefined;

  return (
    <div className="pv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="pv-drawer" role="dialog" aria-modal="true" aria-label={pick(title)}>
        <header>
          <KindIcon kind={item.kind} />
          <span><small>{pick(KIND_LABEL[item.kind])} · {date(item.at, true)}</small><h2>{pick(title)}</h2></span>
          <button type="button" ref={close} className="pv-x" onClick={onClose} aria-label={L('Close', 'إغلاق')}>×</button>
        </header>
        <div className="pv-drawer-body">
          {item.image && <img className="pv-photo" src={item.image} alt={pick(title)} />}
          {item.url && <p><a href={item.url} target="_blank" rel="noreferrer noopener" dir="ltr">{item.url}</a></p>}
          {part && (
            <div className="pv-partfacts">
              <p className="pv-eyebrow">{pick(machineName(part.model))} · {pick(part.trade.name)}</p>
              {part.what && <><h4>{L('What it is', 'ما هي')}</h4><p>{pick(part.what)}</p></>}
              {part.does && <><h4>{L('What it does', 'ماذا تفعل')}</h4><p>{pick(part.does)}</p></>}
              {part.safety && <p className="pv-safety">⚠ {pick(part.safety)}</p>}
            </div>
          )}
          {(lesson || scenario) && <p>{pick(lesson?.summary ?? scenario?.brief)}</p>}
          {typeof item.value?.score === 'number' && (
            <p className="pv-result-line"><span className={`pv-score ${item.value.score >= 80 ? 'ok' : item.value.score >= 50 ? 'mid' : 'low'}`}>{Math.round(item.value.score)}</span>
              {typeof item.value.stars === 'number' && <span>{'★'.repeat(item.value.stars)}{'☆'.repeat(3 - item.value.stars)}</span>}
              {tries.length > 1 && <span>{L(`${tries.length} tries · best ${Math.round(Math.max(...tries.map((t) => t.score)))}`, `${tries.length} محاولات · الأفضل ${Math.round(Math.max(...tries.map((t) => t.score)))}`)}</span>}</p>
          )}
          {crit.length > 0 && (
            <table className="pv-crit"><tbody>{crit.map((c) => <tr key={c.key}><th scope="row">{pick(c.label)}</th><td className="num">{c.score}</td>
              <td className="pv-bars"><span className="b" style={{ inlineSize: `${c.score}%` }} /></td></tr>)}</tbody></table>
          )}
          {q && (
            <ol className="pv-mistake">{q.options.map((o, k) => <li key={k} className={k === q.answer ? 'is-right' : ''}>{pick(o)}</li>)}</ol>
          )}
          <label className="pv-field"><span>{item.kind === 'note' ? L('Note', 'الملاحظة') : L('My notes', 'ملاحظاتي')}</span>
            <textarea rows={item.kind === 'note' ? 8 : 4} value={body} maxLength={LIMITS.body} onChange={(e) => setBody(e.target.value)}
              onBlur={() => { if (body !== (item.body ?? '')) patch({ body }); }} /></label>
          <div className="pv-field"><span>{L('Tags', 'الوسوم')}</span>
            <div className="pv-tags">
              {item.tags.map((t) => <button key={t} type="button" onClick={() => patch({ tags: item.tags.filter((x) => x !== t) })} aria-label={L(`Remove tag ${t}`, `احذف الوسم ${t}`)}>#{t} ×</button>)}
              <form onSubmit={(e) => { e.preventDefault(); const t = tagText.trim().replace(/^#/, ''); if (t && !item.tags.includes(t)) patch({ tags: [...item.tags, t.slice(0, 30)].slice(0, 12) }); setTagText(''); }}>
                <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder={L('Add tag', 'أضف وسمًا')} aria-label={L('Add tag', 'أضف وسمًا')} />
              </form>
            </div>
          </div>
        </div>
        <footer className="pv-actions">
          <button type="button" onClick={() => patch({ pinned: !item.pinned })}>{item.pinned ? L('Unpin', 'ألغِ التثبيت') : L('Pin to my desk', 'ثبّت على مكتبي')}</button>
          {part && <button type="button" onClick={() => go('study', { part: part.key })}>{L('Study this card', 'ذاكر هذه البطاقة')}</button>}
          {part && <button type="button" onClick={() => go('compare', { part: part.key })}>{L('Compare', 'قارن')}</button>}
          {(lesson || scenario || item.ref?.lab) && tries.length > 0 && <button type="button" onClick={() => go('compare', { compare: tries[0]!.ref })}>{L('Compare my tries', 'قارن محاولاتي')}</button>}
          <span className="pv-spacer" />
          <button type="button" className={sure ? 'pv-danger' : 'pv-ghost'} onClick={() => (sure ? remove() : setSure(true))}>{sure ? L('Yes, remove it', 'نعم، احذفه') : L('Remove', 'احذف')}</button>
        </footer>
      </aside>
    </div>
  );
}
