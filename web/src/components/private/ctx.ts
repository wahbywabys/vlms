import { createContext, useContext } from 'react';
import type { Txt } from '../../models/kit';
import type { AttemptRecord, Catalog, CatalogTrade, LockerDrop, LockerItem, PrivateState } from './model';

export type Tab = 'desk' | 'study' | 'practice' | 'compare' | 'locker';

export interface PrivateCtx {
  lang: 'en' | 'ar';
  L: (en: string, ar: string) => string;
  pick: (t: Txt | undefined) => string;
  date: (iso: string, withTime?: boolean) => string;
  state: PrivateState;
  update: (f: (s: PrivateState) => PrivateState) => void;
  catalog: Catalog;
  /** The student's own trade. */
  trade: CatalogTrade;
  /** Private history plus attempts the server holds (V-Lab), newest first. */
  attempts: AttemptRecord[];
  /** Put something in the locker from inside the space; confirms with the toast. */
  add: (d: LockerDrop) => LockerItem;
  go: (t: Tab, focus?: { part?: string; item?: string; compare?: string }) => void;
  focus: { part?: string; item?: string; compare?: string };
  active: boolean;
  tab: Tab;
}

export const Ctx = createContext<PrivateCtx | null>(null);
export const usePv = () => useContext(Ctx)!;
