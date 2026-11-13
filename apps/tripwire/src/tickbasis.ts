/** What a figure on screen is a reading OF, for the price cue (13 Nov 2026, v5). Pure: no DOM, no clock of its own.
 *
 *  `<Tick>` (live.tsx) compares a new reading with the previous one ON THE SAME BASIS and shows a directional halo only for that. A caller that does not say its basis reads as 'live', so a figure that
 *  switches from a live print to a recorded close (the session ends, the feed drops, a position falls back to its daily bar) used to look like a gain or a loss. Every call site now derives its basis here,
 *  from the same word or mark kind the page already prints beside the number, so the cue and the label cannot disagree.
 *
 *    live print (Live)                        -> basis 'live'
 *    delayed print (Delayed)                  -> basis 'live', state 'stale': a number, but not a fresh reading, so no pulse
 *    last close (Last traded, Not traded yet) -> basis 'recorded': no live movement; a change to or from 'live' is a neutral reveal
 *    no reading (Unavailable, null)           -> state 'missing': a status, never a value
 *    a total over several marks               -> 'live' when all are live prints, 'recorded' when none is, 'mixed' when they differ (a change of mix is a basis change, never a gain or a loss) */
import type { ObsState } from './flash.ts';
import { quoteWord, type QWord } from './stamp.ts';

export interface TickBasis { basis: string; state?: ObsState }
export type MarkKind = 'live' | 'close' | null | undefined;

/** The basis of a figure whose status word is already printed beside it (Live, Delayed, Last traded, Not traded yet, Unavailable). */
export function wordTick(word: QWord | null | undefined): TickBasis {
  if (word === 'Live') return { basis: 'live' };
  if (word === 'Delayed') return { basis: 'live', state: 'stale' };
  if (word === 'Last traded' || word === 'Not traded yet') return { basis: 'recorded', state: 'recorded' };
  return { basis: 'live', state: 'missing' };
}
/** The basis of a quote, from its print time. `nse` is false for the 24-hour instruments (gold, oil, Bitcoin, the rupee crosses). */
export const quoteTick = (printSec: number | null | undefined, nowMs: number, nse = true): TickBasis => wordTick(quoteWord(printSec, nowMs, { nse }));
/** The basis of one position's mark: a live print, or the last daily close (null is no mark at all). */
export function markTick(kind: MarkKind): TickBasis {
  return kind === 'live' ? { basis: 'live' } : kind === 'close' ? { basis: 'recorded', state: 'recorded' } : { basis: 'live', state: 'missing' };
}
/** The basis of a total over several marks, from how many are live prints and how many are at the close. */
export function countsTick(live: number, atClose: number): TickBasis {
  if (live > 0 && atClose === 0) return { basis: 'live' };
  if (live === 0 && atClose > 0) return { basis: 'recorded', state: 'recorded' };
  if (live > 0 && atClose > 0) return { basis: 'mixed' };
  return { basis: 'live', state: 'missing' };
}
export const marksTick = (kinds: readonly MarkKind[]): TickBasis => countsTick(kinds.filter((k) => k === 'live').length, kinds.filter((k) => k === 'close').length);
