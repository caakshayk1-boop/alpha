/** What the person has decided, for My Desk: pure, so it can be tested. Recorded facts only. */
import { ENGINES } from './quant.ts';
import type { State } from './store.ts';
import { inr } from './fmt.ts';
export interface Decision { at: string; sym: string; what: string; href: string }
/** Everything the person has decided, newest first: a thesis version with a decision, a saved plan, a paper trade taken from a pick. Recorded facts only. */
export function recentDecisions(s: State, n = 8): Decision[] {
  const out: Decision[] = [];
  for (const e of s.entries) for (const v of e.versions) if (v.decision.trim()) out.push({ at: v.at, sym: e.sym, what: `Thesis decision: ${v.decision.trim()}`, href: `#/desk?v=journal` });
  for (const p of s.plans) out.push({ at: p.filledAt ?? p.at, sym: p.sym, what: p.status === 'paper-filled' ? `Paper fill recorded, ${p.qty} shares` : p.status === 'closed' ? 'Plan closed' : `Plan saved, ${p.qty} shares, stop ${inr(p.stop)}`, href: '#/desk?v=plans' });
  // Paper trades: one line per engine per day (five trades taken the same day were five identical lines), and none for an engine that has been retired (its picks were voided; the Mine tab still lists the trades).
  const retired = new Set<string>(ENGINES.filter((e) => e.retired).map((e) => e.id)); const taken = new Map<string, { at: string; engine: string; syms: string[]; hand: number }>();
  for (const t of s.paper) { if (retired.has(t.engine)) continue; const at = new Date(t.takenAt * 1000).toISOString(); const key = `${t.engine}|${new Date(t.takenAt * 1000 + 19800000).toISOString().slice(0, 10)}`; const g = taken.get(key) ?? { at, engine: t.engine, syms: [], hand: 0 }; g.syms.push(t.sym); if (t.closedByUser) g.hand++; if (at > g.at) g.at = at; taken.set(key, g); }
  for (const g of taken.values()) out.push({ at: g.at, sym: g.syms.length === 1 ? g.syms[0] : `${g.syms.length} names`, what: g.syms.length === 1 ? `Paper trade taken from a ${g.engine} pick${g.hand ? ' (closed by hand)' : ''}` : `Paper trades taken from ${g.engine} picks: ${g.syms.slice(0, 4).join(', ')}${g.syms.length > 4 ? ` and ${g.syms.length - 4} more` : ''}${g.hand ? `; ${g.hand} closed by hand` : ''}`, href: '#/signals?v=tracker' });
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
}
