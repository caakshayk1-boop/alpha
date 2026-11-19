/** Thesis review dates as an iCalendar file (RFC 5545), built on the device and handed to the browser: nothing is sent anywhere. Pure (the caller passes `nowMs`), so it is unit-tested.
 *  One all-day event per active thesis that has a review date on or after today. The event names the company and says what it is; the person's own thesis text is NOT written into the file,
 *  because a calendar file is often synced to a cloud calendar and the notes were promised to stay on this device. */
import type { Entry } from './store.ts';
import { current } from './store.ts';

const CRLF = '\r\n';
/** TEXT values: backslash, semicolon, comma and newline are escaped (RFC 5545 3.3.11). */
export const icsText = (v: string): string => v.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Lines longer than 75 octets are folded: CRLF plus one space; never inside a multi-byte character. */
export function fold(line: string): string {
  const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
  const out: string[] = []; let cur = ''; let bytes = 0;
  for (const ch of line) { const n = enc.encode(ch).length; if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += n; }
  out.push(cur); return out.join(CRLF + ' ');
}
const compact = (iso: string): string => iso.replace(/-/g, '');
const nextDay = (iso: string): string => new Date(Date.parse(iso + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
const stamp = (nowMs: number): string => new Date(nowMs).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

export interface ReviewEvent { id: string; sym: string; day: string }
/** Active theses with a review date today or later (IST day passed in), soonest first. */
export function reviewEvents(entries: readonly Entry[], today: string): ReviewEvent[] {
  return entries.filter((e) => !e.archived).map((e) => ({ id: e.id, sym: e.sym, day: current(e).reviewOn ?? '' }))
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.day) && x.day >= today).sort((a, b) => a.day.localeCompare(b.day) || a.sym.localeCompare(b.sym));
}
export function reviewIcs(entries: readonly Entry[], today: string, nowMs: number): { text: string; count: number } {
  const ev = reviewEvents(entries, today);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tripwire//Thesis review dates//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Tripwire thesis reviews'];
  for (const e of ev) lines.push('BEGIN:VEVENT', `UID:${e.id}-${e.day}@tripwire.askakshay.com`, `DTSTAMP:${stamp(nowMs)}`, `DTSTART;VALUE=DATE:${compact(e.day)}`, `DTEND;VALUE=DATE:${compact(nextDay(e.day))}`,
    `SUMMARY:${icsText(`Review your thesis on ${e.sym}`)}`, `DESCRIPTION:${icsText('A review date you set in Tripwire. Open the app to read what you wrote. Paper research only.')}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join(CRLF) + CRLF, count: ev.length };
}
export const icsName = (today: string): string => `tripwire-reviews-${today}.ics`;
