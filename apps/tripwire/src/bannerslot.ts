/** The stale-data banner's slot. The banner answers "is the screen behind?", and that answer arrives with the screen feed, a second or two after the page is drawn. A banner that simply
 *  appears then pushes the whole view down (about 0.06 of layout shift on Today). So the slot is decided BEFORE the answer, from what this device saw last time, and the banner is never hidden:
 *    'show'    the feed has arrived and it is more than one session behind: the real banner.
 *    'reserve' the answer is still pending and the last one seen (or no last one) says the banner is likely: an invisible banner holds exactly its height, so nothing moves when it fills.
 *    'none'    the answer says no banner is needed (current, one session behind, unreadable, failed to load, or the device is offline and says so in its own banner).
 *  Pure: the page passes in what it knows. The remembered day is one date string, kept only to size the slot, never shown and never a substitute for the answer. */
import { sessionsBehind } from './freshness.ts';

export type BannerSlot = 'show' | 'reserve' | 'none';
export const HINT_KEY = 'tripwire:banner-hint';

/** Would the banner still be due today if the data stopped on `hintDay`? No remembered day means it is unknown, and unknown reserves (the safe side: an empty slot is calmer than a jump). */
export function hintSaysBanner(hintDay: string | null | undefined, now: number = Date.now()): boolean {
  if (!hintDay) return true;
  const b = sessionsBehind(hintDay, now); return b === null ? true : b > 1;
}
export function bannerSlot(i: { online: boolean; loading: boolean; hasData: boolean; behind: number | null; hintDay?: string | null; now?: number }): BannerSlot {
  if (!i.online) return 'none';
  if (i.hasData) return i.behind !== null && i.behind > 1 ? 'show' : 'none';
  if (i.loading) return hintSaysBanner(i.hintDay, i.now) ? 'reserve' : 'none';
  return 'none';
}
export function readHint(): string | null { try { return localStorage.getItem(HINT_KEY); } catch { return null; } }
export function writeHint(day: string | null | undefined): void { if (!day) return; try { localStorage.setItem(HINT_KEY, day); } catch { /* storage unavailable: the slot is simply reserved next time too */ } }
