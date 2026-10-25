/** Discover: filtering and sorting over the published screen rows. Missing is never zero: a row with no figure for a filter
 *  is excluded from that filter and counted, and sorts last in either direction. */
export interface Row {
  sym: string; name: string; sector?: string | null; tier?: string | null; price?: number | null; r1d?: number | null; r1w?: number | null; r1m?: number | null; r3m?: number | null; rs3m?: number | null;
  from_high?: number | null; high52?: number | null; low52?: number | null; sma20?: number | null; sma50?: number | null; sma200?: number | null; rsi?: number | null; vol_spike?: number | null;
  liquid?: boolean | null; turnover_cr?: number | null; pe?: number | null; pb?: number | null; roce_med?: number | null; rev_cagr?: number | null; eps_cagr?: number | null; de?: number | null;
  net_margin?: number | null; ebit_margin?: number | null; div_yield?: number | null; risk_lvl?: string | null; risk_top?: string | null; next_earnings?: string | null; last_date?: string | null; fy?: string | null; has_stmts?: boolean | null;
}
export interface Filters { q: string; sector: string; tier: string; value: '' | 'cheap' | 'rich'; quality: '' | 'high'; momentum: '' | 'strong' | 'weak' | 'near-high' }
export const NO_FILTER: Filters = { q: '', sector: '', tier: '', value: '', quality: '', momentum: '' };
export type SortKey = 'name' | 'r1d' | 'r3m' | 'rs3m' | 'pe' | 'roce_med' | 'from_high' | 'turnover_cr';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Banks and other lenders carry no meaningful debt-to-equity or capital-employed return; the screen's own rule. */
export const isLender = (r: Pick<Row, 'sector'>) => r.sector === 'Financial Services';

export function filterRows(rows: readonly Row[], f: Filters): { rows: Row[]; unmeasured: number } {
  const q = f.q.trim().toLowerCase();
  let unmeasured = 0;
  const out = rows.filter((r) => {
    if (q && !(r.sym.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))) return false;
    if (f.sector && r.sector !== f.sector) return false;
    if (f.tier && r.tier !== f.tier) return false;
    const need = (v: unknown) => { if (!num(v)) { unmeasured++; return false; } return true; };
    if (f.value === 'cheap') { if (!need(r.pe)) return false; if (!(r.pe! > 0 && r.pe! <= 15)) return false; }
    if (f.value === 'rich') { if (!need(r.pe)) return false; if (!(r.pe! >= 40)) return false; }
    if (f.quality === 'high') { if (isLender(r) || !need(r.roce_med)) return false; if (!(r.roce_med! >= 20)) return false; }
    if (f.momentum === 'strong') { if (!need(r.rs3m)) return false; if (!(r.rs3m! > 0)) return false; }
    if (f.momentum === 'weak') { if (!need(r.rs3m)) return false; if (!(r.rs3m! < 0)) return false; }
    if (f.momentum === 'near-high') { if (!need(r.from_high)) return false; if (!(r.from_high! >= -5)) return false; }
    return true;
  });
  return { rows: out, unmeasured };
}
export function sortRows(rows: readonly Row[], key: SortKey, dir: 'asc' | 'desc'): Row[] {
  const s = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return s * a.name.localeCompare(b.name);
    const x = a[key], y = b[key];
    if (!num(x) && !num(y)) return a.sym.localeCompare(b.sym);
    if (!num(x)) return 1;                       // missing last in either direction
    if (!num(y)) return -1;
    return x === y ? a.sym.localeCompare(b.sym) : s * (x - y);
  });
}
export const describeFilters = (f: Filters): string[] => [
  f.sector && `Sector: ${f.sector}`, f.tier && `Size: ${f.tier}`,
  f.value === 'cheap' && 'PE 15 or less', f.value === 'rich' && 'PE 40 or more', f.quality === 'high' && 'Median ROCE 20%+ (not lenders)',
  f.momentum === 'strong' && 'Ahead of the Nifty, 3 months', f.momentum === 'weak' && 'Behind the Nifty, 3 months', f.momentum === 'near-high' && 'Within 5% of the 52-week high',
].filter(Boolean) as string[];
