/** The 30-second company overview: the two pure decisions behind it, kept out of the component so they can be tested.
 *  Nothing here predicts; it names the one thing a reader can do next from where their own notes stand, and says in words what moved. */
import type { State } from './store.ts';
import { reviewDue, current } from './store.ts';
import { pct, isNum } from './fmt.ts';
import type { Row } from './screen.ts';

export type ActionId = 'follow' | 'thesis' | 'review' | 'plan';
export interface PrimaryAction { id: ActionId; label: string; why: string }
/** One primary action, chosen by state: follow it; then write why; then review when a review is due; then size a paper plan; otherwise review the thesis. */
export function primaryAction(s: Pick<State, 'follows' | 'entries' | 'plans'>, sym: string, today: string): PrimaryAction {
  if (!s.follows.includes(sym)) return { id: 'follow', label: `Follow ${sym}`, why: 'Following keeps it on Today and records what changes. It stays on this device.' };
  const e = s.entries.find((x) => x.sym === sym && !x.archived);
  if (!e) return { id: 'thesis', label: 'Write a thesis', why: 'A thesis with its invalidation is what separates a bad day from being wrong.' };
  const due = reviewDue(e, today); const hasPlan = s.plans.some((p) => p.sym === sym && p.status !== 'closed');
  if (due === 'overdue' || due === 'today') return { id: 'review', label: 'Review your thesis', why: due === 'overdue' ? 'Your review date has passed.' : 'Your review is today.' };
  if (!hasPlan) return { id: 'plan', label: 'Create a paper plan', why: `Size it against your own limits, on paper. Your thesis (${current(e).decision || 'no decision recorded'}) stays on file.` };
  return { id: 'review', label: 'Review your thesis', why: 'You have a thesis and a plan on file.' };
}
/** What changed, in one sentence from figures the screen holds: the move on the day (when a price is known), the month, and the distance from the 52-week high. A missing figure is left out, never zero. */
export function changeLine(row: Pick<Row, 'r1m' | 'from_high'>, dayCh: number | null, dayWord: string): string {
  const parts: string[] = [];
  if (isNum(dayCh)) parts.push(`${pct(dayCh)} ${dayWord}`);
  if (isNum(row.r1m)) parts.push(`${pct(row.r1m)} over a month`);
  if (isNum(row.from_high)) parts.push(row.from_high >= -0.05 ? 'at its 52-week high' : `${pct(Math.abs(row.from_high), 1, false)} below its 52-week high`);
  return parts.length ? parts.join(' · ') : 'No move is available: the screen holds no recent returns for this name.';
}
