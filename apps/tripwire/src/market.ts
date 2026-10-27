/** The trading session, from the Indian clock and the exchange calendar (holidays included, see calendar.ts). Callers pass `anyLive` (true when a quote printed in
 *  the last 25 minutes) to override the clock: a live print always wins over the calendar, because the calendar can be wrong and a print cannot. */
import { OPEN_MIN, CLOSE_MIN, closureToday, holidayName, isTradingDay, istClock, nextSession } from './calendar.ts';
export type Phase = 'pre' | 'open' | 'closed';
export interface Session { phase: Phase; label: string; detail: string }
const ist = (ms: number) => new Date(ms + 330 * 60000);
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function sessionNow(nowMs = Date.now(), anyLive: boolean | null = null): Session {
  const { day, mins } = istClock(nowMs); const trading = isTradingDay(day);
  if (anyLive === true) return { phase: 'open', label: 'Market open', detail: trading && mins < CLOSE_MIN ? `closes in ${hm(CLOSE_MIN - mins)}` : 'prices are printing now' };
  if (trading && mins >= 9 * 60 && mins < OPEN_MIN) return { phase: 'pre', label: 'Pre-open', detail: `opens in ${hm(OPEN_MIN - mins)}` };
  if (trading && mins >= OPEN_MIN && mins < CLOSE_MIN) {
    if (anyLive === false) return { phase: 'closed', label: 'No live prints', detail: 'the price source is quiet, or an unscheduled closure' };
    return { phase: 'open', label: 'Market open', detail: `closes in ${hm(CLOSE_MIN - mins)}` };
  }
  // closed: say why when it is a holiday, and when it opens next
  const next = trading && mins < OPEN_MIN ? day : nextSession(day); const dayMs = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  const nextMs = Date.UTC(+next.slice(0, 4), +next.slice(5, 7) - 1, +next.slice(8, 10)); const same = next === day; const tomorrow = nextMs - dayMs === 86400000;
  const when = same ? 'opens today 9:15' : tomorrow ? 'opens tomorrow 9:15' : `opens ${DAYS[new Date(nextMs).getUTCDay()]}${nextMs - dayMs > 3 * 86400000 ? ` ${next.slice(8)}/${next.slice(5, 7)}` : ''} 9:15`;
  const why = closureToday(nowMs); void holidayName;
  return { phase: 'closed', label: why ? 'NSE holiday' : 'Market closed', detail: why ? `${why.replace('NSE holiday: ', '')}, ${when}` : when };
}
