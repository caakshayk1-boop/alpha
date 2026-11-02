/** What the printable company report says, as pure functions: nothing here fetches, draws or decides an investment question. Every sentence is derived from a field the app holds (or from its absence);
 *  nothing is written about a company's prospects, and a statement of absence names the field it was read from. The report is a view of the same data as the Company page, on paper. */
import type { Eligibility } from './eligibility.ts';
import type { Inst, Year } from './data.ts';
import type { Version } from './store.ts';

export interface MissingItem { id: 'events' | 'valuation' | 'ownership' | 'statements' | 'withheld' | 'benchmark' | 'history' | 'volume' | 'thesis' | 'stale'; label: string; detail: string }
export interface MissingIn {
  row: { next_earnings?: string | null; pe_pctile?: number | null; stale?: boolean; last_date?: string | null };
  years: readonly Pick<Year, 'fy'>[];
  inst?: Pick<Inst, 'promoter' | 'fii' | 'dii' | 'series' | 'period'> | null;
  eligibility?: Pick<Eligibility, 'notes'> | null;
  /** what the price history feed holds; null when it could not be read at all */
  chart?: { points: number; hasNifty: boolean; hasVolume: boolean } | null;
  thesisCount: number;
  /** fiscal years a full read needs; the screen holds up to this many */
  statementsWanted?: number;
}
const has = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);

/** The things this app does NOT hold for this company, read from the data that is absent. An empty list means every kind of evidence the report can show is present, which is not a claim that nothing is missing from the world. */
export function missingEvidence(i: MissingIn): MissingItem[] {
  const out: MissingItem[] = [];
  out.push(i.row.next_earnings
    ? { id: 'events', label: 'Event annotations', detail: 'Only the next results date is held, and it is an estimate until reported. No dividend, split, filing or announcement is dated in this data, so the chart marks none of them.' }
    : { id: 'events', label: 'Event annotations', detail: 'No dated event of any kind is held for this company: no results date, dividend, split, filing or announcement. The chart marks none.' });
  out.push(has(i.row.pe_pctile)
    ? { id: 'valuation', label: 'Valuation history', detail: 'Only one number is held, the percentile of the trailing PE against its own past. A PE series is not held, so no valuation history is charted.' }
    : { id: 'valuation', label: 'Valuation history', detail: 'None. No PE percentile and no PE series are held for this company.' });
  const inst = i.inst; const anyHolding = !!inst && (has(inst.promoter) || has(inst.fii) || has(inst.dii));
  const series = inst?.series?.length ?? 0;
  if (!anyHolding) out.push({ id: 'ownership', label: 'Ownership', detail: 'No shareholding pattern is held for this company, so none is shown and none is estimated.' });
  else if (series < 2) out.push({ id: 'ownership', label: 'Ownership series', detail: `Only the latest shareholding snapshot${inst?.period ? ` (${inst.period})` : ''} is held; there is no earlier quarter to compare it with.` });
  else out.push({ id: 'ownership', label: 'Ownership series', detail: `The history held covers foreign and domestic institutions over ${series} quarters. Promoter holding is held as the latest figure only, with no history.` });
  const want = i.statementsWanted ?? 4; const n = i.years.length;
  if (n === 0) out.push({ id: 'statements', label: 'Annual statements', detail: 'None are held, so no growth, margin, return-on-capital or debt figure can be shown.' });
  else if (n < want) out.push({ id: 'statements', label: 'Annual statements', detail: `${n} fiscal ${n === 1 ? 'year is' : 'years are'} held (the screen holds up to ${want}), so multi-year medians and growth rates rest on a short run.` });
  for (const [k, t] of (i.eligibility?.notes ?? []).entries()) out.push({ id: 'withheld', label: k === 0 ? 'Figures withheld for this company' : 'Also withheld', detail: t });
  if (!i.chart) out.push({ id: 'history', label: 'Price history', detail: 'The price history could not be read when this report was made, so no chart is drawn.' });
  else {
    if (!i.chart.hasNifty) out.push({ id: 'benchmark', label: 'Nifty 50 comparison', detail: 'No Nifty 50 line is held for this window, so the chart is the stock on its own and no relative figure is given.' });
    if (i.chart.points < 252) out.push({ id: 'history', label: 'Price history', detail: `${i.chart.points.toLocaleString('en-IN')} daily closes are held, fewer than a full year of sessions (about 250), so a one-year view is not available.` });
    if (!i.chart.hasVolume) out.push({ id: 'volume', label: 'Volume', detail: 'This price history carries no volume, so none is shown.' });
  }
  if (i.row.stale) out.push({ id: 'stale', label: 'Latest close', detail: `This name has not printed a close for more than a session${i.row.last_date ? ` (the last is ${i.row.last_date})` : ''}; its figures are older than the rest of the screen.` });
  if (i.thesisCount === 0) out.push({ id: 'thesis', label: 'Your reasoning', detail: 'No thesis is recorded on this device for this company.' });
  return out;
}

export interface KeyPoint { id: 'first' | 'last' | 'high' | 'low'; label: string; t: number; c: number }
/** First, last, highest and lowest close of the window drawn: the compact table that prints in place of the long one. Ties keep the earlier day. */
export function keyPoints(pts: readonly { t: number; c: number }[]): KeyPoint[] {
  const ok = pts.filter((p) => Number.isFinite(p.c)); if (ok.length < 2) return [];
  let hi = ok[0], lo = ok[0]; for (const p of ok) { if (p.c > hi.c) hi = p; if (p.c < lo.c) lo = p; }
  return [{ id: 'first', label: 'First close', ...ok[0] }, { id: 'last', label: 'Last close', ...ok[ok.length - 1] }, { id: 'high', label: 'Highest close', ...hi }, { id: 'low', label: 'Lowest close', ...lo }].map((k) => ({ id: k.id as KeyPoint['id'], label: k.label, t: k.t, c: k.c }));
}

export interface Fact { label: string; value: string; date: string | null; source: string }
export interface FactsIn { name: string; lastDate?: string | null; price?: string | null; nextEarnings?: string | null; fy?: string | null; builtOn?: string | null; screenAsOf?: string | null; chartThrough?: string | null }
const SRC_SCREEN = 'Alpha screen (data provider: Yahoo Finance)';
/** The dated facts a reader can check against another source, each with where it came from. A fact the app does not hold is absent from this list and appears under missing evidence instead. */
export function reportFacts(i: FactsIn): Fact[] {
  const f: Fact[] = [];
  if (i.lastDate) f.push({ label: 'Last close in the data', value: i.price ?? 'price not held', date: i.lastDate, source: `${SRC_SCREEN}, daily close` });
  if (i.chartThrough) f.push({ label: 'Price chart runs through', value: 'last daily close drawn', date: i.chartThrough, source: 'Yahoo Finance daily closes, through this app\'s Worker' });
  if (i.nextEarnings) f.push({ label: 'Next results', value: 'estimated date', date: i.nextEarnings, source: `${SRC_SCREEN}; an estimate until reported` });
  if (i.fy) f.push({ label: 'Latest fiscal year held', value: i.fy, date: null, source: `${SRC_SCREEN}, annual statements` });
  if (i.builtOn) f.push({ label: 'Screen built', value: i.screenAsOf ? `data through ${i.screenAsOf}` : 'build date', date: i.builtOn, source: 'Alpha screen build' });
  return f;
}

export interface ThesisBlock { present: boolean; savedAt: string | null; versions: number; /** other live entries for the same symbol, not printed */ others: number; lines: { label: string; text: string }[]; note: string | null }
const LABELS: [keyof Version, string][] = [['thesis', 'Thesis'], ['support', 'Supporting evidence'], ['counter', 'Counterargument'], ['decision', 'Decision'], ['invalidation', 'Invalidation (wrong if)'], ['trigger', 'Review trigger'], ['reviewOn', 'Review date']];
/** The saved thesis for this company, or the one-line note that there is none. `entries` are the live (not archived) entries for the symbol, newest first (the order the journal keeps); the newest is used, its earlier versions are counted and never printed as if current, and other entries are counted. */
export function thesisBlock(entries: readonly { versions: readonly Version[]; created?: string }[]): ThesisBlock {
  const e = entries[0];
  const v = e?.versions[e.versions.length - 1];
  if (!e || !v) return { present: false, savedAt: null, versions: 0, others: 0, lines: [], note: 'No thesis recorded.' };
  const lines = LABELS.map(([k, label]) => ({ label, text: String(v[k] ?? '').trim() })).filter((l) => l.text);
  if (!lines.length) return { present: false, savedAt: v.at, versions: e.versions.length, others: entries.length - 1, lines: [], note: 'No thesis recorded.' };
  return { present: true, savedAt: v.at, versions: e.versions.length, others: entries.length - 1, lines, note: null };
}
