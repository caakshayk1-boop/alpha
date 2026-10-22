/** "Worth investigating" (Today) and the confluence board (Tools) rank the same way, from the same check evaluation
 *  (decision.ts, CHECKS_VERSION), so a name reads the same count on every surface (A03). Each idea carries ONE reason and ONE
 *  limitation, chosen by rule: the limitation is the data gate when the data is held (thin history, missing market cap...),
 *  else the strongest countercase point, else the plain statement that Alpha's rules found none (which is not evidence that
 *  none exists). Pure; tested in tests/lib.test.ts. */
import { decide, type Decision } from './decision.ts';
import { eligibility, type Eligibility } from './coverage.ts';
import type { Row, Sig } from './types';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
export const MIN_CHECKS = 6;          // a name needs six of the nine checks to apply before it can be ranked at all
export const MIN_TURNOVER_CR = 5;     // liquid names only

export interface Idea {
  r: Row; d: Decision; passed: number; known: number; total: number; score: number; mine: Sig[];
  reason: string; limitation: string; limitationKind: 'data' | 'countercase' | 'none'; elig: Eligibility | null;
}

export function rankIdeas(rows: Row[], sigsAll: Sig[], alertable: boolean, limit = 8): { ideas: Idea[]; skipped: number; ranked: number } {
  const sigs = sigsAll.filter((x) => x.status === 'open' || x.status === 'pending');
  let skipped = 0;
  const out: Idea[] = [];
  for (const r of rows) {
    if (!has(r.turnover_cr) || r.turnover_cr < MIN_TURNOVER_CR) continue;
    const mine = sigs.filter((x) => x.sym === r.sym);
    const d = decide(r, mine);
    const passed = d.checks.filter((c) => c.pass === true).length, known = d.checks.filter((c) => c.pass !== null).length;
    if (known < MIN_CHECKS) { skipped++; continue; }
    const engines = mine.length * (alertable ? 1 : 0.5);
    const elig = eligibility(r);
    // thin history is not a reason to hide a name, but it must not rank it as if its record were complete (H08)
    const score = (passed / known) * 6 + engines * 2 + (r.mf?.rank && r.mf.rank <= 100 ? 1 : 0) + (r.vd?.c === 'BUY' ? 1 : 0) - (r.risk?.level === 'HIGH' ? 3 : 0) - (elig?.thin ? 1 : 0);
    const limitationKind: Idea['limitationKind'] = elig && !elig.ok ? 'data' : d.bear.length ? 'countercase' : 'none';
    const limitation = limitationKind === 'data' ? elig!.label : limitationKind === 'countercase' ? d.bear[0].text : 'Alpha’s rules found no countercase point. That is not evidence there is none.';
    out.push({ r, d, passed, known, total: d.checks.length, score, mine, reason: d.bull[0]?.text ?? d.headline, limitation, limitationKind, elig });
  }
  out.sort((a, b) => b.score - a.score || a.r.sym.localeCompare(b.r.sym));
  return { ideas: out.slice(0, limit), skipped, ranked: out.length };
}

/** Results dates on file in the next `days` days: names you follow first, then the largest. Every date is the screen's
 *  estimate unless a source confirms it, and it is labelled that way (E12): Alpha holds no exchange confirmation. */
export interface Upcoming { sym: string; name: string; date: string; followed: boolean }
export function upcomingResults(rows: Row[], watch: string[], todayIso: string, days = 14, limit = 6): Upcoming[] {
  const end = new Date(Date.parse(`${todayIso}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
  const w = new Set(watch);
  return rows.filter((r) => r.next_earnings && r.next_earnings >= todayIso && r.next_earnings <= end)
    .sort((a, b) => Number(w.has(b.sym)) - Number(w.has(a.sym)) || (a.next_earnings! < b.next_earnings! ? -1 : a.next_earnings! > b.next_earnings! ? 1 : 0) || (b.mcap_cr ?? 0) - (a.mcap_cr ?? 0))
    .slice(0, limit).map((r) => ({ sym: r.sym, name: r.name, date: r.next_earnings!, followed: w.has(r.sym) }));
}
