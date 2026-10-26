/** Trading styles and their profit-booking ladders. One place, so the book, the tracker, the ledger and the screen print the same rules.
 *
 *  A style is a holding period. Each has two targets measured in units of risk (R = fill minus stop) and a sleeve of the 30-position book.
 *  At Target 1 half the shares are sold and the stop on the rest moves up to the fill price (break-even before costs). At Target 2 the rest is sold.
 *  The stop and the time limit still end whatever is left. These multiples are chosen, not tested: the back-test never used targets.
 *  They are applied only to picks written on or after POLICY_FROM, so no result already in the record is rewritten. */
export type Style = 'short' | 'swing' | 'long';
export interface StyleDef { id: Style; label: string; sessions: string; t1: number; t2: number; cap: number }
export const STYLES: StyleDef[] = [
  { id: 'short', label: 'Short term', sessions: 'up to 10 sessions', t1: 1, t2: 2, cap: 10 },
  { id: 'swing', label: 'Swing', sessions: '11 to 30 sessions', t1: 1.5, t2: 3, cap: 10 },
  { id: 'long', label: 'Long term', sessions: 'over 30 sessions', t1: 2, t2: 4, cap: 10 },
];
export const POLICY_FROM = '2026-10-27';
export const styleDef = (s: Style) => STYLES.find((x) => x.id === s)!;
/** By the pick's own holding period, so a new engine lands in the right sleeve without a list to remember. */
export const styleOf = (horizon: number): Style => (horizon <= 10 ? 'short' : horizon <= 30 ? 'swing' : 'long');
export interface Targets { style: Style; t1R: number; t2R: number }
/** The ladder a pick trades under, or null for a pick written before the policy began (it keeps the stop and time rules it was filed under). */
export function targetsFor(pick: { asOf: string; horizon: number }): Targets | null {
  if (pick.asOf < POLICY_FROM) return null;
  const s = styleDef(styleOf(pick.horizon)); return { style: s.id, t1R: s.t1, t2R: s.t2 };
}
