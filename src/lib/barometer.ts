/** The market Barometer, computed live: a line-for-line port of compute() in trading-dashboard/barometer.py (weights, VIX
 *  bands, score bands, valuation stage, coverage). Why Alpha computes it too: the upstream job reads the Nifty from yfinance,
 *  whose newest daily bar often has no close when the job runs after midnight IST, so it falls back to an older session
 *  (20 Oct 2026: the reading published for 19 Oct carried Friday 16 Oct's Nifty). Live inputs remove that lag.
 *  One deliberate difference, stated: "participation" here is the day's advancers (its label says "advancing today");
 *  upstream feeds it pulse.breadth.up, which is a one-week count (stock_screen.py counts r1w).
 *  Tested against a published reading in tests/lib.test.ts. */

export const WEIGHTS = { trend: 30, breadth: 30, participation: 15, volatility: 15, highs: 10 } as const;
type Key = keyof typeof WEIGHTS;

export const vixScore = (v: number) => (v < 12 ? 85 : v < 16 ? 70 : v < 20 ? 50 : v < 26 ? 28 : 10);
export const vixWord = (v: number) => (v < 12 ? 'very calm' : v < 16 ? 'normal' : v < 20 ? 'unsettled' : v < 26 ? 'jumpy' : 'stressed');

export interface Band { k: 'strong' | 'firm' | 'mixed' | 'weak' | 'poor'; t: string; c: '' | 'up' | 'dn' }
export const bandOf = (score: number): Band =>
  score >= 70 ? { k: 'strong', t: 'Strong', c: 'up' } : score >= 55 ? { k: 'firm', t: 'Firm', c: 'up' } : score >= 40 ? { k: 'mixed', t: 'Mixed', c: '' } : score >= 25 ? { k: 'weak', t: 'Weak', c: 'dn' } : { k: 'poor', t: 'Poor', c: 'dn' };

export interface Stage { k: 'deep' | 'real' | 'early' | 'none'; t: string; c: '' | 'up' }
export const stageOf = (drawdown: number, abovePct: number): Stage =>
  drawdown >= 25 && abovePct <= 25 ? { k: 'deep', t: 'Genuinely cheap', c: 'up' }
    : drawdown >= 15 && abovePct <= 40 ? { k: 'real', t: 'Worth buying in instalments', c: 'up' }
      : drawdown >= 10 ? { k: 'early', t: 'Slightly cheaper', c: '' } : { k: 'none', t: 'Nothing on sale', c: '' };

/** What the stage measures, in words (H03): it is read from the index's fall from its 52-week high and the share of stocks above
 *  their 200-day average. No valuation input (earnings, book, yield) enters it, so it is never shown as "valuation". The port
 *  keeps upstream's own label in `t`; pages show this one. */
export const STAGE_WORDS: Record<Stage['k'], string> = { deep: 'deep drawdown, narrow breadth', real: 'broad drawdown', early: 'early drawdown', none: 'no meaningful drawdown' };
export const stageWords = (k: Stage['k'] | string | undefined | null): string | null => (k && k in STAGE_WORDS ? STAGE_WORDS[k as Stage['k']] : null);

/** Python's round(): halves go to the even neighbour (round(40.5) == 40), unlike Math.round. */
export function pyRound(x: number, dp = 0): number {
  const m = 10 ** dp, y = x * m, f = Math.floor(y), d = y - f;
  const r = Math.abs(d - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(y);
  return r / m;
}

export interface BreadthIn { counted: number; above200: number | null; up: number | null; at52wHigh: number | null }
export interface Part { key: Key; label: string; score: number; weight: number; detail: string }
export interface Reading {
  score: number; band: Band; stage: Stage | null; parts: Part[];
  coverage: { parts: number; partsTotal: number; weightUsed: number; weightTotal: number; missing: Key[]; complete: boolean };
  counted: number; nifty: number | null; drawdownPct: number | null; above200Pct: number | null; vix: number | null;
}

const fin = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function computeBarometer(niftyClose: number | null, niftyHi: number | null, niftyLo: number | null, b: BreadthIn, vix: number | null): Reading | null {
  if (!b.counted) return null;
  const parts: Part[] = [];
  const c = niftyClose, hi = niftyHi, lo = niftyLo;
  if (fin(c) && fin(hi) && fin(lo) && hi > lo) {
    const pos = ((c - lo) / (hi - lo)) * 100;
    parts.push({ key: 'trend', label: 'Where the index sits', score: pyRound(pos, 1), weight: WEIGHTS.trend, detail: `Nifty is ${pos.toFixed(0)}% up its own 52-week range, ${Math.abs(((c - hi) / hi) * 100).toFixed(1)}% below the high` });
  }
  const abovePct = fin(b.above200) ? (b.above200 / b.counted) * 100 : null;
  if (abovePct !== null) parts.push({ key: 'breadth', label: 'Names above their 200-day', score: pyRound(abovePct, 1), weight: WEIGHTS.breadth, detail: `${b.above200} of ${b.counted} hold their 200-day average` });
  if (fin(b.up)) parts.push({ key: 'participation', label: 'Advancing today', score: pyRound((b.up / b.counted) * 100, 1), weight: WEIGHTS.participation, detail: `${b.up} of ${b.counted} advanced` });
  if (fin(vix)) parts.push({ key: 'volatility', label: 'Volatility', score: vixScore(vix), weight: WEIGHTS.volatility, detail: `India VIX at ${vix.toFixed(2)}, ${vixWord(vix)}` });
  if (fin(b.at52wHigh)) parts.push({ key: 'highs', label: 'Names at a 52-week high', score: pyRound(Math.min(100, ((b.at52wHigh / b.counted) * 100) / 5 * 100), 1), weight: WEIGHTS.highs, detail: `${b.at52wHigh} of ${b.counted} at a 52-week high` });
  const wsum = parts.reduce((s, p) => s + p.weight, 0);
  if (!wsum) return null;
  const total = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
  const score = pyRound(parts.reduce((s, p) => s + p.score * p.weight, 0) / wsum);
  const dd = fin(c) && fin(hi) ? Math.abs(((c - hi) / hi) * 100) : null;
  const missing = (Object.keys(WEIGHTS) as Key[]).filter((k) => !parts.some((p) => p.key === k));
  return {
    score, band: bandOf(score), stage: dd !== null && abovePct !== null ? stageOf(dd, abovePct) : null, parts,
    coverage: { parts: parts.length, partsTotal: Object.keys(WEIGHTS).length, weightUsed: wsum, weightTotal: total, missing, complete: wsum === total },
    counted: b.counted, nifty: fin(c) ? c : null, drawdownPct: dd === null ? null : pyRound(dd, 2), above200Pct: abovePct === null ? null : pyRound(abovePct, 1), vix: fin(vix) ? vix : null,
  };
}
