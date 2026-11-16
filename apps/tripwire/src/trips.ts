/** Watchlist Trips (Tripwire 4.0, F7): for each followed name, where it stands against the latest screen and the paper book, with the date it was judged on.
 *  Pure and offline: it reads the screen rows and ledger the page already holds, sends nothing anywhere, and the watchlist itself is the local follow list (this device only).
 *  A state is display vocabulary over existing facts; it creates no signal and changes no rule.
 *    stopped         the name's latest book position closed at its stop and nothing newer is running
 *    at T1           the latest book position has filled Target 1 and is still open
 *    tripped entry   the latest book position is open or awaiting its entry, Target 1 not yet filled
 *    in base         no position, the trend tag says sideways, and the price is above its 200-day average (a rest above the long trend, not a signal)
 *    no signal       none of the above, or the figures to say are missing */
import { trendOf, type Row } from './screen.ts';
import type { Ledger, Outcome } from './ledger.ts';
import type { AutoPlan } from './autobook.ts';
import { dayWord } from './fmt.ts';

export type Trip = 'stopped' | 'at T1' | 'tripped entry' | 'in base' | 'no signal';
export interface TripRow { sym: string; name: string | null; state: Trip; /** the date the state was judged on: the ledger session for a book state, the screen date for the rest */ asOf: string | null; /** one plain sentence saying why */ why: string }
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function tripsOf(syms: readonly string[], rows: readonly Row[], screenAsOf: string | null, ledger: Ledger | null, plan: Pick<AutoPlan, 'taken'> | null): TripRow[] {
  return syms.map((sym): TripRow => {
    const row = rows.find((r) => r.sym === sym) ?? null; const name = row?.name ?? null;
    const mine = plan && ledger ? plan.taken.filter((t) => t.pick.sym === sym).sort((a, b) => b.pick.asOf.localeCompare(a.pick.asOf) || b.pick.id.localeCompare(a.pick.id)) : [];
    const t = mine[0]; const o: Outcome | undefined = t && ledger ? ledger.outcomes[t.pick.id] : undefined;
    const seen = o?.markDay ?? t?.pick.asOf ?? null;
    if (t && o) {
      if (o.status === 'closed' && /stop/i.test(o.reason ?? '') && !o.t1Hit) return { sym, name, state: 'stopped', asOf: o.exitDay ?? seen, why: `${t.pick.engine} position stopped out on ${o.exitDay ? dayWord(o.exitDay) : 'a recorded session'}${typeof o.r === 'number' ? ` at ${o.r > 0 ? '+' : o.r < 0 ? '−' : ''}${Math.abs(o.r).toFixed(2)}R` : ''}.` };
      if (o.status === 'open' && o.t1Hit) return { sym, name, state: 'at T1', asOf: seen, why: `${t.pick.engine} position filled Target 1${o.t1Day ? ` on ${dayWord(o.t1Day)}` : ''}; half is sold and the stop is at the entry price.` };
      if (o.status === 'open' || o.status === 'pending') return { sym, name, state: 'tripped entry', asOf: seen, why: o.status === 'open' ? `${t.pick.engine} position entered${o.entryDay ? ` on ${dayWord(o.entryDay)}` : ''}; Target 1 not yet filled.` : `${t.pick.engine} pick written at the close of ${dayWord(t.pick.asOf)}; awaiting its entry at the next open.` };
    } else if (t && !o) return { sym, name, state: 'tripped entry', asOf: t.pick.asOf, why: `${t.pick.engine} pick written at the close of ${dayWord(t.pick.asOf)}; awaiting its entry at the next open.` };
    if (row && num(row.price) && num(row.sma200)) {
      const tr = trendOf(row).trend;
      if (tr === 'mixed' && row.price > row.sma200) return { sym, name, state: 'in base', asOf: screenAsOf, why: 'Sideways trend and the price is above its 200-day average. No pick has fired.' };
      return { sym, name, state: 'no signal', asOf: screenAsOf, why: 'No pick has fired and the trend is not a sideways rest above the 200-day average.' };
    }
    return { sym, name, state: 'no signal', asOf: screenAsOf, why: row ? 'The figures to judge it are missing on the last screen.' : 'Not in the last screen.' };
  });
}
