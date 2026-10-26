/** The trading session, from the Indian clock. Exchange HOLIDAYS are not modelled, so a holiday reads as an ordinary weekday until the
 *  live feed shows no fresh prints; callers pass `anyLive` (true when a quote printed in the last 25 minutes) to override the clock. */
export type Phase = 'pre' | 'open' | 'closed';
export interface Session { phase: Phase; label: string; detail: string }
const ist = (ms: number) => new Date(ms + 330 * 60000);
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function sessionNow(nowMs = Date.now(), anyLive: boolean | null = null): Session {
  const d = ist(nowMs); const wd = d.getUTCDay(); const mins = d.getUTCHours() * 60 + d.getUTCMinutes(); const OPEN = 9 * 60 + 15, CLOSE = 15 * 60 + 30;
  const weekday = wd >= 1 && wd <= 5;
  if (anyLive === true) return { phase: 'open', label: 'Market open', detail: weekday && mins < CLOSE ? `closes in ${hm(CLOSE - mins)}` : 'prices are printing now' };
  if (weekday && mins >= 9 * 60 && mins < OPEN) return { phase: 'pre', label: 'Pre-open', detail: `opens in ${hm(OPEN - mins)}` };
  if (weekday && mins >= OPEN && mins < CLOSE) {
    if (anyLive === false) return { phase: 'closed', label: 'No live prints', detail: 'a holiday, or the price source is quiet' };
    return { phase: 'open', label: 'Market open', detail: `closes in ${hm(CLOSE - mins)}` };
  }
  // closed: say when it opens next
  let next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); let add = weekday && mins < OPEN ? 0 : 1;
  next = new Date(next.getTime() + add * 86400000); while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next = new Date(next.getTime() + 86400000);
  const same = add === 0; const tomorrow = add === 1 && next.getTime() - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) === 86400000;
  return { phase: 'closed', label: 'Market closed', detail: same ? `opens today 9:15` : tomorrow ? 'opens tomorrow 9:15' : `opens ${DAYS[next.getUTCDay()]} 9:15` };
}
