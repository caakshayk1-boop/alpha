/** One vocabulary for how old a price is. The age is measured from the moment the exchange printed it (the quote's own timestamp), never from the moment the
 *  app last asked: a tab that refreshes every 8 seconds and receives the same 14:02 print for forty minutes must read "no print since 14:02", not "updated now".
 *  Exchange holidays ARE modelled (calendar.ts, the NSE circular): on a listed holiday the market is shut, no print is expected, and the last one is "Last traded". A weekday
 *  the calendar lists as a trading day with no recent print is a quiet price source or an unscheduled halt, and is said to be exactly that rather than blamed on a holiday.
 *
 *  ONE WORD for a quote: Live, Delayed, Last traded or Unavailable. Derived from two facts only: the exchange's own print time, and whether the session is on.
 *    Live          printed within five minutes AND the session is on (or it is a listed special session). A shut market is never Live, however fresh the print.
 *    Delayed       the session is on and the print is older than five minutes.
 *    Last traded   the session is shut (weekend, holiday, before 09:15, after 15:30), or the market trades round the clock but nothing printed for a while: the last print is the last price.
 *    Unavailable   there is no print time to judge and nothing is loading.
 *  The moment the app fetched a price decides nothing here. */
export type QState = 'live' | 'lagging' | 'stale' | 'last';
export type QWord = 'Live' | 'Delayed' | 'Last traded' | 'Unavailable';
export const LIVE_SEC = 5 * 60, LAG_SEC = 20 * 60;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { marketOpenNow, istClock, isSpecialDay } from './calendar.ts';
const ist = (ms: number) => new Date(ms + 330 * 60000);
/** True when the Indian clock and the exchange calendar say the NSE cash session is on (a trading day, 09:15 to 15:30). */
export function nseClockOpen(nowMs: number): boolean { return marketOpenNow(nowMs); }
/** The session is on, or the calendar lists today as a special session (its hours are not modelled, so a current print is then believed). */
export const nseSessionOn = (nowMs: number): boolean => nseClockOpen(nowMs) || isSpecialDay(istClock(nowMs).day);
/** "14:32 IST" for today, "Fri 23 Oct 15:29 IST" for another day (Indian time). */
export function fmtIst(sec: number, nowMs = Date.now()): string {
  const d = ist(sec * 1000), t = ist(nowMs); const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return d.toISOString().slice(0, 10) === t.toISOString().slice(0, 10) ? `${hm} IST` : `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${hm} IST`;
}
export function ageWord(lagSec: number): string { const s = Math.max(0, Math.round(lagSec)); return s < 45 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`; }
export interface QuoteAge { state: QState; word: QWord; lagSec: number; text: string; tone: 'live' | 'warn' | 'bad' | 'quiet' }
/** `nse` is true for names on the Indian exchanges (their session is known); false for markets that trade round the clock or on other hours (gold, Bitcoin, currencies), which are judged by the print's age alone. */
export function quoteAge(ptSec: number | null | undefined, nowMs: number, nse = true): QuoteAge | null {
  if (typeof ptSec !== 'number' || !Number.isFinite(ptSec)) return null;
  const lag = Math.max(0, nowMs / 1000 - ptSec); const at = fmtIst(ptSec, nowMs);
  const last: QuoteAge = { state: 'last', word: 'Last traded', lagSec: lag, text: `Last traded ${at}`, tone: 'quiet' };
  if (nse && !nseSessionOn(nowMs)) return last;                 // a shut market never says Live, and never "delayed": nothing is expected to print
  if (lag <= LIVE_SEC) return { state: 'live', word: 'Live', lagSec: lag, text: `Live · ${at} · ${ageWord(lag)} old`, tone: 'live' };
  if (lag <= LAG_SEC) return { state: 'lagging', word: 'Delayed', lagSec: lag, text: `Delayed · ${at} · ${ageWord(lag)} old`, tone: 'warn' };
  if (nse) return { state: 'stale', word: 'Delayed', lagSec: lag, text: `Delayed · no print since ${at} (${ageWord(lag)}). The calendar lists today as a trading day, so this is not a listed holiday: the price source is quiet, or trading is halted.`, tone: 'bad' };
  return last;
}
export const isLiveQuote = (q: { pt: number } | null | undefined, nowMs = Date.now(), nse = true) => !!q && quoteAge(q.pt, nowMs, nse)?.state === 'live';

/** The word for one quote. `null` while it is still loading (callers draw a placeholder, never "Unavailable"); "Unavailable" only once loading has finished with no print time. */
export function quoteWord(ptSec: number | null | undefined, nowMs: number, o: { nse?: boolean; loading?: boolean } = {}): QWord | null {
  const a = quoteAge(ptSec, nowMs, o.nse ?? true); if (a) return a.word; return o.loading ? null : 'Unavailable';
}
/** The newest print among several (a book, a list). Undefined and unreadable entries are ignored; none at all is null. */
export function freshestPrint(secs: readonly (number | null | undefined)[]): number | null {
  const ok = secs.filter((s): s is number => typeof s === 'number' && Number.isFinite(s)); return ok.length ? Math.max(...ok) : null;
}
/** The word for a position's mark. A mark from a live print is judged by that print's own time; a mark that is a daily close is "Last traded" once the session is shut and "Delayed" while it is on
 *  (the close is then yesterday's, not today's). No mark at all is "Unavailable". `detail` says which price it is, in plain words. */
export function markWord(kind: 'live' | 'close' | null | undefined, printSec: number | null | undefined, nowMs: number): { word: QWord; detail: string } {
  if (!kind) return { word: 'Unavailable', detail: 'no price' };
  if (kind === 'live') { const a = quoteAge(printSec, nowMs); return a ? { word: a.word, detail: a.word === 'Live' ? `printed ${fmtIst(printSec as number, nowMs)}` : `last print ${fmtIst(printSec as number, nowMs)}` } : { word: 'Last traded', detail: 'print time unknown' }; }
  return nseSessionOn(nowMs) ? { word: 'Delayed', detail: 'the last daily close, not today\'s price' } : { word: 'Last traded', detail: 'the last daily close' };
}
