/** NSE cash-market sessions. Holiday list for 2026 copied (with attribution) from the NSE circular as recorded in Tripwire's calendar.ts;
 *  not imported across apps. A year not covered is NOT guessed: covered() says false. Refresh each December. */
export const CAL = { through: '2026-12-31', version: 'nse-2026-1' };
export const HOLIDAYS: Readonly<Record<string, string>> = {
  '2026-01-15': 'Municipal Corporation Election, Maharashtra', '2026-01-26': 'Republic Day', '2026-03-03': 'Holi', '2026-03-26': 'Shri Ram Navami',
  '2026-03-31': 'Shri Mahavir Jayanti', '2026-04-03': 'Good Friday', '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti', '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id', '2026-06-26': 'Muharram', '2026-09-14': 'Ganesh Chaturthi', '2026-10-02': 'Mahatma Gandhi Jayanti', '2026-10-20': 'Dussehra',
  '2026-11-10': 'Diwali-Balipratipada', '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev', '2026-12-25': 'Christmas',
};
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (m: number) => new Date(m).toISOString().slice(0, 10);
export const covered = (d: string) => d <= CAL.through && d >= '2026-01-01';
export function isSession(d: string): boolean { const w = new Date(ms(d)).getUTCDay(); return w !== 0 && w !== 6 && !HOLIDAYS[d]; }
export function nextSession(d: string): string { let m = ms(d); do { m += 86400000; } while (!isSession(iso(m))); return iso(m); }
export function prevSession(d: string): string { let m = ms(d); do { m -= 86400000; } while (!isSession(iso(m))); return iso(m); }
