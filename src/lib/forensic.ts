/** Earnings-quality checks (Alpha Pro Blueprint §2.1, the measurable part). Eight pillars are specified; Alpha's statement
 *  data (four fiscal years of revenue, EBITDA, EBIT, PAT, CFO, FCF, ROCE, D/E) measures three of them exactly as written:
 *  F1 cumulative cash conversion, F3 free-cash-flow reality and F8 incremental return on capital. The other five need lines
 *  the feed does not carry (receivables, inventory and payables, promoter pledges, contingent liabilities, other income), so
 *  they are reported as NOT MEASURED, never estimated. With fewer than all eight measured there is no composite score and no
 *  "kill-switch": a score built on 40% of its weight would read as a full one. Not applied to lenders and insurers (the
 *  Blueprint excludes BFSI). Pure; tested in tests/lib.test.ts. */
import type { Year } from './types';

export type Light = 'GREEN' | 'AMBER' | 'RED';
export interface Pillar { id: string; name: string; weight: number; value: string | null; light: Light | null; rule: string; why: string; missing?: string }

const fin = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const sum = (xs: (number | null)[]) => (xs.every(fin) ? (xs as number[]).reduce((a, b) => a + b, 0) : null);
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** `years` newest first, as the shard holds them. */
export function earningsQuality(yearsNewestFirst: Year[], lender: boolean): { pillars: Pillar[]; measured: number; weightMeasured: number; applies: boolean } {
  const y3 = yearsNewestFirst.slice(0, 3);
  const pillars: Pillar[] = [];
  const has3 = y3.length === 3;
  // F1: sum CFO / sum EBITDA over three years
  {
    const cfo = has3 ? sum(y3.map((y) => y.cfo_cr)) : null, ebitda = has3 ? sum(y3.map((y) => y.ebitda_cr)) : null;
    const r = fin(cfo) && fin(ebitda) && ebitda > 0 ? cfo / ebitda : null;
    pillars.push({ id: 'F1', name: 'Cumulative cash conversion (3 years)', weight: 20, value: r === null ? null : pct(r), light: r === null ? null : r >= 0.75 ? 'GREEN' : r >= 0.5 ? 'AMBER' : 'RED',
      rule: 'Σ operating cash flow ÷ Σ EBITDA, last 3 fiscal years. Green ≥ 75%, amber 50–74%, red < 50%.', why: 'EBITDA that does not turn into operating cash can mean aggressive revenue recognition.', missing: r === null ? (has3 ? 'a cash-flow or EBITDA line is missing, or EBITDA is not positive' : 'fewer than 3 fiscal years on file') : undefined });
  }
  pillars.push({ id: 'F2', name: 'Receivables against sales', weight: 15, value: null, light: null, rule: '3-year receivables growth minus revenue growth, and days sales outstanding.', why: 'Debtors growing faster than sales can mean channel stuffing.', missing: 'receivables are not in Alpha’s statement data' });
  // F3: sum FCF / sum PAT over three years; red also when 3-year FCF is negative while leverage rose
  {
    const fcf = has3 ? sum(y3.map((y) => y.fcf_cr)) : null, pat = has3 ? sum(y3.map((y) => y.pat_cr)) : null;
    const r = fin(fcf) && fin(pat) && pat > 0 ? fcf / pat : null;
    const deUp = has3 && fin(y3[0].de) && fin(y3[2].de) && (y3[0].de as number) > (y3[2].de as number);
    const red = r !== null && (r < 0.2 || (fin(fcf) && fcf < 0 && deUp));
    pillars.push({ id: 'F3', name: 'Free-cash-flow reality (3 years)', weight: 15, value: r === null ? null : pct(r), light: r === null ? null : red ? 'RED' : r >= 0.55 ? 'GREEN' : 'AMBER',
      rule: 'Σ (operating cash flow − capex) ÷ Σ net profit, last 3 fiscal years. Green ≥ 55%, amber 20–54%, red < 20% or negative with debt/equity rising.', why: 'Profit that never becomes free cash may be propped up by capitalised costs or constant capex.', missing: r === null ? (has3 ? 'a free-cash-flow or profit line is missing, or profit is not positive' : 'fewer than 3 fiscal years on file') : undefined });
  }
  pillars.push({ id: 'F4', name: 'Cash conversion cycle drift', weight: 10, value: null, light: null, rule: 'Days inventory + receivables − payables, against its 3-year median.', why: 'Working capital deteriorates before margins do.', missing: 'inventory, receivables and payables are not in Alpha’s statement data' });
  pillars.push({ id: 'F5', name: 'Promoter pledge and holding change', weight: 15, value: null, light: null, rule: 'Pledged shares ÷ promoter holding, and the 4-quarter change in promoter %.', why: 'High pledges can force selling in a drawdown.', missing: 'pledge data is not in Alpha’s feeds (the ownership tab shows holdings only)' });
  pillars.push({ id: 'F6', name: 'Contingent liabilities to net worth', weight: 10, value: null, light: null, rule: '(Contingent liabilities + guarantees) ÷ tangible net worth.', why: 'Off-balance-sheet disputes and guarantees.', missing: 'contingent liabilities are not in Alpha’s statement data' });
  pillars.push({ id: 'F7', name: 'Non-operating profit dependency', weight: 10, value: null, light: null, rule: '(Other income + exceptional gains) ÷ profit before tax.', why: 'Separates core earnings from treasury income and one-offs.', missing: 'other income and exceptional items are not in Alpha’s statement data' });
  // F8: incremental return on invested capital, capital employed recovered as EBIT ÷ ROCE
  {
    const a = yearsNewestFirst[0], b = yearsNewestFirst[3];
    const ce = (y?: Year) => (y && fin(y.ebit_cr) && fin(y.roce) && y.roce > 0 ? y.ebit_cr / (y.roce / 100) : null);
    const cA = ce(a), cB = ce(b);
    const r = a && b && fin(a.ebit_cr) && fin(b.ebit_cr) && cA !== null && cB !== null && cA - cB > 0 ? (a.ebit_cr - b.ebit_cr) / (cA - cB) : null;
    pillars.push({ id: 'F8', name: 'Incremental return on capital (3 years)', weight: 5, value: r === null ? null : pct(r), light: r === null ? null : r >= 0.18 ? 'GREEN' : r >= 0.10 ? 'AMBER' : 'RED',
      rule: '(EBIT now − EBIT 3 years ago) ÷ (capital employed now − then); capital employed is EBIT ÷ ROCE. Green ≥ 18%, amber 10–17.9%, red < 10%.', why: 'Shows whether newly retained capital earns high returns or dilutes ROCE.', missing: r === null ? (b ? 'capital employed did not grow, or a line is missing' : 'fewer than 4 fiscal years on file') : undefined });
  }
  const measured = pillars.filter((p) => p.light !== null);
  return { pillars, measured: measured.length, weightMeasured: measured.reduce((s, p) => s + p.weight, 0), applies: !lender };
}
