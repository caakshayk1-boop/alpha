/** The factual takeaway line of a chart. PURE: every sentence is built from the series that is drawn and nothing else, so what the line says and what the chart
 *  shows cannot disagree (tests/charts.test.ts pins both). It states what happened in the window: the change, the same window for the benchmark, the deepest fall
 *  from a peak, and the date the data runs to. It never says why, never says what comes next, and carries no score or confidence. */
import { dateLabel, spanWord, type Pt, type RangeId } from '../chart.ts';

type CT = { t: number; c: number };
/** A percentage with the typographic minus. A value that rounds to zero carries no sign: a sign on nothing reads as a move that did not happen. */
export function signedPct(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return '—';
  const t = Math.abs(v).toFixed(dp); return `${Number(t) === 0 ? '' : v > 0 ? '+' : '−'}${t}%`;
}
/** Percentage points between two returns, signed, one decimal. */
export function signedPts(v: number, dp = 1): string { const t = Math.abs(v).toFixed(dp); return `${Number(t) === 0 ? '' : v > 0 ? '+' : '−'}${t}`; }
/** A shape cue that does not depend on colour: up, down, or level (nothing drawn). */
export function arrowOf(v: number | null | undefined, eps = 0.05): '▲' | '▼' | '■' { return v == null || !Number.isFinite(v) || Math.abs(v) < eps ? '■' : v > 0 ? '▲' : '▼'; }
export const wordOf = (v: number, eps = 0.05): 'up' | 'down' | 'flat' => (Math.abs(v) < eps ? 'flat' : v > 0 ? 'up' : 'down');

export interface WindowReturn { ret: number; from: CT; to: CT }
/** First close to last close of the window. null with fewer than two points or a first close that is not positive (a ratio from zero or a negative price is not a return). */
export function windowReturn(pts: readonly CT[]): WindowReturn | null {
  if (pts.length < 2) return null; const from = pts[0], to = pts[pts.length - 1];
  if (!(from.c > 0) || !Number.isFinite(to.c)) return null;
  return { ret: (to.c / from.c - 1) * 100, from, to };
}
export interface MaxDrawdown { depth: number; peak: CT; trough: CT; recovered: boolean; now: number }
/** The deepest fall from a running peak inside the window, in percent (negative or zero), with the peak and trough it ran between.
 *  `recovered` is true when a later close got back to the peak; `now` is the last close against the highest close so far. null if no close is positive. */
export function maxDrawdown(pts: readonly CT[]): MaxDrawdown | null {
  const ok = pts.filter((p) => Number.isFinite(p.c) && p.c > 0); if (ok.length < 2) return null;
  let peak = ok[0], worst = 0, wp = ok[0], wt = ok[0];
  for (const p of ok) { if (p.c > peak.c) peak = p; const d = (p.c / peak.c - 1) * 100; if (d < worst) { worst = d; wp = peak; wt = p; } }
  let hi = ok[0].c; for (const p of ok) hi = Math.max(hi, p.c);
  const after = ok.filter((p) => p.t > wt.t); const recovered = worst < 0 && after.some((p) => p.c >= wp.c);
  return { depth: worst, peak: wp, trough: wt, recovered, now: (ok[ok.length - 1].c / hi - 1) * 100 };
}
/** The wording of a window: "the last year", "the last 3 years", or, when the history is shorter than the range asked for or the range is Max, "the N months of history held". */
export function windowWords(range: RangeId, covers: boolean, years: number): string {
  if (range === 'Max' || !covers) return `the ${spanWord(years)} of history held`;
  return range === '1Y' ? 'the last year' : `the last ${range.replace('Y', '')} years`;
}
export interface PriceTakeaway { headline: string; lines: string[]; dataThrough: string; facts: { ret: number | null; bench: number | null; diff: number | null; drawdown: number | null } }
export interface PriceTakeawayIn {
  sym: string; /** the closes DRAWN, in order */ pts: readonly CT[]; /** the benchmark indexed on the same days (any base), or null */ bench?: readonly CT[] | null; benchName?: string;
  words: string; /** the date format of the axis */ monthly?: boolean;
}
/** The takeaway for one stock over its window, with the benchmark on the same days when it is held. */
export function priceTakeaway(i: PriceTakeawayIn): PriceTakeaway | null {
  const w = windowReturn(i.pts); if (!w) return null;
  const b = i.bench ? windowReturn(i.bench) : null; const bn = i.benchName ?? 'the Nifty 50';
  const move = wordOf(w.ret) === 'flat' ? 'was flat' : `${w.ret > 0 ? 'rose' : 'fell'} ${Math.abs(w.ret).toFixed(1)}%`;
  let headline = `${i.sym} ${move} over ${i.words}`;
  let diff: number | null = null;
  if (b) {
    diff = w.ret - b.ret; const rel = wordOf(diff);
    headline += `, against ${signedPct(b.ret)} for ${bn}: ${rel === 'flat' ? 'level with it' : `${Math.abs(diff).toFixed(1)} percentage points ${rel === 'up' ? 'ahead of' : 'behind'} it`}`;
  } else headline += ` (${signedPct(w.ret)})`;
  headline += '.';
  const dd = maxDrawdown(i.pts); const lines: string[] = [];
  if (dd) {
    if (dd.depth > -0.05) lines.push('It never closed below an earlier high inside this window.');
    else lines.push(`The deepest fall from a peak inside the window was ${signedPct(dd.depth)} (from the ${dateLabel(dd.peak.t, i.monthly)} close to the ${dateLabel(dd.trough.t, i.monthly)} close); ${dd.recovered ? 'a later close regained that peak' : `the last close is ${Math.abs(dd.now).toFixed(1)}% below the highest of the window`}.`);
  }
  const dataThrough = `Closes through ${dateLabel(w.to.t)}`;
  return { headline, lines, dataThrough, facts: { ret: w.ret, bench: b ? b.ret : null, diff, drawdown: dd ? dd.depth : null } };
}

export interface IndexedLine { id: string; v: readonly number[] }
export interface CompareTakeawayIn { t: readonly number[]; lines: readonly IndexedLine[]; nifty?: readonly number[] | null; words: string }
export interface CompareTakeaway { headline: string; lines: string[]; dataThrough: string; rows: { id: string; ret: number; drawdown: number }[] }
/** The takeaway for several stocks indexed to 100 on a shared first day. States each return, the same-window Nifty, and the deepest fall of each. Names no winner. */
export function compareTakeaway(i: CompareTakeawayIn): CompareTakeaway | null {
  if (i.t.length < 2 || !i.lines.length) return null;
  const mk = (id: string, v: readonly number[]) => { const pts = v.map((c, k) => ({ t: i.t[k], c })); const w = windowReturn(pts); const d = maxDrawdown(pts); return w ? { id, ret: w.ret, drawdown: d ? d.depth : 0 } : null; };
  const rows = [...i.lines.map((l) => mk(l.id, l.v)), ...(i.nifty ? [mk('Nifty 50', i.nifty)] : [])].filter((r): r is NonNullable<typeof r> => !!r);
  if (!rows.length) return null;
  const ret = (r: { id: string; ret: number }) => `${r.id} ${signedPct(r.ret)}`;
  const headline = `Over ${i.words}, price change: ${rows.map(ret).join(', ')}.`;
  const lines = [`Deepest fall from a peak inside the window: ${rows.map((r) => `${r.id} ${r.drawdown > -0.05 ? '0.0%' : signedPct(r.drawdown)}`).join(', ')}.`];
  return { headline, lines, dataThrough: `Closes through ${dateLabel(i.t[i.t.length - 1])}`, rows };
}

export interface FyIn { fy: string; end?: string; rev_cr?: number | null; pat_cr?: number | null; ebit_margin?: number | null }
const isN = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Compound annual rate between two values `n` years apart, or null when either end is not positive (a rate across a loss or a zero is not defined). */
export function cagr(first: number | null | undefined, last: number | null | undefined, n: number): number | null {
  if (!isN(first) || !isN(last) || !(first > 0) || !(last > 0) || !(n > 0)) return null;
  return (Math.pow(last / first, 1 / n) - 1) * 100;
}
/** Net margin of a year: profit after tax over revenue, in percent. null where either is missing or revenue is not positive. */
export function netMargin(y: FyIn): number | null { return isN(y.pat_cr) && isN(y.rev_cr) && y.rev_cr > 0 ? (y.pat_cr / y.rev_cr) * 100 : null; }
/** Whole years between two fiscal years: from their period-end dates where held, else from the numbers in their labels (FY24, FY2025), else null. */
export function yearsBetween(a: FyIn, b: FyIn): number | null {
  const ya = a.end ? Date.parse(a.end) : NaN, yb = b.end ? Date.parse(b.end) : NaN;
  if (Number.isFinite(ya) && Number.isFinite(yb)) { const n = Math.round((yb - ya) / (365.25 * 86400000)); return n > 0 ? n : null; }
  const fy = (x: FyIn) => { const m = /(\d{2,4})\s*$/.exec(x.fy); if (!m) return NaN; const v = Number(m[1]); return v < 100 ? 2000 + v : v; };
  const n = fy(b) - fy(a); return Number.isFinite(n) && n > 0 ? n : null;
}
const crw = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')} cr`;
/** What the annual figures did, oldest year first. Only years that hold the figure are compared; a gap is named, never filled. */
export function financialsTakeaway(years: readonly FyIn[], opts: { margins?: boolean } = {}): { lines: string[]; span: string | null } {
  const sorted = [...years]; const lines: string[] = [];
  const pick = (get: (y: FyIn) => number | null | undefined) => sorted.filter((y) => isN(get(y)));
  const rev = pick((y) => y.rev_cr), pat = pick((y) => y.pat_cr), nm = sorted.filter((y) => netMargin(y) !== null);
  if (rev.length >= 2) { const a = rev[0], z = rev[rev.length - 1]; const n = yearsBetween(a, z); const g = n ? cagr(a.rev_cr, z.rev_cr, n) : null; lines.push(`Revenue went from ${crw(a.rev_cr as number)} in ${a.fy} to ${crw(z.rev_cr as number)} in ${z.fy}${g !== null && n ? `, ${signedPct(g)} a year over ${n} ${n === 1 ? 'year' : 'years'}` : ''}.`); }
  if (pat.length >= 2) { const a = pat[0], z = pat[pat.length - 1]; const av = a.pat_cr as number, zv = z.pat_cr as number; const n = yearsBetween(a, z); const g = n ? cagr(av, zv, n) : null;
    lines.push(`Profit after tax went from ${av < 0 ? `a loss of ${crw(-av)}` : crw(av)} in ${a.fy} to ${zv < 0 ? `a loss of ${crw(-zv)}` : crw(zv)} in ${z.fy}${g !== null ? `, ${signedPct(g)} a year` : '; a yearly rate is not defined across a loss or a zero'}.`); }
  if (opts.margins !== false && nm.length >= 2) { const a = nm[0], z = nm[nm.length - 1]; const av = netMargin(a) as number, zv = netMargin(z) as number; const d = zv - av;
    lines.push(`Net margin (profit after tax over revenue) went from ${av.toFixed(1)}% to ${zv.toFixed(1)}%, ${wordOf(d, 0.05) === 'flat' ? 'unchanged' : `${Math.abs(d).toFixed(1)} percentage points ${d > 0 ? 'higher' : 'lower'}`}.`); }
  const held = sorted.length;
  if (!lines.length) lines.push(held ? 'Too few years hold these figures to describe a change; each year that is held is in the table.' : 'No annual statements are held for this company.');
  return { lines, span: held ? `${sorted[0].fy} to ${sorted[held - 1].fy}` : null };
}
export type { Pt };
