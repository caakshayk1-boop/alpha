/** The engines' eligibility rule, as a VERSIONED, dated object. A change to it alters every percentile rank and every pick that follows, so it is never edited in
 *  place: a new version is added with the data day it takes effect from, and the ledger records which version wrote each night. Nights already recorded keep the
 *  version they were written under and are never re-run or re-scored (see ledger.ts: append-only).
 *
 *  elig-1  as built until 26 Oct 2026: the screen's liquid flag, a price, a measured ATR, not micro cap. An unpublished size class passed, there was no price
 *          floor, and the screen's liquid flag was trusted without reading the traded value. The written spec asked for more; the three gaps were decisions D1 to D3.
 *  elig-2  from the data day 27 Oct 2026. The written spec, applied as written:
 *            D1  the size class must be PUBLISHED and not micro. The feed publishes a class only for index-sized names, so "a class is published" is the nearest
 *                thing to "in the Nifty 500" the feed can show; an unpublished class is not shown to be in it, and is out.
 *            D2  the screen's traded value a day (turnover_cr) is at least ₹10 crore, on top of the liquid flag. The feed does not say whether that figure is a
 *                20-session median or a mean; the spec says median; the discrepancy is recorded here and not hidden.
 *            D3  the price is at least ₹50.
 *          The thresholds are the spec's, chosen before looking at what they remove. They have not been tuned and are not claimed to be better, only to be the rule
 *          the product says it follows. */
import type { Row } from './screen.ts';

export type RulesId = 'elig-1' | 'elig-2';
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export interface EligStep { id: string; label: string; pass: (r: Row & { atr_pct?: number | null }) => boolean }
export interface RulesDef { id: RulesId; from: string; summary: string; steps: EligStep[] }

const base: EligStep[] = [
  { id: 'liquid', label: 'Flagged liquid by the screen', pass: (r) => r.liquid === true },
  { id: 'priced', label: 'Has a price', pass: (r) => n(r.price) && r.price > 0 },
  { id: 'atr', label: 'Daily range (ATR) measured', pass: (r) => n(r.atr_pct) && r.atr_pct > 0 },
];
export const RULES: RulesDef[] = [
  { id: 'elig-1', from: '0000-00-00', summary: 'Liquid flag, a price, a measured ATR, not micro cap. An unpublished size class passed; no price floor; traded value not read.',
    steps: [...base, { id: 'notmicro', label: 'Not classed micro cap (an unpublished size class passes)', pass: (r) => r.tier !== 'micro' }] },
  { id: 'elig-2', from: '2026-10-27', summary: 'The written spec: a published size class that is not micro (D1), traded value at least ₹10 crore a day (D2), price at least ₹50 (D3), plus the elig-1 tests.',
    steps: [...base,
      { id: 'sized', label: 'Size class published and not micro (D1)', pass: (r) => r.tier === 'large' || r.tier === 'mid' || r.tier === 'small' },
      { id: 'turnover', label: 'Traded value a day at least ₹10 crore (D2)', pass: (r) => n(r.turnover_cr) && r.turnover_cr >= 10 },
      { id: 'floor', label: 'Price at least ₹50 (D3)', pass: (r) => n(r.price) && r.price >= 50 }] },
];
export const CURRENT_RULES: RulesId = 'elig-2';
export const rulesDef = (id: RulesId) => RULES.find((x) => x.id === id)!;
/** The version in force for a data day: the newest whose effective day is not after it. */
export const rulesFor = (asOf: string): RulesId => [...RULES].reverse().find((x) => asOf >= x.from)!.id;
export const stepsFor = (id: RulesId): EligStep[] => rulesDef(id).steps;
export const eligibleUnder = (r: Row & { atr_pct?: number | null }, id: RulesId): boolean => stepsFor(id).every((s) => s.pass(r));
/** A version name read from a stored record. Anything unrecognised, and every record written before versions existed, is elig-1. */
export const rulesOfRecord = (v: unknown): RulesId => (RULES.some((x) => x.id === v) ? (v as RulesId) : 'elig-1');
