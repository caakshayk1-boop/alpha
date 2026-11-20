/** The owner's daily feed, loaded once at build. A missing value is an ABSENT key; every accessor returns null for it and nothing is ever defaulted to zero.
 *  The feed's verdict (`vd`) and trade ladder (`lad`) are removed at fetch time and never shown (ADR-010). */
import { readFileSync, existsSync } from 'node:fs'; import { join } from 'node:path';
export type Row = Record<string, any>;
export interface Feed { rows: Row[]; bySym: Map<string, Row>; detail: Record<string, any>; swot: Record<string, any>; season: any; meta: Row; asOf: string; builtOn: string }
const DIR = process.env.RULEBOOK_FEED_DIR || join(process.cwd(), 'feed');
let cache: Feed | null = null;
export const feedAvailable = () => existsSync(join(DIR, 'screen.json'));
/** L-01 (20 Nov 2026): 14 companies carry no market cap in the source row, which put names such as TCS outside every screen's 2,000 crore gate. Where the row has a close and the newest financial year has a positive net profit and EPS,
 *  market cap = close × net profit ÷ EPS (net profit ÷ EPS is the share count; ₹ crore throughout). The row is marked `mcap_src: 'derived'` so every page can say so; a source value is never replaced; with any input missing the cap stays missing. */
export function deriveMcap(rows: Row[], detail: Record<string, any>): number {
  let n = 0;
  for (const r of rows) {
    if (num(r, 'mcap_cr') != null) continue;
    const px = num(r, 'price'), y = Array.isArray(detail?.[r.sym]?.years) ? detail[r.sym].years[0] : null, pat = y?.pat_cr, eps = y?.eps;
    if (px == null || px <= 0 || typeof pat !== 'number' || typeof eps !== 'number' || !(pat > 0) || !(eps > 0)) continue;
    const cap = (px * pat) / eps; if (!Number.isFinite(cap) || cap <= 0) continue;
    r.mcap_cr = cap; r.mcap_src = 'derived'; n++;
  }
  return n;
}
export function loadFeed(): Feed {
  if (cache) return cache; const rd = (f: string) => JSON.parse(readFileSync(join(DIR, f), 'utf8')); const s = rd('screen.json');
  const rows: Row[] = s.rows.slice().sort((a: Row, b: Row) => a.sym.localeCompare(b.sym));
  const detail = rd('detail.json').detail; deriveMcap(rows, detail);
  const changes = rows.map(r => num(r, 'r1d')).filter((v): v is number => v !== null);
  const averages = rows.filter(r => num(r, 'price') !== null && num(r, 'sma200') !== null && r.sma200 > 0);
  const above = averages.filter(r => r.price > r.sma200).length;
  s.breadth = { ...s.breadth, version: 'screen-rows/1', as_of: s.price_date, counted: changes.length,
    advancing: changes.filter(v => v > 0).length, declining: changes.filter(v => v < 0).length,
    above200_count: above, above200_eligible: averages.length, above200: averages.length ? 100 * above / averages.length : null };
  cache = { rows, bySym: new Map(rows.map((r) => [r.sym, r])), detail, swot: rd('swot.json').swot, season: rd('seasonality.json'), meta: s, asOf: s.price_date, builtOn: s.built_on }; return cache;
}
export const num = (r: Row | undefined, k: string): number | null => { const v = r?.[k]; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
/** The source's own size tier. 304 rows omit it; it is NOT guessed from market cap (the source's cut-offs are its own, and a guess disagreed with them). */
export function tierOf(r: Row): 'large' | 'mid' | 'small' | 'micro' | null { return r.tier ?? null; }
export const sectorOf = (r: Row): string => r.sector || 'Unclassified';
export const industryOf = (r: Row): string | null => r.ind || null;

// ---- formatting (one place, so no two pages format a number differently) ----
const L = 'en-IN';
export const f0 = (x: number | null) => (x == null ? '—' : x.toLocaleString(L, { maximumFractionDigits: 0 }));
export const f1 = (x: number | null) => (x == null ? '—' : x.toLocaleString(L, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const f2 = (x: number | null) => (x == null ? '—' : x.toLocaleString(L, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const pct = (x: number | null, d = 1) => (x == null ? '—' : `${x.toLocaleString(L, { minimumFractionDigits: d, maximumFractionDigits: d })}%`);
export const spct = (x: number | null, d = 1) => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString(L, { minimumFractionDigits: d, maximumFractionDigits: d })}%`);
export const rs = (x: number | null, d = 2) => (x == null ? '—' : `₹${x.toLocaleString(L, { minimumFractionDigits: d, maximumFractionDigits: d })}`);
export const cr = (x: number | null) => (x == null ? '—' : x >= 100000 ? `₹${(x / 100000).toLocaleString(L, { maximumFractionDigits: 2 })} lakh cr` : `₹${x.toLocaleString(L, { maximumFractionDigits: 0 })} cr`);
export const mult = (x: number | null) => (x == null ? '—' : `${x.toLocaleString(L, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`);

// ---- cohorts: percentile of a value inside its sector (when >= 10 peers have it) and across the universe ----
export interface Cohorts { rank(metric: string, r: Row): { sector: number | null; universe: number | null; nSector: number; sectorName: string } }
export function buildCohorts(rows: Row[]): Cohorts {
  const uni = new Map<string, number[]>(), sec = new Map<string, number[]>(); const bump = (m: Map<string, number[]>, k: string, v: number) => { (m.get(k) ?? m.set(k, []).get(k)!).push(v); };
  const metrics = new Set<string>(); for (const r of rows) for (const k of Object.keys(r)) if (typeof r[k] === 'number') metrics.add(k);
  for (const r of rows) for (const k of metrics) { const v = num(r, k); if (v == null) continue; bump(uni, k, v); bump(sec, `${sectorOf(r)}|${k}`, v); }
  for (const a of [...uni.values(), ...sec.values()]) a.sort((x, y) => x - y);
  const pctOf = (a: number[] | undefined, v: number) => { if (!a || a.length < 10) return null; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } let eq = 0; for (let i = lo; i < a.length && a[i] === v; i++) eq++; return ((lo + eq / 2) / a.length) * 100; };
  return { rank: (metric, r) => { const v = num(r, metric); const sa = sec.get(`${sectorOf(r)}|${metric}`); if (v == null) return { sector: null, universe: null, nSector: 0, sectorName: sectorOf(r) }; return { sector: pctOf(sa, v), universe: pctOf(uni.get(metric), v), nSector: sa?.length ?? 0, sectorName: sectorOf(r) }; } };
}
let co: Cohorts | null = null; export const cohorts = (): Cohorts => (co ??= buildCohorts(loadFeed().rows));
