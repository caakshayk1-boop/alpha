/** What the published screen actually contains, counted from the rows themselves: how many companies, how many of each size class, how many are
 *  flagged liquid, how many carry the averages the trend rule needs, and how many the engines may consider. Every number on the Data screen is
 *  produced here from the same rows and the same predicates the engines use, so the page cannot say one thing while the engines do another.
 *
 *  What the feed does NOT publish, and this file therefore cannot state: the date of any index membership list, and how the liquid flag is defined. */
import type { Q } from './quant.ts';
import { CURRENT_RULES, eligibleUnder, rulesDef, rulesFor, stepsFor, type RulesId } from './rules.ts';
import type { Row } from './screen.ts';

export interface Waterfall { label: string; id: string; removed: number; left: number }
export interface Conflict { id: string; title: string; spec: string; actual: string; /** names the elig-1 rule admitted that this test removes */ count: number; decision: string; resolvedIn: RulesId; from: string }
export interface UniverseReport {
  total: number; asOf: string | null; builtOn: string | null;
  tiers: { large: number; mid: number; small: number; micro: number; unknown: number };
  /** large + mid + small: close to the size of the Nifty 500 (100 + 150 + 250). An inference from the counts, not a published membership list. */
  indexSized: number;
  liquid: number; notLiquid: number; withStatements: number; withAverages: number; liquidWithAverages: number;
  engineEligible: number; /** how many the previous rule version would have admitted on the same rows */ engineEligibleElig1: number; rules: RulesId; rulesFrom: string; rulesSummary: string; waterfall: Waterfall[]; financial: number;
  conflicts: Conflict[];
}
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function universeReport(rows: readonly Row[], asOf: string | null, builtOn: string | null, rules: RulesId = asOf ? rulesFor(asOf) : CURRENT_RULES): UniverseReport {
  const c = (f: (r: Row) => boolean) => rows.filter(f).length;
  const tiers = { large: c((r) => r.tier === 'large'), mid: c((r) => r.tier === 'mid'), small: c((r) => r.tier === 'small'), micro: c((r) => r.tier === 'micro'), unknown: c((r) => !r.tier) };
  let left = rows.length; let cur = rows as readonly Row[]; const waterfall: Waterfall[] = [];
  for (const s of stepsFor(rules)) { const next = cur.filter((r) => s.pass(r as Q)); waterfall.push({ id: s.id, label: s.label, removed: cur.length - next.length, left: next.length }); cur = next; left = next.length; }
  const liquid = c((r) => r.liquid === true); const hasAvg = (r: Row) => n(r.sma50) && r.sma50 > 0 && n(r.sma200) && r.sma200 > 0;
  const v1 = rows.filter((r) => eligibleUnder(r as Q, 'elig-1'));
  const d1 = v1.filter((r) => !(r.tier === 'large' || r.tier === 'mid' || r.tier === 'small')).length;
  const d2 = v1.filter((r) => !(n(r.turnover_cr) && r.turnover_cr >= 10)).length;
  const d3 = v1.filter((r) => !(n(r.price) && r.price >= 50)).length;
  const e2 = rulesDef('elig-2'); const from = e2.from;
  const conflicts: Conflict[] = [
    { id: 'D1', title: 'Size class', spec: 'The spec: the engines consider the Nifty 500 and exclude micro caps.', actual: `The feed publishes a size class only for index-sized names. Under elig-1 the ${tiers.unknown} names with no class passed as "not micro"; ${d1} of them were engine-eligible.`, count: d1, decision: `Resolved in ${e2.id} from ${from}: the class must be published and not micro.`, resolvedIn: 'elig-2', from },
    { id: 'D2', title: 'Liquidity', spec: 'The spec: liquid means a traded value of at least ₹10 crore a day (20-session median).', actual: `elig-1 trusted the screen's liquid flag without reading the figure; ${d2} flagged-liquid, engine-eligible names showed under ₹10 crore a day. The feed does not say whether its figure is a median or a mean.`, count: d2, decision: `Resolved in ${e2.id} from ${from}: traded value a day, as published, at least ₹10 crore, on top of the flag.`, resolvedIn: 'elig-2', from },
    { id: 'D3', title: 'Price floor', spec: 'The spec: priced at ₹50 or more.', actual: `elig-1 applied no floor; ${d3} engine-eligible names traded under ₹50.`, count: d3, decision: `Resolved in ${e2.id} from ${from}: price at least ₹50.`, resolvedIn: 'elig-2', from },
  ];
  return { total: rows.length, asOf, builtOn, tiers, indexSized: tiers.large + tiers.mid + tiers.small, liquid, notLiquid: rows.length - liquid, withStatements: c((r) => r.has_stmts === true), withAverages: c(hasAvg),
    liquidWithAverages: c((r) => r.liquid === true && hasAvg(r)), engineEligible: left, engineEligibleElig1: v1.length, rules, rulesFrom: rulesDef(rules).from, rulesSummary: rulesDef(rules).summary, waterfall, financial: c((r) => r.sector === 'Financial Services'), conflicts };
}
