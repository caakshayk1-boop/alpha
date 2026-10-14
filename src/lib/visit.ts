/** "Since your last visit": a snapshot of a few headline figures kept in this browser, and a plain comparison against the next one.
 *  With no earlier snapshot nothing is claimed; on the same data date nothing has changed by definition. */
/** `up`/`down` are one-WEEK counts (pulse.breadth, built from r1w in stock_screen.py), so they are labelled as such. */
export interface Snapshot { asOf: string; score: number | null; up: number | null; down: number | null; signals: string[] }
export type VisitDiff = { kind: 'start' } | { kind: 'same'; asOf: string } | { kind: 'changes'; since: string; lines: string[] };

export function diffSnapshots(prev: Snapshot | null, cur: Snapshot): VisitDiff {
  if (!prev) return { kind: 'start' };
  if (prev.asOf === cur.asOf) return { kind: 'same', asOf: cur.asOf };
  const lines: string[] = [];
  if (prev.score !== null && cur.score !== null && Math.round(prev.score) !== Math.round(cur.score)) lines.push(`Market barometer ${Math.round(prev.score)} → ${Math.round(cur.score)}`);
  if (prev.up !== null && prev.down !== null && cur.up !== null && cur.down !== null) lines.push(`Stocks up / down over the past week: ${prev.up} / ${prev.down} → ${cur.up} / ${cur.down}`);
  const added = cur.signals.filter((s) => !prev.signals.includes(s)), dropped = prev.signals.filter((s) => !cur.signals.includes(s));
  if (added.length) lines.push(`New engine signals: ${added.slice(0, 8).join(', ')}${added.length > 8 ? ` and ${added.length - 8} more` : ''}`);
  if (dropped.length) lines.push(`No longer active: ${dropped.slice(0, 8).join(', ')}${dropped.length > 8 ? ` and ${dropped.length - 8} more` : ''}`);
  return { kind: 'changes', since: prev.asOf, lines };
}

export function parseSnapshot(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    if (typeof o.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.asOf)) return null;
    return { asOf: o.asOf, score: n(o.score), up: n(o.up), down: n(o.down), signals: Array.isArray(o.signals) ? o.signals.filter((x): x is string => typeof x === 'string').slice(0, 200) : [] };
  } catch { return null; }
}
