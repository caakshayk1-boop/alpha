/** What the published screen actually contains, counted from the rows themselves: how many companies, how many of each size class, how many are
 *  flagged liquid, how many carry the averages the trend rule needs, and how many the engines may consider. Every number on the Data screen is
 *  produced here from the same rows and the same predicates the engines use, so the page cannot say one thing while the engines do another.
 *
 *  What the feed does NOT publish, and this file therefore cannot state: the date of any index membership list, and how the liquid flag is defined. */
import { ELIG_STEPS, type Q } from './quant.ts';
import type { Row } from './screen.ts';

export interface Waterfall { label: string; id: string; removed: number; left: number }
export interface Conflict { id: string; title: string; spec: string; actual: string; count: number; decision: string }
export interface UniverseReport {
  total: number; asOf: string | null; builtOn: string | null;
  tiers: { large: number; mid: number; small: number; micro: number; unknown: number };
  /** large + mid + small: close to the size of the Nifty 500 (100 + 150 + 250). An inference from the counts, not a published membership list. */
  indexSized: number;
  liquid: number; notLiquid: number; withStatements: number; withAverages: number; liquidWithAverages: number;
  engineEligible: number; waterfall: Waterfall[]; financial: number;
  conflicts: Conflict[];
}
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function universeReport(rows: readonly Row[], asOf: string | null, builtOn: string | null): UniverseReport {
  const c = (f: (r: Row) => boolean) => rows.filter(f).length;
  const tiers = { large: c((r) => r.tier === 'large'), mid: c((r) => r.tier === 'mid'), small: c((r) => r.tier === 'small'), micro: c((r) => r.tier === 'micro'), unknown: c((r) => !r.tier) };
  let left = rows.length; let cur = rows as readonly Row[]; const waterfall: Waterfall[] = [];
  for (const s of ELIG_STEPS) { const next = cur.filter((r) => s.pass(r as Q)); waterfall.push({ id: s.id, label: s.label, removed: cur.length - next.length, left: next.length }); cur = next; left = next.length; }
  const liquid = c((r) => r.liquid === true); const hasAvg = (r: Row) => n(r.sma50) && r.sma50 > 0 && n(r.sma200) && r.sma200 > 0;
  const lowTurn = rows.filter((r) => r.liquid === true && n(r.turnover_cr) && r.turnover_cr < 10).length;
  const bigNotLiquid = rows.filter((r) => r.liquid !== true && n(r.turnover_cr) && r.turnover_cr >= 50).length;
  const unknownEligible = (cur as Row[]).filter((r) => !r.tier).length;
  const under50 = (cur as Row[]).filter((r) => n(r.price) && r.price < 50).length;
  const turnLow = (cur as Row[]).filter((r) => n(r.turnover_cr) && r.turnover_cr < 10).length;
  const conflicts: Conflict[] = [
    { id: 'D1', title: 'Size class', spec: 'The written spec says the engines consider the Nifty 500 and exclude micro caps.', actual: `${tiers.unknown} names carry no size class. The engines count them as not micro, so ${unknownEligible} of the ${left} eligible names have an unpublished size class.`, count: unknownEligible, decision: 'Decide whether an unpublished size class should pass. Changing it changes every percentile rank and tonight\'s picks, so it needs a versioned rule change, not a quiet edit.' },
    { id: 'D2', title: 'Liquidity', spec: 'The spec says liquid means a 20-session median traded value of at least ₹10 crore.', actual: `The engines use the screen's own liquid flag. ${lowTurn} flagged-liquid names show a traded value under ₹10 crore a day, and ${bigNotLiquid} unflagged names show ₹50 crore or more. The feed does not publish how the flag is defined.`, count: lowTurn, decision: 'Either publish the flag\'s definition or replace it with the written threshold (a versioned rule change).' },
    { id: 'D3', title: 'Price floor', spec: 'The spec says priced at ₹50 or more.', actual: `No price floor is applied. ${under50} eligible names trade under ₹50.`, count: under50, decision: 'Apply the floor or correct the spec (a versioned rule change).' },
  ];
  void turnLow;
  return { total: rows.length, asOf, builtOn, tiers, indexSized: tiers.large + tiers.mid + tiers.small, liquid, notLiquid: rows.length - liquid, withStatements: c((r) => r.has_stmts === true), withAverages: c(hasAvg),
    liquidWithAverages: c((r) => r.liquid === true && hasAvg(r)), engineEligible: left, waterfall, financial: c((r) => r.sector === 'Financial Services'), conflicts };
}
