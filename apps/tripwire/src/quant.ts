/** Two active factor engines (and one retired), each a published idea turned into fixed, pre-stated rules over the screen. They rank; they do not predict.
 *
 *  MOM  Momentum. Twelve-month return skipping the latest month (Jegadeesh and Titman 1993), with nearness to the 52-week
 *       high (George and Hwang 2004), only above the 200-day average and ahead of the Nifty.
 *  QLT  Quality at a fair price. Greenblatt's Magic Formula rank (return on capital and earnings yield), the Piotroski F-score
 *       (2000) and return on capital (Novy-Marx 2013), only above the 200-day average so a cheap falling stock is not bought.
 *  LVT  Steady uptrend. The low-volatility anomaly (Ang, Hodrick, Xing and Zhang 2006; Frazzini and Pedersen 2014) with a
 *       trend filter (Faber 2007): calm stocks that are still rising.
 *
 *  Honest status: that evidence comes from other markets and periods. Tripwire has NOT backtested these on Indian prices, and the
 *  repository's earlier engines failed their walk-forward tests, so nothing here is claimed to work. The paper tracker is the test.
 *  Missing data is never a pass. Ranks are percentiles inside the eligible set, not probabilities. */
import type { Row } from './screen.ts';
import { isLender } from './screen.ts';

export type EngineId = 'MOM' | 'QLT' | 'LVT';
export type Q = Row & { r6m?: number | null; r1y?: number | null; sd1y?: number | null; atr_pct?: number | null; piotroski?: number | null; mf?: { rank?: number; of?: number } | null };
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export interface EngineDef { /** set when an engine has stopped making picks: its record stays, its rules stay, nothing new is written */ retired?: string; id: EngineId; name: string; line: string; theory: string; horizon: number; atrMult: number; maxStopPct: number; top: number; perSector: number; how: string[] }
export const ENGINES: EngineDef[] = [
  { id: 'MOM', name: 'Momentum', line: 'Twelve-month winners, ignoring the last month', horizon: 20, atrMult: 2.5, maxStopPct: 12, top: 5, perSector: 2,
    theory: 'Jegadeesh and Titman (1993); George and Hwang (2004)',
    how: ['Score: 70% rank of the 12-month return skipping the latest month, 30% rank of nearness to the 52-week high.', 'Must close above its 200-day average, be ahead of the Nifty over 3 months and score in the top fifth.', 'Held up to 20 sessions. Stop 2.5 ATR below the signal close; skipped if that is more than 12% away.'] },
  { id: 'QLT', name: 'Quality at a fair price', line: 'Profitable, cheap on earnings, not falling', horizon: 60, atrMult: 3, maxStopPct: 15, top: 5, perSector: 2,
    theory: 'Greenblatt (2005); Piotroski (2000); Novy-Marx (2013)',
    how: ['Score: 50% Magic Formula rank, 30% Piotroski score, 20% median return on capital.', 'Must have a Piotroski score of 7 or more, median ROCE of 15% or more, debt to equity of 1 or less, and close above its 200-day average. Lenders are left out, as the Magic Formula leaves them out.', 'Held up to 60 sessions. Stop 3 ATR below the signal close; skipped if that is more than 15% away.'] },
  { id: 'LVT', retired: '2026-10-26', name: 'Steady uptrend', line: 'Calm stocks that are still rising', horizon: 40, atrMult: 2, maxStopPct: 10, top: 5, perSector: 2,
    theory: 'Ang, Hodrick, Xing and Zhang (2006); Frazzini and Pedersen (2014); Faber (2007)',
    how: ['Score: 60% calmness (lowest one-year volatility) and 40% rank of the 6-month return.', 'Must sit in the calmest quarter, close above its 200-day average, have a positive 6-month return and a risk grade below HIGH.', 'Held up to 40 sessions. Stop 2 ATR below the signal close; skipped if that is more than 10% away.'] },
];
/** The engines still making picks. Steady uptrend was retired on 26 Oct 2026: negative in all three test periods, and its first night of picks was voided for a rule bug. */
export const ACTIVE = ENGINES.filter((e) => !e.retired);
export const engineDef = (id: EngineId) => ENGINES.find((e) => e.id === id)!;

/** Names the engines may consider at all: liquid, priced, with a measured ATR, and not a micro cap (fills there are not credible). */
export const eligible = (r: Q): boolean => r.liquid === true && n(r.price) && r.price > 0 && n(r.atr_pct) && r.atr_pct > 0 && r.tier !== 'micro';

export interface Ctx { elig: Q[]; pct: Record<string, Map<string, number>> }
/** Percentile of each name among those measured: share strictly below plus half the ties. Unmeasured names get no entry. */
export function pctMap(rows: readonly Q[], f: (r: Q) => number | null | undefined): Map<string, number> {
  const v = rows.map((r) => ({ s: r.sym, x: f(r) })).filter((a): a is { s: string; x: number } => n(a.x));
  const out = new Map<string, number>(); const N = v.length;
  for (const a of v) { let lt = 0, eq = 0; for (const b of v) { if (b.x < a.x) lt++; else if (b.x === a.x) eq++; } out.set(a.s, ((lt + 0.5 * eq) / N) * 100); }
  return out;
}
export const mom12_1 = (r: Q): number | null => (n(r.r1y) && n(r.r1m) && r.r1m > -100 ? ((1 + r.r1y / 100) / (1 + r.r1m / 100) - 1) * 100 : null);
const mfPct = (r: Q): number | null => (r.mf && n(r.mf.rank) && n(r.mf.of) && r.mf.of > 1 ? (1 - (r.mf.rank - 1) / (r.mf.of - 1)) * 100 : null);
export function buildCtx(rows: readonly Q[]): Ctx {
  const elig = rows.filter(eligible);
  return { elig, pct: {
    mom: pctMap(elig, mom12_1), high: pctMap(elig, (r) => r.from_high), pio: pctMap(elig, (r) => r.piotroski), roce: pctMap(elig, (r) => (isLender(r) ? null : r.roce_med)),
    mf: pctMap(elig, mfPct), sd: pctMap(elig, (r) => r.sd1y), r6: pctMap(elig, (r) => r.r6m),
  } };
}

export interface Criterion { label: string; pass: boolean | null; value: string }
export interface Evaluation { id: EngineId; eligible: boolean; criteria: Criterion[]; score: number | null; pass: boolean }
const pc = (v: number | null | undefined, dp = 0) => (n(v) ? `${v.toFixed(dp)}` : 'not measured');
const sgn = (v: number | null | undefined, dp = 1) => (n(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}%` : 'not measured');
const test = (label: string, v: number | null | undefined, ok: (x: number) => boolean, show: string): Criterion => ({ label, pass: n(v) ? ok(v) : null, value: show });

export function evaluate(id: EngineId, r: Q, ctx: Ctx): Evaluation {
  const el = eligible(r); const g = (k: string) => ctx.pct[k].get(r.sym) ?? null;
  const above200 = n(r.price) && n(r.sma200) ? r.price > r.sma200 : null;
  const base: Criterion[] = [{ label: 'Liquid, priced, not a micro cap', pass: el, value: el ? 'yes' : 'no' }];
  const c: Criterion[] = [...base];
  let score: number | null = null;
  if (id === 'MOM') {
    const m = mom12_1(r), mp = g('mom'), hp = g('high');
    c.push({ label: 'Close above the 200-day average', pass: above200, value: n(r.sma200) ? `${pc(r.price, 2)} vs ${pc(r.sma200, 2)}` : 'not measured' });
    c.push(test('Ahead of the Nifty over 3 months', r.rs3m, (x) => x > 0, n(r.rs3m) ? `${r.rs3m > 0 ? '+' : '−'}${Math.abs(r.rs3m).toFixed(1)} pts` : 'not measured'));
    c.push(test('12-1 month return', m, () => true, sgn(m)));
    if (n(mp) && n(hp)) score = 0.7 * mp + 0.3 * hp;
    c.push(test('Score in the top fifth', score, (x) => x >= 80, n(score) ? `${score.toFixed(0)} of 100` : 'not measured'));
  } else if (id === 'QLT') {
    const sc = n(g('mf')) && n(g('pio')) && n(g('roce')) ? 0.5 * g('mf')! + 0.3 * g('pio')! + 0.2 * g('roce')! : null; score = sc;
    c.push({ label: 'Not a lender', pass: !isLender(r), value: isLender(r) ? 'lender' : 'no' });
    c.push(test('Piotroski score 7 or more', r.piotroski, (x) => x >= 7, n(r.piotroski) ? `${r.piotroski} of 9` : 'not measured'));
    c.push(test('Median ROCE 15% or more', r.roce_med, (x) => x >= 15, n(r.roce_med) ? `${r.roce_med.toFixed(1)}%` : 'not measured'));
    c.push(test('Debt to equity 1 or less', r.de, (x) => x >= 0 && x <= 1, n(r.de) ? r.de.toFixed(2) : 'not measured'));
    c.push({ label: 'Close above the 200-day average', pass: above200, value: n(r.sma200) ? `${pc(r.price, 2)} vs ${pc(r.sma200, 2)}` : 'not measured' });
    c.push({ label: 'Ranked by the Magic Formula', pass: n(mfPct(r)) ? true : null, value: r.mf?.rank ? `rank ${r.mf.rank} of ${r.mf.of}` : 'unranked' });
  } else {
    const calm = n(g('sd')) ? 100 - g('sd')! : null; const r6p = g('r6');
    if (n(calm) && n(r6p)) score = 0.6 * calm + 0.4 * r6p;
    c.push(test('In the calmest quarter (1-year volatility)', calm, (x) => x >= 75, n(r.sd1y) ? `${r.sd1y.toFixed(0)}% a year` : 'not measured'));
    c.push({ label: 'Close above the 200-day average', pass: above200, value: n(r.sma200) ? `${pc(r.price, 2)} vs ${pc(r.sma200, 2)}` : 'not measured' });
    c.push(test('Positive 6-month return', r.r6m, (x) => x > 0, sgn(r.r6m)));
    c.push({ label: 'Risk grade below HIGH', pass: r.risk_lvl ? r.risk_lvl !== 'HIGH' : null, value: r.risk_lvl ?? 'not graded' });
  }
  const need = c.filter((x) => x.label !== 'Score in the top fifth' || id === 'MOM');
  const pass = el && need.every((x) => x.pass === true) && n(score);
  return { id, eligible: el, criteria: c, score, pass };
}

export interface Pick { engine: EngineId; sym: string; name: string; sector?: string | null; asOf: string; ref: number; stop: number; stopPct: number; horizon: number; score: number; rank: number; risk?: string | null; why: string[] }
export interface Run { id: EngineId; picks: Pick[]; funnel: { universe: number; eligible: number; passed: number; skippedWideStop: number; picked: number } }

export function runEngine(id: EngineId, rows: readonly Q[], ctx: Ctx, asOf: string): Run {
  const def = engineDef(id);
  const passed = ctx.elig.map((r) => ({ r, e: evaluate(id, r, ctx) })).filter((x) => x.e.pass).sort((a, b) => b.e.score! - a.e.score! || a.r.sym.localeCompare(b.r.sym));
  const picks: Pick[] = []; const perSector = new Map<string, number>(); let wide = 0;
  for (const { r, e } of passed) {
    const stopPct = def.atrMult * r.atr_pct!;
    if (stopPct > def.maxStopPct) { wide++; continue; }
    const sec = r.sector ?? 'unknown'; if ((perSector.get(sec) ?? 0) >= def.perSector) continue;
    if (picks.length >= def.top) break;
    perSector.set(sec, (perSector.get(sec) ?? 0) + 1);
    const ref = r.price!, stop = Math.round(ref * (1 - stopPct / 100) * 100) / 100;
    picks.push({ engine: id, sym: r.sym, name: r.name, sector: r.sector, asOf, ref, stop, stopPct: Math.round(((ref - stop) / ref) * 1000) / 10, horizon: def.horizon, score: Math.round(e.score!), rank: picks.length + 1, risk: r.risk_top ?? (r.risk_lvl ? `Screen risk grade ${r.risk_lvl}` : null),
      why: e.criteria.filter((x) => x.pass === true && x.label !== 'Liquid, priced, not a micro cap').map((x) => `${x.label}: ${x.value}`) });
  }
  return { id, picks, funnel: { universe: rows.length, eligible: ctx.elig.length, passed: passed.length, skippedWideStop: wide, picked: picks.length } };
}
export function runAll(rows: readonly Q[], asOf: string): { runs: Run[]; ctx: Ctx; picks: Pick[] } {
  const ctx = buildCtx(rows); const runs = ACTIVE.map((e) => runEngine(e.id, rows, ctx, asOf));
  return { runs, ctx, picks: runs.flatMap((r) => r.picks) };
}
