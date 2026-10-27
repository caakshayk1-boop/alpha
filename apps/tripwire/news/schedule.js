// When the job runs. GitHub cron lines are a coarse grid (see .github/workflows/tripwire_news.yml); THIS file is the rule: 15 minutes while the NSE cash session is on (by the exchange
// calendar, holidays included), 30 otherwise. The same functions give the browser its "next check" and its "delayed" threshold, so the page and the job cannot disagree.
import { marketOpenNow, nextSession, istClock, OPEN_MIN } from '../src/calendar.ts';
import { CADENCE, DELAY_AFTER } from './config.js';

export const cadenceMin = (nowMs) => (marketOpenNow(nowMs) ? CADENCE.session : CADENCE.off);
/** The next instant a check is due after `fromMs`: one cadence on, but never later than the next session open (09:15 IST), which is on the cron grid. */
export function nextCheckMs(fromMs) {
  const cand = fromMs + cadenceMin(fromMs) * 60000;
  const openOf = (d) => Date.parse(`${d}T00:00:00Z`) - 330 * 60000 + OPEN_MIN * 60000;
  const { day } = istClock(fromMs); const prev = new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const d = nextSession(prev);                       // today if it is a trading day, else the next session day
  const open = openOf(d) > fromMs ? openOf(d) : openOf(nextSession(day));
  return open < cand ? open : cand;
}

/** Whether a cron tick should do the work. The cron fires every 15 minutes through the session window and every 30 elsewhere, but the window is wider than the session (holidays, pre-open),
 *  so a tick outside the session cadence is skipped when the last attempt was less than (cadence - 3 min) ago. `force` (a manual dispatch) always runs. */
export function shouldRun({ nowMs, lastAttemptMs, force = false }) {
  if (force) return { run: true, why: 'forced' };
  if (!Number.isFinite(lastAttemptMs)) return { run: true, why: 'no previous attempt' };
  const c = cadenceMin(nowMs); const sinceMin = (nowMs - lastAttemptMs) / 60000;
  return sinceMin >= c - 3 ? { run: true, why: `${sinceMin.toFixed(0)} min since the last attempt, cadence ${c}` } : { run: false, why: `only ${sinceMin.toFixed(0)} min since the last attempt, cadence ${c}` };
}
/** How old the last SUCCESSFUL check may be before the page calls the news delayed. */
export const delayAfterMin = (checkedMs) => DELAY_AFTER.cadences * cadenceMin(checkedMs) + DELAY_AFTER.graceMin;
