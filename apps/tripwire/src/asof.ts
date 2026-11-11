/** One "Data as of" block for a company page. Each part of the page has its own clock (the quote, the nightly screen, the price history, the accounts, the filing),
 *  and the person should not have to reconcile five date strings scattered around the page. This builds the rows from structured inputs, in a fixed order,
 *  and says plainly when a date is not held. Pure: no fetching, no clock except the one passed in. */
import { dayWord } from './fmt.ts';
import { fmtIst } from './stamp.ts';

export interface AsOfInput {
  /** the live or last-traded print, when a quote was read */
  quote: { word: string; t: number } | null;
  /** the close the screen's figures were computed from */
  screenClose: string | null;
  /** last day of the price history drawn, as epoch seconds; undefined while it loads, null when it could not be read */
  chartThrough: number | null | undefined;
  /** the financial year of the latest accounts held */
  fy: string | null;
  /** the filing publication date, when the data carries one (it does not yet) */
  filed?: string | null;
  stale?: boolean;
  nowMs?: number;
}
export interface AsOfRow { id: 'quote' | 'screen' | 'chart' | 'accounts' | 'filing'; k: string; v: string; missing: boolean }
const isoOfSec = (s: number) => new Date(s * 1000 + 5.5 * 3600000).toISOString().slice(0, 10);
/** A day word that names the year when it is not the current one, so an old date never reads as a recent one. */
export const dayWordY = (iso: string, nowMs = Date.now()) => { const y = iso.slice(0, 4); return y === isoOfSec(nowMs / 1000).slice(0, 4) ? dayWord(iso) : `${dayWord(iso)} ${y}`; };

export function asOfRows(i: AsOfInput): AsOfRow[] {
  return [
    { id: 'quote', k: 'Quote', v: i.quote ? `${i.quote.word} · ${fmtIst(i.quote.t, i.nowMs)}` : 'Live price not available; figures use the close', missing: !i.quote },
    { id: 'screen', k: 'Screen metrics', v: i.screenClose ? `Close of ${dayWordY(i.screenClose, i.nowMs)}${i.stale ? ' (stale)' : ''}` : 'Snapshot date unavailable', missing: !i.screenClose || !!i.stale },
    { id: 'chart', k: 'Chart', v: i.chartThrough === undefined ? 'Loading' : i.chartThrough === null ? 'Price history unavailable' : `Through ${dayWordY(isoOfSec(i.chartThrough), i.nowMs)}`, missing: i.chartThrough === null },
    { id: 'accounts', k: 'Accounts', v: i.fy ? `Financial year ${i.fy}` : 'Financial period unavailable', missing: !i.fy },
    { id: 'filing', k: 'Filing', v: i.filed ? `Published ${dayWordY(i.filed, i.nowMs)}` : 'Publication date unavailable', missing: !i.filed },
  ];
}

/** Why the dates differ, in one paragraph. Only the clauses that apply are said. */
export function asOfWhy(i: AsOfInput): string {
  const bits = [
    i.quote ? 'The quote is read from Yahoo Finance when the page opens and moves during the session.' : null,
    'Screen metrics (trend, RSI, ranks) are recomputed once a night from the last finished close, so they can trail the quote by a session.',
    'The chart is daily closes and ends on the last close the price service holds.',
    'Accounts change only when a new annual report is filed.',
    i.filed ? null : 'The data does not carry the date each filing was published, so that date is shown as unavailable rather than guessed.',
  ];
  return bits.filter(Boolean).join(' ');
}
