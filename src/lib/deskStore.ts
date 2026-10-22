'use client';
/** The browser side of the one backup (lib/backup.ts): where each collection lives, how to read all of them at once for
 *  "Export everything", and how to write a merged import back so every open view updates. My Desk owns no store of its
 *  own: these are the same keys the company page, Today and the Screen already write. */
import { normaliseScreen, type CollectionId, type DeskState, type SavedScreen } from './backup';
import { parseJournal } from './journal';
import { CARDS_EVENT, CARDS_KEY, readCards } from './library';
import { REVIEW_KEY, type Snapshot } from './review';
import { announceStored } from './store';

export const DESK_KEYS: Record<CollectionId, string> = {
  watchlist: 'alpha-watchlist', cards: CARDS_KEY, journal: 'alpha-journal', conditions: 'alpha-conditions', screens: 'alpha-screen-saved', reviews: REVIEW_KEY,
};
export const LAST_EXPORT_KEY = 'alpha-last-export';

const json = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
export const parseScreens = (raw: string | null): SavedScreen[] => { try { const v = JSON.parse(raw ?? '[]'); return Array.isArray(v) ? v.map(normaliseScreen).filter((x): x is SavedScreen => !!x) : []; } catch { return []; } };

export function readDesk(): DeskState {
  const rv = json(REVIEW_KEY);
  let journal: DeskState['journal'] = [];
  try { journal = parseJournal(localStorage.getItem(DESK_KEYS.journal)); } catch { /* blocked */ }
  let screens: SavedScreen[] = [];
  try { screens = parseScreens(localStorage.getItem(DESK_KEYS.screens)); } catch { /* blocked */ }
  return {
    watchlist: strList(json(DESK_KEYS.watchlist)),
    cards: readCards().cards,
    journal,
    conditions: strList(json(DESK_KEYS.conditions)),
    screens,
    reviews: rv && typeof rv === 'object' && !Array.isArray(rv) ? (rv as Record<string, Snapshot>) : {},
  };
}

/** Write the named collections, verify each one was kept, and tell every view. Returns the collections that failed. */
export function writeDesk(next: DeskState, which: CollectionId[]): CollectionId[] {
  const failed: CollectionId[] = [];
  for (const c of which) {
    const key = DESK_KEYS[c];
    try {
      const text = JSON.stringify(next[c]);
      localStorage.setItem(key, text);
      if (localStorage.getItem(key) !== text) throw new Error('not kept');
    } catch { failed.push(c); continue; }
    if (c === 'cards') window.dispatchEvent(new Event(CARDS_EVENT));
    else if (c === 'reviews') window.dispatchEvent(new Event(REVIEW_KEY));
    else announceStored(key);
  }
  return failed;
}

export function readLastExport(): string | null { try { return localStorage.getItem(LAST_EXPORT_KEY); } catch { return null; } }
export function markExported(now = new Date()): string { const at = now.toISOString(); try { localStorage.setItem(LAST_EXPORT_KEY, at); window.dispatchEvent(new CustomEvent('alpha-store', { detail: LAST_EXPORT_KEY })); } catch { /* not recorded */ } return at; }

/** Hand the reader a file. Text only; the browser never opens it. */
export function downloadText(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
