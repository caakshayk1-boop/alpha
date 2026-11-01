/** ORIGINAL versus RESTATED, from the provenance the record already holds. Pure: no React, no clock. Nothing here creates, edits or estimates a result.
 *
 *  What exists to go on, and only this: each pick's data day (`asOf`), the dated rule versions (POLICY_FROM 27 Oct 2026 for the profit ladder; TARGETS_BACKFILL_ON 1 Nov 2026 when the ladder was applied
 *  to earlier picks that had not finished; elig-1/elig-2 and book-1/book-2 by night), and whether an outcome carries ladder fields (they exist only when the ladder was run for it).
 *  There is NO stored "result before the restatement", so a restated position's earlier figure is not shown and is not reconstructed: it is labelled, not paired with an invented number.
 *
 *    as filed   written on or after POLICY_FROM: it traded under the ladder from its first night. Nothing was restated.
 *    original   written before POLICY_FROM and finished without the ladder: it keeps the stop-and-time rule it was closed under and was never re-evaluated. Its ladder levels are reference only.
 *    restated   written before POLICY_FROM and still unfinished on TARGETS_BACKFILL_ON (or finished since, with ladder fields): the ladder has been applied to it from its entry bar, so its result is under
 *               the restated rule, not the one it was filed under. A closed result is never rewritten; this one was not closed when the rule was extended.
 *  Wording is pinned by tests/provenance.test.ts. */
import { POLICY_FROM, TARGETS_BACKFILL_ON } from './exits.ts';
import { bookRulesOf } from './autobook.ts';
import { rulesFor } from './rules.ts';
import { dayWord } from './fmt.ts';
import type { Ledger, LedgerPick, Outcome } from './ledger.ts';
import { RETIRED } from './ledger.ts';

export type ResultBasis = 'as-filed' | 'original' | 'restated';
export interface Basis { basis: ResultBasis; short: string; line: string; rules: string }
const WORD: Record<ResultBasis, string> = { 'as-filed': 'As filed', original: 'Original rule', restated: 'Restated rule' };

/** `final`: the outcome is finished (closed or skipped). `outcome`: lets a finished early pick that carries ladder fields (closed after the extension) read as restated. */
export function resultBasis(pick: { asOf: string }, final: boolean, outcome?: Pick<Outcome, 't1Hit' | 't2Hit'> | null): Basis {
  const rules = `${rulesFor(pick.asOf)} · ${bookRulesOf(pick.asOf)}`;
  if (pick.asOf >= POLICY_FROM) return { basis: 'as-filed', short: WORD['as-filed'], rules, line: `Filed under the profit-booking ladder from its first night (written ${dayWord(pick.asOf)}, on or after ${dayWord(POLICY_FROM)}). Nothing about it was restated.` };
  const laddered = !final || (outcome != null && (outcome.t1Hit !== undefined || outcome.t2Hit !== undefined));
  if (laddered) return { basis: 'restated', short: WORD.restated, rules, line: `Filed ${dayWord(pick.asOf)} under stop-and-time only. On ${dayWord(TARGETS_BACKFILL_ON)} the profit-booking ladder was applied to it from its entry bar because it had not finished, so its result is under the restated rule. No finished result was changed, and its earlier figure is not stored, so none is shown.` };
  return { basis: 'original', short: WORD.original, rules, line: `Filed ${dayWord(pick.asOf)} and finished under stop-and-time only, before the ladder reached earlier picks. It was never re-evaluated; its T1 and T2 are reference levels, not traded.` };
}
export interface BasisCounts { asFiled: number; original: number; restated: number; total: number }
/** Counts the CLOSED, counted results (the ones in the record's totals) by the rule they were produced under. Voided picks and retired engines are out, as in every total. */
export function basisCounts(l: Ledger): BasisCounts {
  const c: BasisCounts = { asFiled: 0, original: 0, restated: 0, total: 0 };
  for (const p of l.picks as LedgerPick[]) {
    if (l.voided?.[p.id] || RETIRED.has(p.engine)) continue; const o = l.outcomes[p.id]; if (!o || o.status !== 'closed' || typeof o.r !== 'number') continue;
    const b = resultBasis(p, true, o).basis; c.total++; if (b === 'as-filed') c.asFiled++; else if (b === 'restated') c.restated++; else c.original++;
  }
  return c;
}
/** One sentence for the Record: how the closed results split by rule, and the warning that the split is not like-for-like when it is mixed. Null when nothing has closed. */
export function basisLine(c: BasisCounts): string | null {
  if (!c.total) return null;
  const parts = [c.asFiled ? `${c.asFiled} as filed` : '', c.restated ? `${c.restated} restated` : '', c.original ? `${c.original} original rule` : ''].filter(Boolean).join(', ');
  const mixed = [c.asFiled, c.restated, c.original].filter((n) => n > 0).length > 1;
  return `Of ${c.total} closed result${c.total === 1 ? '' : 's'}: ${parts}.${mixed ? ` They were produced under different exit rules (stop-and-time, then the profit-booking ladder from ${dayWord(POLICY_FROM)}), so the total R mixes rules and is not like-for-like.` : ''}`;
}
