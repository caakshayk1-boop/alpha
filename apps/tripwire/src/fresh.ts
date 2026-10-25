/** How old is the data? The last finished NSE session is the latest weekday whose 15:30 IST close has passed (we use 16:00 to be safe).
 *  Exchange holidays are NOT modelled, so "behind" can overcount by a holiday; the page says so rather than claiming a calendar it does not have. */
const ist = (d: Date) => new Date(d.getTime() + 330 * 60000);
export function lastFinishedSession(now = new Date()): string {
  const t = ist(now); let day = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const afterClose = t.getUTCHours() >= 16;
  const wd = day.getUTCDay();
  if (wd === 0 || wd === 6 || !afterClose) day = new Date(day.getTime() - 86400000);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day = new Date(day.getTime() - 86400000);
  return day.toISOString().slice(0, 10);
}
export function sessionsBehind(dataDay: string | null | undefined, now = new Date()): number | null {
  if (!dataDay || !/^\d{4}-\d{2}-\d{2}$/.test(dataDay)) return null;
  const last = lastFinishedSession(now); if (dataDay >= last) return 0;
  let n = 0; let d = new Date(dataDay + 'T00:00:00Z');
  while (d.toISOString().slice(0, 10) < last) { d = new Date(d.getTime() + 86400000); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++; }
  return n;
}
export type Fresh = { word: 'Current' | 'One session behind' | 'Behind' | 'Unknown'; behind: number | null; tone: 'lime' | 'peach' | '' };
export function freshness(dataDay: string | null | undefined, now = new Date()): Fresh {
  const b = sessionsBehind(dataDay, now);
  if (b === null) return { word: 'Unknown', behind: null, tone: 'peach' };
  if (b === 0) return { word: 'Current', behind: 0, tone: 'lime' };
  if (b === 1) return { word: 'One session behind', behind: 1, tone: 'peach' };
  return { word: 'Behind', behind: b, tone: 'peach' };
}
