/**
 * Trade registry. Order here is the order of the switcher. To add a trade,
 * create its file next to these and append it to the list.
 */
import { auto } from './auto';
import { cnc } from './cnc';
import { elec } from './elec';
import type { Trade, TradeId } from './types';
import { weld } from './weld';

export const TRADES: Trade[] = [cnc, auto, elec, weld];
export const tradeById = (id: TradeId): Trade => TRADES.find((t) => t.id === id) ?? TRADES[0]!;
export const isTradeId = (id: string): boolean => TRADES.some((t) => t.id === id);
export type { Trade, TradeId } from './types';
