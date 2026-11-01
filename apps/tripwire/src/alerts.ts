/** Target-hit flags for the paper book: which positions had Target 1 or Target 2 fill in the last COMPLETED session.
 *
 *  This is a list computed from the book when the page (or the nightly job) runs. Nothing is sent to anyone: there is no notification channel, and no text here may say there is.
 *  A hit is flagged only if the bar that filled it is the last completed session's bar, so a flag is a fact about one named day and expires on its own. */
import type { Outcome } from './ledger.ts';
import { targetPrices } from './levels.ts';
import { dayWord } from './fmt.ts';
import { lastFinishedSession } from './calendar.ts';
import type { View } from './tracker.ts';

export interface HitAlert {
  /** the pick's id, so the same position is never listed twice */
  id: string; sym: string; engine: string; kind: 'T1' | 'T2';
  /** the target's price, and the price it actually filled at (a bar that gapped above the target fills at its open) */
  level: number; price: number;
  /** the India date of the session whose bar filled it */
  session: string;
  text: string;
}
export interface AlertInput { id: string; sym: string; engine: string; t1Day?: string | null; t1Level?: number | null; t1Px?: number | null; t2Day?: string | null; t2Level?: number | null; t2Px?: number | null }

export const T1_TEXT = 'T1 hit — half booked';
export const T2_TEXT = 'T2 hit — position closed';
const istDay = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);

/** The alerts for `session` (the last completed one). T2 first (it closed the position), then T1; ties by symbol. A target with no recorded level or fill price is not flagged: nothing is invented. */
export function hitAlerts(inputs: readonly AlertInput[], session: string): HitAlert[] {
  const out: HitAlert[] = [];
  for (const i of inputs) {
    if (i.t2Day === session && i.t2Level != null && i.t2Px != null) out.push({ id: i.id, sym: i.sym, engine: i.engine, kind: 'T2', level: i.t2Level, price: i.t2Px, session, text: T2_TEXT });
    if (i.t1Day === session && i.t1Level != null && i.t1Px != null) out.push({ id: i.id, sym: i.sym, engine: i.engine, kind: 'T1', level: i.t1Level, price: i.t1Px, session, text: T1_TEXT });
  }
  return out.sort((a, b) => (a.kind === b.kind ? a.sym.localeCompare(b.sym) || a.id.localeCompare(b.id) : a.kind === 'T2' ? -1 : 1));
}
/** Same thing for the clock: the last completed NSE session at `nowMs`. */
export const alertsNow = (inputs: readonly AlertInput[], nowMs = Date.now()): HitAlert[] => hitAlerts(inputs, lastFinishedSession(nowMs));

interface PickLike { id: string; sym: string; engine: string; asOf: string; ref: number; stop: number; horizon: number }
/** From a ledger outcome (the nightly job's own record of the ladder). The levels are the booked ones: the fill plus the style's multiples of R. */
export function inputFromOutcome(p: PickLike, o: Outcome | undefined): AlertInput {
  const base: AlertInput = { id: p.id, sym: p.sym, engine: p.engine };
  if (!o || (o.status !== 'open' && o.status !== 'closed') || o.entry == null) return base;
  const t = targetPrices({ asOf: p.asOf, horizon: p.horizon, ref: p.ref, stop: p.stop }, false, o.entry);
  if (!t || t.basis !== 'entry') return base;
  return { ...base, t1Day: o.t1Day ?? null, t1Level: t.t1, t1Px: o.t1Px ?? null, t2Day: o.t2Day ?? null, t2Level: t.t2, t2Px: o.t2Px ?? null };
}
/** From a live view (the browser's own replay of the bars, newer than the nightly file). Falls back to the ledger outcome for a position the ledger has already finished. */
export function inputFromRow(p: PickLike, v: View, o?: Outcome): AlertInput {
  const L = v.ladder; if (!L || (L.t1T == null && L.t2T == null)) return inputFromOutcome(p, o);
  return { id: p.id, sym: p.sym, engine: p.engine, t1Day: L.t1T != null ? istDay(L.t1T) : null, t1Level: L.t1, t1Px: L.t1Px ?? null, t2Day: L.t2T != null ? istDay(L.t2T) : null, t2Level: L.t2, t2Px: L.t2Px ?? null };
}
/** One line in words, for a log or a card. */
export const alertLine = (a: HitAlert): string => `${a.sym} (${a.engine}): ${a.text}. ${a.kind} ${a.level.toFixed(2)}, filled at ${a.price.toFixed(2)}, ${dayWord(a.session)}.`;
