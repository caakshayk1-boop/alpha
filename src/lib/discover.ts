/** Discover (the Screen): the measures, what each comparison means in words, and how one typed query is interpreted, in ONE
 *  place, so a chip, a preset's description, a column heading and the filter that actually runs cannot disagree (C02-C06).
 *  Pure; tested in tests/query.test.ts.
 *
 *  Rules:
 *  - Every comparison is named by the operator that runs: "≥ 25" means 25 itself passes, "> 25" means it does not.
 *  - Every qualitative word (low debt, profitable, oversold...) carries its definition, with its own boundary.
 *  - A company with no value for a measure never passes a filter on it, and is not counted as failing it either. */
import type { Row } from './types';
import type { Filter } from './nl';
import { parse } from './nl.ts';
import { looksLikeQuery, parseQuery } from './query.ts';
import { dateLabel, num, pct, ratio } from './format.ts';

type Num = number | null | undefined;
const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** What a figure is measured at. price: the screen's last close (or live, for price and the day's move); statement: each
 *  company's own latest fiscal year on file; score: computed at the screen build from both. */
export type Basis = 'price' | 'statement' | 'score';
export interface Field { id: string; label: string; short: string; unit: string; get: (r: Row) => Num; fmt: (v: number) => string; kind?: 'chg'; basis: Basis }

export const FIELDS: Field[] = [
  { id: 'price', label: 'Price', short: 'Price', unit: '', basis: 'price', get: (r) => r.price, fmt: (v) => `₹${num(v, 2)}` },
  { id: 'mcap_cr', label: 'Market cap (₹ cr)', short: 'Market cap', unit: ' cr', basis: 'price', get: (r) => r.mcap_cr, fmt: (v) => (v >= 1e5 ? `${num(v / 1e5, 2)}L cr` : `${num(v, 0)} cr`) },
  { id: 'pe', label: 'P/E', short: 'P/E', unit: '', basis: 'price', get: (r) => r.pe, fmt: (v) => num(v, 1) },
  { id: 'pb', label: 'P/B', short: 'P/B', unit: '', basis: 'price', get: (r) => r.pb, fmt: (v) => num(v, 2) },
  { id: 'roce', label: 'ROCE %', short: 'ROCE', unit: '%', basis: 'statement', get: (r) => r.roce, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'roe', label: 'ROE %', short: 'ROE', unit: '%', basis: 'statement', get: (r) => r.roe, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'de', label: 'Debt / equity', short: 'Debt/equity', unit: '', basis: 'statement', get: (r) => r.de, fmt: (v) => num(v, 2) },
  { id: 'div_yield', label: 'Dividend yield %', short: 'Dividend yield', unit: '%', basis: 'price', get: (r) => r.div_yield, fmt: (v) => `${pct(v, 2, false)}` },
  { id: 'rev_cagr', label: 'Revenue CAGR %', short: 'Revenue CAGR', unit: '%', basis: 'statement', get: (r) => r.rev_cagr, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'eps_cagr', label: 'EPS CAGR %', short: 'EPS CAGR', unit: '%', basis: 'statement', get: (r) => r.eps_cagr, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'cfo_pat', label: 'Cash / profit', short: 'Cash/profit', unit: '×', basis: 'statement', get: (r) => r.cfo_pat, fmt: (v) => `${ratio(v, 2)}` },
  { id: 'piotroski', label: 'Piotroski F (of 9)', short: 'Piotroski F', unit: '', basis: 'statement', get: (r) => r.piotroski, fmt: (v) => String(v) },
  { id: 'q', label: 'Quality score', short: 'Quality', unit: '', basis: 'score', get: (r) => r.q, fmt: (v) => String(Math.round(v)) },
  { id: 'g', label: 'Growth score', short: 'Growth', unit: '', basis: 'score', get: (r) => r.g, fmt: (v) => String(Math.round(v)) },
  { id: 'v', label: 'Value score', short: 'Value', unit: '', basis: 'score', get: (r) => r.v, fmt: (v) => String(Math.round(v)) },
  { id: 'tech', label: 'Technical score', short: 'Technical', unit: '', basis: 'score', get: (r) => r.tech, fmt: (v) => String(Math.round(v)) },
  { id: 'comp', label: 'Composite score', short: 'Composite', unit: '', basis: 'score', get: (r) => r.comp, fmt: (v) => String(Math.round(v)) },
  { id: 'r1d', label: 'Today %', short: 'Today', unit: '%', basis: 'price', get: (r) => r.r1d, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r1w', label: 'Week %', short: 'Week', unit: '%', basis: 'price', get: (r) => r.r1w, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r1m', label: 'Month %', short: 'Month', unit: '%', basis: 'price', get: (r) => r.r1m, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r3m', label: '3 months %', short: '3 months', unit: '%', basis: 'price', get: (r) => r.r3m, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r1y', label: 'Year %', short: 'Year', unit: '%', basis: 'price', get: (r) => r.r1y, fmt: (v) => String(v), kind: 'chg' },
  { id: 'rs3m', label: 'Vs index, 3 months %', short: 'Vs index 3m', unit: ' pts', basis: 'price', get: (r) => r.rs3m, fmt: (v) => String(v), kind: 'chg' },
  { id: 'from_high', label: 'From 52-week high %', short: 'From 52w high', unit: '%', basis: 'price', get: (r) => r.from_high, fmt: (v) => `${pct(v, 0, false)}` },
  { id: 'rsi', label: 'RSI (14)', short: 'RSI', unit: '', basis: 'price', get: (r) => r.rsi, fmt: (v) => num(v, 0) },
  { id: 'pe_pctile', label: 'P/E percentile in own history', short: 'P/E pctile', unit: '', basis: 'price', get: (r) => r.pe_pctile, fmt: (v) => `${Math.round(v)}` },
  { id: 'turnover_cr', label: 'Daily turnover (₹ cr)', short: 'Turnover', unit: ' cr', basis: 'price', get: (r) => r.turnover_cr, fmt: (v) => `${num(v, 1)} cr` },
];
export const FIELD = new Map(FIELDS.map((f) => [f.id, f]));

/** The heading's basis, in words (C05). `close` is the screen's price date; `built` the screen build date. */
export function basisText(f: Field, close: string | null, built: string | null, live?: string | null): string {
  if (live && (f.id === 'price' || f.id === 'r1d')) return `live, ${live} IST`;
  if (f.basis === 'price') return close ? `at the ${dateLabel(close)} close` : 'at the latest close';
  if (f.basis === 'statement') return 'latest FY on file (each company’s own)';
  return built ? `screen build of ${dateLabel(built)}` : 'at the screen build';
}

/** A manual condition from the filter editor. `>=` includes the boundary; `<=` includes it too (the editor offers no strict form). */
export interface Cond { f: string; op: '>=' | '<='; v: string }
const SIGN: Record<Cond['op'], string> = { '>=': '≥', '<=': '≤' };
export const condActive = (c: Cond) => c.v !== '' && Number.isFinite(Number(c.v));
export function condLabel(c: Cond): string {
  const f = FIELD.get(c.f);
  return `${f?.short ?? c.f} ${SIGN[c.op]} ${c.v}${f?.unit ?? ''}`;
}
export function condDef(c: Cond): string {
  const f = FIELD.get(c.f);
  const v = `${c.v}${f?.unit ?? ''}`;
  return `${f?.label.replace(/ %$| \(₹ cr\)$/, '') ?? c.f} ${c.op === '>=' ? 'at least' : 'at most'} ${v}: a company at exactly ${v} passes. A company with no value for it never passes.`;
}
export function condTest(c: Cond): (r: Row) => boolean {
  const g = FIELD.get(c.f)?.get, n = Number(c.v);
  return (r) => { const x = g ? g(r) : null; return has(x) && (c.op === '>=' ? x >= n : x <= n); };
}

/** One description of a preset from the conditions it actually applies; a lower and an upper bound on the same measure read as a range. */
export function condsText(conds: Cond[]): string {
  const out: string[] = [];
  const seen = new Set<number>();
  conds.forEach((c, i) => {
    if (seen.has(i)) return;
    const j = conds.findIndex((d, k) => k !== i && !seen.has(k) && d.f === c.f && d.op !== c.op);
    if (j >= 0) {
      seen.add(j);
      const lo = c.op === '>=' ? c : conds[j], hi = c.op === '>=' ? conds[j] : c, f = FIELD.get(c.f);
      out.push(`${f?.short ?? c.f} ${lo.v} to ${hi.v}${f?.unit ?? ''} (both included)`);
    } else out.push(condLabel(c));
  });
  return out.join(' and ');
}

/** Words for each screen-only flag a preset can set. */
export const FLAG_DEFS: Record<string, string> = {
  vetted: 'Vetted: clears the screen’s data checks (enough statement years, fresh statements and price, a published market cap, liquidity and the balance-sheet checks). A gate on the data, not a view on the company.',
  ahimsa: 'In NSE’s Nifty500 Ahimsa index, as recorded in the screen feed.',
  uptrend: 'Uptrend: price strictly above its 50-day and 200-day averages, and its 3-month return strictly ahead of the Nifty’s, at the latest close.',
  magic: 'Ranked 1 to 100 on the screen’s Magic Formula (ROCE rank plus earnings-yield rank). Lenders, utilities and companies under ₹1,000 crore are not ranked.',
  signal: 'Appears in the engines’ signal feed at the latest close. A selection by a rule, not advice.',
};

/** The size class (C06): where it comes from, the date it was set, and how many classed names publish no market cap. The class
 *  is the screen feed's own `tier`; it is reported, never re-derived or second-guessed here. */
export function tierNote(rows: Row[], builtOn: string | null): { text: string; noCap: number } {
  const noCap = rows.filter((r) => r.tier && !has(r.mcap_cr)).length;
  const when = builtOn ? `the screen build of ${dateLabel(builtOn)}` : 'the latest screen build';
  return { noCap, text: `Size class from ${when} (the feed’s own class for each company).${noCap ? ` ${num(noCap)} compan${noCap === 1 ? 'y has' : 'ies have'} a class but no published market cap.` : ''}` };
}

/** "ROCE at least 25%" → "ROCE ≥ 25%": the chip shows the operator that runs, in one notation for both input forms (C03). */
export function chipText(label: string): string {
  return label
    .replace(/ not equal to (-?\d)/g, ' ≠ $1').replace(/ equal to (-?\d)/g, ' = $1')
    .replace(/ at least (-?\d)/g, ' ≥ $1').replace(/ at most (-?\d)/g, ' ≤ $1')
    .replace(/ above (-?\d)/g, ' > $1').replace(/ below (-?\d)/g, ' < $1');
}

const PHRASE_DEFS: Record<string, string> = {
  'Large cap': 'The screen feed’s own size class for the company: large cap. Not re-derived from market cap here.', 'Mid cap': 'The screen feed’s own size class for the company: mid cap. Not re-derived from market cap here.',
  'Small cap': 'The screen feed’s own size class for the company: small cap. Not re-derived from market cap here.', 'Micro cap': 'The screen feed’s own size class for the company: micro cap. Not re-derived from market cap here.',
  'In an uptrend (price > 50-day > 200-day)': 'Uptrend: price strictly above its 50-day average, and the 50-day strictly above the 200-day, at the latest close.',
  'Above its 200-day average': 'Price strictly above its 200-day average at the latest close.',
  'Within 5% of its 52-week high': 'Near the high: no more than 5% below its 52-week high; exactly 5% below counts.',
  'At least 40% below its 52-week high': 'Beaten down: 40% or more below its 52-week high; exactly 40% counts.',
  'Oversold (RSI under 30)': 'Oversold: 14-day RSI strictly below 30 at the latest close; 30 itself does not count.',
  'Overbought (RSI over 70)': 'Overbought: 14-day RSI strictly above 70 at the latest close; 70 itself does not count.',
  'Cheap against its own history (P/E percentile ≤ 35)': 'Cheap: P/E at or below the 35th percentile of the company’s own P/E history. Cheap against itself, not against other companies.',
  'Quality score 70 or more': 'Quality: the screen’s quality score of 70 or more (70 counts).',
  '3-month return at least 10 points ahead of the Nifty': 'Momentum: the stock’s 3-month return minus the Nifty’s, in percentage points, of 10 or more; 10 counts.',
  'Debt/equity 0.3 or less': 'Low debt: debt/equity of 0.3 or less on the latest balance sheet (0.3 counts). Applied to lenders too, where debt is the raw material.',
  'Profitable (positive net margin)': 'Profitable: net margin strictly above zero in the latest fiscal year; exactly zero does not count.',
  'Operating cash at least 0.8× profit': 'Cash-backed: operating cash flow of 0.8× net profit or more (0.8 counts).',
  'In the Magic Formula top 100': 'Ranked 1 to 100 on the screen’s Magic Formula.',
  'Screen class: has a case on file': 'The screen’s own class for the company is “has a case”. Not a recommendation.',
  'Risk level LOW': 'Low risk: the screen grades its risk flags LOW. Not a forecast of price risk.',
  'Turnover ₹10 crore a day or more': 'Liquid: ₹10 crore or more traded a day on average (10 counts).',
  'Dividend yield 2% or more': 'Income: dividend yield of 2% or more at the latest close (2% counts).',
  'Promoters hold 50% or more': 'Promoter-held: Yahoo’s insiders figure, a proxy for promoter holding, of 50% or more (50 counts).',
  'Revenue CAGR 15% or more': 'Growing: revenue compounding at 15% a year or more over the statements on file (15% counts).',
};
const OP_DEF: [RegExp, (v: string) => string][] = [
  [/ ≥ (-?[\d.]+\S*)$/, (v) => `at least ${v}: exactly ${v} passes`],
  [/ ≤ (-?[\d.]+\S*)$/, (v) => `at most ${v}: exactly ${v} passes`],
  [/ > (-?[\d.]+\S*)$/, (v) => `strictly above ${v}: exactly ${v} does not pass`],
  [/ < (-?[\d.]+\S*)$/, (v) => `strictly below ${v}: exactly ${v} does not pass`],
  [/ = (-?[\d.]+\S*)$/, (v) => `exactly ${v}`],
  [/ ≠ (-?[\d.]+\S*)$/, (v) => `anything but ${v}`],
];
/** The definition a chip carries (C04): the qualitative word's rule with its boundary, or the comparison in words. */
export function define(label: string, note?: string): string {
  const base = PHRASE_DEFS[label] ?? (() => {
    const t = chipText(label);
    for (const [re, say] of OP_DEF) { const m = re.exec(t); if (m) return `${t.slice(0, m.index)} ${say(m[1])}. A company with no value never passes.`; }
    return `${label}: matched on the screen feed’s sector and industry.`;
  })();
  return note ? `${base} ${note}` : base;
}

/** One typed text, read once: the query language when it looks like it, plain English otherwise. */
export interface Reading { filters: Filter[]; unknown: string[]; error: { message: string; at: number } | null; isQuery: boolean }
export function interpret(text: string): Reading {
  if (!text.trim()) return { filters: [], unknown: [], error: null, isQuery: false };
  if (looksLikeQuery(text)) {
    const r = parseQuery(text);
    return 'message' in r ? { filters: [], unknown: [], error: r, isQuery: true } : { filters: r.filters, unknown: [], error: null, isQuery: true };
  }
  const p = parse(text);
  return { ...p, error: null, isQuery: false };
}
