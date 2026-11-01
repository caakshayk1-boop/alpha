/** Which Today and which My Desk a person gets, derived only from what is stored. Pure, so a test can hold it to the rule.
 *  NEW means nothing the person made or was shown exists yet: no follow, thought, plan, paper trade, saved comparison or screen, weekly review,
 *  and no change that was surfaced, seen or dismissed. Anything at all makes the person RETURNING, so a restored backup never lands on the setup screen. */
import type { State } from './store.ts';

const some = (o: Record<string, unknown[] | unknown> | undefined) => Object.values(o ?? {}).some((v) => (Array.isArray(v) ? v.length > 0 : v != null));
export function isNewUser(s: State): boolean {
  return s.follows.length === 0 && s.entries.length === 0 && s.plans.length === 0 && (s.paper?.length ?? 0) === 0
    && (s.compares?.length ?? 0) === 0 && (s.screens?.length ?? 0) === 0 && (s.reviews?.length ?? 0) === 0
    && !some(s.seen) && (s.inbox?.length ?? 0) === 0 && !some(s.dismissed) && !some(s.snaps);
}
/** The My Desk views that hold something. A view that is empty is not offered as a tab, but its link still opens (an explicit ?v= always wins). */
export interface DeskHas { follow: boolean; journal: boolean; plans: boolean; saved: boolean; any: boolean }
export function deskHas(s: State): DeskHas {
  const follow = s.follows.length > 0, journal = s.entries.length > 0, plans = s.plans.length > 0, saved = (s.compares?.length ?? 0) > 0 || (s.screens?.length ?? 0) > 0;
  return { follow, journal, plans, saved, any: follow || journal || plans || saved || (s.paper?.length ?? 0) > 0 };
}
