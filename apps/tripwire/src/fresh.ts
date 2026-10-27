/** How old is the data? The last finished NSE session comes from the exchange calendar (weekends and the published holidays), so a screen built on the last
 *  session before a holiday is "current" through the holiday and the word "behind" never counts a day the market was shut. */
import { lastFinishedSession as lastFinished, sessionsBetween } from './calendar.ts';
export const lastFinishedSession = (now = new Date()): string => lastFinished(now.getTime());
export function sessionsBehind(dataDay: string | null | undefined, now = new Date()): number | null {
  if (!dataDay || !/^\d{4}-\d{2}-\d{2}$/.test(dataDay)) return null;
  const last = lastFinishedSession(now); return dataDay >= last ? 0 : sessionsBetween(dataDay, last);
}
export type Fresh = { word: 'Current' | 'One session behind' | 'Behind' | 'Unknown'; behind: number | null; tone: 'lime' | 'peach' | '' };
export function freshness(dataDay: string | null | undefined, now = new Date()): Fresh {
  const b = sessionsBehind(dataDay, now);
  if (b === null) return { word: 'Unknown', behind: null, tone: 'peach' };
  if (b === 0) return { word: 'Current', behind: 0, tone: 'lime' };
  if (b === 1) return { word: 'One session behind', behind: 1, tone: 'peach' };
  return { word: 'Behind', behind: b, tone: 'peach' };
}
