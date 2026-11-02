/** How a paper plan is DESCRIBED: the hypothetical allocation, the cash left, and the modelled loss at the assumed stop, with the caveats that go beside them.
 *  This file computes nothing new about sizing. The quantity, capital, risk and costs come from `planner.ts#sizePlan` (unchanged); here they are only restated against the hypothetical equity and cash the person typed
 *  (a product and a difference of figures already produced there). Every figure is hypothetical: it is read from no broker or account, and a plan is a calculation, not an order, a fill or a holding. */
export interface PlanFigures {
  /** quantity x entry: the rupees the plan would put to work if the whole position were bought at the entry assumed */
  capital: number;
  /** capital as a share of the hypothetical equity, or null when equity is not a positive number */
  allocationPct: number | null;
  /** hypothetical cash after buying at the entry assumed (never negative from `sizePlan`, which caps quantity by cash; a saved plan edited by hand could differ, and a negative figure is shown as it is) */
  cashLeft: number | null;
  /** quantity x (entry - stop): what the position loses if it exits exactly at the assumed stop. A gap, slippage or a halt can make the real loss larger. */
  lossAtStop: number;
  lossAtStopPct: number | null;
  /** the round-trip cost assumption applied to capital (the same arithmetic as `sizePlan`), or null when no assumption is given */
  costs: number | null;
  /** loss at the stop plus the cost assumption, or null when costs are null */
  lossWithCosts: number | null;
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function planFigures(p: { qty: number; entry: number; stop: number }, equity: number, cash: number, costRoundTripPct: number | null = null): PlanFigures {
  const capital = p.qty * p.entry; const lossAtStop = p.qty * (p.entry - p.stop);
  const costs = finite(costRoundTripPct) && costRoundTripPct >= 0 ? capital * costRoundTripPct / 100 : null;
  return {
    capital, allocationPct: finite(equity) && equity > 0 ? capital / equity * 100 : null, cashLeft: finite(cash) ? cash - capital : null,
    lossAtStop, lossAtStopPct: finite(equity) && equity > 0 ? lossAtStop / equity * 100 : null, costs, lossWithCosts: costs == null ? null : lossAtStop + costs,
  };
}
/** The caveats printed beside any plan figure. The cost assumption is the number the planner was given, not a constant of this file. */
export function planCaveats(costRoundTripPct: number, slippagePct?: number): string[] {
  return [
    'Paper only: this is a calculation on hypothetical money. It is not an order, a fill or a holding, and no broker is connected.',
    'The stop is your assumption. A gap through it (an overnight move, a halt, a thin market) can lose more than the modelled loss, and nothing guarantees an exit at the stop price.',
    `Costs are assumed at ${costRoundTripPct}% of capital over a round trip${slippagePct != null ? `, and a fill is assumed at the next open plus ${slippagePct}% slippage` : ''}. Real brokerage, taxes and fills differ.`,
    'Cash left assumes the whole position is bought at the entry price shown, using the hypothetical cash set in Settings.',
  ];
}
