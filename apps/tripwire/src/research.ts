/** Company-first, deterministic reads. Every interpretation travels with its fact, date and rule. */
import type { Company } from './data.ts';
import { meaningful, eligibilityOf } from './eligibility.ts';
import { metric } from './metrics.ts';
import type { Row } from './screen.ts';
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const f = (n: number) => n.toFixed(1);
export interface ResearchFact { id: string; label: string; read: string; fact: string; rule: string; period: string; source: string; href: string; limit: string; question: string }
export function sourceLink(sym: string, statement = false): string { return `https://finance.yahoo.com/quote/${encodeURIComponent(sym + '.NS')}/${statement ? 'financials/' : 'history/'}`; }
export function evidenceDate(r: Row, id: string): string {
  return ['roce', 'roce_med', 'de', 'rev_cagr', 'eps_cagr', 'net_margin', 'ebit_margin', 'cfo_pat', 'piotroski'].includes(id)
    ? `Accounts: ${r.fy ?? 'reporting period unavailable'}. Snapshot close: ${r.last_date ?? 'date unavailable'}. Filing publication date is not supplied.`
    : `Close: ${r.last_date ?? 'date unavailable'}. ${metric(id)?.period ?? 'Window defined by the selected figure'}.`;
}
export function companyRead(c: Company): ResearchFact[] {
  const r = c.row, el = eligibilityOf(r, c.years ?? []); const out: ResearchFact[] = [];
  const add = (id: string, label: string, read: string, fact: string, rule: string, question: string, statement = true) => out.push({ id, label, read, fact, rule, question, period: evidenceDate(r, id), source: statement ? 'Annual statements via Yahoo Finance → Alpha screen' : 'Yahoo Finance prices → Alpha screen', href: sourceLink(c.sym, statement), limit: metric(id)?.caution ?? 'A descriptive screen measure, not a valuation or a prediction. Check the underlying filing.' });
  if (finite(r.rev_cagr)) add('rev_cagr', 'Business', r.rev_cagr > 0 ? 'Revenue expanded' : r.rev_cagr < 0 ? 'Revenue contracted' : 'Revenue unchanged', `Revenue CAGR ${f(r.rev_cagr)}%`, 'Positive / zero / negative compound revenue growth over the years available.', 'What explains this revenue trend, and does the latest filing show it continuing?');
  if (meaningful(el, 'roce') && finite(r.roce_med)) add('roce', 'Quality', r.roce_med >= 15 ? 'ROCE ≥15%' : 'ROCE <15%', `Median ROCE ${f(r.roce_med)}%`, '15% is the existing Quality engine research threshold, not a universal quality rating.', 'What supports the reported return on capital, and how much capital must be reinvested?');
  if (finite(r.pe) && r.pe > 0) add('pe', 'Valuation', finite(r.pe_pctile) ? r.pe_pctile <= 20 ? 'Low in its own history' : r.pe_pctile >= 80 ? 'High in its own history' : 'Mid historical range' : 'Historical comparison unavailable', `Trailing PE ${f(r.pe)}×${finite(r.pe_pctile) ? ` · percentile ${f(r.pe_pctile)}` : ''}`, '20th / 80th percentiles delimit low / high. A low multiple is not proof of cheapness.', 'Does the earnings outlook justify this multiple, and are trailing earnings representative?', false);
  if (c.inst && finite(c.inst.fii_pp) && finite(c.inst.dii_pp) && c.inst.period && c.inst.prev_period) {
    const i = c.inst; out.push({ id: 'ownership', label: 'Ownership', read: Math.max(Math.abs(i.fii_pp!), Math.abs(i.dii_pp!)) < .25 ? 'Small stake changes' : 'Reported stakes changed', fact: `FII ${i.fii_pp! >= 0 ? '+' : ''}${f(i.fii_pp!)} pp · DII ${i.dii_pp! >= 0 ? '+' : ''}${f(i.dii_pp!)} pp`, rule: 'A change of at least 0.25 percentage points in either group is highlighted; it is not a buy or sell signal.', period: `${i.prev_period} → ${i.period}`, source: 'NSE quarterly shareholding filings, via the published ownership feed', href: `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(c.sym)}`, limit: 'Quarterly snapshots do not reveal daily trading or investor intentions.', question: 'Which ownership groups changed, and does the filing explain a share-count or classification change?' });
  }
  return out;
}
export function researchEvidence(c: Company, fact: ResearchFact): string {
  return `${c.sym}: ${fact.fact}\n${fact.period}\nRule: ${fact.rule}\nSource: ${fact.source}\n${fact.href}\nLimits: ${fact.limit}`;
}
export function materialDifferences(cs: Company[]): { label: string; text: string; why: string; sources: { sym: string; date: string }[] }[] {
  const specs = [
    { id: 'roce', key: 'roce_med', label: 'Return on capital', threshold: 5, unit: 'pp', why: 'A 5 pp spread warrants checking capital intensity and reinvestment needs. Highest is not automatically best.', eligible: (c: Company) => meaningful(eligibilityOf(c.row, c.years), 'roce') },
    { id: 'rev_cagr', key: 'rev_cagr', label: 'Revenue growth', threshold: 5, unit: 'pp', why: 'A 5 pp spread may reflect different bases, acquisitions or business cycles; inspect the filings.', eligible: () => true },
    { id: 'de', key: 'de', label: 'Leverage', threshold: .5, unit: '×', why: 'A 0.5× spread changes financing exposure; compare cash generation and debt maturities.', eligible: (c: Company) => meaningful(eligibilityOf(c.row, c.years), 'leverage') },
    { id: 'pe', key: 'pe', label: 'Earnings multiple', threshold: 5, unit: '×', why: 'A 5× PE spread can reflect different growth or earnings quality; lower is not automatically better.', eligible: (c: Company) => finite(c.row.pe) && c.row.pe! > 0 },
  ];
  return specs.flatMap((s) => {
    const ns = cs.filter(s.eligible).map((c) => ({ c, v: c.row[s.key as keyof Row] })).filter((x): x is { c: Company; v: number } => finite(x.v)).sort((a, b) => b.v - a.v);
    if (ns.length < 2 || ns[0].v - ns.at(-1)!.v + 1e-9 < s.threshold) return [];
    const pair = [ns[0], ns.at(-1)!]; return [{ label: s.label, text: `${pair[0].c.sym} ${f(pair[0].v)} vs ${pair[1].c.sym} ${f(pair[1].v)} · spread ${f(pair[0].v - pair[1].v)} ${s.unit}`, why: s.why, sources: pair.map(({ c }) => ({ sym: c.sym, date: evidenceDate(c.row, s.id) })) }];
  }).slice(0, 3);
}
