/** The daily book snapshot (Tripwire 6.0, 18 Nov 2026). The ledger keeps exits and today's mark, never yesterday's, so the running open-book R of the past cannot be rebuilt
 *  later. One small row per session, written once by the nightly job after the ledger assertions pass, starts that history. Pure: no clock, no network, no React.
 *
 *  Counted exactly as `summarizeLedger` counts: voided picks and retired engines are out. `openR` is the sum of each open position's recorded mark in R (the position's own `r`
 *  on its latest `markDay`); a position with no mark yet adds nothing and is counted in `unmarked`, never estimated. A day, once written, is never rewritten. */
import type { Ledger } from './ledger.ts';
import { RETIRED } from './ledger.ts';

export interface EngineSnap { open: number; openR: number; t1: number; closed: number; closedR: number }
export interface BookSnap { day: string; open: number; t1: number; openR: number; closed: number; closedR: number; unmarked: number; engines: Record<string, EngineSnap> }
export interface SnapFile { schema: 'tripwire-book-snapshots/1'; started: string; days: BookSnap[] }

const r2 = (v: number): number => Math.round(v * 100) / 100;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const emptySnapFile = (now: string): SnapFile => ({ schema: 'tripwire-book-snapshots/1', started: now.slice(0, 10), days: [] });

/** The book as the ledger holds it now, labelled with the newest session any open position was marked on. Null when nothing is open and nothing has closed (no day to name). */
export function snapshotOf(l: Ledger): BookSnap | null {
  const live = l.picks.filter((p) => !l.voided?.[p.id] && !RETIRED.has(p.engine));
  const rows = live.map((p) => ({ p, o: l.outcomes[p.id] })).filter((x) => !!x.o);
  const open = rows.filter((x) => x.o.status === 'open');
  const closed = rows.filter((x) => x.o.status === 'closed' && typeof x.o.r === 'number');
  const days = [...open.map((x) => x.o.markDay), ...closed.map((x) => x.o.exitDay)].filter((d): d is string => !!d && ISO.test(d)).sort();
  const day = open.map((x) => x.o.markDay).filter((d): d is string => !!d && ISO.test(d)).sort().pop() ?? days.pop();
  if (!day) return null;
  const engines: Record<string, EngineSnap> = {};
  const slot = (e: string) => (engines[e] ??= { open: 0, openR: 0, t1: 0, closed: 0, closedR: 0 });
  let unmarked = 0;
  for (const { p, o } of open) { const s = slot(p.engine); s.open++; if (o.t1Hit) s.t1++; if (typeof o.r === 'number') s.openR += o.r; else unmarked++; }
  for (const { p, o } of closed) { const s = slot(p.engine); s.closed++; s.closedR += o.r!; }
  for (const s of Object.values(engines)) { s.openR = r2(s.openR); s.closedR = r2(s.closedR); }
  const all = Object.values(engines);
  return { day, open: open.length, t1: all.reduce((a, s) => a + s.t1, 0), openR: r2(all.reduce((a, s) => a + s.openR, 0)), closed: closed.length, closedR: r2(all.reduce((a, s) => a + s.closedR, 0)), unmarked, engines: Object.fromEntries(Object.entries(engines).sort(([a], [b]) => a.localeCompare(b))) };
}

/** Append-only: a day already in the file is left exactly as it was (a later run the same night does not rewrite it). Days stay in date order. */
export function appendSnapshot(file: SnapFile | null, snap: BookSnap, now: string): { file: SnapFile; added: boolean } {
  const f = file ?? emptySnapFile(now);
  if (f.days.some((d) => d.day === snap.day)) return { file: f, added: false };
  return { file: { ...f, days: [...f.days, snap].sort((a, b) => a.day.localeCompare(b.day)) }, added: true };
}

/** The line the Record draws: closed R plus the open positions' marks, per session. Needs two sessions to be a line. */
export interface BookPoint { day: string; closedR: number; openR: number; total: number }
export const bookSeries = (f: Pick<SnapFile, 'days'> | null | undefined): BookPoint[] => (f?.days ?? []).map((d) => ({ day: d.day, closedR: d.closedR, openR: d.openR, total: r2(d.closedR + d.openR) }));
