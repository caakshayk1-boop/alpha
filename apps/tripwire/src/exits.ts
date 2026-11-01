/** Trading styles and their profit-booking ladders. One place, so the book, the tracker, the ledger and the screen print the same rules.
 *
 *  A style is a holding period. Each has two targets measured in units of risk (R = fill minus stop). The 30-position limit is shared by all styles.
 *  At Target 1 half the shares are sold and the stop on the rest moves up to the fill price (break-even before costs). At Target 2 the rest is sold.
 *  The stop and the time limit still end whatever is left. These multiples are chosen, not tested: the back-test never used targets.
 *  Picks written on or after POLICY_FROM trade under them from the start. From TARGETS_BACKFILL_ON (1 Nov 2026) the same ladder is also applied, from the
 *  entry bar, to every earlier pick that has not finished (open or waiting to enter): it was filed under a stop-and-time-only rule, but a ladder that never ran for it
 *  left a crossed target unbooked. A finished (closed or skipped) outcome is never re-evaluated, so no result already in the record is rewritten. */
export type Style = 'short' | 'swing' | 'long';
export interface StyleDef { id: Style; label: string; sessions: string; t1: number; t2: number }
export const STYLES: StyleDef[] = [
  { id: 'short', label: 'Short term', sessions: 'up to 10 sessions', t1: 1, t2: 2 },
  { id: 'swing', label: 'Swing', sessions: '11 to 30 sessions', t1: 1.5, t2: 3 },
  { id: 'long', label: 'Long term', sessions: 'over 30 sessions', t1: 2, t2: 4 },
];
export const POLICY_FROM = '2026-10-27';
/** The date the ladder was extended to the picks filed before POLICY_FROM that were still open or waiting to enter. No multiple, engine rule or threshold changed on this date. */
export const TARGETS_BACKFILL_ON = '2026-11-01';
export const styleDef = (s: Style) => STYLES.find((x) => x.id === s)!;
/** By the pick's own holding period, so a new engine lands in the right style without a list to remember. */
export const styleOf = (horizon: number): Style => (horizon <= 10 ? 'short' : horizon <= 30 ? 'swing' : 'long');
export interface Targets { style: Style; t1R: number; t2R: number }
/** The ladder a pick trades under. Filed on or after POLICY_FROM: always. Filed before it: the backfill ladder while the position is unfinished,
 *  and null once it has finished (`final`), because a finished result keeps the stop-and-time rule it was closed under and is never re-evaluated. */
export function targetsFor(pick: { asOf: string; horizon: number }, final = false): Targets | null {
  if (pick.asOf < POLICY_FROM && final) return null;
  const s = styleDef(styleOf(pick.horizon)); return { style: s.id, t1R: s.t1, t2R: s.t2 };
}
/** How the ladder relates to a pick: `filed` (live from the day it was written), `backfilled` (an earlier pick, still unfinished, traded under the ladder from its entry bar since TARGETS_BACKFILL_ON),
 *  or `reference` (an earlier pick that finished before the backfill: its levels are shown for orientation only and were never traded). */
export type TargetBasis = 'filed' | 'backfilled' | 'reference';
export const targetBasis = (pick: { asOf: string }, final = false): TargetBasis => (pick.asOf >= POLICY_FROM ? 'filed' : final ? 'reference' : 'backfilled');
export const REFERENCE_ONLY = 'reference only — predates target tracking';
