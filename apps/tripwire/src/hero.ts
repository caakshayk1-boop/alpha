/** The first-visit line on Today: what Tripwire is, who runs it, and why the numbers can be checked. Dismissible. Pure, so the storage-denied path is a unit test.
 *  The dismissal is one flag in localStorage. When storage is denied the line is shown on every visit, and a dismissal still hides it for the rest of the session (a module-level
 *  flag; a reload of the page forgets it, which is the honest cost of having nowhere to write). Nothing here reads the clock. */
export const HERO_KEY = 'tripwire:hero-dismissed';
export const HERO_LINE = 'Rules that fire, evidence you can check — by Akshay, CA.';
export const HERO_NOTE = 'Paper-only research, not advice: no order is ever placed and nothing here is a recommendation.';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
let sessionDismissed = false;
/** For tests only: forget the in-memory dismissal. */
export function resetHeroSession(): void { sessionDismissed = false; }

function store(): Store | null { try { return localStorage; } catch { return null; } }
/** Is the line due? True on a first visit, and on every visit while storage is denied (until it is dismissed in this session). */
export function heroDue(s: Store | null = store()): boolean {
  if (sessionDismissed) return false;
  try { return !s || s.getItem(HERO_KEY) !== '1'; } catch { return true; }
}
/** Hide the line now, and remember it if the browser lets us. Returns whether it was written. */
export function dismissHero(s: Store | null = store()): boolean {
  sessionDismissed = true;
  try { if (!s) return false; s.setItem(HERO_KEY, '1'); return true; } catch { return false; }
}
