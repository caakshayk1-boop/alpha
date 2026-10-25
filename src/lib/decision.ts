import type { Row, Sig } from './types';
import { ordinal } from './status.ts';
import { isLender } from './sector.ts';
import { num } from './format.ts';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
export interface Point { text: string; weight: number }
export interface Check { label: string; pass: boolean | null; detail: string }
export interface Evidence { text: string; side: 'for' | 'against'; source: string }
/** The version of the nine research checks below. Every surface that counts them (Today, Tools, Peek, the company page, a saved
 *  card) calls decide() on the same screen row, so the same row always gives the same count (A03). Bump it when a rule changes. */
export const CHECKS_VERSION = 'checks-1.2';      // 1.2: rs3m read as what it is, a 3-month return gap to the Nifty in points, not a 0-100 score
export interface Decision {
  version: string;
  dims: { name: string; score: number | null; note: string }[];
  bull: Point[]; bear: Point[]; checks: Check[]; headline: string; triggers: string[];
  evidence: Evidence[]; agree: string[]; conflicts: string[]; missing: string[]; nextResults: string | null;
}

/** Deterministic read of one company from the screen's own numbers. Every sentence is built from a figure on the page; nothing is generated or predicted. */
export function decide(r: Row, sigs: Sig[], yearsIn?: number | null): Decision {
  // statement years: the caller's count when it has the filed statements, else the screen row's own count, so a page without the
  // statements (Today, Tools) never counts a growth check the company page refuses as too short (A03)
  const years = yearsIn ?? (has(r.fy_count) ? r.fy_count : null);
  const bull: Point[] = [], bear: Point[] = [];
  const lender = isLender(r);
  const add = (cond: boolean, side: 'bull' | 'bear', text: string, weight: number) => { if (cond) (side === 'bull' ? bull : bear).push({ text, weight }); };

  add(has(r.roce) && r.roce >= 18 && !lender, 'bull', `ROCE of ${num(r.roce, 0)}% means each rupee of capital earns well above a typical cost of capital`, 3);
  add(has(r.roce) && r.roce < 8 && !lender, 'bear', `ROCE of only ${num(r.roce, 0)}%: the business earns little on the capital it uses`, 3);
  add(has(r.de) && r.de <= 0.3 && !lender, 'bull', `Debt/equity ${num(r.de, 2)}: little leverage to worry about`, 2);
  add(has(r.de) && r.de > 1.5 && !lender, 'bear', `Debt/equity ${num(r.de, 2)}: leverage leaves little room for a bad year`, 3);
  add(has(r.icover) && r.icover < 3 && !lender, 'bear', `Interest cover ${num(r.icover, 1)}×: profits cover interest only thinly`, 2);
  const thin = typeof years === 'number' && years < 4;      // under four statement years a CAGR is a year-on-year change, not a trend
  add(!thin && has(r.rev_cagr) && r.rev_cagr >= 15, 'bull', `Revenue has compounded at ${num(r.rev_cagr, 0)}% a year`, 2);
  add(!thin && has(r.eps_cagr) && r.eps_cagr >= 15, 'bull', `EPS has compounded at ${num(r.eps_cagr, 0)}% a year`, 2);
  add(!thin && has(r.rev_cagr) && r.rev_cagr < 0, 'bear', `Revenue has shrunk ${num(Math.abs(r.rev_cagr ?? 0), 0)}% a year`, 3);
  add(!thin && has(r.eps_cagr) && r.eps_cagr < 0, 'bear', `EPS has fallen ${num(Math.abs(r.eps_cagr ?? 0), 0)}% a year`, 2);
  add(has(r.cfo_pat) && r.cfo_pat >= 0.9 && !lender, 'bull', `Operating cash flow is ${num(r.cfo_pat, 2)}× net profit (latest year): earnings are backed by cash`, 2);
  add(has(r.cfo_pat) && r.cfo_pat < 0.5 && !lender, 'bear', `Operating cash is only ${num(r.cfo_pat, 2)}× reported profit: earnings are not turning into cash`, 3);
  add(has(r.piotroski) && r.piotroski >= 7, 'bull', `Piotroski score ${r.piotroski}/${r.piotroski_of ?? 9}: financial health is improving on most tests`, 2);
  add(has(r.piotroski) && r.piotroski <= 3, 'bear', `Piotroski score ${r.piotroski}/${r.piotroski_of ?? 9}: weak on most tests of financial health`, 2);
  add(has(r.pe_pctile) && r.pe_pctile <= 25, 'bull', `P/E sits at the ${ordinal(r.pe_pctile ?? 0)} percentile of its own history: cheap against itself`, 2);
  add(has(r.pe_pctile) && r.pe_pctile >= 80, 'bear', `P/E sits at the ${ordinal(r.pe_pctile ?? 0)} percentile of its own history: expensive against itself`, 2);
  add(has(r.pe) && r.pe > 60, 'bear', `P/E of ${num(r.pe, 0)}× prices in years of strong growth`, 2);
  add(has(r.rs3m) && r.rs3m >= 10, 'bull', `3-month return ${Math.round(r.rs3m ?? 0)} points ahead of the Nifty`, 2);
  add(has(r.rs3m) && r.rs3m <= -10, 'bear', `3-month return ${Math.round(Math.abs(r.rs3m ?? 0))} points behind the Nifty`, 2);
  add(has(r.price) && has(r.sma200) && r.price > r.sma200, 'bull', 'Trading above its 200-day average', 1);
  add(has(r.price) && has(r.sma200) && r.price < r.sma200, 'bear', 'Trading below its 200-day average', 2);
  add(has(r.from_high) && r.from_high >= -5, 'bull', `Within ${num(Math.abs(r.from_high ?? 0), 0)}% of its 52-week high`, 1);
  add(has(r.from_high) && r.from_high <= -35, 'bear', `${num(Math.abs(r.from_high ?? 0), 0)}% below its 52-week high`, 2);
  add(has(r.rsi) && r.rsi >= 75, 'bear', `RSI ${num(r.rsi, 0)}: stretched in the short term`, 1);
  add(has(r.rsi) && r.rsi <= 30, 'bull', `RSI ${num(r.rsi, 0)}: oversold in the short term`, 1);
  add(r.risk?.level === 'HIGH', 'bear', `The screen rates its risk flags HIGH (${r.risk?.flags.length ?? 0} flagged)`, 3);
  add(has(r.turnover_cr) && r.turnover_cr < 2, 'bear', `Only ₹${num(r.turnover_cr, 1)} crore traded a day: hard to exit in size`, 2);
  add(has(r.insiders) && r.insiders >= 50, 'bull', `Promoters hold ${num(r.insiders, 0)}%: owners have a lot at stake`, 1);
  if (r.mf?.rank && r.mf.of) add(r.mf.rank <= r.mf.of * 0.1, 'bull', `Magic Formula rank #${r.mf.rank} of ${r.mf.of}: cheap and high-return together`, 3);
  // limitations Alpha already knows belong in the countercase, not only further down the page (C09)
  add(thin, 'bear', `Only ${years} fiscal year${years === 1 ? '' : 's'} of statements on file: growth and multi-year figures are thin`, 3);
  add(has(r.tech) && r.tech <= 25, 'bear', `Technical score ${Math.round(r.tech ?? 0)}/100: bottom quarter of the screen on trend and momentum`, 2);
  const live = sigs.filter((s) => s.status === 'open' || s.status === 'pending');
  if (live.length) add(true, 'bull', `Passed every Swing v2 rule (${live[0].setup.toLowerCase()}) at the ${live[0].date} close, with the market gate on`, 2);

  const sort = (a: Point, b: Point) => b.weight - a.weight;
  bull.sort(sort); bear.sort(sort);

  const dimScore = (v: number | null | undefined): number | null => (has(v) ? Math.round((v - 50) / 25 * 10) / 10 : null);
  const dims = [
    { name: 'Quality', score: dimScore(r.q), note: has(r.q) ? `${ordinal(r.q)} percentile of the screen` : 'not scored' },
    { name: 'Growth', score: thin ? null : dimScore(r.g), note: thin ? `not judged: only ${years} statement years (rank ${has(r.g) ? ordinal(r.g) : 'n/a'} on thin history)` : has(r.g) ? `${ordinal(r.g)} percentile` : 'not scored' },
    { name: 'Value', score: dimScore(r.v), note: has(r.v) ? `${ordinal(r.v)} percentile (higher is cheaper)` : 'not scored' },
    { name: 'Trend', score: dimScore(r.tech), note: has(r.tech) ? `${ordinal(r.tech)} percentile` : 'not scored' },
    { name: 'Engines', score: live.length ? 2 : null, note: live.length ? 'an active Swing plan' : 'no active plan' },
  ];

  const checks: Check[] = [
    { label: 'Earns more than it costs to run the capital', pass: lender ? null : has(r.roce) ? r.roce >= 12 : null, detail: has(r.roce) ? `ROCE ${num(r.roce, 1)}% (bar 12%)` : 'not available' },
    { label: 'Debt is manageable', pass: lender ? null : has(r.de) ? r.de <= 1 : null, detail: has(r.de) ? `Debt/equity ${num(r.de, 2)} (bar 1.0)` : 'not available' },
    { label: 'Profit becomes cash', pass: lender ? null : has(r.cfo_pat) ? r.cfo_pat >= 0.7 : null, detail: has(r.cfo_pat) ? `Operating cash flow / net profit ${num(r.cfo_pat, 2)}× (bar 0.7)` : 'not available' },
    { label: 'Growing', pass: thin ? null : has(r.rev_cagr) ? r.rev_cagr >= 8 : null, detail: thin ? `only ${years} statement years on file: too short for a growth trend` : has(r.rev_cagr) ? `Revenue CAGR ${num(r.rev_cagr, 1)}% (bar 8%)` : 'not available' },
    { label: 'Not expensive against its own history', pass: has(r.pe_pctile) ? r.pe_pctile < 70 : null, detail: has(r.pe_pctile) ? `P/E at ${ordinal(r.pe_pctile)} percentile (bar 70)` : 'not available' },
    { label: 'In an uptrend', pass: has(r.price) && has(r.sma50) && has(r.sma200) ? r.price > r.sma50 && r.sma50 > r.sma200 : null, detail: has(r.sma200) ? `price ${num(r.price, 0)} · 50d ${num(r.sma50, 0)} · 200d ${num(r.sma200, 0)}` : 'not available' },
    { label: 'Beating the market', pass: has(r.rs3m) ? r.rs3m > 0 : null, detail: has(r.rs3m) ? `3-month return ${r.rs3m >= 0 ? '+' : '−'}${Math.round(Math.abs(r.rs3m))} points against the Nifty (bar: above 0)` : 'not available' },
    { label: 'Liquid enough to trade', pass: has(r.turnover_cr) ? r.turnover_cr >= 5 : null, detail: has(r.turnover_cr) ? `₹${num(r.turnover_cr, 1)} crore a day (bar 5)` : 'not available' },
    { label: 'No high-risk flags', pass: r.risk ? r.risk.level !== 'HIGH' : null, detail: r.risk ? `risk ${r.risk.level.toLowerCase()}` : 'not available' },
  ];
  const known = checks.filter((c) => c.pass !== null);
  const passed = known.filter((c) => c.pass).length;

  const strong = dims.filter((d) => (d.score ?? 0) >= 1).map((d) => d.name.toLowerCase());
  const weak = dims.filter((d) => d.score !== null && d.score <= -1).map((d) => d.name.toLowerCase());
  const unavailable = checks.length - known.length;
  const headline = `${passed} of ${known.length} of Alpha's research checks pass${unavailable ? ` (${unavailable} of ${checks.length} not applicable or unavailable)` : ''}. ${strong.length ? `Strong on ${strong.join(' and ')}. ` : ''}${weak.length ? `Weak on ${weak.join(' and ')}.` : strong.length ? '' : 'Nothing stands out either way.'}`.trim();

  const triggers: string[] = [];
  if (has(r.sma200) && has(r.price)) triggers.push(r.price > r.sma200 ? `A close below the 200-day average (₹${num(r.sma200, 0)}) would end the long-term uptrend` : `A close above the 200-day average (₹${num(r.sma200, 0)}) would repair the long-term trend`);
  if (r.next_earnings) triggers.push(r.next_earnings >= new Date().toISOString().slice(0, 10) ? `Results are due ${r.next_earnings}: the numbers above will update` : `Results were due ${r.next_earnings}: the fundamentals above may lag them until the screen refreshes`);
  for (const s of sigs.filter((x) => x.status === 'open' || x.status === 'pending')) triggers.push(`Swing plan: stop ₹${num(s.stop_now ?? s.sl, 2)}, ${s.half ? 'T2' : 'T1'} ₹${num(s.half ? s.t2 ?? s.t2_plan : s.t1 ?? s.t1_plan, 2)}`);
  if (has(r.high52)) triggers.push(`A close above the 52-week high (₹${num(r.high52, 0)}) is a new high; a base below it is still a range`);

  const srcOf = (t: string) => (t.startsWith('Passed every Swing') ? 'signals' : r.last_date ? `screen, ${r.last_date}` : 'screen');
  const evidence: Evidence[] = [...bull.map((p) => ({ ...p, side: 'for' as const })), ...bear.map((p) => ({ ...p, side: 'against' as const }))]
    .sort((x, y) => y.weight - x.weight).slice(0, 5).map((p) => ({ text: p.text, side: p.side, source: srcOf(p.text) }));
  const score = (name: string) => dims.find((d) => d.name === name)?.score ?? null;
  const conflicts: string[] = [];
  const belowLong = has(r.price) && has(r.sma200) && r.price < r.sma200;
  if (live.length && belowLong) conflicts.push('A Swing signal is active, yet the price is now below its 200-day average.');
  if ((score('Quality') ?? 0) >= 1 && (score('Trend') ?? 0) <= -1) conflicts.push('Quality scores high but the price trend scores low: a good business the market is not currently rewarding.');
  if ((score('Value') ?? 0) >= 1 && (score('Growth') ?? 0) <= -1) conflicts.push('It screens cheap, but growth scores low: cheapness may be the price of slow growth.');
  if (r.vd?.c === 'BUY' && r.risk?.level === 'HIGH') conflicts.push('The screen has a case on file, yet its risk flags are HIGH.');
  if (live.length && r.vd?.c === 'AVOID') conflicts.push('A Swing signal is active while the screen excludes it.');
  const pos = dims.filter((d) => (d.score ?? 0) >= 1 && d.name !== 'Engines').map((d) => d.name.toLowerCase());
  const neg = dims.filter((d) => d.score !== null && d.score <= -1 && d.name !== 'Engines').map((d) => d.name.toLowerCase());
  const agree: string[] = [];
  if (pos.length >= 2) agree.push(`${pos.join(', ')} all point the same way (positive).`);
  if (neg.length >= 2) agree.push(`${neg.join(', ')} all point the same way (negative).`);
  const missing = checks.filter((c) => c.pass === null).map((c) => `${c.label}: ${c.detail}`);
  if (typeof years === 'number' && years < 4) missing.push(`Only ${years} fiscal year${years === 1 ? '' : 's'} of statements on file: multi-year figures are thin.`);
  return {
    version: CHECKS_VERSION, dims, bull: bull.slice(0, 5), bear: bear.slice(0, 5), checks, headline, triggers: triggers.slice(0, 5), evidence, agree, conflicts, missing, nextResults: r.next_earnings ?? null };
}

/** The companies most like this one on quality, growth, value, trend, return on capital, margin, leverage and strength. */
export function lookalikes(r: Row, rows: Row[], k = 6): { row: Row; sim: number }[] {
  const feats = (x: Row): number[] | null => {
    const v = [x.q, x.g, x.v, x.tech, x.rs3m, x.roce, x.net_margin, x.de];
    if (!v.every(has)) return null;
    return [v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, Math.max(-30, Math.min(60, v[5]!)), Math.max(-30, Math.min(50, v[6]!)), Math.max(0, Math.min(4, v[7]!))];
  };
  const pool = rows.map((x) => ({ x, f: feats(x) })).filter((p): p is { x: Row; f: number[] } => p.f !== null);
  const me = feats(r);
  if (!me || pool.length < 30) return [];
  const n = me.length, mean = Array(n).fill(0), sd = Array(n).fill(0);
  for (const p of pool) p.f.forEach((v, i) => { mean[i] += v / pool.length; });
  for (const p of pool) p.f.forEach((v, i) => { sd[i] += ((v - mean[i]) ** 2) / pool.length; });
  const z = (f: number[]) => f.map((v, i) => (v - mean[i]) / (Math.sqrt(sd[i]) || 1));
  const zm = z(me);
  const out = pool.filter((p) => p.x.sym !== r.sym).map((p) => ({ row: p.x, d: Math.sqrt(z(p.f).reduce((s, v, i) => s + (v - zm[i]) ** 2, 0)) }));
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, k).map((o) => ({ row: o.row, sim: Math.max(0, Math.round(100 * (1 - o.d / (Math.sqrt(n) * 2.5)))) }));
}

/** The screen's own classification, worded as a research class and never as an instruction. */
export function screenClass(vd: { c: string; l: string; o: string } | undefined): { text: string; tone: string; title: string } {
  if (!vd) return { text: 'Screen: no class', tone: '', title: 'The screen holds no classification for this company.' };
  const why = vd.o ? ` Reason on file: ${vd.o}.` : '';
  switch (vd.c) {
    case 'BUY': return { text: `Screen: ${vd.l.toLowerCase()} case`, tone: 'up', title: `Passes the screen's rules for a ${vd.l.toLowerCase()} case.${why} A research classification, not a recommendation to buy.` };
    case 'WAIT': return { text: `Screen: ${vd.l.toLowerCase()}`, tone: 'acc', title: `The screen sees a case but not at this price or setup.${why} Not a recommendation.` };
    case 'AVOID': return { text: 'Screen: excluded', tone: 'down', title: `Excluded by a screen rule.${why}` };
    default: return { text: 'Screen: no case yet', tone: '', title: `Nothing on file meets the screen's rules.${why}` };
  }
}
