/** The four screens evaluated on the owner's daily feed (ADR-013). Same rules, same pass/fail-per-rule output as screens.ts, but every input comes from the feed:
 *  Piotroski from the feed's nine per-stock test results, Magic Formula from the feed's own rank (its EBIT/EV and EBIT/invested-capital ranking with its exclusions),
 *  Quality+Momentum from ROCE, three-year profit, 12-1 momentum and the 200-day average, Conservative from debt/equity and three years of ROCE and operating cash flow.
 *  A missing input makes a rule null (not scorable), never pass or fail. Version 2 (ADR-015): stricter than Tripwire's engines. Universe: market cap at least 2,000 crore; every screen also requires liquidity (feed flag and at least 10 crore a day, Alpha's own floor); each screen LISTS only its 5 best passers. */
import { type Feed, type Row, num } from './feed.ts'; import type { RuleResult, StockResult, ScreenRun } from './screens.ts'; import { PIOTROSKI_LABELS } from './stockpage.ts';
export const MIN_MCAP = 2000, MAGIC_MIN_MCAP = 5000, MAGIC_TOP = 10, MIN_TURNOVER = 10, LIST_MAX = 5;
const R = (id: string, label: string, threshold: string, pass: boolean | null, value: string, why?: string | null): RuleResult => ({ id, label, pass, value: pass === null ? (why ?? 'missing') : value, threshold });
/** Tripwire's eligibility rule (apps/tripwire/src/eligibility.ts): capital-based ratios are not judged for financial-sector companies, nor where the statement lines cannot describe one business. Returns the reason, or null when the figures are meaningful. */
export function notMeaningful(r: Row): string | null { if (r.sector === 'Financial Services') return 'not judged: financial sector'; const m = num(r, 'ebit_margin'), c = num(r, 'cfo_pat'); if (m != null && Math.abs(m) > 100) return 'not meaningful: operating profit exceeds revenue'; if (c != null && Math.abs(c) > 10) return 'not meaningful: profit near zero'; return null; }
const f1 = (x: number) => x.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const years = (F: Feed, sym: string): any[] => (Array.isArray(F.detail[sym]?.years) ? F.detail[sym].years : []);
function finish(symbol: string, rules: RuleResult[], need: (n: number) => boolean): StockResult { const scorable = rules.every((r) => r.pass !== null), n = rules.filter((r) => r.pass === true).length; return { symbol, rules, scorable, passes: scorable && need(n), failed: rules.filter((r) => r.pass === false), score: n }; }
function run(id: string, uni: Row[], per: StockResult[], near: (s: StockResult) => boolean): ScreenRun {
  const detail: Record<string, StockResult> = {}; for (const s of per) detail[s.symbol] = s;
  return { screen_id: id, universe_n: uni.length, detail, passed: per.filter((s) => s.passes).map((s) => s.symbol).sort(), not_scorable: per.filter((s) => !s.scorable).map((s) => s.symbol).sort(), refused: per.filter((s) => s.scorable && !s.passes).map((s) => s.symbol).sort(),
    near_miss: per.filter((s) => !s.passes && near(s)).map((s) => ({ symbol: s.symbol, failed_rule: s.failed[0]?.label ?? '', gap: s.failed[0] ? `${s.failed[0].value} vs ${s.failed[0].threshold}` : '' })).sort((a, b) => a.symbol.localeCompare(b.symbol)) };
}
export const universe = (F: Feed): Row[] => F.rows.filter((r) => (num(r, 'mcap_cr') ?? 0) >= MIN_MCAP);
const liquidRule = (r: Row): RuleResult => { const t = num(r, 'turnover_cr'); return R('liq', 'Liquid: trades at least ₹10 crore a day', 'feed flag and ≥ ₹10 cr', r.liquid == null || t == null ? null : r.liquid === true && t >= MIN_TURNOVER, t == null ? '' : `₹${f1(t)} cr`); };
const above200 = (r: Row): RuleResult => { const px = num(r, 'price'), s2 = num(r, 'sma200'); return R('trend', 'Price is above its 200-day average', 'close > 200-day', px == null || s2 == null ? null : px > s2, px == null || s2 == null ? '' : `₹${f1(px)} vs ₹${f1(s2)}`); };
/** Order inside a screen: the feed's composite score, highest first (Magic Formula: its own rank, lowest first). The first LIST_MAX passers are the screen's list. */
const orderBy = (F: Feed, a: string, b: string, magic = false) => { const A = F.bySym.get(a)!, B = F.bySym.get(b)!; return magic ? (A.mf?.rank ?? 1e9) - (B.mf?.rank ?? 1e9) || a.localeCompare(b) : (num(B, 'comp') ?? 0) - (num(A, 'comp') ?? 0) || a.localeCompare(b); };
function withList(F: Feed, r: ScreenRun, magic = false): ScreenRun { return { ...r, listed: [...r.passed].sort((a, b) => orderBy(F, a, b, magic)).slice(0, LIST_MAX) }; }
const allOf = (rs: RuleResult[]) => rs.length;

export function piotroskiFeed(F: Feed): ScreenRun { const uni = universe(F);
  const per = uni.map((r) => { const bits = F.detail[r.sym]?.piotroski_bits; const ok = typeof bits === 'string' && bits.length === 9;
    return finish(r.sym, [...PIOTROSKI_LABELS.map((l, i) => R(`f${i + 1}`, l, 'test passed (the feed gives each test\'s result, not its inputs)', ok ? bits[i] === '1' : null, ok && bits[i] === '1' ? 'passed' : 'failed')), above200(r), liquidRule(r)], (n) => n === 11); });
  return withList(F, run('piotroski', uni, per, (s) => s.scorable && s.failed.length === 1)); }

export function magicFeed(F: Feed): ScreenRun { const uni = universe(F);
  const base = uni.map((r) => { const mf = r.mf, rank = typeof mf?.rank === 'number' ? mf.rank : null; const mc = num(r, 'mcap_cr') ?? 0;
    const rules = mf == null ? [R('m1', 'Eligible and ranked by the source', 'ranked on earnings yield and return on capital', null, '')] : rank == null ? [R('m1', 'Eligible and ranked by the source', 'not excluded (lenders, insurers, real estate, utilities, one-off years, negative EBIT)', false, String(mf.why ?? 'excluded'))]
      : [R('m1', 'Eligible and ranked by the source', 'not excluded', true, 'ranked'), R('m2', 'Earnings yield (EBIT ÷ enterprise value)', 'positive', typeof mf.ey === 'number' ? mf.ey > 0 : null, typeof mf.ey === 'number' ? `${f1(mf.ey)}%` : ''), R('m3', 'Return on capital (EBIT ÷ invested capital)', 'positive', typeof mf.roc === 'number' ? mf.roc > 0 : null, typeof mf.roc === 'number' ? `${f1(mf.roc)}%` : ''),
        R('m4', 'Market cap is at least ₹5,000 crore', '≥ ₹5,000 cr', mc >= MAGIC_MIN_MCAP, `₹${Math.round(mc).toLocaleString('en-IN')} cr`), liquidRule(r)];
    return { r, rank, rules }; });
  const pool = base.filter((b) => b.rank != null && b.rules.every((x) => x.pass === true)).sort((a, b) => a.rank! - b.rank!); const pos = new Map(pool.map((b, i) => [b.r.sym, i + 1]));
  const per = base.map((b) => { const p = pos.get(b.r.sym) ?? null; const rules = b.rank == null ? b.rules : [...b.rules, R('m6', `Among the best ${MAGIC_TOP} by the source's combined rank, after the rules above`, `position ≤ ${MAGIC_TOP}`, b.rules.some((x) => x.pass !== true) ? (b.rules.some((x) => x.pass === null) ? null : false) : (p ?? 99) <= MAGIC_TOP, p ? `position ${p} of ${pool.length} (feed rank ${b.rank})` : 'not in the eligible pool')];
    const s = finish(b.r.sym, rules, () => p != null && p <= MAGIC_TOP); (s as any).pos = p; return s; });
  return withList(F, run('magic-formula', uni, per, (s) => { const p = (s as any).pos as number | null; return p != null && p > MAGIC_TOP && p <= MAGIC_TOP + 5; }), true); }

const mom = (r: Row) => { const y = num(r, 'r1y'), m = num(r, 'r1m'); return y == null || m == null ? null : ((1 + y / 100) / (1 + m / 100) - 1) * 100; };
export function qualityMomentumFeed(F: Feed): ScreenRun { const uni = universe(F); const ms = uni.map(mom).filter((x): x is number => x != null).sort((a, b) => a - b); const cut = ms.length ? ms[Math.floor(ms.length * 0.9)] : null;
  const per = uni.map((r) => { const nm = notMeaningful(r), y = years(F, r.sym), roce = num(r, 'roce'), m = mom(r), p0 = y[0]?.pat_cr, p2 = y[2]?.pat_cr; const pat = typeof p0 === 'number' && typeof p2 === 'number';
    return finish(r.sym, [R('q1', 'Return on capital employed is at least 20%', '≥ 20%', nm || roce == null ? null : roce >= 20, roce == null ? '' : `${f1(roce)}%`, nm), R('q2', 'Profit is at least 25% above two years ago (base positive)', 'profit ≥ 1.25× two years ago', pat ? p2 > 0 && p0 >= p2 * 1.25 : null, pat ? `₹${Math.round(p0)} vs ₹${Math.round(p2)} cr` : ''),
      R('q3', '12-1 month price momentum is in the top tenth of the universe', cut == null ? 'top 10%' : `≥ ${f1(cut)}%`, m == null || cut == null ? null : m >= cut, m == null ? '' : `${f1(m)}%`), above200(r), liquidRule(r)], (n) => n === 5); });
  return withList(F, run('quality-momentum', uni, per, (s) => s.scorable && s.failed.length === 1)); }

export function conservativeFeed(F: Feed): ScreenRun { const uni = universe(F);
  const per = uni.map((r) => { const nm = notMeaningful(r), y = years(F, r.sym).slice(0, 3), de = num(r, 'de'), cp = num(r, 'cfo_pat'), three = y.length === 3; const roces = y.map((x) => x.roce), cfos = y.map((x) => x.cfo_cr);
    return finish(r.sym, [R('c1', 'Debt to equity is at most 0.1', '≤ 0.1', nm || de == null ? null : de <= 0.1, de == null ? '' : de.toFixed(2), nm), R('c2', 'Return on capital employed was 30%+ in each of the last 3 years', '3 of 3 years ≥ 30%', nm || !three || roces.some((x) => typeof x !== 'number') ? null : roces.every((x) => x >= 30), roces.map((x) => (typeof x === 'number' ? Math.round(x) + '%' : '—')).join(' · '), nm),
      R('c3', 'Operating cash flow was positive in each of the last 3 years', '3 of 3 years > 0', nm || !three || cfos.some((x) => typeof x !== 'number') ? null : cfos.every((x) => x > 0), cfos.map((x) => (typeof x === 'number' ? Math.round(x) : '—')).join(' · '), nm), R('c4', 'Cash flow covers profit in full', 'CFO ÷ profit ≥ 1.0×', nm || cp == null ? null : cp >= 1, cp == null ? '' : `${cp.toFixed(2)}×`, nm), liquidRule(r)], (n) => n === 5); });
  return withList(F, run('conservative-quality', uni, per, (s) => s.scorable && s.failed.length === 1)); }
export const runAllFeed = (F: Feed): ScreenRun[] => [piotroskiFeed(F), magicFeed(F), qualityMomentumFeed(F), conservativeFeed(F)];

let memo: ScreenRun[] | null = null; /** The four runs, computed once per build and shared by every stock page. */
export const runsFor = (F: Feed): ScreenRun[] => (memo ??= runAllFeed(F));
