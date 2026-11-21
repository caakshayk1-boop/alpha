// Prices are compared with the dated mark, never with an intraday quote.
export function exitDistance(close: number | null, stop: number | null, target: number | null) {
  if (close == null || stop == null || target == null ||
      ![close, stop, target].every(Number.isFinite) || Math.min(close, stop) <= 0 || target <= stop) return null;
  return { toStop: (stop - close) / close * 100, toTarget: (target - close) / close * 100,
    position: Math.min(1, Math.max(0, (close - stop) / (target - stop))) };
}

// The next session uses the highest close through the marked session, as in the ledger engine.
export function nextTrailingStop(entry: number, initial: number, stopPct: number, closes: number[]) {
  if (!closes.length || ![entry, initial, stopPct,...closes].every(n=>Number.isFinite(n) && n>0) || stopPct>=100) return null;
  return Math.max(initial, Math.round(Math.max(entry,...closes)*(1-stopPct/100)*100)/100);
}
