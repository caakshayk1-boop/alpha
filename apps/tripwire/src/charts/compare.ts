/** Comparison maths that sit beside `alignIndexed` in chart.ts: what the shared window cost each name (coverage), drawdown lines for the same window, and where each name
 *  is ahead on a measured figure (trade-offs, with no overall winner). Pure. */
import { dateLabel, drawdownSeries, spanWord, RANGES, type Aligned, type RangeId, type Series } from '../chart.ts';

const DAY = 86400;
const dayOf = (t: number) => Math.floor((t + 19800) / DAY);
export interface Coverage { windowStart: number; windowEnd: number; sharedDays: number; leftOut: number; spanYears: number; shorter: boolean; notes: string[]; byName: { id: string; first: number; last: number; limiting: boolean }[] }
/** What the shared window cost. `series` is what was fetched, `al` what `alignIndexed` kept for `range`.
 *  Notes (all factual): the window is shorter than the range because a name's history starts later; a name's latest close is earlier than another's; days left out because not every name traded. */
export function coverageOf(series: readonly Series[], al: Aligned, range: RangeId): Coverage {
  const ws = al.t[0], we = al.t[al.t.length - 1]; const years = RANGES.find((r) => r.id === range)!.years;
  const spanYears = (we - ws) / (365.25 * DAY);
  const info = series.map((s) => { const ts = s.t.filter((_, i) => s.c[i] > 0); return { id: s.id, first: ts.length ? ts[0] : ws, last: ts.length ? ts[ts.length - 1] : we, days: new Set(ts.map(dayOf)) }; });
  const latestAll = Math.max(...info.map((x) => x.last));
  const requested = years === null ? null : latestAll - years * 365.25 * DAY;
  // a name limits the window when the range asked for reaches back before its first close in this data
  const limiting = info.map((x) => requested !== null && x.first > requested + 7 * DAY);
  const shorter = requested !== null && ws > requested + 7 * DAY;
  const notes: string[] = [];
  if (shorter) {
    const names = info.filter((_, k) => limiting[k]).map((x) => `${x.id} (from ${dateLabel(x.first)})`);
    notes.push(`The window is ${spanWord(spanYears)}, not ${range}: ${names.length ? `${names.join(' and ')} ${names.length === 1 ? 'has' : 'have'} no earlier closes in this data` : 'the names share no earlier trading days'}, so every line starts together on ${dateLabel(ws)}.`);
  }
  for (const x of info) if (dayOf(x.last) < dayOf(latestAll)) notes.push(`${x.id}'s latest close is ${dateLabel(x.last)}, earlier than ${dateLabel(latestAll)} for the others; the comparison ends on ${dateLabel(we)}.`);
  const union = new Set<number>(); for (const x of info) for (const d of x.days) if (d >= dayOf(ws) && d <= dayOf(we)) union.add(d);
  const leftOut = Math.max(0, union.size - al.t.length);
  if (leftOut > 0) notes.push(`${leftOut} ${leftOut === 1 ? 'day' : 'days'} on which not every name has a close ${leftOut === 1 ? 'is' : 'are'} left out, so no line is drawn across a day it did not trade.`);
  return { windowStart: ws, windowEnd: we, sharedDays: al.t.length, leftOut, spanYears, shorter, notes, byName: info.map((x, k) => ({ id: x.id, first: x.first, last: x.last, limiting: limiting[k] })) };
}
/** Percent below the running peak, for each indexed line, over the shared window. Zero at a new high, never positive. */
export function drawdownLines(al: Aligned): { id: string; v: number[] }[] {
  const dd = (v: readonly number[]) => drawdownSeries(v.map((c, k) => ({ t: al.t[k], c })));
  return [...al.lines.map((l) => ({ id: l.id, v: dd(l.v) })), ...(al.nifty ? [{ id: 'Nifty 50', v: dd(al.nifty) }] : [])];
}

export interface TradeoffLine { group: string; label: string; best: 'high' | 'low'; vals: { id: string; v: number | null | undefined }[] }
export interface Tradeoffs { byName: { id: string; ahead: string[] }[]; skipped: string[]; sentence: string }
const isN = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** For each measured row, who is ahead (highest or lowest as the row says). A row with fewer than two measured names, or a tie, has no leader and is listed under `skipped`.
 *  The sentence groups the rows by name and ends by saying no overall ranking is given: the rows measure different things and carry different risks. */
export function tradeoffs(lines: readonly TradeoffLine[], ids: readonly string[]): Tradeoffs {
  const ahead = new Map<string, string[]>(ids.map((i) => [i, []])); const skipped: string[] = [];
  for (const ln of lines) {
    const m = ln.vals.filter((x): x is { id: string; v: number } => isN(x.v)); if (m.length < 2) { skipped.push(ln.label); continue; }
    const r = (v: number) => Math.round(v * 100) / 100;
    const top = ln.best === 'high' ? Math.max(...m.map((x) => x.v)) : Math.min(...m.map((x) => x.v));
    const lead = m.filter((x) => r(x.v) === r(top)); if (lead.length !== 1) { skipped.push(ln.label); continue; }
    ahead.get(lead[0].id)?.push(`${ln.best === 'high' ? 'higher' : 'lower'} ${ln.label}`);
  }
  const byName = ids.map((id) => ({ id, ahead: ahead.get(id) ?? [] }));
  const parts = byName.filter((b) => b.ahead.length).map((b) => `${b.id}: ${b.ahead.join(', ')}`);
  const sentence = parts.length ? `${parts.join('. ')}. These rows measure different things and carry different risks, so no overall ranking is given.` : 'The measured figures do not separate these names (too few are measured for both, or they tie). No overall ranking is given.';
  return { byName, skipped, sentence };
}
