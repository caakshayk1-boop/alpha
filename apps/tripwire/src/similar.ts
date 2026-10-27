/** "Stocks like this": the names whose measured figures sit closest to this one's. Pure statistics, no model and no network.
 *  Each figure is turned into a distance in typical spreads (median absolute deviation, so a few extreme ratios do not decide it) and the
 *  distance is averaged over the figures BOTH names have. A name that shares fewer than five figures is not compared. This is closeness of
 *  numbers today. It is not a claim that two companies do the same business, or will move together. */
import type { Row } from './screen.ts';
import { valueOf, type MetricKey } from './screener.ts';

export const LIKE: MetricKey[] = ['pe', 'pb', 'roce_med', 'roe', 'rev_cagr', 'net_margin', 'de', 'r3m', 'rs3m', 'rsi', 'atr_pct', 'from_high'];
const MIN_SHARED = 5;

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export interface Like { row: Row; distance: number; shared: number; closest: MetricKey[] }

export function similarTo(sym: string, rows: readonly Row[], n = 5): Like[] {
  const me = rows.find((r) => r.sym === sym); if (!me) return [];
  const spread = new Map<MetricKey, number>();
  for (const k of LIKE) {
    const xs = rows.map((r) => valueOf(r, k)).filter((v): v is number => v !== null); if (xs.length < 20) continue;
    const md = median(xs); const mad = median(xs.map((v) => Math.abs(v - md))); if (mad > 0) spread.set(k, mad);
  }
  const out: Like[] = [];
  for (const r of rows) {
    if (r.sym === sym) continue;
    const diffs: [MetricKey, number][] = [];
    for (const [k, mad] of spread) { const a = valueOf(me, k), b = valueOf(r, k); if (a !== null && b !== null) diffs.push([k, Math.min(5, Math.abs(a - b) / mad)]); }
    if (diffs.length < MIN_SHARED) continue;
    const d = diffs.reduce((s, [, x]) => s + x, 0) / diffs.length;
    out.push({ row: r, distance: Math.round(d * 1000) / 1000, shared: diffs.length, closest: [...diffs].sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k]) => k) });
  }
  return out.sort((a, b) => a.distance - b.distance || (a.row.sym < b.row.sym ? -1 : 1)).slice(0, n);
}

/** Real peers, kept apart from `similarTo`: the same broad sector and the same size class, liquid names only, listed by value traded a day. It is a grouping, not a ranking of likeness:
 *  the sector is the data provider's coarse label. A company with no sector or no size class has no such list, and the answer says why rather than listing strangers. */
export interface SectorPeers { sector: string | null; tier: string | null; list: Row[]; why: string }
export function sectorPeers(sym: string, rows: readonly Row[], n = 5): SectorPeers | null {
  const me = rows.find((r) => r.sym === sym); if (!me) return null;
  const sector = me.sector ?? null, tier = me.tier ?? null;
  if (!sector) return { sector, tier, list: [], why: 'The data names no sector for this company, so there is no same-sector list.' };
  if (!tier) return { sector, tier, list: [], why: `No size class is published for this company, so a same-sector list in ${sector} would not be like for like.` };
  const list = rows.filter((r) => r.sym !== sym && r.sector === sector && r.tier === tier && r.liquid).sort((a, b) => (b.turnover_cr ?? 0) - (a.turnover_cr ?? 0)).slice(0, n);
  return { sector, tier, list, why: list.length ? '' : `No other liquid ${tier} cap company in ${sector} is in this screen.` };
}
