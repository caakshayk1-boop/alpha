/** The instruments on the home screen beside the Indian indices. Prices come from Yahoo Finance through the Worker: COMEX and ICE futures for
 *  gold, silver and oil (not MCX, so rupee prices at home differ by the exchange rate, duty and premium), spot rates for currencies. */
import { useLiveMacro } from './quotes.ts';
export interface MacroDef { key: string; label: string; sub: string; dp: number; pre: string; tv: string; tint: string }
export const MACRO: MacroDef[] = [
  { key: 'GOLD', label: 'Gold', sub: 'US dollars an ounce', dp: 2, pre: '$', tv: 'TVC:GOLD', tint: '#ffb02e' },
  { key: 'SILVER', label: 'Silver', sub: 'US dollars an ounce', dp: 2, pre: '$', tv: 'TVC:SILVER', tint: '#9fc4ff' },
  { key: 'BRENT', label: 'Brent oil', sub: 'US dollars a barrel', dp: 2, pre: '$', tv: 'TVC:UKOIL', tint: '#a98bff' },
  { key: 'WTI', label: 'WTI oil', sub: 'US dollars a barrel', dp: 2, pre: '$', tv: 'TVC:USOIL', tint: '#ff6fa8' },
  { key: 'USDINR', label: 'USD / INR', sub: 'rupees per US dollar', dp: 2, pre: '₹', tv: 'FX_IDC:USDINR', tint: '#35e0d0' },
  { key: 'MYRINR', label: 'MYR / INR', sub: 'rupees per ringgit', dp: 3, pre: '₹', tv: 'FX_IDC:MYRINR', tint: '#5ff0b0' },
  { key: 'USDMYR', label: 'USD / MYR', sub: 'ringgit per US dollar', dp: 4, pre: 'RM', tv: 'FX_IDC:USDMYR', tint: '#58a8ff' },
  { key: 'BTC', label: 'Bitcoin', sub: 'US dollars', dp: 0, pre: '$', tv: 'BITSTAMP:BTCUSD', tint: '#ff9a3c' },
];
export const macroDef = (k: string) => MACRO.find((m) => m.key === k);
export const fmtMacro = (m: MacroDef, v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? m.pre + v.toLocaleString('en-US', { minimumFractionDigits: m.dp, maximumFractionDigits: m.dp }) : '—');
export const macroTv = (k: string) => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(macroDef(k)?.tv ?? 'TVC:GOLD')}`;
/** All eight, refreshed every 8 seconds while the page is visible and something is printing. */
export const useMacro = (on = true) => useLiveMacro(on);
