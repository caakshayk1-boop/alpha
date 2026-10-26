/** Links out to TradingView's chart for an NSE symbol. TradingView writes a few tickers with an underscore where NSE uses & or -
 *  (M&M is M_M, BAJAJ-AUTO is BAJAJ_AUTO). Other oddities may exist; the page opens TradingView's own search if a symbol is not found. */
export const tvSymbol = (sym: string): string => sym.toUpperCase().replace(/[&-]/g, '_');
export const tvUrl = (sym: string): string => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent('NSE:' + tvSymbol(sym))}`;
export const TV_INDEX: Record<string, string> = { NIFTY: 'NSE:NIFTY', BANKNIFTY: 'NSE:BANKNIFTY', VIX: 'NSE:INDIAVIX' };
export const tvIndexUrl = (k: string): string => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(TV_INDEX[k] ?? 'NSE:NIFTY')}`;
