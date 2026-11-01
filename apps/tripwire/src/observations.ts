/** REPEATED OBSERVATIONS versus INDEPENDENT POSITIONS. Pure: no React, no clock.
 *
 *  The nightly record writes down every pick of every engine, every night, whether or not anyone takes it. That is a count of OBSERVATIONS ("on this night this engine named this company"). A company that
 *  keeps passing a rule is named again the next night, and by a second engine: those are repeated looks at one setup, not new, independent bets. The record replays every observation on its own, so
 *  its closed outcomes are counted per observation and two of them on the same company can overlap in time. The paper book is different: it holds a company once at a time, so its POSITIONS are the
 *  independent ones. Neither number is wrong; they answer different questions, and this module is the one place that counts both, so every screen can say which is which.
 *  Voided picks and retired engines are out of every figure, exactly as in `summarizeLedger`. Nothing is estimated: every number is a count of rows the ledger holds. */
import type { Ledger } from './ledger.ts';
import { RETIRED } from './ledger.ts';
import type { AutoPlan } from './autobook.ts';

export interface Observations {
  /** picks written down (one per engine, company and night) */
  observations: number;
  /** distinct companies those observations name */
  names: number;
  /** observations beyond the first for the same company */
  repeats: number;
  nights: number;
  /** positions the paper book took: one company at a time, so these are the independent ones */
  positions: number;
  /** observations the book did not take as a position (a company already held, a full book, a sector cap, a ticket too small) */
  notTaken: number;
  /** observations whose replay has closed with an R, and how many distinct companies they cover */
  closedObservations: number; closedNames: number;
  /** the companies named most often, most first (ties by symbol) */
  top: { sym: string; n: number }[];
}
export function observationsOf(l: Ledger, plan: Pick<AutoPlan, 'taken'> | null): Observations {
  const ps = l.picks.filter((p) => !l.voided?.[p.id] && !RETIRED.has(p.engine));
  const count = new Map<string, number>(); for (const p of ps) count.set(p.sym, (count.get(p.sym) ?? 0) + 1);
  const closed = ps.filter((p) => { const o = l.outcomes[p.id]; return !!o && o.status === 'closed' && typeof o.r === 'number'; });
  const positions = plan ? plan.taken.length : 0;
  return {
    observations: ps.length, names: count.size, repeats: ps.length - count.size, nights: new Set(ps.map((p) => p.asOf)).size,
    positions, notTaken: plan ? Math.max(0, ps.length - positions) : 0,
    closedObservations: closed.length, closedNames: new Set(closed.map((p) => p.sym)).size,
    top: [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([sym, n]) => ({ sym, n })),
  };
}
const pl = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
/** The two counts in one place, in words. `plan` null (the book could not be read) leaves the position half out rather than guessing it. */
export function observationLines(o: Observations, hasPlan = true): { observed: string; positions: string | null; outcomes: string } {
  const rep = o.repeats > 0 ? ` ${pl(o.repeats, 'observation is a repeat', 'observations are repeats')} of a company already named earlier${o.top.length ? ` (${o.top.map((t) => `${t.sym} ${t.n} times`).join(', ')})` : ''}.` : ' None repeats a company.';
  return {
    observed: `${pl(o.observations, 'pick observation')} over ${pl(o.nights, 'night')} name ${pl(o.names, 'company', 'companies')}.${rep} An observation is one engine naming one company on one night; a repeat is another look at the same setup, not a new independent bet.`,
    positions: hasPlan ? `The paper book holds a company once at a time, so its ${pl(o.positions, 'position')} are the independent ones; the other ${o.notTaken.toLocaleString('en-IN')} observations were not taken as positions (a company already held, a full book, a sector limit, or a share price above the ticket).` : null,
    outcomes: `Closed outcomes are counted per observation: ${pl(o.closedObservations, 'closed outcome')} cover ${pl(o.closedNames, 'company', 'companies')}. Two outcomes on the same company can overlap in time, so they are not independent trials.`,
  };
}
