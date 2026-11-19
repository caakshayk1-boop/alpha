/** The insight engine: for each stock, what is DISTINCTIVE about it versus its peers, written in plain sentences. No LLM, no randomness: the same feed gives the same text.
 *  Rules that make pages differ and never repeat themselves:
 *   - A fact exists only if the stock is unusual on that metric (top or bottom ~quintile of its sector or the whole universe). Average is never reported.
 *   - At most 2 facts per topic and 6 in all; a metric appears in at most one fact.
 *   - Facts quote a RANK (top 3% of 94 Technology stocks), never the raw value: the stats grid owns the numbers. So no number is shown twice on a page.
 *   - If nothing is unusual the page says so in one sentence instead of filler. */
import { type Row, type Cohorts, num, tierOf, sectorOf, industryOf, f1, f2, pct, spct, cr, mult, rs } from './feed.ts';
export type Topic = 'quality' | 'growth' | 'valuation' | 'momentum' | 'balance' | 'cash' | 'ownership' | 'risk' | 'liquidity';
interface M { key: string; topic: Topic; name: string; hi: string; lo: string; invert?: boolean }   // hi/lo: the phrase when top / bottom of the cohort
export const METRICS: M[] = [
  { key: 'roce', topic: 'quality', name: 'return on capital employed', hi: 'earns an unusually high return on its capital', lo: 'earns a low return on its capital' },
  { key: 'roe', topic: 'quality', name: 'return on equity', hi: 'has a high return on equity', lo: 'has a weak return on equity' },
  { key: 'ebit_margin', topic: 'quality', name: 'operating margin', hi: 'keeps an unusually wide operating margin', lo: 'runs on a thin operating margin' },
  { key: 'net_margin', topic: 'quality', name: 'net margin', hi: 'keeps a high share of revenue as profit', lo: 'keeps little of its revenue as profit' },
  { key: 'rev_cagr', topic: 'growth', name: 'three-year revenue growth', hi: 'has grown revenue faster than most peers', lo: 'has grown revenue slower than most peers' },
  { key: 'eps_cagr', topic: 'growth', name: 'three-year earnings-per-share growth', hi: 'has compounded earnings per share quickly', lo: 'has barely grown earnings per share' },
  { key: 'pat_yoy', topic: 'growth', name: 'latest-year profit growth', hi: 'grew profit sharply in the latest year', lo: 'saw profit fall back in the latest year' },
  { key: 'pe', topic: 'valuation', name: 'price-to-earnings', hi: 'trades at a rich earnings multiple', lo: 'trades at a low earnings multiple' },
  { key: 'pb', topic: 'valuation', name: 'price-to-book', hi: 'trades at a high multiple of book value', lo: 'trades at a low multiple of book value' },
  { key: 'div_yield', topic: 'valuation', name: 'dividend yield', hi: 'pays a high dividend yield', lo: 'pays no meaningful dividend' },
  { key: 'r3m', topic: 'momentum', name: 'three-month return', hi: 'has risen faster than most peers over three months', lo: 'has lagged most peers over three months' },
  { key: 'r1y', topic: 'momentum', name: 'one-year return', hi: 'has been among the stronger performers over a year', lo: 'has been among the weaker performers over a year' },
  { key: 'rs1y', topic: 'momentum', name: 'one-year return against the Nifty', hi: 'has beaten the Nifty by a wide margin over a year', lo: 'has trailed the Nifty by a wide margin over a year' },
  { key: 'de', topic: 'balance', name: 'debt to equity', hi: 'carries more debt against equity than most peers', lo: 'carries very little debt against equity', invert: true },
  { key: 'icover', topic: 'balance', name: 'interest cover', hi: 'covers its interest many times over', lo: 'has thin interest cover' },
  { key: 'curr', topic: 'balance', name: 'current ratio', hi: 'holds ample short-term assets against short-term bills', lo: 'holds little short-term cover against its bills' },
  { key: 'cfo_pat', topic: 'cash', name: 'cash conversion', hi: 'turns an unusually large share of profit into operating cash', lo: 'turns little of its profit into operating cash' },
  { key: 'fcf_margin', topic: 'cash', name: 'free-cash-flow margin', hi: 'keeps a large share of revenue as free cash', lo: 'keeps little of its revenue as free cash' },
  { key: 'insiders', topic: 'ownership', name: 'insider holding', hi: 'is held more tightly by insiders than most peers', lo: 'has a small insider holding' },
  { key: 'instis', topic: 'ownership', name: 'institutional holding', hi: 'has a large institutional shareholder base', lo: 'has few institutional holders' },
  { key: 'sd1y', topic: 'risk', name: 'one-year volatility', hi: 'has been more volatile than most peers', lo: 'has been calmer than most peers', invert: true },
  { key: 'turnover_cr', topic: 'liquidity', name: 'daily turnover', hi: 'trades in unusually large value each day', lo: 'trades thinly' },
];
export interface Fact { metric: string; topic: Topic; label: string; sentence: string; strength: number; side: 'hi' | 'lo'; good: boolean | null }
const topPhrase = (p: number) => (p >= 50 ? `top ${Math.max(1, Math.round(100 - p))}%` : `bottom ${Math.max(1, Math.round(p))}%`);
const GOOD_HIGH = new Set(['roce', 'roe', 'ebit_margin', 'net_margin', 'rev_cagr', 'eps_cagr', 'pat_yoy', 'div_yield', 'r3m', 'r1y', 'rs1y', 'icover', 'curr', 'cfo_pat', 'fcf_margin']);
export function facts(r: Row, co: Cohorts, threshold = 0.6): Fact[] {
  const out: Fact[] = [];
  for (const m of METRICS) {
    const k = co.rank(m.key, r); if (k.universe == null) continue;
    const useSector = k.sector != null && k.nSector >= 10; const p = useSector ? k.sector! : k.universe; const strength = Math.abs(p - 50) / 50; if (strength < threshold) continue;
    if (m.key === 'div_yield' && p < 50) continue;                                   // "pays no dividend" is common info, not a distinction
    const side: 'hi' | 'lo' = p >= 50 ? 'hi' : 'lo'; const cohort = useSector ? `${k.nSector} ${k.sectorName} stocks` : 'the 999 stocks tracked';
    const good = m.invert ? (side === 'lo' ? true : false) : GOOD_HIGH.has(m.key) ? side === 'hi' : null;
    if (m.key === 'icover' && side === 'hi' && (num(r, 'de') ?? 1) < 0.1) continue;   // interest cover of a debt-free company is trivially huge and repeats the balance-sheet fact
    out.push({ metric: m.key, topic: m.topic, side, good, strength, label: cap(side === 'hi' ? m.hi : m.lo), sentence: `${cap(m.name)} is in the ${topPhrase(p)} of ${cohort}.` });
  }
  out.sort((a, b) => b.strength - a.strength || a.metric.localeCompare(b.metric)); const picked: Fact[] = [], perTopic = new Map<Topic, number>();
  for (const f of out) { if ((perTopic.get(f.topic) ?? 0) >= 2) continue; picked.push(f); perTopic.set(f.topic, (perTopic.get(f.topic) ?? 0) + 1); if (picked.length === 6) break; }
  return picked;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1); const art = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
/** Deterministic variety: pick one of several phrasings by a hash of the symbol, so neighbouring pages do not read alike. */
const h = (s: string) => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
const pick = <T,>(sym: string, salt: string, a: T[]) => a[h(sym + salt) % a.length];
const TIER: Record<string, string> = { large: 'large-cap', mid: 'mid-cap', small: 'small-cap', micro: 'micro-cap' };

export interface Writeup { position: string; profile: string; trend: string }
export function writeup(r: Row, rows: Row[], co: Cohorts, fs: Fact[]): Writeup {
  const sym = r.sym, tier = tierOf(r), ind = industryOf(r), sec = sectorOf(r), mc = num(r, 'mcap_cr');
  const withCap = rows.filter((x) => num(x, 'mcap_cr') != null); const sizeRank = mc == null ? null : withCap.filter((x) => (num(x, 'mcap_cr') as number) > mc).length + 1;
  const kind = [tier ? TIER[tier] : '', ind && ind !== sec && r.sector ? `${ind} company in ${sec}` : r.sector ? `${sec} company` : ind ? `${ind} company` : 'company'].filter(Boolean).join(' ');
  const size = mc != null ? `${pick(sym, 'p2', ['It has a market value of', 'The market values it at', 'Its market value is'])} ${cr(mc)}, number ${sizeRank} of the ${withCap.length} stocks here that have one.` : 'The source data carries no market value for it, so no size rank is given.';
  const position = `${r.name} is ${art(kind)} ${kind}. ${size}`;
  const good = fs.filter((f) => f.good === true), bad = fs.filter((f) => f.good === false);
  let profile: string;
  if (!fs.length) profile = 'No measure of quality, growth, valuation or balance sheet is unusual against its peers. The stats below are the whole story.';
  else { const t = (a: Fact[]) => [...new Set(a.map((f) => TOPIC_WORD[f.topic]))].slice(0, 2).join(' and '); const parts: string[] = [];
    if (good.length) parts.push(`${pick(sym, 'g', ['Where it stands out is', 'Its strengths against peers are', 'It is distinguished by'])} ${t(good)}.`);
    if (bad.length) parts.push(`${pick(sym, 'b', ['The weaker side is', 'It is behind peers on', 'Where it lags is'])} ${t(bad)}.`);
    const neutral = fs.filter((f) => f.good === null); if (neutral.length && !parts.length) parts.push(`What is unusual about it is ${t(neutral)}.`);
    profile = parts.join(' '); }
  const price = num(r, 'price'), s200 = num(r, 'sma200'), hi52 = num(r, 'from_high'), rs3 = num(r, 'rs3m'), rsi = num(r, 'rsi');
  const bits: string[] = [];
  if (price != null && s200 != null) bits.push(r.stack ? 'The price sits above its 20, 50 and 200-day averages, and the averages are in rising order.' : price > s200 ? 'The price is above its 200-day average, but the shorter averages are not yet in order.' : 'The price is below its 200-day average.');
  if (hi52 != null) bits.push(hi52 > -3 ? 'It is trading close to its 52-week high.' : hi52 > -15 ? 'It is a little below its 52-week high.' : hi52 > -30 ? 'It is well below its 52-week high.' : 'It is far below its 52-week high.');
  if (rs3 != null) bits.push(rs3 >= 5 ? 'Over three months it has run clearly ahead of the Nifty.' : rs3 <= -5 ? 'Over three months it has fallen clearly behind the Nifty.' : 'Over three months it has kept roughly level with the Nifty.');
  if (rsi != null && (rsi >= 70 || rsi <= 30)) bits.push(rsi >= 70 ? 'Its 14-day RSI is stretched.' : 'Its 14-day RSI is washed out.');
  return { position, profile, trend: bits.join(' ') || 'There is not enough price history in the feed to describe the trend.' };
}
const TOPIC_WORD: Record<Topic, string> = { quality: 'profitability', growth: 'growth', valuation: 'valuation', momentum: 'price momentum', balance: 'the balance sheet', cash: 'cash generation', ownership: 'ownership', risk: 'volatility', liquidity: 'trading liquidity' };

/** The five most similar stocks in the same sector, by distance over the source's own four scores plus log market cap. Excludes the stock itself. */
export function peers(r: Row, rows: Row[], n = 5): Row[] {
  const v = (x: Row) => ['q', 'g', 'v', 'tech'].map((k) => num(x, k)); const me = v(r); if (me.some((x) => x == null)) return [];
  const mcOf = (x: Row) => num(x, 'mcap_cr'), lm = (x: Row) => Math.log(Math.max(1, mcOf(x) ?? 1));
  return rows.filter((x) => x.sym !== r.sym && sectorOf(x) === sectorOf(r) && r.sector && v(x).every((y) => y != null))
    .map((x) => { const score = v(x).reduce((a, y, i) => a + ((y as number) - (me[i] as number)) ** 2 / 100 ** 2, 0); const size = mcOf(r) != null && mcOf(x) != null ? ((lm(x) - lm(r)) / 6) ** 2 : 0.05;
      return { x, d: Math.sqrt(score + size) + (r.ind && x.ind === r.ind ? 0 : 0.5) }; })
    .sort((a, b) => a.d - b.d || a.x.sym.localeCompare(b.x.sym)).slice(0, n).map((o) => o.x);
}
export const lines = { pct, spct, f1, f2, mult, rs };
