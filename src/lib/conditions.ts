// conditions.ts — alerts on explicit data conditions (Pro §28 P3), kept in this browser. A condition is the Screen's own
// query language with an optional company in front: "TCS: rsi < 30", or "roce < 15" for every name on the watchlist.
// It is checked against the latest screen when My Desk opens. There are no price targets and no push notifications: with
// no account there is nothing to send them from, and the page says so.
import type { Row } from './types';
import { FIELDS, parseQuery, type QueryError } from './query.ts';

const FIELD_GET: Record<string, (r: Row) => number | null | undefined> = Object.fromEntries(Object.entries(FIELDS).map(([k, f]) => [k, f.get]));

export interface Condition { raw: string; sym: string | null; query: string }
export interface Checked { sym: string; met: boolean | null; why: string }

/** "TCS: rsi < 30" → { sym: 'TCS', query: 'rsi < 30' }; "roce < 15" → every watchlist name. */
export function parseCondition(raw: string): Condition | QueryError {
  const m = /^\s*([A-Za-z0-9&-]{1,20})\s*:\s*(.+)$/.exec(raw);
  const sym = m ? m[1].toUpperCase() : null;
  const query = (m ? m[2] : raw).trim();
  const q = parseQuery(query);
  if ('message' in q) return { message: q.message, at: q.at + (m ? raw.indexOf(m[2]) : 0) };
  return { raw: raw.trim(), sym, query };
}

/** Each name the condition covers, met or not, from the latest screen. A name with no value for a field is "not
 *  measurable", never counted as not met. */
export function check(c: Condition, rows: Row[], watch: string[]): Checked[] {
  const q = parseQuery(c.query);
  if ('message' in q) return [];
  const names = c.sym ? [c.sym] : watch;
  const by = new Map(rows.map((r) => [r.sym, r]));
  return names.map((sym) => {
    const r = by.get(sym);
    if (!r) return { sym, met: null, why: 'not in the screen' };
    const missing = q.fields.filter((f) => { const x = (FIELD_GET[f] ?? (() => null))(r); return typeof x !== 'number' || !Number.isFinite(x); });
    if (missing.length) return { sym, met: null, why: `no value for ${missing.join(', ')}` };
    return { sym, met: q.combined.test(r), why: '' };
  });
}

