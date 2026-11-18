/** The four screens evaluated on the owner's daily feed (ADR-013). Same rules, same pass/fail-per-rule output as screens.ts, but every input comes from the feed:
 *  Piotroski from the feed's nine per-stock test results, Magic Formula from the feed's own rank (its EBIT/EV and EBIT/invested-capital ranking with its exclusions),
 *  Quality+Momentum from ROCE, three-year profit, 12-1 momentum and the 200-day average, Conservative from debt/equity and three years of ROCE and operating cash flow.
 *  A missing input makes a rule null (not scorable), never pass or fail. Universe: market cap present and at least 1,000 crore. */
import { type Feed, type Row, num } from './feed.ts'; import type { RuleResult, StockResult, ScreenRun } from './screens.ts'; import { PIOTROSKI_LABELS } from './stockpage.ts';
export const MIN_MCAP = 1000, TOP = 15;
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

export function piotroskiFeed(F: Feed): ScreenRun { const uni = universe(F);
  const per = uni.map((r) => { const bits = F.detail[r.sym]?.piotroski_bits; const ok = typeof bits === 'string' && bits.length === 9;
    return finish(r.sym, PIOTROSKI_LABELS.map((l, i) => R(`f${i + 1}`, l, 'test passed (the feed gives each test\'s result, not its inputs)', ok ? bits[i] === '1' : null, ok && bits[i] === '1' ? 'passed' : 'failed')), (n) => n >= 8); });
  return run('piotroski', uni, per, (s) => s.scorable && s.score === 7); }

export function magicFeed(F: Feed): ScreenRun { const uni = universe(F);
  const per = uni.map((r) => { const mf = r.mf; const rank = typeof mf?.rank === 'number' ? mf.rank : null, of = mf?.of;
    const rules = mf == null ? [R('m1', 'Eligible and ranked by the source', 'ranked on earnings yield and return on capital', null, '')]
      : rank == null ? [R('m1', 'Eligible and ranked by the source', 'not excluded (lenders, insurers, real estate, utilities, one-off years, negative EBIT)', false, String(mf.why ?? 'excluded'))]
      : [R('m1', 'Eligible and ranked by the source', 'not excluded', true, 'ranked'), R('m2', 'Earnings yield (EBIT ÷ enterprise value)', 'positive', typeof mf.ey === 'number' ? mf.ey > 0 : null, typeof mf.ey === 'number' ? `${f1(mf.ey)}%` : ''), R('m3', 'Return on capital (EBIT ÷ invested capital)', 'positive', typeof mf.roc === 'number' ? mf.roc > 0 : null, typeof mf.roc === 'number' ? `${f1(mf.roc)}%` : ''), R('m5', 'Combined rank is in the top 15', `rank ≤ ${TOP}`, rank <= TOP, `rank ${rank} of ${of}`)];
    const s = finish(r.sym, rules, () => rank != null && rank <= TOP); (s as any).rank = rank; return s; });
  const rk = (s: StockResult) => (s as any).rank as number | null; return run('magic-formula', uni, per, (s) => { const k = rk(s); return k != null && k > TOP && k <= TOP + 5; }); }

const mom = (r: Row) => { const y = num(r, 'r1y'), m = num(r, 'r1m'); return y == null || m == null ? null : ((1 + y / 100) / (1 + m / 100) - 1) * 100; };
export function qualityMomentumFeed(F: Feed): ScreenRun { const uni = universe(F); const ms = uni.map(mom).filter((x): x is number => x != null).sort((a, b) => a - b); const cut = ms.length ? ms[Math.floor(ms.length * 0.8)] : null;
  const per = uni.map((r) => { const nm = notMeaningful(r), y = years(F, r.sym), roce = num(r, 'roce'), m = mom(r), px = num(r, 'price'), s200 = num(r, 'sma200'), p0 = y[0]?.pat_cr, p2 = y[2]?.pat_cr; const pat = typeof p0 === 'number' && typeof p2 === 'number';
    return finish(r.sym, [R('q1', 'Return on capital employed is at least 15%', '≥ 15%', nm || roce == null ? null : roce >= 15, roce == null ? '' : `${f1(roce)}%`, nm), R('q2', 'Profit is higher than two years ago, and was positive then', 'profit up, base positive', pat ? p2 > 0 && p0 > p2 : null, pat ? `₹${Math.round(p0)} vs ₹${Math.round(p2)} cr` : ''),
      R('q3', '12-1 month price momentum is in the top fifth of the universe', cut == null ? 'top 20%' : `≥ ${f1(cut)}%`, m == null || cut == null ? null : m >= cut, m == null ? '' : `${f1(m)}%`), R('q4', 'Price is above its 200-day average', 'close > 200-day', px == null || s200 == null ? null : px > s200, px == null || s200 == null ? '' : `₹${f1(px)} vs ₹${f1(s200)}`)], (n) => n === 4); });
  return run('quality-momentum', uni, per, (s) => s.scorable && s.failed.length === 1); }

export function conservativeFeed(F: Feed): ScreenRun { const uni = universe(F);
  const per = uni.map((r) => { const nm = notMeaningful(r), y = years(F, r.sym).slice(0, 3), de = num(r, 'de'), three = y.length === 3; const roces = y.map((x) => x.roce), cfos = y.map((x) => x.cfo_cr);
    return finish(r.sym, [R('c1', 'Debt to equity is at most 0.5', '≤ 0.5', nm || de == null ? null : de <= 0.5, de == null ? '' : de.toFixed(2), nm), R('c2', 'Return on capital employed was 15%+ in each of the last 3 years', '3 of 3 years ≥ 15%', nm || !three || roces.some((x) => typeof x !== 'number') ? null : roces.every((x) => x >= 15), roces.map((x) => (typeof x === 'number' ? Math.round(x) + '%' : '—')).join(' · '), nm),
      R('c3', 'Operating cash flow was positive in each of the last 3 years', '3 of 3 years > 0', nm || !three || cfos.some((x) => typeof x !== 'number') ? null : cfos.every((x) => x > 0), cfos.map((x) => (typeof x === 'number' ? Math.round(x) : '—')).join(' · '), nm)], (n) => n === 3); });
  return run('conservative-quality', uni, per, (s) => s.scorable && s.failed.length === 1); }
export const runAllFeed = (F: Feed): ScreenRun[] => [piotroskiFeed(F), magicFeed(F), qualityMomentumFeed(F), conservativeFeed(F)];
