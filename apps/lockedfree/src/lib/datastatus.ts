/** Is this data current? One rule, used by the Data status page (27 Nov 2026). A daily dataset is current when it describes the last NSE session whose data is DUE, and the number of sessions behind is
 *  counted on the exchange calendar (weekends and holidays are not sessions). Data for a session is due at 23:30 IST on that session's day: the owner's feed is built in the evening, and Yahoo, the source of
 *  the ledger's benchmark, can post the benchmark's latest bar late. A weekly dataset is current when it is no more than nine days old. Pure functions; the page compares against the browser's own clock,
 *  so the verdict is never frozen at build time. */
import { isSession, prevSession, nextSession } from './calendar.ts';

export const CLOSE_MIN = 15 * 60 + 30, DUE_MIN = 23 * 60 + 30;
export type State = 'current' | 'behind' | 'unknown';
export interface Verdict { state: State; behind: number | null; unit: 'session' | 'day' | null; expected: string | null }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ist = (ms: number) => { const d = new Date(ms + 330 * 60000); return { day: d.toISOString().slice(0, 10), mins: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
/** The last session whose given time (minutes after midnight IST) has passed. */
export function lastSessionPast(nowMs: number, atMin: number): string {
  const { day, mins } = ist(nowMs);
  return isSession(day) && mins >= atMin ? day : prevSession(day);
}
export function sessionsBetween(a: string, b: string): number { let n = 0, d = a; while (d < b) { d = nextSession(d); if (d <= b) n++; } return n; }
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

export function verdictOf(asOf: string | null | undefined, nowMs: number, cadence: 'daily' | 'weekly' = 'daily'): Verdict {
  if (!asOf || !ISO.test(asOf)) return { state: 'unknown', behind: null, unit: null, expected: null };
  const today = ist(nowMs).day;
  if (asOf > today) return { state: 'unknown', behind: null, unit: null, expected: null };       // a date in the future is unreadable, never "current"
  if (cadence === 'weekly') { const age = daysBetween(asOf, today); return { state: age <= 9 ? 'current' : 'behind', behind: age <= 9 ? 0 : age, unit: 'day', expected: null }; }
  const expected = lastSessionPast(nowMs, DUE_MIN);
  if (asOf >= expected) return { state: 'current', behind: 0, unit: 'session', expected };
  return { state: 'behind', behind: sessionsBetween(asOf, expected), unit: 'session', expected };
}
/** The sentence a row prints: "Current", or "2 sessions behind". */
export function verdictWord(v: Verdict): string {
  if (v.state === 'unknown') return 'Date could not be read';
  if (v.state === 'current') return 'Current';
  const n = v.behind ?? 0; return `${n} ${v.unit === 'day' ? (n === 1 ? 'day' : 'days') : n === 1 ? 'session' : 'sessions'} behind`;
}
