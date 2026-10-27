/** One vocabulary for how old a price is. The age is measured from the moment the exchange printed it (the quote's own timestamp), never from the moment the
 *  app last asked: a tab that refreshes every 8 seconds and receives the same 14:02 print for forty minutes must read "no print since 14:02", not "updated now".
 *  Holidays are not modelled; a weekday session with no recent print says exactly that, instead of guessing why. */
export type QState = 'live' | 'lagging' | 'stale' | 'last';
export const LIVE_SEC = 5 * 60, LAG_SEC = 20 * 60;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { marketOpenNow } from './calendar.ts';
const ist = (ms: number) => new Date(ms + 330 * 60000);
/** True when the Indian clock and the exchange calendar say the NSE cash session is on (a trading day, 09:15 to 15:30). */
export function nseClockOpen(nowMs: number): boolean { return marketOpenNow(nowMs); }
/** "14:32 IST" for today, "Fri 23 Oct 15:29 IST" for another day (Indian time). */
export function fmtIst(sec: number, nowMs = Date.now()): string {
  const d = ist(sec * 1000), t = ist(nowMs); const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return d.toISOString().slice(0, 10) === t.toISOString().slice(0, 10) ? `${hm} IST` : `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${hm} IST`;
}
export function ageWord(lagSec: number): string { const s = Math.max(0, Math.round(lagSec)); return s < 45 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`; }
export interface QuoteAge { state: QState; lagSec: number; text: string; tone: 'live' | 'warn' | 'bad' | 'quiet' }
/** `nse` is true for names on the Indian exchanges (their session is known); false for markets that trade round the clock or on other hours (gold, Bitcoin, currencies). */
export function quoteAge(ptSec: number | null | undefined, nowMs: number, nse = true): QuoteAge | null {
  if (typeof ptSec !== 'number' || !Number.isFinite(ptSec)) return null;
  const lag = Math.max(0, nowMs / 1000 - ptSec);
  if (lag <= LIVE_SEC) return { state: 'live', lagSec: lag, text: `${fmtIst(ptSec, nowMs)} · ${ageWord(lag)} old`, tone: 'live' };
  if (lag <= LAG_SEC) return { state: 'lagging', lagSec: lag, text: `${fmtIst(ptSec, nowMs)} · ${ageWord(lag)} old`, tone: 'warn' };
  if (nse && nseClockOpen(nowMs)) return { state: 'stale', lagSec: lag, text: `No print since ${fmtIst(ptSec, nowMs)} (${ageWord(lag)}). A holiday, or the price source is quiet.`, tone: 'bad' };
  return { state: 'last', lagSec: lag, text: `Last print ${fmtIst(ptSec, nowMs)}`, tone: 'quiet' };
}
export const isLiveQuote = (q: { pt: number } | null | undefined, nowMs = Date.now()) => !!q && quoteAge(q.pt, nowMs)?.state === 'live';
