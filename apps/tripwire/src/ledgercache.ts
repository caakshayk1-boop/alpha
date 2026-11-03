/** Last published position record, independent of price fetches and device entry settings. */
import type { Ledger } from './ledger.ts';
export const LEDGER_CACHE_KEY = 'tripwire.ledger.last-good.v1';
export function validLedger(value: unknown): value is Ledger {
  if (!value || typeof value !== 'object') return false;
  const l = value as Ledger;
  return l.schema === 'tripwire-ledger/1' && Number.isFinite(Date.parse(l.updated)) && Array.isArray(l.days) && Array.isArray(l.picks) && !!l.outcomes && typeof l.outcomes === 'object'
    && l.picks.every((p) => p && typeof p.id === 'string' && typeof p.sym === 'string' && p.ref > 0 && p.stop > 0 && p.horizon > 0);
}
export function readLedgerCache(storage: Pick<Storage, 'getItem'>): Ledger | null {
  try { const l: unknown = JSON.parse(storage.getItem(LEDGER_CACHE_KEY) ?? 'null'); return validLedger(l) ? l : null; } catch { return null; }
}
export function writeLedgerCache(storage: Pick<Storage, 'getItem' | 'setItem'>, l: Ledger): void {
  if (!validLedger(l)) return;
  try { const old = readLedgerCache(storage); if (!old || old.updated <= l.updated) storage.setItem(LEDGER_CACHE_KEY, JSON.stringify(l)); } catch { /* Storage failure never changes positions in memory. */ }
}
