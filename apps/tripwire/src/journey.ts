/** The path the product is built around: follow a name, write why, size a paper plan, set the date you will look again. Each step is DONE from the user's own
 *  saved state, never from a click counter, so it is correct after a restore from backup. */
import type { State } from './store.ts';
import { current, reviewDue } from './store.ts';

export type StepId = 'follow' | 'thesis' | 'plan' | 'review';
export interface Step { id: StepId; n: number; title: string; why: string; done: boolean }
export interface Journey { steps: Step[]; done: number; next: Step | null; due: { sym: string; id: string; overdue: boolean } | null; sym: string | null }
export function journeyOf(s: State, today: string): Journey {
  const active = s.entries.filter((e) => !e.archived);
  const steps: Step[] = [
    { id: 'follow', n: 1, title: 'Follow a name', why: 'Following a company is how Today starts telling you what changed in it.', done: s.follows.length > 0 },
    { id: 'thesis', n: 2, title: 'Write why, and what would make you wrong', why: 'A thesis with its invalidation protects you from the story you tell yourself later.', done: active.length > 0 },
    { id: 'plan', n: 3, title: 'Size a paper plan', why: 'The planner shows how many shares your own risk limit allows. Nothing is ordered.', done: s.plans.length > 0 },
    { id: 'review', n: 4, title: 'Set a date to look again', why: 'A review date turns a note into a habit. Tripwire reminds you on that day.', done: active.some((e) => !!current(e).reviewOn) },
  ];
  const dueE = active.find((e) => ['overdue', 'today'].includes(reviewDue(e, today) ?? ''));
  const sym = (active[0]?.sym ?? s.follows[0]) ?? null;
  return { steps, done: steps.filter((x) => x.done).length, next: steps.find((x) => !x.done) ?? null, due: dueE ? { sym: dueE.sym, id: dueE.id, overdue: reviewDue(dueE, today) === 'overdue' } : null, sym };
}
