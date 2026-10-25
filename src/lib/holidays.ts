/** NSE equity-segment trading holidays that fall on weekdays (T12): the exchange's own calendar, so a holiday is never counted
 *  as a missing session. Source: NSE circular NSE/CMTR/71775 "Trading holidays for the calendar year 2026", plus the
 *  15 Jan 2026 Maharashtra municipal-election closure published on NSE's holidays page (BSE lists the same 16 dates).
 *  A year not listed here falls back to the weekday rule plus the sessions the market's own record shows were missed
 *  (status.ts sessionGaps), and says so: add each new year's circular when NSE publishes it. Special sessions (Muhurat
 *  trading on a weekend) are not regular sessions and are not listed. */
export const NSE_HOLIDAYS: Readonly<Record<number, readonly string[]>> = {
  2026: ['2026-01-15', '2026-01-26', '2026-03-03', '2026-03-26', '2026-03-31', '2026-04-03', '2026-04-14', '2026-05-01', '2026-05-28', '2026-06-26', '2026-09-14', '2026-10-02', '2026-10-20', '2026-11-10', '2026-11-24', '2026-12-25'],
};
const ALL = new Set(Object.values(NSE_HOLIDAYS).flat());
export const isNseHoliday = (isoDate: string): boolean => ALL.has(isoDate);
/** True when the exchange calendar for that year is on file (otherwise only weekdays and observed gaps are known). */
export const calendarKnown = (isoDate: string): boolean => Number(isoDate.slice(0, 4)) in NSE_HOLIDAYS;
