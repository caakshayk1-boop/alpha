/** ONE answer to "may this figure be judged for this company?", used by the company page, the report, Discover, the engines and their explanations.
 *  Before this existed five places each decided on their own: the page hid ROCE and margins "for a lender" while the Case beside it praised the ROCE
 *  and the Countercase warned about it, Discover refused the quality filter, the engine said "not a lender" about a merchant banker, and the risk
 *  grade (built from those same ratios) was printed as a finding. Now every consumer asks here, so they cannot disagree.
 *
 *  Two reasons a figure is not meaningful, and nothing else:
 *   1. Financial sector. The only classification the feed publishes is the sector, so the whole sector is treated alike: statement ratios built on
 *      capital employed, operating margin, debt, interest cover and cash conversion are not comparable with industrial companies and are not judged.
 *      (Brokers, advisers and asset managers sit in the sector beside banks; the feed cannot tell them apart.)
 *   2. Implausible. EBIT above revenue (a margin over 100%) or a cash-conversion ratio blown up by a near-zero profit means the statement lines do not
 *      describe one business. That holds in any sector.
 *  A figure that is not meaningful is hidden with its reason; it is never shown as a strength or a flag, and never as zero. */
import type { Row } from './screen.ts';
import type { Year } from './data.ts';

export type MetricId = 'roce' | 'margin' | 'leverage' | 'cash' | 'cover';
export interface Verdict { ok: boolean; reason: string | null }
export interface Eligibility {
  financial: boolean;
  metrics: Record<MetricId, Verdict>;
  /** Size class. The feed carries it for the index-sized names only; an unknown class is stated, never read as "not micro". */
  size: { known: boolean; tier: string | null; label: string };
  /** Plain sentences, one per reason something is withheld, for display. */
  notes: string[];
}
export const FINANCIAL_SECTOR = 'Financial Services';
export const isFinancialSector = (r: Pick<Row, 'sector'>) => r.sector === FINANCIAL_SECTOR;
const IDS: MetricId[] = ['roce', 'margin', 'leverage', 'cash', 'cover'];
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const TIER_WORD: Record<string, string> = { large: 'Large cap', mid: 'Mid cap', small: 'Small cap', micro: 'Micro cap' };

export function eligibilityOf(row: Pick<Row, 'sector' | 'tier' | 'cfo_pat' | 'ebit_margin'>, years: readonly Year[] = []): Eligibility {
  const financial = isFinancialSector(row);
  const m = Object.fromEntries(IDS.map((i) => [i, { ok: true, reason: null }])) as Record<MetricId, Verdict>;
  const notes: string[] = [];
  if (financial) {
    for (const i of IDS) m[i] = { ok: false, reason: 'financial sector' };
    notes.push('Financial-sector company. The feed publishes the sector only, so return on capital, operating margin, debt, interest cover and cash conversion are not compared with other sectors and are not judged here.');
  } else {
    const recent = years.slice(0, 4);
    const over = recent.filter((y) => n(y.ebit_margin) && Math.abs(y.ebit_margin) > 100).map((y) => y.fy);
    if (over.length || (n(row.ebit_margin) && Math.abs(row.ebit_margin) > 100)) {
      const why = `operating profit exceeds revenue${over.length ? ` in ${over.join(', ')}` : ''}`;
      m.margin = { ok: false, reason: why }; m.roce = { ok: false, reason: why };
      notes.push(`Operating margin and return on capital are not meaningful: ${why}, so the statement lines do not describe one business.`);
    }
    const cash = recent.slice(0, 2).some((y) => { const c = (y as Year & { cfo_pat?: number | null }).cfo_pat; return n(c) && Math.abs(c) > 10; }) || (n(row.cfo_pat) && Math.abs(row.cfo_pat) > 10);
    if (cash) { m.cash = { ok: false, reason: 'profit is near zero' }; notes.push('Cash conversion is not meaningful: it divides by a profit close to zero, so the ratio is a number without a message.'); }
  }
  const tier = row.tier ?? null;
  const size = tier ? { known: true, tier, label: TIER_WORD[tier] ?? tier } : { known: false, tier: null, label: 'Size class not published' };
  return { financial, metrics: m, size, notes };
}
export const meaningful = (e: Eligibility, id: MetricId) => e.metrics[id].ok;

/** WHAT THE GRADE MEASURES. The screen's LOW / MEDIUM / HIGH is a weighted count of the warning flags the screen raised: statement quality (return on capital, margins, cash conversion, free cash flow,
 *  interest cover, leverage, working capital, a share-count break), valuation against industry peers, daily range (flagged from 5% a day), thin trading and a fall of 40% or more from the
 *  52-week high. In the published screen LOW is a score of 0 to 2, MEDIUM 3 to 5 and HIGH 6 or more. It does NOT read the price trend, a fall smaller than the flag, the market, your position size or anything
 *  about the future: of the 290 LOW names in the 26 Oct screen, 187 were below their 200-day average and 130 were more than 25% under their 52-week high. So it is named for what it counts. */
export const RISK_NAME = 'Screen flag level';
export const RISK_SCOPE = 'Scope: this counts the warning flags the screen raised on the latest annual statements (return on capital, margins, cash flow, interest cover, leverage), valuation against industry peers, daily range, thin trading and a fall of 40% or more from the 52-week high. It does not read the price trend, smaller falls, the market, your position size or the future.';
/** "Screen flag level LOW: no flags raised." / "... HIGH: 7 flags raised." An unknown count says only the level. */
export function riskSentence(level: string, flags: number | null): string { return `${RISK_NAME} ${level}${flags == null ? '' : `: ${flags === 0 ? 'no flags' : flags === 1 ? '1 flag' : `${flags} flags`} raised`}.`; }
/** What an empty flag list may be called. It is never "no risk". */
export const NO_FLAGS_SENTENCE = 'No screen flag was raised. That is not a finding that there are no risks: the screen reads only the ratios and price measures in the scope line, so read the filings and the chart anyway.';
/** The screen's risk grade is built from the ratios above. When any of them is withheld the grade is not a clean finding, so it is not printed as one. */
export function riskGradeOf(row: Pick<Row, 'risk_lvl'>, e: Eligibility): { level: string | null; note: string | null } {
  if (!row.risk_lvl) return { level: null, note: null };
  if (e.financial) return { level: null, note: 'Risk grade not shown: it is built from ratios that do not apply to financial-sector companies.' };
  const bad = IDS.filter((i) => !e.metrics[i].ok);
  return bad.length ? { level: row.risk_lvl, note: `This grade leans on figures flagged not meaningful here, so read it as partial. ${RISK_SCOPE}` } : { level: row.risk_lvl, note: `${RISK_NAME}, counting flags only. ${RISK_SCOPE}` };
}

/* ---------- the case and the countercase ---------- */
export interface Item { t: string; k: string; topic: string; sev?: string }
interface Topic { id: string; re: RegExp; metric: MetricId | null }
// order matters: the first match wins
const TOPICS: Topic[] = [
  { id: 'shares', re: /share count/i, metric: null },
  { id: 'margin_jump', re: /margin discontinuity|margin moved|margin .*year on year/i, metric: 'margin' },
  { id: 'margin_trend', re: /operating margin|EBIT margin/i, metric: 'margin' },
  { id: 'roce_trend', re: /return on capital (has )?(fall|declin|compress)|ROCE trend|ROCE [\d.]+% vs/i, metric: 'roce' },
  { id: 'roce_level', re: /capital employed|ROCE/i, metric: 'roce' },
  { id: 'leverage', re: /debt|borrowing|leverage|gearing/i, metric: 'leverage' },
  { id: 'cover', re: /interest cover|icover/i, metric: 'cover' },
  { id: 'cash', re: /cash conversion|cash from operations|free cash|operating cash|CFO/i, metric: 'cash' },
  { id: 'stretch', re: /200-day average|200-day/i, metric: null },
  { id: 'growth', re: /revenue|sales/i, metric: null },
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function topicOf(it: { t: string; k: string }): { id: string; metric: MetricId | null } {
  const text = `${it.t} ${it.k}`; const hit = TOPICS.find((x) => x.re.test(text));
  return hit ? { id: hit.id, metric: hit.metric } : { id: norm(it.t), metric: null };
}
export interface Curated { strengths: Item[]; counters: Item[]; hidden: { item: Item; reason: string }[]; merged: number }
const SEV = (s?: string) => (s === 'high' ? 0 : s === 'med' ? 1 : 2);
/** Strengths and counter-arguments with the same rules applied to both sides: a line about a figure that is not meaningful is hidden (and counted), and
 *  two lines about the same thing (a risk flag and a weakness that say "return on capital is falling") become one. */
export function curateCase(input: { strengths: readonly { t: string; k: string }[]; flags: readonly { t: string; k: string; s?: string }[]; weaknesses: readonly { t: string; k: string }[] }, e: Eligibility): Curated {
  const hidden: Curated['hidden'] = []; let merged = 0;
  const run = (src: { t: string; k: string; s?: string }[]): Item[] => {
    const seen = new Set<string>(); const out: Item[] = [];
    for (const x of src) {
      const tp = topicOf(x); const it: Item = { t: x.t, k: x.k, topic: tp.id, sev: x.s };
      if (tp.metric && !e.metrics[tp.metric].ok) { hidden.push({ item: it, reason: e.metrics[tp.metric].reason ?? 'not meaningful' }); continue; }
      if (seen.has(tp.id)) { merged++; continue; }
      seen.add(tp.id); out.push(it);
    }
    return out;
  };
  const strengths = run([...input.strengths]);
  const counterSrc = [...input.flags].sort((a, b) => SEV(a.s) - SEV(b.s)).concat(input.weaknesses.map((w) => ({ ...w, s: undefined })));
  return { strengths, counters: run(counterSrc), hidden, merged };
}
