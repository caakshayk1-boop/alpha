import type { Ledger, LedgerPick } from './ledger.ts';
import type { SwingFeed } from './trust.ts';

/** Pure facts for the Daily Edition and the Gate page. Nothing here is invented: a figure the published files do not carry comes back as null and the screen says "not published". */

type Gate = SwingFeed['gate'];
export interface GateGap { rule: string; value: string; /** how far from passing, in the check's own unit; null when the published value string does not carry enough to say */ gap: string | null; /** the gap as a share of the threshold, only to rank checks against each other */ rel: number | null }

const num = (s: string) => Number(s.replace(/,/g, ''));

/** How far one failing check is from passing. Only two published shapes carry a threshold and a reading: "At least N% ..." with "M% above", and "... at or below N" with "VIX M". Everything else gets no gap. */
export function gapOf(rule: string, value: string): { gap: string; rel: number } | null {
  const atLeast = /at least\s+(\d+(?:\.\d+)?)\s*%/i.exec(rule), reading = /(\d+(?:\.\d+)?)\s*%/.exec(value);
  if (atLeast && reading) { const need = num(atLeast[1]), have = num(reading[1]); const d = Math.round((need - have) * 10) / 10; return d > 0 ? { gap: `${d} points short of ${need}%`, rel: d / need } : null; }
  const atMost = /at or below\s+(\d+(?:\.\d+)?)/i.exec(rule), vix = /(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (atMost && vix) { const cap = num(atMost[1]), have = num(vix[1]); const d = Math.round((have - cap) * 10) / 10; return d > 0 ? { gap: `${d} above the ${cap} limit`, rel: d / cap } : null; }
  return null;
}

/** The failing checks, nearest to passing first. Checks with no computable gap follow in published order and say so; none is guessed. */
export function failingChecks(g: Gate): GateGap[] {
  const bad = g.checks.filter((c) => !c.ok).map((c): GateGap => { const x = gapOf(c.rule, c.value); return { rule: c.rule, value: c.value, gap: x?.gap ?? null, rel: x?.rel ?? null }; });
  return [...bad.filter((b) => b.rel != null).sort((a, b) => a.rel! - b.rel!), ...bad.filter((b) => b.rel == null)];
}

/** Days the gate was off, out of the days published. "Sat out" means exactly this: the published gate said off. */
export function gateRun(h: { d: string; on: boolean }[] | undefined): { off: number; total: number; on: number; offStreak: number; first: string } | null {
  if (!h || h.length === 0) return null;
  const sorted = h.slice().sort((a, b) => a.d.localeCompare(b.d)); let streak = 0;
  for (let i = sorted.length - 1; i >= 0 && !sorted[i].on; i--) streak++;
  return { off: sorted.filter((x) => !x.on).length, on: sorted.filter((x) => x.on).length, total: sorted.length, offStreak: streak, first: sorted[0].d };
}

export interface EditionEngine { engine: string; eligible: number; passed: number; picked: number; skippedWideStop: number; /** passed the rules but not picked: passed minus picked, floored at 0 */ passedNotPicked: number }
export interface Edition {
  asOf: string; recorded: string; rules: string | null; engines: EditionEngine[]; picks: LedgerPick[];
  voided: { id: string; reason: string }[]; gate: boolean | null; prev: string | null; next: string | null; position: number; of: number;
  /** what changed against the previous recorded night: picks that are new names for their engine */
  newNames: LedgerPick[];
}

/** Ledger nights, newest first. */
export const editionDays = (l: Ledger): string[] => l.days.map((d) => d.asOf).sort((a, b) => b.localeCompare(a));

/** One night of the ledger as an edition. `day` defaults to the latest. Null when the ledger has no such night. */
export function edition(l: Ledger, day?: string, gateHistory?: { d: string; on: boolean }[]): Edition | null {
  const days = editionDays(l); const asOf = day ?? days[0]; if (!asOf) return null;
  const rec = l.days.find((d) => d.asOf === asOf); if (!rec) return null;
  const i = days.indexOf(asOf); const prev = days[i + 1] ?? null, next = i > 0 ? days[i - 1] : null;
  const picks = l.picks.filter((p) => p.asOf === asOf);
  const engines = Object.entries(rec.engines).map(([engine, e]): EditionEngine => ({ engine, eligible: e.eligible, passed: e.passed, picked: e.picked, skippedWideStop: e.skippedWideStop ?? 0, passedNotPicked: Math.max(0, e.passed - e.picked) }));
  const voided = Object.entries(l.voided ?? {}).filter(([id]) => id.startsWith(asOf + '|')).map(([id, reason]) => ({ id, reason }));
  const before = new Set(l.picks.filter((p) => prev != null && p.asOf < asOf).map((p) => `${p.engine}|${p.sym}`));
  const newNames = picks.filter((p) => !before.has(`${p.engine}|${p.sym}`));
  const g = gateHistory?.find((x) => x.d === asOf);
  return { asOf, recorded: rec.recorded, rules: rec.rules ?? null, engines, picks, voided, gate: g ? g.on : null, prev, next, position: days.length - i, of: days.length, newNames };
}
