/** Sectors ranked by trend, each with the number of names it rests on. Pure. The ranking is "net": the share of a sector's counted names in an uptrend minus the share in a downtrend (percentage
 *  points). It describes the last close; it forecasts nothing and recommends nothing. A sector with fewer counted names than MIN_SECTOR (shared/breadthrule.js, the same constant the Worker
 *  applies) is NOT ranked, because a percentage of a handful of names is not a comparison; the page says how many were left out and why. */
import { MIN_SECTOR } from '../shared/breadthrule.js';
import { trendOf, type Row } from './screen.ts';

export interface SectorIn { k: string; n: number; up: number; down: number }
export interface RankedSector extends SectorIn { /** up minus down, percentage points, rounded to one decimal */ net: number; /** names that are neither */ side: number; rank: number }
export interface SectorRanking { ranked: RankedSector[]; /** sectors given but under the minimum, with their counts */ below: { k: string; n: number }[]; min: number }
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Strongest first by net; ties by the larger sample, then by name, so the order is the same on every render. */
export function rankSectors(sectors: readonly SectorIn[], min: number = MIN_SECTOR): SectorRanking {
  const ok = sectors.filter((s) => s.n >= min && Number.isFinite(s.up) && Number.isFinite(s.down));
  const ranked = ok.map((s) => ({ ...s, net: r1(s.up - s.down), side: r1(Math.max(0, 100 - s.up - s.down)) }))
    .sort((a, b) => b.net - a.net || b.n - a.n || a.k.localeCompare(b.k)).map((s, i) => ({ ...s, rank: i + 1 }));
  return { ranked, below: sectors.filter((s) => s.n < min).map((s) => ({ k: s.k, n: s.n })).sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)), min };
}

/** Counted names per sector at the close, straight from the screen rows (liquid names with a trend), including the sectors too small to rank. */
export function sectorsFromRows(rows: readonly Row[]): SectorIn[] {
  const by = new Map<string, { n: number; up: number; down: number }>();
  for (const r of rows) { if (!r.liquid) continue; const t = trendOf(r).trend; if (!t) continue; const k = r.sector ?? 'Other'; const e = by.get(k) ?? { n: 0, up: 0, down: 0 }; e.n++; if (t === 'up') e.up++; if (t === 'down') e.down++; by.set(k, e); }
  return [...by.entries()].map(([k, e]) => ({ k, n: e.n, up: (e.up / e.n) * 100, down: (e.down / e.n) * 100 }));
}
