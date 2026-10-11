import type { EngineSignal, Row } from './types';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
export interface Point { text: string; weight: number }
export interface Check { label: string; pass: boolean | null; detail: string }
export interface Decision {
  dims: { name: string; score: number | null; note: string }[];
  bull: Point[]; bear: Point[]; checks: Check[]; headline: string; triggers: string[];
}

/** Deterministic read of one company from the screen's own numbers. Every sentence is built from a figure on the page; nothing is generated or predicted. */
export function decide(r: Row, sigs: EngineSignal[]): Decision {
  const bull: Point[] = [], bear: Point[] = [];
  const lender = /financial|bank|insurance/i.test(`${r.sector} ${r.ind}`);
  const add = (cond: boolean, side: 'bull' | 'bear', text: string, weight: number) => { if (cond) (side === 'bull' ? bull : bear).push({ text, weight }); };

  add(has(r.roce) && r.roce >= 18 && !lender, 'bull', `ROCE of ${r.roce?.toFixed(0)}% means each rupee of capital earns well above a typical cost of capital`, 3);
  add(has(r.roce) && r.roce < 8 && !lender, 'bear', `ROCE of only ${r.roce?.toFixed(0)}%: the business earns little on the capital it uses`, 3);
  add(has(r.de) && r.de <= 0.3 && !lender, 'bull', `Debt/equity ${r.de?.toFixed(2)}: little leverage to worry about`, 2);
  add(has(r.de) && r.de > 1.5 && !lender, 'bear', `Debt/equity ${r.de?.toFixed(2)}: leverage leaves little room for a bad year`, 3);
  add(has(r.icover) && r.icover < 3 && !lender, 'bear', `Interest cover ${r.icover?.toFixed(1)}×: profits cover interest only thinly`, 2);
  add(has(r.rev_cagr) && r.rev_cagr >= 15, 'bull', `Revenue has compounded at ${r.rev_cagr?.toFixed(0)}% a year`, 2);
  add(has(r.eps_cagr) && r.eps_cagr >= 15, 'bull', `EPS has compounded at ${r.eps_cagr?.toFixed(0)}% a year`, 2);
  add(has(r.rev_cagr) && r.rev_cagr < 0, 'bear', `Revenue has shrunk ${Math.abs(r.rev_cagr ?? 0).toFixed(0)}% a year`, 3);
  add(has(r.eps_cagr) && r.eps_cagr < 0, 'bear', `EPS has fallen ${Math.abs(r.eps_cagr ?? 0).toFixed(0)}% a year`, 2);
  add(has(r.cfo_pat) && r.cfo_pat >= 0.9 && !lender, 'bull', `Cash profit is ${r.cfo_pat?.toFixed(2)}× reported profit: earnings are backed by cash`, 2);
  add(has(r.cfo_pat) && r.cfo_pat < 0.5 && !lender, 'bear', `Operating cash is only ${r.cfo_pat?.toFixed(2)}× reported profit: earnings are not turning into cash`, 3);
  add(has(r.piotroski) && r.piotroski >= 7, 'bull', `Piotroski score ${r.piotroski}/${r.piotroski_of ?? 9}: financial health is improving on most tests`, 2);
  add(has(r.piotroski) && r.piotroski <= 3, 'bear', `Piotroski score ${r.piotroski}/${r.piotroski_of ?? 9}: weak on most tests of financial health`, 2);
  add(has(r.pe_pctile) && r.pe_pctile <= 25, 'bull', `P/E sits at the ${Math.round(r.pe_pctile ?? 0)}th percentile of its own history: cheap against itself`, 2);
  add(has(r.pe_pctile) && r.pe_pctile >= 80, 'bear', `P/E sits at the ${Math.round(r.pe_pctile ?? 0)}th percentile of its own history: expensive against itself`, 2);
  add(has(r.pe) && r.pe > 60, 'bear', `P/E of ${r.pe?.toFixed(0)}× prices in years of strong growth`, 2);
  add(has(r.rs3m) && r.rs3m >= 70, 'bull', `3-month relative strength ${Math.round(r.rs3m ?? 0)}/100: beating most of the market`, 2);
  add(has(r.rs3m) && r.rs3m <= 30, 'bear', `3-month relative strength ${Math.round(r.rs3m ?? 0)}/100: lagging most of the market`, 2);
  add(has(r.price) && has(r.sma200) && r.price > r.sma200, 'bull', 'Trading above its 200-day average', 1);
  add(has(r.price) && has(r.sma200) && r.price < r.sma200, 'bear', 'Trading below its 200-day average', 2);
  add(has(r.from_high) && r.from_high >= -5, 'bull', `Within ${Math.abs(r.from_high ?? 0).toFixed(0)}% of its 52-week high`, 1);
  add(has(r.from_high) && r.from_high <= -35, 'bear', `${Math.abs(r.from_high ?? 0).toFixed(0)}% below its 52-week high`, 2);
  add(has(r.rsi) && r.rsi >= 75, 'bear', `RSI ${r.rsi?.toFixed(0)}: stretched in the short term`, 1);
  add(has(r.rsi) && r.rsi <= 30, 'bull', `RSI ${r.rsi?.toFixed(0)}: oversold in the short term`, 1);
  add(r.risk?.level === 'HIGH', 'bear', `The screen rates its risk flags HIGH (${r.risk?.flags.length ?? 0} flagged)`, 3);
  add(has(r.turnover_cr) && r.turnover_cr < 2, 'bear', `Only ₹${r.turnover_cr?.toFixed(1)} crore traded a day: hard to exit in size`, 2);
  add(has(r.insiders) && r.insiders >= 50, 'bull', `Promoters hold ${r.insiders?.toFixed(0)}%: owners have a lot at stake`, 1);
  if (r.mf?.rank && r.mf.of) add(r.mf.rank <= r.mf.of * 0.1, 'bull', `Magic Formula rank #${r.mf.rank} of ${r.mf.of}: cheap and high-return together`, 3);
  const good = sigs.filter((s) => s.engine_status === 'EDGE SHOWN' || s.engine_status === 'LEANING POSITIVE');
  if (good.length) add(true, 'bull', `Selected by ${good.map((s) => s.engine_name).join(' and ')}, whose models beat random picks on data they had not seen`, 2);

  const sort = (a: Point, b: Point) => b.weight - a.weight;
  bull.sort(sort); bear.sort(sort);

  const dimScore = (v: number | null | undefined): number | null => (has(v) ? Math.round((v - 50) / 25 * 10) / 10 : null);
  const dims = [
    { name: 'Quality', score: dimScore(r.q), note: has(r.q) ? `${Math.round(r.q)}th percentile of the screen` : 'not scored' },
    { name: 'Growth', score: dimScore(r.g), note: has(r.g) ? `${Math.round(r.g)}th percentile` : 'not scored' },
    { name: 'Value', score: dimScore(r.v), note: has(r.v) ? `${Math.round(r.v)}th percentile (higher is cheaper)` : 'not scored' },
    { name: 'Trend', score: dimScore(r.tech), note: has(r.tech) ? `${Math.round(r.tech)}th percentile` : 'not scored' },
    { name: 'Engines', score: sigs.length ? (good.length ? 2 : 0) : null, note: sigs.length ? `${sigs.length} active plan${sigs.length > 1 ? 's' : ''}` : 'no active plan' },
  ];

  const checks: Check[] = [
    { label: 'Earns more than it costs to run the capital', pass: lender ? null : has(r.roce) ? r.roce >= 12 : null, detail: has(r.roce) ? `ROCE ${r.roce.toFixed(1)}% (bar 12%)` : 'not available' },
    { label: 'Debt is manageable', pass: lender ? null : has(r.de) ? r.de <= 1 : null, detail: has(r.de) ? `Debt/equity ${r.de.toFixed(2)} (bar 1.0)` : 'not available' },
    { label: 'Profit becomes cash', pass: lender ? null : has(r.cfo_pat) ? r.cfo_pat >= 0.7 : null, detail: has(r.cfo_pat) ? `Cash/profit ${r.cfo_pat.toFixed(2)}× (bar 0.7)` : 'not available' },
    { label: 'Growing', pass: has(r.rev_cagr) ? r.rev_cagr >= 8 : null, detail: has(r.rev_cagr) ? `Revenue CAGR ${r.rev_cagr.toFixed(1)}% (bar 8%)` : 'not available' },
    { label: 'Not expensive against its own history', pass: has(r.pe_pctile) ? r.pe_pctile < 70 : null, detail: has(r.pe_pctile) ? `P/E at ${Math.round(r.pe_pctile)}th percentile (bar 70)` : 'not available' },
    { label: 'In an uptrend', pass: has(r.price) && has(r.sma50) && has(r.sma200) ? r.price > r.sma50 && r.sma50 > r.sma200 : null, detail: has(r.sma200) ? `price ${r.price?.toFixed(0)} · 50d ${r.sma50?.toFixed(0)} · 200d ${r.sma200.toFixed(0)}` : 'not available' },
    { label: 'Beating the market', pass: has(r.rs3m) ? r.rs3m >= 50 : null, detail: has(r.rs3m) ? `3-month relative strength ${Math.round(r.rs3m)}/100` : 'not available' },
    { label: 'Liquid enough to trade', pass: has(r.turnover_cr) ? r.turnover_cr >= 5 : null, detail: has(r.turnover_cr) ? `₹${r.turnover_cr.toFixed(1)} crore a day (bar 5)` : 'not available' },
    { label: 'No high-risk flags', pass: r.risk ? r.risk.level !== 'HIGH' : null, detail: r.risk ? `risk ${r.risk.level.toLowerCase()}` : 'not available' },
  ];
  const known = checks.filter((c) => c.pass !== null);
  const passed = known.filter((c) => c.pass).length;

  const strong = dims.filter((d) => (d.score ?? 0) >= 1).map((d) => d.name.toLowerCase());
  const weak = dims.filter((d) => d.score !== null && d.score <= -1).map((d) => d.name.toLowerCase());
  const headline = `${passed} of ${known.length} checks pass. ${strong.length ? `Strong on ${strong.join(' and ')}. ` : ''}${weak.length ? `Weak on ${weak.join(' and ')}.` : strong.length ? '' : 'Nothing stands out either way.'}`.trim();

  const triggers: string[] = [];
  if (has(r.sma200) && has(r.price)) triggers.push(r.price > r.sma200 ? `A close below the 200-day average (₹${r.sma200.toFixed(0)}) would end the long-term uptrend` : `A close above the 200-day average (₹${r.sma200.toFixed(0)}) would repair the long-term trend`);
  if (r.next_earnings) triggers.push(r.next_earnings >= new Date().toISOString().slice(0, 10) ? `Results are due ${r.next_earnings}: the numbers above will update` : `Results were due ${r.next_earnings}: the fundamentals above may lag them until the screen refreshes`);
  for (const s of sigs.filter((x) => x.status === 'open' || x.status === 'pending')) triggers.push(`${s.engine_name} plan: stop ₹${(s.stop_now ?? s.sl).toFixed(2)}, first target ₹${s.targets[0].toFixed(2)}`);
  if (has(r.high52)) triggers.push(`A close above the 52-week high (₹${r.high52.toFixed(0)}) is a new high; a base below it is still a range`);

  return { dims, bull: bull.slice(0, 5), bear: bear.slice(0, 5), checks, headline, triggers: triggers.slice(0, 5) };
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
