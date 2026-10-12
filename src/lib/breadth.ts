import type { Row } from './types';

/** The one definition of "share of stocks above their 200-day average", computed from the screen's own rows so every page
 *  that quotes it quotes the same number, with its denominator. A stock with no 200-day average (too little history) is
 *  left out of the denominator and counted in `noHistory`, never silently treated as "below". */
export interface Breadth200 { above: number; withHistory: number; universe: number; noHistory: number; pct: number | null }

export function breadth200(rows: Pick<Row, 'price' | 'sma200'>[]): Breadth200 {
  let above = 0;
  let withHistory = 0;
  for (const r of rows) {
    if (typeof r.price === 'number' && typeof r.sma200 === 'number' && Number.isFinite(r.price) && Number.isFinite(r.sma200)) {
      withHistory++;
      if (r.price > r.sma200) above++;
    }
  }
  return { above, withHistory, universe: rows.length, noHistory: rows.length - withHistory, pct: withHistory ? (above / withHistory) * 100 : null };
}
