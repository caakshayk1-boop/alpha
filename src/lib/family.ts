/** The askakshay family (28 Nov 2026): the four products, in one list the Today block and the footer both read, and the rule that
 *  turns each product's own published data dates (/api/family, worker/family.js) into one line. Current / behind is decided by the
 *  hub's status contract (lib/status.ts), so this block, /status/ and every data stamp use the same calendar. No return figures,
 *  no rankings between products: each line says what the product is and how current its own data is. */
import { describe, expectedSession, plural, reconcile, type DataStatus, type Freshness } from './status.ts';

import type { FamilyId } from './familyList.ts';
export { FAMILY, type FamilyId, type FamilyMember } from './familyList.ts';

export interface FamilyDataset { label: string; asOf: string | null; cadence: 'daily' | 'weekly' }
export interface FamilyProduct { id: FamilyId; reached: boolean; datasets: FamilyDataset[] }
export interface FamilyFeed { ok: boolean; read_at: string; products: FamilyProduct[] }

export interface FamilyLine { state: Freshness | 'not-reached' | 'checking'; text: string; detail: string }

const RANK: Record<Freshness, number> = { current: 0, partial: 1, delayed: 2, stale: 3, missing: 4, unavailable: 4, error: 5 };
const short = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** One product's line. The least current dataset sets the state; the detail names every dataset and its day. Pure (clock passed in). */
export function familyLine(p: FamilyProduct | undefined, now: Date): FamilyLine {
  if (!p) return { state: 'checking', text: 'Checking its data date', detail: '' };
  if (!p.reached) return { state: 'not-reached', text: 'Not reached just now', detail: 'The site did not answer the hub. Open it to check.' };
  if (!p.datasets.length) return { state: 'unavailable', text: 'Data date not published', detail: '' };
  const judged: DataStatus[] = reconcile(p.datasets.map((d, i) => ({ id: `${p.id}-${i}`, label: d.label, source: p.id, asOf: d.asOf, refreshedAt: null, cadence: d.cadence })), expectedSession(now));
  const worst = judged.reduce((a, b) => (RANK[b.state] > RANK[a.state] ? b : a));
  const detail = judged.map((d) => `${d.label}: ${d.asOf ? short(d.asOf) : 'no date'}`).join(' · ');
  const lag = plural(worst.lagSessions, worst.unit);
  const text = worst.state === 'current' ? `Current to ${short(worst.asOf as string)}`
    : worst.state === 'delayed' ? `${worst.label}: ${lag} behind`
    : worst.state === 'stale' ? `${worst.label}: stale, ${lag} behind`
    : `${worst.label}: ${describe(worst)}`;
  return { state: worst.state, text, detail };
}
