/** Which target bookings the person has already been shown. A booking that is new since their last visit gets the one accent sweep on its ladder (motion on only); one they have seen does not.
 *  The very first time the list is read there is no "last visit", so nothing is new and everything on screen is recorded: a first visit with ten old bookings gives no sweeps, not ten.
 *  Pure apart from the storage handed in, so it is unit-tested; the card passes localStorage. */
export const SEEN_KEY = 'tripwire:bookings-seen';
export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }
export const bookingKey = (id: string, kind: 'T1' | 'T2', day: string) => `${id}|${kind}|${day}`;
const read = (s: Store): string[] | null => { try { const t = s.getItem(SEEN_KEY); return t == null ? null : (JSON.parse(t) as string[]); } catch { return null; } };
/** The keys among `keys` that have not been shown before. Does not record them: call `markSeen` once they have been drawn. */
export function newBookings(keys: readonly string[], s: Store): Set<string> {
  const seen = read(s); if (seen == null) return new Set();      // first read: no earlier visit to be new since
  return new Set(keys.filter((k) => !seen.includes(k)));
}
export function markSeen(keys: readonly string[], s: Store): void {
  try { const seen = read(s) ?? []; const next = [...new Set([...seen, ...keys])].slice(-300); s.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* private mode: a sweep may repeat once */ }
}
