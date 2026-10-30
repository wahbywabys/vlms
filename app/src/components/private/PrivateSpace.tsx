'use client';
/**
 * Private: the student's own space. Study the machines as flashcards, practise
 * without being graded, compare attempts and machines side by side, and keep
 * anything worth keeping (parts, lessons, results, notes, photos, links) in a
 * personal locker. Only the student sees it; nothing in it counts towards
 * their competency record.
 *
 * Shared by the prototype and the app (copied by scripts/sync-3d.sh). The host
 * passes the catalogue of what can be studied and where to keep the space.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Txt } from '../../models/kit';
import { LockIcon } from '../LockerButton';
import { ATTEMPT_EVENT, LOCKER_EVENT, lockerSaved, type AttemptRecord, type LockerDrop } from '../locker';
import { Compare } from './Compare';
import { Ctx, type PrivateCtx, type Tab } from './ctx';
import { Desk } from './Desk';
import { Locker } from './Locker';
import { addAttempt, addDrop, type Catalog, type LockerItem } from './model';
import { Practice } from './Practice';
import { usePrivateState, type PrivateAdapter } from './store';
import { Study } from './Study';
import './PrivateSpace.css';

export interface PrivateSpaceProps {
  lang: 'en' | 'ar';
  catalog: Catalog;
  owner: { name: Txt };
  adapter: PrivateAdapter;
  /** Attempts the server keeps (V-Lab sessions with rubric scores). Merged with the private history. */
  attempts?: AttemptRecord[];
  /** Take "Save to my locker" drops and finished attempts from the rest of the page (the prototype, where every screen is mounted). */
  listen?: boolean;
  /** False while the screen is hidden: stops the 3D previews. */
  active?: boolean;
}

const TABS: { id: Tab; en: string; ar: string; icon: string }[] = [
  { id: 'desk', en: 'My desk', ar: 'مكتبي', icon: 'M4 19h16M6 19V9h12v10M9 9V5h6v4' },
  { id: 'study', en: 'Study', ar: 'ذاكر', icon: 'M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-5a3 3 0 0 0-1 .2M20 5v13h-6' },
  { id: 'practice', en: 'Practice', ar: 'تدرّب', icon: 'M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z' },
  { id: 'compare', en: 'Compare', ar: 'قارن', icon: 'M4 6h7v13H4zM13 6h7v13h-7zM7.5 3v3M16.5 3v3' },
  { id: 'locker', en: 'My locker', ar: 'خزانتي', icon: 'M5 3h14v18H5zM12 3v18M9 11v2M15 11v2' },
];

export function PrivateSpace({ lang, catalog, owner, adapter, attempts: serverAttempts = [], listen = false, active = true }: PrivateSpaceProps) {
  const { state, update, status } = usePrivateState(adapter);
  const [tab, setTab] = useState<Tab>('desk');
  const [focus, setFocus] = useState<PrivateCtx['focus']>({});
  const [seen, setSeen] = useState<Tab[]>(['desk']);
  useEffect(() => { setSeen((v) => (v.includes(tab) ? v : [...v, tab])); }, [tab]);

  // Drops and attempts from other screens.
  useEffect(() => {
    if (!listen) return;
    const onDrop = (e: Event) => {
      const drop = (e as CustomEvent<LockerDrop>).detail;
      update((s) => addDrop(s, drop).state);
      lockerSaved(drop, true);
    };
    const onAttempt = (e: Event) => update((s) => addAttempt(s, (e as CustomEvent<AttemptRecord>).detail));
    window.addEventListener(LOCKER_EVENT, onDrop);
    window.addEventListener(ATTEMPT_EVENT, onAttempt);
    return () => { window.removeEventListener(LOCKER_EVENT, onDrop); window.removeEventListener(ATTEMPT_EVENT, onAttempt); };
  }, [listen, update]);

  const add = useCallback((d: LockerDrop): LockerItem => {
    let item: LockerItem | undefined;
    update((s) => { const r = addDrop(s, d); item = r.item; return r.state; });
    lockerSaved(d, true);
    return item ?? { id: '', kind: d.kind, at: new Date().toISOString(), title: d.title, tags: [] };
  }, [update]);

  const trade = catalog.trades.find((t) => t.id === catalog.home) ?? catalog.trades[0]!;
  const ctx = useMemo<PrivateCtx | null>(() => {
    if (!state) return null;
    const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' });
    const fmtT = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const ids = new Set(state.history.map((h) => h.id));
    return {
      lang, L: (en, ar) => (lang === 'ar' ? ar : en), pick: (t) => (t ? t[lang] || t.en : ''),
      date: (iso, withTime) => { const d = new Date(iso); return Number.isNaN(+d) ? '' : (withTime ? fmtT : fmt).format(d); },
      state, update, catalog, trade, add, active, tab,
      attempts: [...state.history, ...serverAttempts.filter((a) => !ids.has(a.id))].sort((a, b) => b.at.localeCompare(a.at)),
      go: (t, f = {}) => { setTab(t); setFocus(f); },
      focus,
    };
  }, [state, lang, update, catalog, trade, add, active, tab, serverAttempts, focus]);

  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const counts: Partial<Record<Tab, number>> = state ? { locker: state.items.length } : {};
  return (
    <div className="pv" style={{ ['--pv-accent' as string]: trade.accent }}>
      <header className="pv-head">
        <div className="pv-title">
          <span className="pv-lock"><LockIcon size={26} /></span>
          <div>
            <p className="pv-eyebrow">{L('Private', 'خاص')} · {owner.name[lang]}</p>
            <h1>{L('My private space', 'مساحتي الخاصة')}</h1>
            <p className="pv-sub">
              {L('Only you can see what is in here. Study, practise and compare at your own pace: nothing here is graded or shown to your trainer.',
                'لا يرى محتوى هذه المساحة أحد غيرك. ذاكر وتدرّب وقارن على راحتك: لا شيء هنا يُقيَّم أو يظهر لمدربك.')}
            </p>
          </div>
        </div>
        <p className={`pv-status is-${status}`} role="status">
          {status === 'loading' ? L('Opening…', 'جارٍ الفتح…')
            : status === 'saving' ? L('Saving…', 'جارٍ الحفظ…')
            : status === 'offline' ? L('Offline: changes are kept here and saved when you reconnect', 'غير متصل: التغييرات محفوظة هنا وستُرسل عند عودة الاتصال')
            : adapter.where === 'account' ? L('Saved to your account', 'محفوظ في حسابك') : L('Saved on this device', 'محفوظ على هذا الجهاز')}
        </p>
      </header>

      <nav className="pv-tabs" role="tablist" aria-label={L('Private space', 'المساحة الخاصة')}>
        {TABS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => ctx?.go(x.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={x.icon} /></svg>
            {L(x.en, x.ar)}
            {counts[x.id] ? <span className="pv-n">{counts[x.id]}</span> : null}
          </button>
        ))}
      </nav>

      {ctx ? (
        <Ctx.Provider value={ctx}>
          <div className="pv-body">
            {/* Each tab mounts on first visit and then stays, so a card session or a quiz survives a look at the locker. */}
            {seen.includes('desk') && <div hidden={tab !== 'desk'}><Desk /></div>}
            {seen.includes('study') && <div hidden={tab !== 'study'}><Study /></div>}
            {seen.includes('practice') && <div hidden={tab !== 'practice'}><Practice /></div>}
            {seen.includes('compare') && <div hidden={tab !== 'compare'}><Compare /></div>}
            {seen.includes('locker') && <div hidden={tab !== 'locker'}><Locker /></div>}
          </div>
        </Ctx.Provider>
      ) : <div className="pv-body pv-loading" aria-busy="true" />}
    </div>
  );
}
