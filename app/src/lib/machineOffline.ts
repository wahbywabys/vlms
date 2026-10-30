'use client';
/**
 * Wires the offline machine check (components/modules/offlinePack.ts) to this
 * app: downloads the pack through the /api/v1 bridge, and queues offline scans
 * in the IndexedDB outbox, which PwaRegister replays on reconnect.
 */
import jsQR from 'jsqr';
import type { FrameDecoder, MachineOffline } from '@/components/modules/MachineAccess';
import { decide, findMachine, loadPack, packExpired, refreshPack, type OfflinePack } from '@/components/modules/offlinePack';
import { flush, queueMutation } from '@/components/modules/outbox';
import { API_BASE, apiFetch } from './browserApi';

/** QR reading on browsers without BarcodeDetector (iPhone Safari, Firefox). */
export const decodeFrame: FrameDecoder = (f) => jsQR(f.data, f.width, f.height, { inversionAttempts: 'dontInvert' })?.data ?? null;

export const fetchPack = () => refreshPack(() => apiFetch<OfflinePack>('/safety/offline-pack'));

export async function recordScan(code: string, learnerId: string | undefined, allowed: boolean, pack: OfflinePack) {
  await queueMutation({ clientMutationId: crypto.randomUUID(), type: 'machine_scan', media: [],
    payload: { code, ...(learnerId ? { learnerId } : {}), scannedAt: new Date().toISOString(), offlineAllowed: allowed, packGeneratedAt: pack.generatedAt } });
  if (navigator.onLine) void flush(API_BASE).catch(() => undefined);
}

/** For a learner's own scans. */
export function learnerOffline(userId: string): MachineOffline {
  return {
    check: (code) => {
      const pack = loadPack(userId);
      if (!pack) return 'no_pack';
      const machine = findMachine(pack, code);
      if (!machine) return null;
      return { machine, decision: decide(pack, machine, userId), packAt: pack.generatedAt, expired: packExpired(pack) };
    },
    record: async (code, allowed) => { const pack = loadPack(userId); if (pack) await recordScan(code, undefined, allowed, pack); },
  };
}
