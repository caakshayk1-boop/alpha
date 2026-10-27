/** The exchange-session calendar: which days the NSE cash market trades, and the first and last session around any day. ONE answer for every clock in the app
 *  (the header strip, the freshness words, the polling that stops when the market is shut, the staleness of a screen, the Data screen).
 *
 *  SOURCE. NSE circular "Holidays for the calendar year 2026 - Equities", read from nseindia.com/resources/exchange-communication-holidays on 27 Oct 2026 and
 *  cross-checked against BSE's equity list and against the sessions the Nifty actually printed (test: every weekday of 2026 missing from the price history is
 *  in this list, and nothing in this list up to the history's last day traded). A year this file does not cover is NOT guessed: every weekday counts as a
 *  session and `covered()` says false, so a page can say the calendar ends rather than pretend.
 *  Weekend holidays on the circular (Mahashivratri, Id-Ul-Fitr, Independence Day) change nothing: the market is shut at weekends anyway.
 *  Muhurat trading (Sunday 8 Nov 2026, Diwali Laxmi Pujan) is a short special session whose hours the exchange announces separately: it is recorded below and
 *  NOT modelled as an ordinary session (no bars, no ledger night is expected for it). */
export const CALENDAR = { year: 2026, from: '2026-01-01', through: '2026-12-31', source: 'NSE circular, Holidays for the calendar year 2026 - Equities (read 27 Oct 2026)', version: 'nse-2026-1' } as const;

export const HOLIDAYS: Readonly<Record<string, string>> = {
  '2026-01-15': 'Municipal Corporation Election, Maharashtra', '2026-01-26': 'Republic Day', '2026-03-03': 'Holi', '2026-03-26': 'Shri Ram Navami',
  '2026-03-31': 'Shri Mahavir Jayanti', '2026-04-03': 'Good Friday', '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti', '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id', '2026-06-26': 'Muharram', '2026-09-14': 'Ganesh Chaturthi', '2026-10-02': 'Mahatma Gandhi Jayanti', '2026-10-20': 'Dussehra',
  '2026-11-10': 'Diwali-Balipratipada', '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev', '2026-12-25': 'Christmas',
};
export const SPECIAL: Readonly<Record<string, string>> = { '2026-11-08': 'Diwali Laxmi Pujan: Muhurat trading, a short evening session whose hours the exchange announces' };

const DAY_MS = 86400000;
export const OPEN_MIN = 9 * 60 + 15, CLOSE_MIN = 15 * 60 + 30;
const parse = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** The Indian calendar day and minutes since midnight for an instant. */
export const istClock = (nowMs: number) => { const d = new Date(nowMs + 330 * 60000); return { day: d.toISOString().slice(0, 10), mins: d.getUTCHours() * 60 + d.getUTCMinutes(), wd: d.getUTCDay() }; };

export const covered = (day: string) => day >= CALENDAR.from && day <= CALENDAR.through;
export const holidayName = (day: string): string | null => HOLIDAYS[day] ?? null;
export function isTradingDay(day: string): boolean { const wd = new Date(parse(day)).getUTCDay(); return wd !== 0 && wd !== 6 && !HOLIDAYS[day]; }
export function prevSession(day: string): string { let t = parse(day) - DAY_MS; while (!isTradingDay(iso(t))) t -= DAY_MS; return iso(t); }
export function nextSession(day: string): string { let t = parse(day) + DAY_MS; while (!isTradingDay(iso(t))) t += DAY_MS; return iso(t); }
/** Trading days strictly after `a` up to and including `b`. */
export function sessionsBetween(a: string, b: string): number { let n = 0; for (let t = parse(a) + DAY_MS; t <= parse(b); t += DAY_MS) if (isTradingDay(iso(t))) n++; return n; }

/** The latest session whose 15:30 close has passed (16:00 IST, to let the last prints and the close settle). */
export function lastFinishedSession(nowMs = Date.now()): string {
  const { day, mins } = istClock(nowMs); return isTradingDay(day) && mins >= 16 * 60 ? day : prevSession(day);
}
/** True when the cash session is on right now by the clock and the calendar. */
export function marketOpenNow(nowMs = Date.now()): boolean { const { day, mins } = istClock(nowMs); return isTradingDay(day) && mins >= OPEN_MIN && mins < CLOSE_MIN; }
/** Why the market is shut today, in words, or null when it is an ordinary trading day (or a weekend). */
export function closureToday(nowMs = Date.now()): string | null { const { day } = istClock(nowMs); const h = holidayName(day); return h ? `NSE holiday: ${h}` : null; }
export const calendarNote = (nowMs = Date.now()): string | null => { const { day } = istClock(nowMs); return covered(day) ? null : `The session calendar covers ${CALENDAR.from.slice(0, 4)} only; for ${day.slice(0, 4)} every weekday is treated as a session.`; };
