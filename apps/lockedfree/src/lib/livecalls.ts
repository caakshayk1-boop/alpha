import { chargesFor } from './charges.ts';
/** An open call marked to a delayed live price: the change since the fill, and the figure after the buy-side charges, which is how the ledger itself nets an open call. Null when any input is not a positive number (a missing price is never read as zero). */
export interface LiveMark { gross: number; grossPct: number; net: number }
export function liveMark(qty: number, entry: number, px: number): LiveMark | null {
  if (!(qty > 0) || !(entry > 0) || !(px > 0)) return null;
  const gross = Math.round(qty * (px - entry) * 100) / 100;
  const charges = chargesFor('buy', qty, entry).reduce((s, l) => s + l.amount, 0);
  return { gross, grossPct: Math.round((px / entry - 1) * 1e4) / 100, net: Math.round((gross - charges) * 100) / 100 };
}
