/** Compare: the measures, the one rule for marking a difference, and the short read of what differs, built only from the
 *  figures (Pro §22.5, C18, C19). Pure; tested in tests/lib.test.ts.
 *
 *  Rules:
 *  - No winner. A measure is marked only when "better" is defined for it and the gap to the next company is material.
 *  - A lender's ROCE, margins, leverage, cash conversion and interest cover read "not comparable" (sector.ts), never marked.
 *  - Missing is missing: a company without the figure is left out of the comparison, never counted as zero.
 *  - CAGRs are marked only when every company's statements cover the same period; Piotroski only on the same number of tests. */
import type { Row } from './types';
import { LENDER_NA, isLender } from './sector.ts';
import { crore, num, pct, ratio } from './format.ts';

const has = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export type View = 'overview' | 'quality' | 'valuation' | 'financials';
export const VIEWS: [View | 'full', string][] = [['overview', 'Overview'], ['quality', 'Quality'], ['valuation', 'Valuation'], ['financials', 'Financials'], ['full', 'Full table']];
/** `material`: the smallest gap between the best and the next value worth marking, in the measure's own units, or as a share
 *  for multiples (`rel`). Below it the row stays neutral: a 0.4-point gap in ROCE is noise, not a difference. `better: null`
 *  means no direction is defined (size, a past return), so the row is never marked. */
export interface Spec { label: string; views: View[]; get: (r: Row) => number | null | undefined; fmt: (v: number, r: Row) => string; better: 'high' | 'low' | null; material?: number; rel?: boolean; period?: boolean; basis: string }
export const SPECS: Spec[] = [
  { label: 'Market cap', views: ['overview', 'valuation'], get: (r) => r.mcap_cr, fmt: (v) => crore(v), better: null, basis: 'at the screen close' },
  { label: 'Composite score', views: ['overview'], material: 10, get: (r) => r.comp, fmt: (v) => num(v, 0), better: 'high', basis: 'score 0 to 100, screen build' },
  { label: 'Quality', views: ['overview', 'quality'], material: 10, get: (r) => r.q, fmt: (v) => num(v, 0), better: 'high', basis: 'score 0 to 100, screen build' },
  { label: 'Growth', views: ['overview', 'financials'], material: 10, get: (r) => r.g, fmt: (v) => num(v, 0), better: 'high', basis: 'score 0 to 100, screen build' },
  { label: 'Value', views: ['overview', 'valuation'], material: 10, get: (r) => r.v, fmt: (v) => num(v, 0), better: 'high', basis: 'score 0 to 100, screen build' },
  { label: 'Technical', views: ['overview'], material: 10, get: (r) => r.tech, fmt: (v) => num(v, 0), better: 'high', basis: 'score 0 to 100, screen build' },
  { label: 'P/E', views: ['overview', 'valuation'], material: 0.2, rel: true, get: (r) => (has(r.pe) && r.pe > 0 ? r.pe : null), fmt: (v) => ratio(v, 1), better: 'low', basis: 'at the screen close, trailing earnings' },
  { label: 'P/B', views: ['valuation'], material: 0.2, rel: true, get: (r) => r.pb, fmt: (v) => ratio(v, 2), better: 'low', basis: 'at the screen close' },
  { label: 'P/E vs own history', views: ['valuation'], material: 20, get: (r) => r.pe_pctile, fmt: (v) => `${num(v, 0)}th pct`, better: 'low', basis: 'percentile of its own P/E history' },
  { label: 'Dividend yield', views: ['valuation'], material: 1, get: (r) => r.div_yield, fmt: (v) => pct(v, 2, false), better: 'high', basis: 'at the screen close' },
  { label: 'ROCE', views: ['overview', 'quality'], material: 5, get: (r) => r.roce, fmt: (v) => pct(v, 1, false), better: 'high', basis: 'latest FY' },
  { label: 'ROE', views: ['quality'], material: 5, get: (r) => r.roe, fmt: (v) => pct(v, 1, false), better: 'high', basis: 'latest FY' },
  { label: 'EBIT margin', views: ['quality', 'financials'], material: 5, get: (r) => r.ebit_margin, fmt: (v) => pct(v, 1, false), better: 'high', basis: 'latest FY' },
  { label: 'Net margin', views: ['financials'], material: 5, get: (r) => r.net_margin, fmt: (v) => pct(v, 1, false), better: 'high', basis: 'latest FY' },
  { label: 'Debt / equity', views: ['overview', 'quality', 'financials'], material: 0.3, get: (r) => r.de, fmt: (v) => num(v, 2), better: 'low', basis: 'latest balance sheet' },
  { label: 'Interest cover', views: ['financials'], material: 3, get: (r) => r.icover, fmt: (v) => ratio(v, 1), better: 'high', basis: 'latest FY' },
  { label: 'Cash conversion', views: ['quality', 'financials'], material: 0.2, get: (r) => r.cfo_pat, fmt: (v) => ratio(v, 2), better: 'high', basis: 'operating cash ÷ profit, latest FY' },
  { label: 'Revenue CAGR', views: ['financials'], material: 5, period: true, get: (r) => r.rev_cagr, fmt: (v) => pct(v, 1, false), better: 'high', basis: 'over the statements on file' },
  { label: 'EPS CAGR', views: ['financials'], material: 5, period: true, get: (r) => r.eps_cagr, fmt: (v) => pct(v, 1, false), better: 'high', basis: 'over the statements on file' },
  { label: 'Piotroski F', views: ['quality'], material: 2, get: (r) => r.piotroski, fmt: (v, r) => `${num(v, 0)}/${r.piotroski_of ?? 9}`, better: 'high', basis: 'tests passed of those computable' },
  { label: '1 year', views: ['overview'], get: (r) => r.r1y, fmt: (v) => pct(v, 1), better: null, basis: 'price return to the screen close' },
  { label: 'From 52-week high', views: ['valuation'], get: (r) => r.from_high, fmt: (v) => pct(v, 0, false), better: null, basis: 'at the screen close' },
];

/** Measures the screen computes for every company but which, for a lender, rest on inputs that do not apply (C19). */
export const LENDER_CARE = new Set(['Quality', 'Piotroski F']);
export interface Mark { vals: (number | null)[]; na: boolean[]; best: number | null; why: string | null }
/** The one marking rule. `spans[i]` is company i's statement period ("first|last" end dates), for the CAGR rows. */
export function mark(sp: Spec, rows: Row[], spans: (string | null)[]): Mark {
  const vals = rows.map((r) => { const v = sp.get(r); return has(v) ? v : null; });
  const na = rows.map((r) => LENDER_NA.has(sp.label) && isLender(r));
  let why: string | null = null;
  if (!sp.better) why = 'no better direction is defined';
  if (sp.period && !(spans.every((y) => y !== null) && new Set(spans).size === 1)) why = 'the statement periods differ';
  // C19: a lender's Quality and Piotroski read inputs that do not describe a bank, so they are never marked where a lender is present
  if (LENDER_CARE.has(sp.label) && rows.some(isLender)) why = 'lenders are scored on inputs that do not apply to them';
  if (!why && sp.label === 'Piotroski F' && new Set(rows.filter((r) => has(r.piotroski)).map((r) => r.piotroski_of ?? 9)).size > 1) why = 'scored on different numbers of tests';
  const cmp = vals.filter((v, i) => v !== null && !na[i]) as number[];
  const sorted = [...cmp].sort((a, b) => (sp.better === 'low' ? a - b : b - a));
  const gap = sorted.length > 1 ? (sp.rel ? Math.abs(sorted[0] / sorted[1] - 1) : Math.abs(sorted[0] - sorted[1])) : 0;
  if (!why && sorted.length < 2) why = 'fewer than two comparable figures';
  if (!why && gap < (sp.material ?? 0)) why = 'the gap is not material';
  return { vals, na, best: why ? null : sorted[0], why };
}

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const lc = (s: string) => (/^(ROCE|ROE|P\/|EPS|EBIT)/.test(s) ? s.replace(/^EBIT margin$/, 'EBIT margin') : s.toLowerCase());

/** The lead: material differences first, then what cannot be compared and what is missing. At most `max` sentences. */
export function summarise(rows: Row[], spans: (string | null)[], max = 5): string[] {
  if (rows.length < 2) return [];
  const out: string[] = [];
  const order = ['Composite score', 'ROCE', 'ROE', 'Debt / equity', 'P/E', 'Revenue CAGR', 'EBIT margin', 'Cash conversion', 'Dividend yield'];
  for (const label of order) {
    const sp = SPECS.find((s) => s.label === label)!;
    const m = mark(sp, rows, spans);
    if (m.best === null) continue;
    const i = m.vals.findIndex((v, k) => v === m.best && !m.na[k]);
    const rest = m.vals.map((v, k) => ({ v, k })).filter((x) => x.k !== i && x.v !== null && !m.na[x.k]).sort((a, b) => (sp.better === 'low' ? (a.v as number) - (b.v as number) : (b.v as number) - (a.v as number)));
    const word = sp.better === 'low' ? (rows.length === 2 ? 'lower' : 'lowest') : (rows.length === 2 ? 'higher' : 'highest');
    const name = label === 'Composite score' ? 'composite score' : lc(label);
    const fig = (k: number) => sp.fmt(m.vals[k] as number, rows[k]);
    out.push(rows.length === 2 ? `${rows[i].sym} has the ${word} ${name} (${fig(i)} vs ${fig(rest[0].k)}).` : `${rows[i].sym} has the ${word} ${name} (${fig(i)}; next, ${rows[rest[0].k].sym} at ${fig(rest[0].k)}).`);
    if (out.length >= max - 2) break;
  }
  if (!out.length) out.push('No overview measure differs by enough to mark: the gaps are within the material thresholds.');
  const lenders = rows.filter(isLender).map((r) => r.sym);
  if (lenders.length) {
    const na = list([...LENDER_NA].map(lc));
    out.push(lenders.length === rows.length ? `${na} are not comparable for ${rows.length === 2 ? 'the two lenders' : `these ${rows.length} lenders`}: debt is their raw material.` : `${na} are not comparable for ${list(lenders)} (${lenders.length === 1 ? 'a lender' : 'lenders'}): debt is the raw material.`);
  }
  const notes: string[] = [];
  if (!(spans.every((y) => y !== null) && new Set(spans).size === 1)) notes.push('Revenue and EPS CAGR cover different statement periods, so they are not marked');
  const missing = rows.map((r) => ({ sym: r.sym, n: SPECS.filter((s) => !has(s.get(r)) && !(LENDER_NA.has(s.label) && isLender(r))).map((s) => lc(s.label)) })).filter((x) => x.n.length);
  if (missing.length) notes.push(`not in the feed: ${missing.slice(0, 2).map((x) => `${list(x.n.slice(0, 3))}${x.n.length > 3 ? ` and ${x.n.length - 3} more` : ''} for ${x.sym}`).join('; ')}`);
  if (notes.length) out.push(`${notes.join('; ').replace(/^./, (c) => c.toUpperCase())}.`);
  return out.slice(0, max);
}

/** C19: the screen's generic Quality score and Piotroski F for a lender. Upstream, the lender rule takes leverage out of
 *  Quality, so a bank's score stands on what is left (often ROE alone, `q_conf` 0.2), and Piotroski keeps its cash-flow,
 *  current-ratio and margin tests, which do not describe a bank. Labelled here; it cannot be fixed in this repo. */
export function lenderCaveat(r: Row): string | null {
  if (!isLender(r)) return null;
  const conf = has(r.q_conf) ? Math.round(r.q_conf * 100) : null;
  return `Quality includes measures that do not apply to lenders${conf !== null ? ` and rests on ${conf}% of its inputs` : ''}; Piotroski F counts cash-flow and margin tests that do not describe a bank. Read with care.`;
}
