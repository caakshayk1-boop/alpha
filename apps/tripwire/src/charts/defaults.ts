/** What a chart opens on. A person who has chosen a range or a benchmark view keeps it (saved in Prefs.chart); anyone else gets one year of the stock against the Nifty 50,
 *  where the history can fill that year and the Nifty is held for nearly all of it. Otherwise the longest range the history fills, as a plain price line. Pure. */
import { compareSeries, defaultRange, rangeAvailability, sliceRange, type Pt, type RangeId } from '../chart.ts';

export interface ChartPref { range?: RangeId; vs?: boolean }
export const RANGE_IDS: readonly RangeId[] = ['1Y', '3Y', '5Y', '10Y', 'Max'];
export const isRangeId = (v: unknown): v is RangeId => typeof v === 'string' && (RANGE_IDS as readonly string[]).includes(v);
/** Share of a window's points that carry a Nifty close. The comparison needs the first day to carry one; below this share it starts so late that the window is not the window asked for. */
export const NIFTY_COVERAGE_MIN = 0.9;
export function niftyCoverage(win: readonly Pt[]): number { return win.length ? win.filter((p) => typeof p.n === 'number' && p.n > 0).length / win.length : 0; }
export interface ChartStart { range: RangeId; vs: boolean; why: 'saved' | 'default-1y-vs-nifty' | 'default-longest' }
export function chartStart(all: readonly Pt[], pref: ChartPref | undefined, instrument: boolean): ChartStart {
  const avail = rangeAvailability(all); const can = (r: RangeId) => !!avail.find((a) => a.id === r)?.available;
  const fits = (r: RangeId) => { const w = sliceRange(all, r).pts; if (instrument) return false; const c = compareSeries(w); return !!c && !c.trimmed && niftyCoverage(w) >= NIFTY_COVERAGE_MIN; };
  if (pref && isRangeId(pref.range) && can(pref.range)) return { range: pref.range, vs: pref.vs !== undefined ? !!pref.vs && fits(pref.range) : fits(pref.range), why: 'saved' };
  if (!instrument && can('1Y') && fits('1Y')) return { range: '1Y', vs: pref?.vs === false ? false : true, why: 'default-1y-vs-nifty' };
  return { range: can('1Y') ? '1Y' : defaultRange(all), vs: false, why: 'default-longest' };
}
