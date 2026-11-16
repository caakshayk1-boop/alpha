/** "Why this stock?" (Tripwire 4.0, F4): the lead explainer of a company page, written by a TEMPLATE from the real values: the screen row, the engines' own evaluation, the factor sheet and the book's pick.
 *  No model text, no invented reason. A sentence whose value is missing is OMITTED, never filled, so a name with thin data gets a shorter explainer, never a wrong one. Pure. */
import type { Row } from './screen.ts';
import { pickFacts, type Fact } from './pickfacts.ts';
import type { EngineId } from './quant.ts';
import { FACTOR_META } from './intel.ts';
import { dayWord } from './fmt.ts';

export interface WhyPick { engine: EngineId; asOf: string; ref: number; stop: number }
export interface WhyIn {
  sym: string; row: Row | null | undefined;
  /** each engine's own verdict on the row today; null while it has not been computed (the sentence is then left out) */
  engines: { id: EngineId; name: string; pass: boolean }[] | null;
  /** the latest ledger pick on this name, if any */ pick: WhyPick | null;
  /** the factor sheet, if it carries this name */ factors: { universe: number; values: Record<string, number> } | null;
}
export interface WhyLine { id: 'rule' | 'values' | 'ranks' | 'invalidation'; text: string }
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inr = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const RANKED = ['mom12_1', 'near_high'] as const;

export function whyLines(i: WhyIn): WhyLine[] {
  const out: WhyLine[] = []; const r = i.row ?? null;
  if (i.pick) out.push({ id: 'rule', text: `The ${i.pick.engine} engine's rule fired on ${i.sym}: its latest pick was written at the close of ${dayWord(i.pick.asOf)}.` });
  else if (i.engines) { const ok = i.engines.filter((e) => e.pass); out.push({ id: 'rule', text: ok.length ? `${ok.map((e) => e.name).join(' and ')} pass${ok.length === 1 ? 'es' : ''} for ${i.sym} on the last screen. No pick has been written for it.` : `No engine rule passes for ${i.sym} on the last screen, so no pick has been written.` }); }
  const facts: Fact[] = i.pick && r ? pickFacts(i.pick.engine, r) : [];
  if (facts.length) out.push({ id: 'values', text: `The values behind it: ${facts.slice(0, 5).map((f) => `${f.k} ${f.v}`).join(', ')}.` });
  if (i.factors) {
    const rk = RANKED.filter((k) => num(i.factors!.values[k])).map((k) => `${FACTOR_META[k].label.toLowerCase()} ${Math.round(i.factors!.values[k])} of 100`);
    if (rk.length) out.push({ id: 'ranks', text: `Ranked among ${i.factors.universe} stocks: ${rk.join('; ')}.` });
  }
  if (i.pick && r && num(r.price) && r.price > 0 && i.pick.stop > 0) {
    const d = ((r.price - i.pick.stop) / r.price) * 100;
    out.push({ id: 'invalidation', text: d > 0 ? `What would end it: a fall to the stop at ${inr(i.pick.stop)}, which is ${d.toFixed(1)}% below the last price of ${inr(r.price)}. It is a paper stop, set when the pick was written.` : `The last price of ${inr(r.price)} is at or below the stop at ${inr(i.pick.stop)}; the paper position is judged on completed sessions, not on this price.` });
  }
  return out;
}
