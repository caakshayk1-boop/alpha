/** One feed of what changed in the paper book: positions close to their stop, targets that filled, positions that closed, and the newest night's picks. Pure and in-app only: nothing is sent to anyone.
 *  It reports facts the book already holds. Order is by how much a person might want to look: near a stop, then closes, then targets, then new picks. */
import type { BookRow } from './book.ts';
import type { HitAlert } from './alerts.ts';
import type { Ledger } from './ledger.ts';
import { positionInsight } from './positioninsight.ts';
export type FeedKind = 'near-stop' | 'closed' | 'target' | 'picks';
export interface FeedItem { id: string; kind: FeedKind; text: string; href: string; tone: 'up' | 'down' | 'info'; sym?: string }
const ENGINE_NAME: Record<string, string> = { MOM: 'Momentum', QLT: 'Quality', ST: 'Short-Term' };
const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
export function buildFeed({ hits, rows, ledger, nowSec, max = 6 }: { hits: readonly HitAlert[]; rows: readonly BookRow[]; ledger: Ledger | null; nowSec: number; max?: number }): FeedItem[] {
  const out: FeedItem[] = [];
  for (const r of rows) { const i = r.v.status === 'open' ? positionInsight(r.v, r.p) : null; if (i && i.badges.includes('Near the stop') && i.stopPct != null) out.push({ id: `ns|${r.p.id}`, kind: 'near-stop', sym: r.p.sym, tone: 'down', href: `#/c/${r.p.sym}`, text: `${r.p.sym} is ${r1(i.stopPct)}% above its stop.` }); }
  for (const r of rows) if (r.v.status === 'closed' && typeof r.v.exitT === 'number' && nowSec - r.v.exitT < 3 * 86400 && r.v.exitT <= nowSec + 3600) out.push({ id: `cl|${r.p.id}`, kind: 'closed', sym: r.p.sym, tone: (r.v.r ?? 0) >= 0 ? 'up' : 'down', href: '#/signals?v=auto', text: `${r.p.sym} closed${r.v.reason ? `: ${r.v.reason.toLowerCase()}` : ''}${typeof r.v.r === 'number' ? ` (${r.v.r >= 0 ? '+' : ''}${r1(r.v.r)}R)` : ''}.` });
  for (const a of hits) out.push({ id: `hit|${a.id}|${a.kind}`, kind: 'target', sym: a.sym, tone: 'up', href: `#/c/${a.sym}`, text: `${a.sym} filled ${a.kind} at ${a.price.toFixed(2)}.` });
  const night = ledger?.days.at(-1)?.asOf; const picks = night ? ledger!.picks.filter((p) => p.asOf === night && !ledger!.voided?.[p.id]) : [];
  if (night && picks.length) { const by = picks.reduce<Record<string, number>>((m, p) => { m[p.engine] = (m[p.engine] ?? 0) + 1; return m; }, {}); out.push({ id: `pk|${night}`, kind: 'picks', tone: 'info', href: '#/signals', text: `${picks.length} new pick${picks.length === 1 ? '' : 's'} recorded for ${night}: ${Object.entries(by).map(([e, n]) => `${n} ${ENGINE_NAME[e] ?? e}`).join(', ')}.` }); }
  const order: Record<FeedKind, number> = { 'near-stop': 0, closed: 1, target: 2, picks: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.text.localeCompare(b.text)).slice(0, max);
}
