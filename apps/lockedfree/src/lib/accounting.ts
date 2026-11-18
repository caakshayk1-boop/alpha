/** The one accounting module. Pure, no I/O. Public ledger and a visitor's browser book both call this; nothing else computes P&L.
 *  Rules: realised = booked exits (partials included) net of allocated charges; unrealised = remaining quantity vs remaining cost basis;
 *  every charge belongs to one fill and is counted once; R is measured against the ORIGINAL filled position's risk, frozen, unchanged by partial exits.
 *  Average-cost method. Buy charges follow the shares: when q of Q shares are sold, q/Q of the open buy charges move to realised. */
import type { ChargeLine } from './charges.ts';
import { sum } from './charges.ts';
export interface Fill { date: string; side: 'buy' | 'sell'; qty: number; price: number; charges?: ChargeLine[] }
export interface Position { qty: number; avgCost: number; openBuyCharges: number }
export interface Result {
  realised: number; unrealised: number; total: number; initialRisk: number; r: number | null;
  qtyOpen: number; qtyOriginal: number; avgCost: number; chargesTotal: number; chargesRealised: number; chargesOpen: number; status: 'open' | 'closed';
}
export const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/** `mark` is the price of the remaining quantity (null when nothing is open or no mark exists: unrealised is then null-safe 0 only if nothing is open). */
export function evaluate(fills: Fill[], stop: number, mark: number | null): Result {
  let qty = 0, avg = 0, openBuy = 0, realised = 0, chargesRealised = 0, chargesTotal = 0, bought = 0, risk = 0;
  for (const f of fills) {
    if (!(f.qty > 0) || !(f.price > 0)) throw new Error(`bad fill ${JSON.stringify(f)}`);
    const ch = f.charges ? sum(f.charges) : 0; chargesTotal += ch;
    if (f.side === 'buy') {
      avg = (avg * qty + f.price * f.qty) / (qty + f.qty); qty += f.qty; openBuy += ch; bought += f.qty;
      risk += f.qty * (f.price - stop);                      // frozen at the moment of each entry fill; a sell never touches it
    } else {
      if (f.qty > qty + 1e-9) throw new Error('sell exceeds open quantity');
      const share = qty ? f.qty / qty : 0, moved = openBuy * share;
      realised += (f.price - avg) * f.qty - ch - moved; chargesRealised += ch + moved;
      openBuy -= moved; qty -= f.qty;
    }
  }
  let unrealised = 0;
  if (qty > 1e-9) {
    if (mark == null) throw new Error('an open position needs a mark');
    unrealised = (mark - avg) * qty - openBuy;
  } else { qty = 0; openBuy = 0; }
  const total = realised + unrealised;
  return {
    realised: r2(realised), unrealised: r2(unrealised), total: r2(total), initialRisk: r2(risk), r: risk > 0 ? r2(total / risk) : null,
    qtyOpen: qty, qtyOriginal: bought, avgCost: r2(avg), chargesTotal: r2(chargesTotal), chargesRealised: r2(chargesRealised), chargesOpen: r2(openBuy), status: qty > 0 ? 'open' : 'closed',
  };
}
/** Position size from account size, risk % and the entry/stop distance. Whole shares, rounded down. null when the inputs cannot give one. */
export function positionSize(account: number, riskPct: number, entry: number, stop: number): number | null {
  const d = entry - stop; if (!(account > 0) || !(riskPct > 0) || !(d > 0)) return null;
  const riskPaise = Math.round(account * riskPct), distPaise = Math.round(d * 100);   // integer paise: 10 / 0.01 must be 1000, not 999.99...
  return distPaise > 0 ? Math.floor(riskPaise / distPaise) : null;
}
