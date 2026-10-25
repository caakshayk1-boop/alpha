/** Today's progress: the few numbers that say how much of today's routine is done. Pure functions, tested in tests/lib.test.ts.
 *  Every figure is a count of something recorded in this browser or published by the site; nothing is a score of how well
 *  anything went, and an empty list is a state of its own, never 0%. */
import type { JournalEntry } from './journal.ts';
import { reviewDue } from './journal.ts';

const istDay = (iso: string): string | null => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/** Followed names whose review snapshot was saved on `todayIst` (IST). A snapshot of a name no longer followed does not count. */
export function reviewedToday(watch: readonly string[], snaps: Readonly<Record<string, { at: string }>>, todayIst: string): { done: number; total: number } {
  const names = [...new Set(watch)];
  return { total: names.length, done: names.filter((s) => snaps[s] && istDay(snaps[s].at) === todayIst).length };
}

/** How many of `n` dots are filled for done/total: proportional, rounded down so the gauge never shows more than was done,
 *  and at least one dot once anything is done so a start is visible. */
export function filledDots(done: number, total: number, n: number): number {
  if (!(total > 0) || !(done > 0)) return 0;
  return Math.min(n, Math.max(1, Math.floor((Math.min(done, total) / total) * n)));
}

/** Dot centres on a semicircle, left to right, in a box of 2·r wide and r tall (plus the dot radius). */
export function arcDots(n: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI - (n === 1 ? Math.PI / 2 : (i / (n - 1)) * Math.PI);
    return { x: Math.round((r + r * Math.cos(a)) * 100) / 100, y: Math.round((r - r * Math.sin(a)) * 100) / 100 };
  });
}

/** Journal entries whose review date has come and which have no retrospective yet. */
export const reviewsDue = (journal: readonly JournalEntry[], todayIso: string): number => journal.filter((e) => reviewDue(e, todayIso)).length;
