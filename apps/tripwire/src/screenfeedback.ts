import { describeFilters, filterRows, NO_FILTER, trendOf, type Filters, type Row } from './screen.ts';
import { describeCond, figureOf, fmtMetric, metricOf } from './screener.ts';
export interface FilterFeedback { rule: string; actual: string; outcome: 'passed' | 'excluded' | 'ignored'; reason: string }
/** Explain each condition using the same evaluator as Discover. No second set of inclusion rules. */
export function explainScreen(row: Row, filters: Filters) {
  const checks: FilterFeedback[] = [];
  for (const key of ['q', 'sector', 'tier', 'value', 'quality', 'momentum', 'trend'] as const) {
    if (!filters[key]) continue;
    const f = { ...NO_FILTER, [key]: filters[key] }; const r = filterRows([row], f);
    const actual = key === 'q' ? `${row.sym} · ${row.name}` : key === 'sector' || key === 'tier' ? row[key] ?? 'Unavailable' : key === 'trend' ? trendOf(row).detail : key === 'value' ? `PE ${row.pe ?? 'unavailable'}` : key === 'quality' ? `Median ROCE ${row.roce_med ?? 'unavailable'}%` : filters.momentum === 'near-high' ? `From high ${row.from_high ?? 'unavailable'}%` : `vs Nifty, 3 months ${row.rs3m ?? 'unavailable'} pp`;
    checks.push({ rule: key === 'q' ? `Name contains “${filters.q}”` : describeFilters(f).join(' · '), actual, outcome: r.rows.length ? 'passed' : 'excluded', reason: r.notApplicable ? 'Ratio not applicable to this company.' : r.unmeasured ? 'A required figure is missing.' : r.rows.length ? 'Meets this condition.' : 'Does not meet this condition.' });
  }
  for (const c of filters.cond ?? []) {
    const f = figureOf(row, c.m); const result = filterRows([row], { ...NO_FILTER, cond: [c] });
    checks.push({ rule: describeCond(c), actual: f.k === 'value' ? fmtMetric(metricOf(c.m)!, f.v) : f.k === 'na' ? 'Not applicable' : 'Missing', outcome: result.unknownIncluded ? 'ignored' : result.rows.length ? 'passed' : 'excluded', reason: result.unknownIncluded ? 'Missing-value condition ignored because “include no figure” is enabled; this is not measured evidence.' : f.k === 'na' ? 'Not applicable, even when missing figures are allowed.' : f.k === 'missing' ? 'Missing data cannot pass this condition.' : result.rows.length ? 'Meets this condition.' : 'Outside the specified threshold.' });
  }
  return { matched: filterRows([row], filters).rows.length === 1, checks };
}
