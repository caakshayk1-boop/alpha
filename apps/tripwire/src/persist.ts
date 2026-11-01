/** Reading and writing the saved state, with the storage passed in so every failure can be tested without a browser.
 *
 *  What it guarantees (tests/persist.test.ts, tests/reliability.mjs):
 *    - A failed write (quota, a blocked or read-only store, a thrown error of any kind) is REPORTED with a reason; the caller keeps its in-memory state and can offer an export at once.
 *    - Unreadable saved data is never written over before a copy of it is kept. An earlier kept copy is not lost to a later one.
 *    - A store that cannot even be read leaves the caller on its in-memory state; it never replaces that state with the defaults.
 *    - Another tab's change is adopted only when this tab has nothing unsaved in memory. */
import { DEFAULTS, readSaved, type State } from './store.ts';

type Store = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;
export type SaveFailure = 'full' | 'blocked' | 'other';
export type SaveResult = { ok: true } | { ok: false; why: SaveFailure };
/** `QuotaExceededError` (and Firefox's NS_ERROR_DOM_QUOTA_REACHED) means full; a SecurityError means the browser blocks storage here; anything else is "other". */
export function classifySaveError(e: unknown): SaveFailure {
  const n = String((e as { name?: string })?.name ?? ''); const c = Number((e as { code?: number })?.code);
  if (/quota/i.test(n) || c === 22 || c === 1014) return 'full'; if (/security/i.test(n) || c === 18) return 'blocked'; return 'other';
}
export function saveState(store: Store | null, key: string, state: State): SaveResult {
  if (!store) return { ok: false, why: 'blocked' };
  try { store.setItem(key, JSON.stringify(state)); return { ok: true }; } catch (e) { return { ok: false, why: classifySaveError(e) }; }
}
export const SAVE_FAILURE_WORDS: Record<SaveFailure, string> = {
  full: 'this browser\'s storage is full',
  blocked: 'this browser is blocking storage here (private mode, or a setting)',
  other: 'this browser would not save it',
};
export interface Loaded { state: State; unreadable: boolean; /** the store could not be read at all */ blocked: boolean }
export function loadState(store: Store | null, key: string): Loaded {
  if (!store) return { state: DEFAULTS, unreadable: false, blocked: true };
  let text: string | null; try { text = store.getItem(key); } catch { return { state: DEFAULTS, unreadable: false, blocked: true }; }
  const r = readSaved(text);
  if (r.unreadable) keepUnreadable(store, key, text as string);
  return { state: r.state, unreadable: r.unreadable, blocked: false };
}
/** The copy of data that could not be read. The key is `${key}:unreadable`; a copy that is already there and differs moves to `${key}:unreadable:earlier` instead of being lost. Returns whether a copy was kept. */
export function keepUnreadable(store: Store, key: string, text: string): boolean {
  const k = `${key}:unreadable`;
  try {
    const have = store.getItem(k); if (have === text) return true;
    if (have) { try { store.setItem(`${k}:earlier`, have); } catch { /* the newer copy matters more */ } }
    store.setItem(k, text); return true;
  } catch { return false; }
}
export const readUnreadable = (store: Store | null, key: string): string | null => { try { return store?.getItem(`${key}:unreadable`) ?? null; } catch { return null; } };
/** Whether a "storage" event from another tab should replace this tab's state: only for this key (or a clear), and never while this tab holds changes the browser would not save. */
export const shouldAdoptStorageEvent = (e: { key: string | null }, key: string, persisted: boolean): boolean => (e.key === null || e.key === key) && persisted;
/** Write, read back and remove a test value: the proof that this browser keeps data, used by the status page. */
export function storageWorks(store: Store | null): boolean {
  if (!store) return false; const k = 'tripwire:probe';
  try { store.setItem(k, '1'); const ok = store.getItem(k) === '1'; try { store.removeItem?.(k); } catch { /* the value is harmless */ } return ok; } catch { return false; }
}
