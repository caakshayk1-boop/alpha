import type { Row } from './types';

export interface Filter { label: string; test: (r: Row) => boolean }
export interface Parsed { filters: Filter[]; unknown: string[] }
const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

const GROUPS: [RegExp, string, (r: Row) => boolean][] = [
  [/\b(it|tech|technology|software|it services)\b/, 'IT and technology', (r) => r.ind === 'Information Technology' || r.sector === 'Technology'],
  [/\b(pharma|pharmaceutical|healthcare|health|hospital)s?\b/, 'Healthcare', (r) => r.sector === 'Healthcare' || r.ind === 'Healthcare'],
  [/\b(bank|banks|banking|nbfc|financials?|lenders?|insurance)\b/, 'Financials', (r) => r.sector === 'Financial Services' || r.ind === 'Financial Services'],
  [/\b(auto|autos|automobile|automotive)\b/, 'Autos', (r) => r.ind === 'Automobile and Auto Components'],
  [/\b(fmcg|consumer staples|staples|consumer defensive)\b/, 'FMCG and staples', (r) => r.ind === 'Fast Moving Consumer Goods' || r.sector === 'Consumer Defensive'],
  [/\b(metals?|mining|steel)\b/, 'Metals and mining', (r) => r.ind === 'Metals & Mining'],
  [/\b(chemicals?)\b/, 'Chemicals', (r) => r.ind === 'Chemicals'],
  [/\b(power|utilities|utility)\b/, 'Power and utilities', (r) => r.ind === 'Power' || r.sector === 'Utilities'],
  [/\b(realty|real estate|property)\b/, 'Real estate', (r) => r.ind === 'Realty' || r.sector === 'Real Estate'],
  [/\b(capital goods|industrials?|engineering)\b/, 'Capital goods', (r) => r.ind === 'Capital Goods' || r.sector === 'Industrials'],
  [/\b(energy|oil|gas)\b/, 'Energy', (r) => r.sector === 'Energy' || r.ind === 'Oil Gas & Consumable Fuels'],
  [/\b(telecom|telecommunication)\b/, 'Telecom', (r) => r.ind === 'Telecommunication'],
  [/\b(media|entertainment)\b/, 'Media', (r) => r.ind === 'Media Entertainment & Publication'],
  [/\b(construction|infra|infrastructure)\b/, 'Construction', (r) => r.ind === 'Construction'],
  [/\b(textiles?)\b/, 'Textiles', (r) => r.ind === 'Textiles'],
  [/\b(consumer durables?|durables)\b/, 'Consumer durables', (r) => r.ind === 'Consumer Durables'],
];

const TIERS: [RegExp, string, string][] = [[/\blarge[- ]?caps?\b/, 'Large cap', 'large'], [/\bmid[- ]?caps?\b/, 'Mid cap', 'mid'], [/\bsmall[- ]?caps?\b/, 'Small cap', 'small'], [/\bmicro[- ]?caps?\b/, 'Micro cap', 'micro']];

const PHRASES: [RegExp, string, (r: Row) => boolean][] = [
  [/\buptrend(ing)?\b|\btrending up\b/, 'In an uptrend (price > 50-day > 200-day)', (r) => has(r.price) && has(r.sma50) && has(r.sma200) && r.price > r.sma50 && r.sma50 > r.sma200],
  [/\babove (the )?200[- ]?(day|dma)\b/, 'Above its 200-day average', (r) => has(r.price) && has(r.sma200) && r.price > r.sma200],
  [/\bnear (its )?(52[- ]?week|yearly|52w) high\b|\bnear highs?\b/, 'Within 5% of its 52-week high', (r) => has(r.from_high) && r.from_high >= -5],
  [/\bbeaten[- ]?down\b|\bfar from (its )?highs?\b/, 'More than 40% below its 52-week high', (r) => has(r.from_high) && r.from_high <= -40],
  [/\boversold\b/, 'Oversold (RSI under 30)', (r) => has(r.rsi) && r.rsi < 30],
  [/\boverbought\b/, 'Overbought (RSI over 70)', (r) => has(r.rsi) && r.rsi > 70],
  [/\b(cheap|undervalued|value)\b/, 'Cheap against its own history (P/E percentile ≤ 35)', (r) => has(r.pe_pctile) && r.pe_pctile <= 35],
  [/\b(high|good|top) quality\b|\bquality\b/, 'Quality score 70 or more', (r) => has(r.q) && r.q >= 70],
  [/\b(strong|good) momentum\b|\bmomentum\b|\boutperform(ing|ers)?\b/, '3-month relative strength 70 or more', (r) => has(r.rs3m) && r.rs3m >= 70],
  [/\blow debt\b|\bdebt[- ]?free\b|\bno debt\b|\bunlevered\b/, 'Debt/equity 0.3 or less', (r) => has(r.de) && r.de <= 0.3],
  [/\bprofitable\b/, 'Profitable (positive net margin)', (r) => has(r.net_margin) && r.net_margin > 0],
  [/\bcash[- ]?(generative|rich|backed)\b/, 'Operating cash at least 0.8× profit', (r) => has(r.cfo_pat) && r.cfo_pat >= 0.8],
  [/\bmagic formula\b/, 'In the Magic Formula top 100', (r) => !!r.mf?.rank && r.mf.rank <= 100],
  [/\bbuy rated\b|\bverdict buy\b|\bscreen says buy\b/, 'Screen verdict BUY', (r) => r.vd?.c === 'BUY'],
  [/\blow risk\b|\bsafe\b/, 'Risk level LOW', (r) => r.risk?.level === 'LOW'],
  [/\bliquid\b|\bhighly traded\b/, 'Turnover ₹10 crore a day or more', (r) => has(r.turnover_cr) && r.turnover_cr >= 10],
  [/\bdividend\b|\bincome\b/, 'Dividend yield 2% or more', (r) => has(r.div_yield) && r.div_yield >= 2],
  [/\bpromoter[- ]?(owned|led|heavy)\b/, 'Promoters hold 50% or more', (r) => has(r.insiders) && r.insiders >= 50],
  [/\bgrowth\b|\bgrowing\b|\bcompounders?\b/, 'Revenue CAGR 15% or more', (r) => has(r.rev_cagr) && r.rev_cagr >= 15],
];

type Num = (r: Row) => number | null | undefined;
const METRICS: [RegExp, string, string, Num][] = [
  [/(?:\broce\b)/, 'ROCE', '%', (r) => r.roce], [/(?:\broe\b)/, 'ROE', '%', (r) => r.roe],
  [/(?:debt(?:[ /-]*to[ /-]*equity|[ /-]*equity)?|\bd\/e\b|\bde\b)/, 'Debt/equity', '', (r) => r.de],
  [/(?:\bp\/?e\b|\bpe\b|price[- ]to[- ]earnings)/, 'P/E', '×', (r) => r.pe], [/(?:\bp\/?b\b|price[- ]to[- ]book)/, 'P/B', '×', (r) => r.pb],
  [/(?:revenue growth|sales growth|rev(?:enue)? cagr)/, 'Revenue CAGR', '%', (r) => r.rev_cagr], [/(?:eps growth|profit growth|earnings growth|eps cagr)/, 'EPS CAGR', '%', (r) => r.eps_cagr],
  [/(?:dividend yield|div yield|yield)/, 'Dividend yield', '%', (r) => r.div_yield], [/(?:piotroski)/, 'Piotroski', '', (r) => r.piotroski],
  [/(?:\brsi\b)/, 'RSI', '', (r) => r.rsi], [/(?:net margin|profit margin)/, 'Net margin', '%', (r) => r.net_margin], [/(?:ebit margin|operating margin)/, 'EBIT margin', '%', (r) => r.ebit_margin],
  [/(?:interest cover(?:age)?)/, 'Interest cover', '×', (r) => r.icover], [/(?:promoter(?: holding)?)/, 'Promoter holding', '%', (r) => r.insiders],
  [/(?:market ?cap(?:italisation)?|mcap)/, 'Market cap', ' cr', (r) => r.mcap_cr], [/(?:turnover|traded value)/, 'Daily turnover', ' cr', (r) => r.turnover_cr],
  [/(?:1[- ]?(?:year|yr|y) return|1y)/, '1-year return', '%', (r) => r.r1y], [/(?:3[- ]?(?:month|m) return|3m)/, '3-month return', '%', (r) => r.r3m], [/(?:1[- ]?(?:month|m) return|1m)/, '1-month return', '%', (r) => r.r1m],
  [/(?:\bquality\b)/, 'Quality score', '', (r) => r.q], [/(?:\bvalue score\b)/, 'Value score', '', (r) => r.v],
];
const ABOVE = '(?:above|over|greater than|more than|at least|>=|>|min(?:imum)?|exceeds?)';
const BELOW = '(?:below|under|less than|at most|<=|<|max(?:imum)?|lower than)';

/** Turns plain English into filters over the screen. Every clause it understood is returned as a labelled filter, and every word it did not is returned too. */
export function parse(q: string): Parsed {
  let s = ` ${q.toLowerCase().replace(/[,;]/g, ' ').replace(/₹|\brs\.?(?=\s*\d)|\bcrores?\b|\bcr\b/g, ' ').replace(/\s+/g, ' ')} `;
  const filters: Filter[] = [];
  for (const [re, label, key] of TIERS) if (re.test(s)) { filters.push({ label, test: (r) => r.tier === key }); s = s.replace(re, ' '); }
  for (const [re, label, f] of METRICS.map(([m, l, u, g]) => [m, l, [u, g] as const] as const)) {
    const [u, g] = f;
    const cmp = new RegExp(`${re.source}\\s*(?:is|of|:)?\\s*(${ABOVE}|${BELOW})?\\s*(-?\\d+(?:\\.\\d+)?)\\s*%?`);
    const m = s.match(cmp);
    if (m) {
      const dir = m[1] ?? '>=';
      const below = new RegExp(`^${BELOW}$`).test(dir);
      const v = Number(m[2]);
      filters.push({ label: `${label} ${below ? 'at most' : 'at least'} ${v}${u}`, test: (r) => { const x = g(r); return has(x) && (below ? x <= v : x >= v); } });
      s = s.replace(m[0], ' ');
    }
  }
  for (const [re, label, f] of PHRASES) if (re.test(s)) { filters.push({ label, test: f }); s = s.replace(new RegExp(re.source, 'g'), ' '); }
  const grp: [string, (r: Row) => boolean][] = [];
  for (const [re, label, f] of GROUPS) if (re.test(s)) { grp.push([label, f]); s = s.replace(new RegExp(re.source, 'g'), ' '); }
  if (grp.length) filters.push({ label: grp.map((g) => g[0]).join(' or '), test: (r) => grp.some((g) => g[1](r)) });
  const stop = new Set(['stocks', 'stock', 'companies', 'company', 'shares', 'with', 'and', 'in', 'the', 'a', 'an', 'that', 'are', 'is', 'show', 'me', 'find', 'give', 'high', 'low', 'good', 'best', 'top', 'of', 'for', 'to', 'cap', 'caps', 'sector', 'or', 'which', 'have', 'has', 'all', 'only', 'name', 'names', 'big', 'small', 'large', 'mid', 'micro', 'now', 'today', 'than', 'greater', 'less', 'at', 'least', 'most']);
  const unknown = s.split(' ').filter((w) => w && !stop.has(w) && !/^[-\d.%<>=]+$/.test(w));
  return { filters, unknown };
}
