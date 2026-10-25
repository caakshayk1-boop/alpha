/** Paper planner: pure sizing arithmetic for a LONG paper plan. It places no order and a saved plan is not a fill.
 *  Quantity is the smallest of four caps (risk, cash, position exposure, liquidity); every cap is reported so the reader sees which one bound.
 *  Slippage and gaps can make the real loss larger than `risk` below. */
export interface PlanInput {
  equity: number; cash: number; riskPct: number; entry: number; stop: number;
  maxPositionPct: number; costRoundTripPct: number;
  /** 20-session traded value in rupees, when known; the liquidity cap is 1% of it */
  tradedValue?: number | null;
  /** R multiples for the conditional targets; defaults to the engine plan (+2R, +4R) */
  targetsR?: number[];
}
export interface PlanOut {
  ok: true; qty: number; capital: number; risk: number; riskPerShare: number; costs: number; binding: 'risk' | 'cash' | 'position' | 'liquidity';
  caps: { risk: number; cash: number; position: number; liquidity: number | null };
  targets: { r: number; price: number; gross: number; net: number }[]; limits: string[];
}
export interface PlanErr { ok: false; error: string }
const pos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function sizePlan(i: PlanInput): PlanOut | PlanErr {
  if (![i.equity, i.cash, i.entry, i.stop, i.riskPct, i.maxPositionPct].every(pos)) return { ok: false, error: 'Every price and amount must be a positive number.' };
  if (!(i.costRoundTripPct >= 0) || !Number.isFinite(i.costRoundTripPct)) return { ok: false, error: 'Costs must be zero or more.' };
  if (i.riskPct > 5) return { ok: false, error: 'A risk budget above 5% of equity is not accepted here.' };
  if (i.maxPositionPct > 100) return { ok: false, error: 'Position exposure cannot exceed 100% of equity.' };
  if (i.stop >= i.entry) return { ok: false, error: 'A long plan needs the stop below the entry.' };
  const rps = i.entry - i.stop;
  const caps = {
    risk: Math.floor((i.equity * i.riskPct / 100) / rps),
    cash: Math.floor(i.cash / i.entry),
    position: Math.floor((i.equity * i.maxPositionPct / 100) / i.entry),
    liquidity: pos(i.tradedValue) ? Math.floor((i.tradedValue * 0.01) / i.entry) : null,
  };
  const live: [PlanOut['binding'], number][] = [['risk', caps.risk], ['cash', caps.cash], ['position', caps.position]];
  if (caps.liquidity !== null) live.push(['liquidity', caps.liquidity]);
  live.sort((a, b) => a[1] - b[1]);
  const [binding, qty] = live[0];
  if (qty < 1) return { ok: false, error: `Not feasible: the ${binding} limit allows less than one share at these prices.` };
  const capital = qty * i.entry;
  const costs = capital * i.costRoundTripPct / 100;
  const targets = (i.targetsR ?? [2, 4]).map((r) => { const price = i.entry + r * rps; const gross = qty * (price - i.entry); return { r, price, gross, net: gross - costs }; });
  const limits = ['A gap through the stop can lose more than the planned risk.', 'Costs are an assumption; real fills differ.'];
  if (caps.liquidity === null) limits.push('Liquidity is unknown for this name, so no liquidity cap was applied.');
  return { ok: true, qty, capital, risk: qty * rps, riskPerShare: rps, costs, binding, caps, targets, limits };
}
