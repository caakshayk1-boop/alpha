/** Sessions the forward record should hold and does not: nights the ledger job never wrote down (4 and 5 Nov 2026 were lost to a failing test
 *  in the nightly job). Pure: the ledger and an instant in, dates out; the clock is the caller's, so a test never depends on today.
 *
 *  A session counts as missing when it is an ordinary trading day (the exchange calendar in calendar.ts, so holidays and the Muhurat special session are
 *  never expected), it falls on or after the first night the ledger recorded, it has no recorded night, and a LATER session has also finished. The latest
 *  finished session is not missing yet: the job writes a night down the same evening or in the next morning's recovery slots. */
import { isTradingDay, lastFinishedSession, nextSession } from './calendar.ts';

export interface GapLedger { days: readonly { asOf: string }[] }

/** THE implementation (12 Nov 2026; the Book Record used to carry its own copy): the trading sessions from the first recorded night up to, but not including, `until` that have no recorded
 *  night. Holidays and weekends are never sessions (calendar.ts). Dates only, no clock. Callers choose where the record is expected to run to: the Data page, to the latest FINISHED session;
 *  the Book Record (bookview.missingNights), to its own last recorded night, since a trailing gap there is lateness, which the picks-through pill states. */
export function missingSessions(recorded: readonly string[], until: string): string[] {
  const days = recorded.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!days.length) return [];
  const have = new Set(days), out: string[] = [];
  let d = isTradingDay(days[0]) ? days[0] : nextSession(days[0]);
  for (let guard = 0; d < until && guard < 3700; guard++, d = nextSession(d)) if (!have.has(d)) out.push(d);
  return out;
}

/** The Data page's reading: gaps up to the latest finished session, which is itself not missing yet. */
export function missingNights(ledger: GapLedger | null | undefined, nowMs: number): string[] {
  return missingSessions((ledger?.days ?? []).map((d) => d.asOf), lastFinishedSession(nowMs));
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "4 Nov 2026" for an ISO date. */
export const gapDate = (iso: string) => `${+iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

/** The one-line disclosure, or null when nothing is missing: "2 sessions not recorded: 4 Nov 2026, 5 Nov 2026". */
export function missingNightsNote(dates: readonly string[]): string | null {
  if (!dates.length) return null;
  return `${dates.length} session${dates.length === 1 ? '' : 's'} not recorded: ${dates.map(gapDate).join(', ')}`;
}
