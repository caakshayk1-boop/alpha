/** Research presets for Discover. A preset is NOT a new screen and NOT a score: it is a fixed combination of the filters and conditions Discover already has, so choosing one just sets those filters,
 *  the URL carries them (`?trend=up&c=rsi:ge:35&...`), Back and a shared link reproduce them, and the person can see and change every one. Its criteria are printed in words, built from the SAME
 *  filter state by the same describers the filter chips use, so the words cannot differ from what is applied. No preset invents a formula, ranks anything, or says a name is worth buying: the
 *  result is a list of names that meet stated tests, in whatever order the person sorts it. */
import { describeFilters, filterRows, type Row } from './screen.ts';
import { fmtMetric, metricOf, type Cond } from './screener.ts';
import { DEFAULT_STATE, PAGE, canonConds, filtersOf, type DiscoverState } from './discoverstate.ts';

export interface Preset { id: string; title: string; /** what it is for, one plain line */ line: string; /** the filters it sets; anything it does not name is cleared */ set: Partial<Pick<DiscoverState, 'trend' | 'momentum' | 'value' | 'quality'>> & { cond?: Cond[] } }
export const PRESETS: readonly Preset[] = [
  { id: 'leaders', title: 'Uptrend and ahead of the Nifty', line: 'Names whose trend is up and which beat the index over three months.', set: { trend: 'up', momentum: 'strong' } },
  { id: 'quality-fair', title: 'High ROCE at a modest PE', line: 'Names with a high median return on capital that are not priced richly on trailing earnings.', set: { quality: 'high', value: 'cheap' } },
  { id: 'debt-light', title: 'High ROCE, low debt', line: 'High median return on capital with little borrowing. Lenders are left out: neither figure is defined for them.', set: { quality: 'high', cond: [{ m: 'de', op: 'lte', v: 0.5 }] } },
  { id: 'pullback', title: 'Resting inside an uptrend', line: 'In an uptrend, with RSI back between 35 and 50.', set: { trend: 'up', cond: [{ m: 'rsi', op: 'gte', v: 35 }, { m: 'rsi', op: 'lte', v: 50 }] } },
  { id: 'washed', title: 'Sold hard and still falling', line: 'In a downtrend with RSI at 30 or below. A list to study, not a call that the fall is over.', set: { trend: 'down', cond: [{ m: 'rsi', op: 'lte', v: 30 }] } },
];

/** The preset's filters on top of a state: its four quick filters and its conditions replace the person's, the search, sector, size, view, sort, columns and picks stay theirs. First page. */
export function applyPreset(st: DiscoverState, p: Preset): DiscoverState {
  return { ...st, trend: p.set.trend ?? '', momentum: p.set.momentum ?? '', value: p.set.value ?? '', quality: p.set.quality ?? '', cond: canonConds(p.set.cond ?? []), show: PAGE };
}
/** The state a preset would set, on its own. */
export const presetState = (p: Preset): DiscoverState => applyPreset({ ...DEFAULT_STATE, cond: [], pick: [] }, p);
/** Is this preset exactly what the state's trend, momentum, value, quality and conditions say? (Search, sector, size and the rest do not matter: they narrow the same preset.) */
export function isPresetOn(st: DiscoverState, p: Preset): boolean {
  const w = presetState(p); const key = (s: DiscoverState) => JSON.stringify([s.trend, s.momentum, s.value, s.quality, canonConds(s.cond)]);
  return key(st) === key(w);
}
export const activePreset = (st: DiscoverState): Preset | null => PRESETS.find((p) => isPresetOn(st, p)) ?? null;
/** A preset turned off: its filters cleared, nothing else touched. */
export const clearPreset = (st: DiscoverState): DiscoverState => ({ ...st, trend: '', momentum: '', value: '', quality: '', cond: [], show: PAGE });

/** One condition in words: "Debt to equity at most 0.5". */
export function condWords(c: Cond): string {
  const m = metricOf(c.m); if (!m) return ''; const dec = Math.min(2, (String(c.v).split('.')[1] ?? '').length);
  return `${m.label} ${c.op === 'gte' ? 'at least' : 'at most'} ${fmtMetric({ ...m, signed: false, dp: Math.max(m.dp, dec) }, c.v)}`;
}
/** The preset's criteria as a list of plain statements: the quick filters through the filter chips' own describer, the conditions through `condWords`. */
export function presetCriteria(p: Preset): string[] {
  const s = presetState(p); const f = filtersOf(s);
  return [...describeFilters({ ...f, cond: [] }), ...s.cond.map(condWords)];
}
/** The same sentence a person would read as the full tail of a preset: every name with no figure for a test is left out. */
export const PRESET_FOOTNOTE = 'Every test must hold. A name with no figure for a test is left out, never counted as zero. The list is not ranked as a recommendation: sort it however you like, and read each company before anything else.';

/** How many names meet a preset today, and how many of the screen's names could be measured at all (the rest have no figure for at least one test). Pure, over the rows. */
export function presetCount(rows: readonly Row[], p: Preset): { n: number; of: number; unmeasured: number } {
  const s = presetState(p); const f = filterRows(rows, filtersOf(s));
  return { n: f.rows.length, of: rows.length, unmeasured: f.unmeasured + f.notApplicable };
}
