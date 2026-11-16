/** Where a price sits between its 52-week low and high (3.0 Phase B). Pure. A missing or degenerate range is null, never a guess. */
export function rangePos(price: number | null | undefined, low: number | null | undefined, high: number | null | undefined): number | null {
  if (![price, low, high].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const p = price as number, lo = low as number, hi = high as number;
  if (hi <= lo) return null;
  return Math.round(Math.min(1, Math.max(0, (p - lo) / (hi - lo))) * 100);
}
export const rangeWords = (pos: number | null): string => (pos == null ? 'No 52-week range published' : `${pos}% of the way from the 52-week low to the high`);
