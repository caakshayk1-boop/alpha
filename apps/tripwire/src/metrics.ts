/** Plain definitions for every figure Tripwire prints. Deterministic text, not generated: the page labels it as such. */
export interface Metric { id: string; label: string; what: string; period: string; source: string; caution?: string }
const SRC = 'Annual statements via Yahoo Finance, computed by the Alpha screen';
export const METRICS: Metric[] = [
  { id: 'roce', label: 'ROCE', what: 'Operating profit (EBIT) divided by capital employed, in percent. How much the business earns on the money tied up in it.', period: 'Median of up to four fiscal years', source: SRC, caution: 'Not meaningful for banks and lenders, so it is not shown for them.' },
  { id: 'de', label: 'Debt to equity', what: 'Total borrowings divided by shareholders’ equity. Higher means more of the business is funded by lenders.', period: 'Latest fiscal year', source: SRC, caution: 'Negative equity reads as a bad balance sheet, never a clean one. Not meaningful for lenders.' },
  { id: 'pe', label: 'PE', what: 'Share price divided by earnings per share. The rupees paid for one rupee of yearly profit.', period: 'Trailing, at the data date', source: SRC, caution: 'Absent when earnings are negative. A low PE is not a signal that a stock is cheap.' },
  { id: 'rsi', label: 'RSI', what: 'A 0 to 100 measure of how one-sided the last 14 closes were. 70 or more is strong buying, 30 or less is strong selling.', period: '14 sessions to the data date', source: 'Computed from daily closes', caution: 'It describes what happened. It does not say a reversal is due.' },
  { id: 'rs3m', label: 'Against the Nifty', what: 'The stock’s 3-month return minus the Nifty 50’s, in percentage points.', period: '3 months to the data date', source: 'Computed from daily closes' },
  { id: 'from_high', label: 'From the high', what: 'How far the last close is below the highest price traded in the past 52 weeks.', period: '52 weeks', source: 'Exchange prices, unadjusted for dividends' },
  { id: 'vol_spike', label: 'Volume', what: 'The latest session’s volume divided by its recent average. 2x means twice as much traded as usual.', period: 'Latest session vs recent average', source: 'Exchange volume' },
  { id: 'net_margin', label: 'Net margin', what: 'Profit after tax as a share of revenue.', period: 'Latest fiscal year', source: SRC },
  { id: 'rev_cagr', label: 'Revenue growth', what: 'Compound yearly growth of revenue across the years held.', period: 'Up to 3 years', source: SRC },
  { id: 'eps_cagr', label: 'EPS growth', what: 'Compound yearly growth of earnings per share. Withheld when the share count changed structurally.', period: 'Up to 3 years', source: SRC },
  { id: 'div_yield', label: 'Dividend yield', what: 'Yearly dividend per share as a share of the price.', period: 'Trailing', source: SRC },
  { id: 'turnover_cr', label: 'Traded value', what: 'Rupees traded a day in crore, the median of 20 sessions. It sets how much you could trade without moving the price.', period: '20 sessions', source: 'Exchange volume and price' },
];
export const metric = (id: string) => METRICS.find((m) => m.id === id);
export function glossarySearch(q: string): Metric[] {
  const t = q.trim().toLowerCase(); if (!t) return [];
  return METRICS.filter((m) => m.label.toLowerCase().includes(t) || m.what.toLowerCase().includes(t));
}
