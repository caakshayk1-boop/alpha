/** The numbers behind the sector heat map, from the published screen rows. Pure, so every figure is unit-tested.
 *
 *  What is drawn, and what it is not:
 *   - Only LIQUID names with a finite change for the chosen window and a traded value count. A name missing a figure is left out, never read as zero.
 *   - A cell's SIZE is its share of the group's traded value (turnover in crore on the last session). It is not market capitalisation; the screen does not carry that.
 *   - A cell's COLOUR is the price change over the window (1 day, 1 week or 1 month) at the last close, weighted by traded value for a sector, as the name's own figure inside a sector.
 *   - The window's change is a close-to-close figure from the published screen, not a live price. */
import type { Row } from './screen.ts';

export type HeatWindow = 'r1d' | 'r1w' | 'r1m';
export const WINDOW_LABEL: Record<HeatWindow, string> = { r1d: '1 day', r1w: '1 week', r1m: '1 month' };
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface HeatName { sym: string; name: string; sector: string; chg: number; weight: number; price: number | null; tier: string | null }
export interface HeatSector { sector: string; n: number; weight: number; /** traded-value-weighted mean change, in percent */ chg: number; up: number; down: number; names: HeatName[] }

export function heatNames(rows: Row[], win: HeatWindow, sector?: string): HeatName[] {
  const out: HeatName[] = [];
  for (const r of rows) {
    if (!r.liquid || r.stale || !r.sector || (sector != null && r.sector !== sector)) continue;
    const chg = r[win]; const w = r.turnover_cr;
    if (!num(chg) || !num(w) || w <= 0) continue;
    out.push({ sym: r.sym, name: r.name, sector: r.sector, chg, weight: w, price: num(r.price) ? r.price : null, tier: r.tier ?? null });
  }
  return out;
}

/** One cell per sector with at least `minNames` counted names, largest first. */
export function sectorHeat(rows: Row[], win: HeatWindow, minNames = 3): HeatSector[] {
  const by = new Map<string, HeatName[]>();
  for (const n of heatNames(rows, win)) (by.get(n.sector) ?? by.set(n.sector, []).get(n.sector)!).push(n);
  const out: HeatSector[] = [];
  for (const [sector, names] of by) {
    if (names.length < minNames) continue;
    const weight = names.reduce((a, n) => a + n.weight, 0);
    const chg = names.reduce((a, n) => a + n.chg * n.weight, 0) / weight;
    out.push({ sector, n: names.length, weight, chg, up: names.filter((n) => n.chg > 0).length, down: names.filter((n) => n.chg < 0).length, names });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** The k strongest and k weakest names by change. A name never appears in both, and a group too small to split gives fewer. */
export function leadersLaggards(names: HeatName[], k = 5): { leaders: HeatName[]; laggards: HeatName[] } {
  const s = [...names].sort((a, b) => b.chg - a.chg || b.weight - a.weight || a.sym.localeCompare(b.sym));
  const take = Math.min(k, Math.floor(s.length / 2));
  return { leaders: s.slice(0, take), laggards: s.slice(s.length - take).reverse() };
}

/** Colour strength 0..1 for a change, against a scale that fits the window: a 1-day move of 3% is as strong as a 1-month move of 12%. */
export const HEAT_SCALE: Record<HeatWindow, number> = { r1d: 3, r1w: 6, r1m: 12 };
export function heatStrength(chg: number, win: HeatWindow): number { return Math.min(1, Math.abs(chg) / HEAT_SCALE[win]); }
export const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;

/** The sector names the screen publishes are long for a cell on a phone; these are the short forms the map prints. Anything else is printed as it is. */
const SHORT: Record<string, string> = { 'Financial Services': 'Financials', 'Communication Services': 'Comm. services', 'Consumer Cyclical': 'Cons. cyclical', 'Consumer Defensive': 'Cons. defensive', 'Basic Materials': 'Materials', 'Real Estate': 'Real estate' };
export const shortSector = (s: string) => SHORT[s] ?? s;

/** A short code for a cell too narrow to print the name at a readable size. The full name stays in the tooltip, the accessible name and the table. */
const ABBR: Record<string, string> = { 'Financial Services': 'Fin', Industrials: 'Ind', Energy: 'Energy', Technology: 'Tech', Healthcare: 'Health', 'Basic Materials': 'Matls', 'Consumer Cyclical': 'Cyc', 'Consumer Defensive': 'Def', 'Communication Services': 'Comm', Utilities: 'Utils', 'Real Estate': 'RE' };
export const abbrSector = (s: string) => ABBR[s] ?? s.slice(0, 4);

/** What a cell prints and at what size. Widths are in percent of the map's width ("cqw"); a bold character is `charW` em wide. The size is chosen so the longest word fits the cell, and a size under
 *  MIN_CQW (about 10 px on a phone) is not used: the short form is tried, and if that does not fit either the cell prints nothing (a label that is cut off is worse than none). */
/** How wide one printed bold character is, in em. Deliberately generous: capitals are wider than lower case, and the fallback font on Linux (what CI renders) is wider than the Mac's, so a label that fits here fits there. */
export const charW = (t: string) => (/[A-Z]/.test(t) && t === t.toUpperCase() ? 0.8 : 0.68);
export const PCT_W = 0.78;
export const MIN_CQW = 3.3; export const MAX_CQW = 3.9; const PAD_V = 6.5;           // vertical padding of a cell, in cqw
export interface CellLabel { text: string | null; fn: number; fp: number | null }
/** The height a label needs, in cqw (the map is 100 cqw wide and its virtual height unit is the same): padding, the name's lines (a name with a space wraps there), and the figure under it. */
export function labelNeed(text: string, fn: number, inner: number, fp: number | null): number {
  const oneLine = text.length * charW(text) * fn <= inner; const lines = oneLine || !text.includes(' ') ? 1 : 2;
  return PAD_V + lines * 1.15 * fn + (fp != null ? 1.1 * fp + 0.4 : 0);
}
export function cellLabel(w: number, h: number, full: string, short: string | null, pctText: string, ellipsis = false): CellLabel {
  const pad = w >= 17 ? 8 : 4; const inner = Math.max(0, w - pad); const longest = (t: string) => Math.max(...t.split(' ').map((x) => x.length), 1) * charW(t);
  const fit = (t: string) => inner / longest(t); const texts = short && short !== full ? [full, short] : [full];
  // the figure is semibold digits and a percent sign, wider than the name's letters; it is shown only where it fits at a readable size
  const rawFp = inner / (pctText.length * PCT_W); const fp = w >= 17 && rawFp >= MIN_CQW ? Math.min(5.2, rawFp) : null;
  // preference order: name with its figure, the short form with its figure, the name alone, the short form alone. The first that fits both the width and the height is used.
  for (const withFig of fp != null ? [true, false] : [false]) for (const t of texts) { const f = fit(t); if (f < MIN_CQW) continue; const fn = Math.min(f, MAX_CQW); if (labelNeed(t, fn, inner, withFig ? fp : null) <= h) return { text: t, fn, fp: withFig ? fp : null }; }
  // A company symbol may be cut with an ellipsis when at least four characters still show at the smallest readable size: a large cell with a clipped symbol says more than a blank one (the tooltip and the
  // accessible name carry the full name). A sector name never is: it has a short code instead.
  if (ellipsis && Math.floor(inner / (MIN_CQW * charW(full))) >= 4 && labelNeed(full, MIN_CQW, Infinity, null) <= h) return { text: full, fn: MIN_CQW, fp: null };
  return { text: null, fn: MIN_CQW, fp: null };
}
