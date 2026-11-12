/** "At a glance" (12 Nov 2026, owner: "a ONE-PAGER but smart info"): eight cells under the chart, each ONE fact with its basis and date. Every figure is read off a field or a helper
 *  the page already uses (trendOf, riskGradeOf, resultsDate, the screen row); no score, threshold or rule of its own. A figure the data does not hold is the WORD for its absence, never a zero.
 *  The cells say the figure; the disclosures below keep the method (the one-minute read keeps its sources and limits, the financial charts keep the years). */
import type { Company } from './data.ts';
import type { Row } from './screen.ts';
import { trendChecks, trendOf, TREND_WORD } from './screen.ts';
import { resultsDate } from './resultsdate.ts';
import { dayWord } from './fmt.ts';

export interface GlanceCell { id: 'range' | 'trend' | 'quality' | 'valuation' | 'size' | 'results' | 'ownership' | 'risk'; k: string; v: string; sub: string; tone: 'up' | 'down' | 'warn' | 'neutral'; /** 0..100 on the 52-week range, for the little meter */ at?: number | null }
export interface GlanceIn {
  c: { row: Row; inst?: Company['inst']; built_on?: string }; nowMs: number;
  /** the price the range position is worked from, and the 52-week low and high it is worked against (live when a live print moved them) */ px: number | null; lo: number | null; hi: number | null;
  fromHigh: number | null; /** 'live' | 'at close' | 'last traded' */ basisWord: string;
  /** the screen's own gates, from eligibility.ts: is ROCE meaningful here, is this a lender */ roceMeaningful: boolean; financial: boolean;
  riskLevel: string | null; riskNote: string | null; flagCount: number | null; stale: boolean;
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inr0 = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN');
const sgn = (v: number, dp = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}%`;

export function glanceOf(i: GlanceIn): GlanceCell[] {
  const r = i.c.row as Row; const out: GlanceCell[] = [];
  // 1. where the price sits in its 52-week range
  const span = num(i.lo) && num(i.hi) && i.hi > i.lo ? i.hi - i.lo : null; const at = span && num(i.px) ? Math.min(100, Math.max(0, ((i.px - i.lo!) / span) * 100)) : null;
  out.push(at === null ? { id: 'range', k: '52-week range', v: 'Not available', sub: 'The 52-week low or high is not held.', tone: 'neutral', at: null }
    : { id: 'range', k: '52-week range', v: `${Math.round(at)}% up the range`, sub: `${inr0(i.lo!)} to ${inr0(i.hi!)}${num(i.fromHigh) ? ` · ${sgn(i.fromHigh)} from high` : ''} · ${i.basisWord}`, tone: 'neutral', at });
  // 2. the trend, by the one rule, and the close it was tagged at
  const tr = trendOf(r); const ck = trendChecks(r); const held = ck && tr.trend ? (tr.trend === 'down' ? ck.down : ck.up).filter(([, ok]) => ok).length : null;
  out.push(tr.trend ? { id: 'trend', k: 'Trend', v: i.stale ? `${TREND_WORD[tr.trend]} · stale` : TREND_WORD[tr.trend], sub: `At the close of ${dayWord(r.last_date)} · ${held} of 4 rules hold${i.stale ? ' · close is older than a session' : ''}`, tone: i.stale ? 'neutral' : tr.trend === 'up' ? 'up' : tr.trend === 'down' ? 'down' : 'neutral' }
    : { id: 'trend', k: 'Trend', v: 'Not tagged', sub: 'A moving average or the 3-month return is missing.', tone: 'neutral' });
  // 3. quality: the median ROCE the one-minute read prints, only where the screen says it means something
  out.push(i.financial ? { id: 'quality', k: 'Return on capital', v: 'Not applicable', sub: 'Not measured for a lender; the screen does not judge it here.', tone: 'neutral' }
    : i.roceMeaningful && num(r.roce_med) ? { id: 'quality', k: 'Return on capital', v: `${r.roce_med.toFixed(1)}%`, sub: `Median ROCE · accounts ${r.fy ?? 'period unavailable'}`, tone: 'neutral' }
    : { id: 'quality', k: 'Return on capital', v: 'Not meaningful', sub: 'Withheld for this company; the reason is under Risks.', tone: 'neutral' });
  // 4. valuation against its own history (the percentile of the trailing PE), never against a target
  out.push(num(r.pe) && r.pe > 0 ? { id: 'valuation', k: 'Valuation', v: `PE ${r.pe.toFixed(1)}×`, sub: num(r.pe_pctile) ? `Higher than ${Math.round(r.pe_pctile)}% of its own past readings · close ${dayWord(r.last_date)}` : `Trailing, at the close of ${dayWord(r.last_date)} · no history held`, tone: 'neutral' }
    : { id: 'valuation', k: 'Valuation', v: 'No positive PE', sub: 'Trailing earnings are missing or not positive.', tone: 'neutral' });
  // 5. size and liquidity
  const tier = r.tier ? `${r.tier[0].toUpperCase()}${r.tier.slice(1)} cap` : 'Size not published';
  out.push({ id: 'size', k: 'Size and liquidity', v: tier, sub: num(r.turnover_cr) ? `${inr0(r.turnover_cr)} cr traded a day${r.liquid === false ? ' · thin' : r.liquid === true ? ' · liquid' : ''}` : 'Traded value not held', tone: 'neutral' });
  // 6. the results date, by resultsDate: a past estimate is never a next date
  const rd = resultsDate(r.next_earnings, i.nowMs);
  out.push({ id: 'results', k: 'Results date', v: rd.short, sub: rd.state === 'past' ? `Last supplied estimate ${dayWord(rd.date)}` : rd.state === 'missing' ? 'No date is published for this name' : 'As listed by the data provider; an estimate until reported', tone: rd.state === 'past' ? 'warn' : 'neutral' });
  // 7. who owns it: the three groups the shareholding pattern states
  const n = i.c.inst; const hold = n && [n.promoter, n.fii, n.dii].some(num);
  out.push(hold ? { id: 'ownership', k: 'Ownership', v: num(n!.promoter) ? `Promoter ${n!.promoter.toFixed(1)}%` : 'Promoter not stated', sub: `${num(n!.fii) ? `FII ${n!.fii.toFixed(1)}%` : 'FII not stated'} · ${num(n!.dii) ? `DII ${n!.dii.toFixed(1)}%` : 'DII not stated'}${n!.period ? ` · ${n!.period}` : ''}`, tone: 'neutral' }
    : { id: 'ownership', k: 'Ownership', v: 'Not available', sub: 'No shareholding pattern is held; nothing is estimated.', tone: 'neutral' });
  // 8. the screen's flag grade and how many flags it counted
  out.push(i.riskLevel ? { id: 'risk', k: 'Screen flags', v: `${i.riskLevel[0]}${i.riskLevel.slice(1).toLowerCase()}${i.flagCount == null ? '' : ` · ${i.flagCount} ${i.flagCount === 1 ? 'flag' : 'flags'}`}`, sub: 'Counts warnings on statements and trading; it forecasts nothing', tone: i.riskLevel.toUpperCase() === 'HIGH' ? 'warn' : 'neutral' }
    : { id: 'risk', k: 'Screen flags', v: 'Not graded', sub: i.riskNote ?? 'No flag grade is held for this name.', tone: 'neutral' });
  return out;
}
