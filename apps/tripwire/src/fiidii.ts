/** FII/FPI and DII daily trading activity as NSE publishes it (provisional figures, ₹ crore). Pure: no React, no clock, no network.
 *  Used by the nightly script that fetches and stores it (tools/fiidii.mjs) and by the Markets card that shows it, so both read one definition.
 *  Nothing here is estimated: a figure that does not parse, or whose net does not equal buy minus sell, is refused whole and the last good file stays. */
export interface FlowSide { buy: number; sell: number; net: number }
export interface FlowDay { date: string; fii: FlowSide; dii: FlowSide }
export interface FlowFile { schema: 'tripwire-fiidii/1'; updated: string; source: string; rows: FlowDay[] }
export const FLOW_SCHEMA = 'tripwire-fiidii/1';
export const FLOW_KEEP = 60;
/** The card is hidden once the newest day is this many sessions old: a flow figure that old is history, not a reading. */
export const FLOW_MAX_BEHIND = 3;

const MONTH: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** "03-Nov-2026" (NSE's form) to "2026-11-03"; null when it is not a real date. */
export function isoOfNse(d: unknown): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(d ?? '').trim()); if (!m) return null;
  const mo = MONTH[m[2].toLowerCase()], day = Number(m[1]), y = Number(m[3]); if (!mo || day < 1 || day > 31) return null;
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const t = new Date(`${iso}T00:00:00Z`);
  return t.getUTCFullYear() === y && t.getUTCMonth() + 1 === mo && t.getUTCDate() === day ? iso : null;
}
const num = (v: unknown): number | null => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null; };
function side(r: Record<string, unknown>): FlowSide | null {
  const buy = num(r.buyValue), sell = num(r.sellValue), net = num(r.netValue); if (buy == null || sell == null || net == null || buy < 0 || sell < 0) return null;
  if (Math.abs(net - (buy - sell)) > Math.max(1, 0.005 * Math.max(buy, sell))) return null;   // the net must be buy minus sell, to rounding
  return { buy, sell, net };
}
/** NSE's fiidiiTradeReact answer: one record for FII/FPI and one for DII, same date. null for anything else. */
export function parseNse(raw: unknown): FlowDay | null {
  if (!Array.isArray(raw)) return null;
  const rec = (re: RegExp) => raw.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && re.test(String((r as Record<string, unknown>).category ?? '')));
  const f = rec(/^FII/i), d = rec(/^DII/i); if (f.length !== 1 || d.length !== 1) return null;
  const date = isoOfNse(f[0].date); if (!date || date !== isoOfNse(d[0].date)) return null;
  const fii = side(f[0]), dii = side(d[0]); return fii && dii ? { date, fii, dii } : null;
}
export function validFile(v: unknown): v is FlowFile {
  const f = v as FlowFile; return !!f && f.schema === FLOW_SCHEMA && Array.isArray(f.rows) && f.rows.every((r) => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && [r.fii, r.dii].every((s) => s && [s.buy, s.sell, s.net].every(Number.isFinite)));
}
/** Add one day to the stored history: a day is stored once (a later fetch of the same date replaces it), oldest first, at most FLOW_KEEP days. */
export function mergeFlows(old: FlowFile | null, day: FlowDay, now: string, source = 'NSE fiidiiTradeReact (provisional)'): FlowFile {
  const kept = (old && validFile(old) ? old.rows : []).filter((r) => r.date !== day.date);
  return { schema: FLOW_SCHEMA, updated: now, source, rows: [...kept, day].sort((a, b) => a.date.localeCompare(b.date)).slice(-FLOW_KEEP) };
}

const cr = (v: number) => `₹${Math.round(Math.abs(v)).toLocaleString('en-IN')} cr`;
export const crSigned = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${cr(v)}`;
export interface FlowReading { line: string; window: string | null; fii: number; dii: number; date: string }
/** One plain sentence about the newest day, and a window total once there are at least three sessions stored. Describes what was reported; never a forecast. */
export function readFlows(rows: readonly FlowDay[]): FlowReading | null {
  const last = rows[rows.length - 1]; if (!last) return null; const f = last.fii.net, d = last.dii.net; let line: string;
  if (Math.abs(f) < 1 || Math.abs(d) < 1) line = `FIIs were ${Math.abs(f) < 1 ? 'flat' : f > 0 ? `net buyers (${cr(f)})` : `net sellers (${cr(f)})`} and DIIs were ${Math.abs(d) < 1 ? 'flat' : d > 0 ? `net buyers (${cr(d)})` : `net sellers (${cr(d)})`}.`;
  else if (f < 0 && d > 0) line = d >= -f ? `DIIs bought ${cr(d)}, more than the ${cr(f)} FIIs sold.` : `DIIs bought ${cr(d)}, absorbing ${Math.round((d / -f) * 100)}% of the ${cr(f)} FIIs sold.`;
  else if (f > 0 && d < 0) line = `FIIs bought ${cr(f)} while DIIs sold ${cr(d)}.`;
  else if (f > 0) line = `Both were net buyers: FIIs ${cr(f)}, DIIs ${cr(d)}.`;
  else line = `Both were net sellers: FIIs ${cr(f)}, DIIs ${cr(d)}.`;
  const w = rows.slice(-5); const window = w.length >= 3 ? `Last ${w.length} sessions: FIIs ${crSigned(w.reduce((a, r) => a + r.fii.net, 0))}, DIIs ${crSigned(w.reduce((a, r) => a + r.dii.net, 0))}.` : null;
  return { line, window, fii: f, dii: d, date: last.date };
}
