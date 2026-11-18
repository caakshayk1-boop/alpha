/** The four screens as pure rule functions. Every stock gets a per-rule result {pass: true|false|null, value, threshold}; null = NOT SCORABLE
 *  (an input is missing). Missing never passes and never fails: a stock with any null rule is "not scorable" for that screen.
 *  Thresholds are frozen by owner approval of BUILD-PLAN §5; changing one needs an ADR and a new screen version. */
export interface Year { fy: number; revenue?: number; gross_profit?: number; net_income?: number; cfo?: number; total_assets?: number; long_term_debt?: number;
  current_assets?: number; current_liabilities?: number; shares?: number; ebit?: number; net_fixed_assets?: number; equity?: number; total_debt?: number; cash?: number }
export interface Company { symbol: string; name?: string; sector?: string; mcap_cr?: number; years: Year[];   // newest first; values in rupees crore except shares
  close?: number; ma200?: number; mom_12_1?: number /* % */ }
export interface RuleResult { id: string; label: string; pass: boolean | null; value: string; threshold: string }
export interface StockResult { symbol: string; rules: RuleResult[]; scorable: boolean; passes: boolean; failed: RuleResult[]; score?: number }
export interface ScreenRun { screen_id: string; passed: string[]; near_miss: { symbol: string; failed_rule: string; gap: string }[]; refused: string[]; not_scorable: string[]; universe_n: number; detail: Record<string, StockResult> }
export interface ScreenDef { id: string; name: string; version: number; short: string; run(universe: Company[]): ScreenRun }

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const f = (x: number, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toString();
const R = (id: string, label: string, threshold: string, pass: boolean | null, value: string): RuleResult => ({ id, label, pass, value: pass === null ? 'missing' : value, threshold });
const cmp = (id: string, label: string, threshold: string, a: number | undefined, b: number | undefined, test: (a: number, b: number) => boolean, show: (a: number, b: number) => string) =>
  num(a) && num(b) ? R(id, label, threshold, test(a, b), show(a, b)) : R(id, label, threshold, null, '');
const roa = (y: Year) => (num(y.net_income) && num(y.total_assets) && y.total_assets > 0 ? y.net_income / y.total_assets : undefined);
const cr = (y: Year) => (num(y.current_assets) && num(y.current_liabilities) && y.current_liabilities > 0 ? y.current_assets / y.current_liabilities : undefined);
const lev = (y: Year) => (num(y.long_term_debt) && num(y.total_assets) && y.total_assets > 0 ? y.long_term_debt / y.total_assets : undefined);
const gm = (y: Year) => (num(y.gross_profit) && num(y.revenue) && y.revenue > 0 ? y.gross_profit / y.revenue : undefined);
const at = (y: Year) => (num(y.revenue) && num(y.total_assets) && y.total_assets > 0 ? y.revenue / y.total_assets : undefined);
export const capEmployed = (y: Year) => (num(y.total_assets) && num(y.current_liabilities) ? y.total_assets - y.current_liabilities : undefined);
export const roce = (y: Year) => { const c = capEmployed(y); return num(y.ebit) && num(c) && c > 0 ? (y.ebit / c) * 100 : undefined; };
const FIN = /bank|financ|insur|nbfc|capital markets|asset management|housing finance/i, UTIL = /utilit|power generation|electric|gas distribution|water/i;

function finish(symbol: string, rules: RuleResult[], need: (rs: RuleResult[]) => boolean): StockResult {
  const scorable = rules.every((r) => r.pass !== null), failed = rules.filter((r) => r.pass === false);
  return { symbol, rules, scorable, passes: scorable && need(rules), failed, score: rules.filter((r) => r.pass === true).length };
}
function summarise(id: string, universe: Company[], per: StockResult[], nearOK: (s: StockResult) => boolean, refusedOK: (s: StockResult) => boolean): ScreenRun {
  const detail: Record<string, StockResult> = {}; for (const s of per) detail[s.symbol] = s;
  return { screen_id: id, universe_n: universe.length, detail, passed: per.filter((s) => s.passes).map((s) => s.symbol).sort(),
    not_scorable: per.filter((s) => !s.scorable).map((s) => s.symbol).sort(), refused: per.filter((s) => s.scorable && !s.passes && refusedOK(s)).map((s) => s.symbol).sort(),
    near_miss: per.filter((s) => !s.passes && nearOK(s)).map((s) => ({ symbol: s.symbol, failed_rule: s.failed[0]?.label ?? '', gap: s.failed[0] ? `${s.failed[0].value} vs ${s.failed[0].threshold}` : '' })).sort((a, b) => a.symbol.localeCompare(b.symbol)) };
}

// ---- 1. Piotroski F-Score: pass at 8 or 9 of 9 ----
export function piotroski(c: Company): StockResult {
  const a = c.years[0], b = c.years[1], A = (x?: Year) => x ?? ({} as Year);
  const rules = [
    cmp('f1', 'Return on assets is positive', '> 0', roa(A(a)), 0, (x, y) => x > y, (x) => `${f(x * 100)}%`),
    cmp('f2', 'Operating cash flow is positive', '> 0', a?.cfo, 0, (x, y) => x > y, (x) => `₹${f(x, 0)} cr`),
    cmp('f3', 'Return on assets improved', 'above last year', roa(A(a)), roa(A(b)), (x, y) => x > y, (x, y) => `${f(x * 100)}% vs ${f(y * 100)}%`),
    cmp('f4', 'Cash flow exceeds net income', 'CFO > net income', a?.cfo, a?.net_income, (x, y) => x > y, (x, y) => `${f(x, 0)} vs ${f(y, 0)} cr`),
    cmp('f5', 'Long-term debt ratio did not rise', 'not above last year', lev(A(a)), lev(A(b)), (x, y) => x <= y, (x, y) => `${f(x * 100)}% vs ${f(y * 100)}%`),
    cmp('f6', 'Current ratio improved', 'above last year', cr(A(a)), cr(A(b)), (x, y) => x > y, (x, y) => `${f(x)} vs ${f(y)}`),
    cmp('f7', 'No new shares issued', 'shares not above last year', a?.shares, b?.shares, (x, y) => x <= y * 1.0005, (x, y) => `${f(x / 1e7, 2)} vs ${f(y / 1e7, 2)} cr`),
    cmp('f8', 'Gross margin improved', 'above last year', gm(A(a)), gm(A(b)), (x, y) => x > y, (x, y) => `${f(x * 100)}% vs ${f(y * 100)}%`),
    cmp('f9', 'Asset turnover improved', 'above last year', at(A(a)), at(A(b)), (x, y) => x > y, (x, y) => `${f(x)} vs ${f(y)}`),
  ];
  return finish(c.symbol, rules, (rs) => rs.filter((r) => r.pass).length >= 8);
}
export const PIOTROSKI: ScreenDef = { id: 'piotroski', name: 'Piotroski F-Score', version: 1, short: 'Nine yes/no tests of improving financial health. A stock needs 8 or 9.',
  run: (u) => { const per = u.map(piotroski); return summarise('piotroski', u, per, (s) => s.scorable && s.score === 7, () => true); } };

// ---- 2. Magic Formula: rank by earnings yield + return on capital, top 15 ----
const TOP = 15, MIN_MCAP = 1000;
export function magic(universe: Company[]): ScreenRun {
  type Row = { c: Company; ey?: number; roc?: number; elig: RuleResult[] };
  const rows: Row[] = universe.map((c) => {
    const y = c.years[0], ev = num(c.mcap_cr) && y ? c.mcap_cr + (y.total_debt ?? NaN) - (y.cash ?? NaN) : NaN;
    const ey = num(y?.ebit) && ev > 0 ? y.ebit! / ev : undefined;
    const nwc = y && num(y.current_assets) && num(y.current_liabilities) ? y.current_assets - y.current_liabilities : undefined, ic = y && num(y.net_fixed_assets) && num(nwc) ? y.net_fixed_assets + nwc : undefined;
    const roc = num(y?.ebit) && num(ic) && ic > 0 ? y.ebit! / ic : undefined;
    const sector = c.sector ?? '';
    return { c, ey, roc, elig: [
      R('m1', 'Not a financial or utility company', 'excluded sectors', c.sector ? !(FIN.test(sector) || UTIL.test(sector)) : null, sector),
      cmp('m2', 'Market cap is large enough', `≥ ₹${MIN_MCAP} cr`, c.mcap_cr, MIN_MCAP, (x, t) => x >= t, (x) => `₹${f(x, 0)} cr`),
      R('m3', 'Earnings yield is positive', '> 0', num(ey) ? ey > 0 : null, num(ey) ? `${f(ey * 100)}%` : ''),
      R('m4', 'Return on capital is positive', '> 0', num(roc) ? roc > 0 : null, num(roc) ? `${f(roc * 100)}%` : ''),
    ] };
  });
  const ok = rows.filter((r) => r.elig.every((e) => e.pass === true));
  const rank = (key: 'ey' | 'roc') => { const s = [...ok].sort((a, b) => (b[key] as number) - (a[key] as number)); return new Map(s.map((r, i) => [r.c.symbol, i + 1])); };
  const rEy = rank('ey'), rRoc = rank('roc'), combined = new Map(ok.map((r) => [r.c.symbol, rEy.get(r.c.symbol)! + rRoc.get(r.c.symbol)!]));
  const order = [...ok].sort((a, b) => combined.get(a.c.symbol)! - combined.get(b.c.symbol)! || a.c.symbol.localeCompare(b.c.symbol));
  const pos = new Map(order.map((r, i) => [r.c.symbol, i + 1]));
  const per: StockResult[] = rows.map((r) => {
    const p = pos.get(r.c.symbol), rules = [...r.elig, R('m5', 'Combined rank is in the top 15', `rank ≤ ${TOP}`, p ? p <= TOP : r.elig.some((e) => e.pass === null) ? null : false, p ? `rank ${p} of ${ok.length}` : 'not ranked')];
    return finish(r.c.symbol, rules, () => !!p && p <= TOP);
  });
  const run = summarise('magic-formula', universe, per, (s) => { const p = pos.get(s.symbol); return !!p && p > TOP && p <= TOP + 5; }, (s) => s.rules.every((x) => x.pass !== null));
  return run;
}
export const MAGIC: ScreenDef = { id: 'magic-formula', name: 'Magic Formula', version: 1, short: 'Cheap and productive: ranks stocks by earnings yield plus return on capital. The top 15 make the list.', run: magic };

// ---- 3. Quality + momentum composite ----
export function qualityMomentum(universe: Company[]): ScreenRun {
  const moms = universe.map((c) => c.mom_12_1).filter(num).sort((a, b) => a - b), cut = moms.length ? moms[Math.floor(moms.length * 0.8)] : undefined;
  const per = universe.map((c) => { const y = c.years;
    const rules = [
      R('q1', 'Return on capital employed is at least 15%', '≥ 15%', num(roce(y[0] ?? ({} as Year))) ? roce(y[0])! >= 15 : null, num(roce(y[0] ?? ({} as Year))) ? `${f(roce(y[0])!, 1)}%` : ''),
      cmp('q2', 'Earnings are higher than two years ago', 'net income up, base positive', y[0]?.net_income, y[2]?.net_income, (a, b) => b > 0 && a > b, (a, b) => `₹${f(a, 0)} vs ₹${f(b, 0)} cr`),
      cmp('q3', '12-1 month price momentum is in the top fifth', cut == null ? 'top 20%' : `≥ ${f(cut, 1)}%`, c.mom_12_1, cut, (a, b) => a >= b, (a) => `${f(a, 1)}%`),
      cmp('q4', 'Price is above its 200-day average', 'close > 200-day', c.close, c.ma200, (a, b) => a > b, (a, b) => `₹${f(a)} vs ₹${f(b)}`),
    ]; return finish(c.symbol, rules, (rs) => rs.every((r) => r.pass)); });
  return summarise('quality-momentum', universe, per, (s) => s.scorable && s.failed.length === 1, () => true);
}
export const QUALITY_MOMENTUM: ScreenDef = { id: 'quality-momentum', name: 'Quality + Momentum', version: 1, short: 'Profitable, growing companies whose price is already rising. All four rules must hold.', run: qualityMomentum };

// ---- 4. Conservative quality ----
export function conservative(universe: Company[]): ScreenRun {
  const per = universe.map((c) => { const y = c.years.slice(0, 3), a = c.years[0];
    const de = num(a?.total_debt) && num(a?.equity) && a.equity > 0 ? a.total_debt / a.equity : undefined;
    const roces = y.map(roce), cfos = y.map((x) => x.cfo);
    const rules = [
      R('c1', 'Debt to equity is at most 0.5', '≤ 0.5', num(de) ? de <= 0.5 : null, num(de) ? f(de) : ''),
      R('c2', 'Return on capital employed was 15%+ in each of the last 3 years', '3 of 3 years ≥ 15%', y.length < 3 || roces.some((x) => !num(x)) ? null : roces.every((x) => x! >= 15), roces.map((x) => (num(x) ? f(x, 0) + '%' : '—')).join(' · ')),
      R('c3', 'Operating cash flow was positive in each of the last 3 years', '3 of 3 years > 0', y.length < 3 || cfos.some((x) => !num(x)) ? null : cfos.every((x) => x! > 0), cfos.map((x) => (num(x) ? f(x, 0) : '—')).join(' · ')),
    ]; return finish(c.symbol, rules, (rs) => rs.every((r) => r.pass)); });
  return summarise('conservative-quality', universe, per, (s) => s.scorable && s.failed.length === 1, () => true);
}
export const CONSERVATIVE: ScreenDef = { id: 'conservative-quality', name: 'Conservative Quality', version: 1, short: 'Low debt, steady returns, real cash. Often returns very few names, and sometimes none.', run: conservative };
export const SCREENS: ScreenDef[] = [PIOTROSKI, MAGIC, QUALITY_MOMENTUM, CONSERVATIVE];
