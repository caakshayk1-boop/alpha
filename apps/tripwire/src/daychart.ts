/** Geometry for one session's price path. Pure: no React, no clock, no DOM.
 *
 *  The fault this replaces: the old five-minute sparkline put the person's ENTRY price into its vertical scale, so a position bought at ₹61 and trading at ₹66.7 drew today's 40-paisa move as a flat
 *  line squashed against the top. Here the scale is today's own range plus the previous close and nothing else. Entry, stop and targets that fall outside it are drawn as markers on the edge
 *  of the chart (see `where`), never allowed to stretch the axis.
 *
 *  The horizontal axis is the whole NSE session (09:15 to 15:30 IST) for Indian names, so a half-finished day is visibly half a day; markets that trade round the clock use the data's own extent. */
export interface DayIn { t: number[]; c: number[]; prev: number; /** an Indian cash-market name: the axis is the 09:15 to 15:30 session. false: the data's own extent. */ nse?: boolean }
export interface DayPt { t: number; c: number; x: number; y: number }
export interface Pad { l: number; r: number; t: number; b: number }
export interface DayGeo {
  w: number; h: number; pad: Pad; lo: number; hi: number; start: number; end: number;
  x: (t: number) => number; y: (v: number) => number;
  pts: DayPt[]; line: string; baseY: number; open: DayPt; high: DayPt; low: DayPt; last: DayPt;
  /** how much of the session the last point has covered, 0 to 1 (1 for a round-the-clock market) */
  elapsed: number;
  /** is a level inside the drawn range, or off the edge of it */
  where: (v: number) => 'in' | 'above' | 'below';
  /** the point nearest to a horizontal position, for scrubbing */
  nearest: (px: number) => number;
}
const SESSION_OPEN_IST = '09:15:00+05:30', SESSION_CLOSE_IST = '15:30:00+05:30';
/** The epoch-second bounds of the NSE session on the Indian calendar day of `t`. */
export function sessionBounds(t: number): { start: number; end: number } {
  const day = new Date((t + 19800) * 1000).toISOString().slice(0, 10);
  return { start: Date.parse(`${day}T${SESSION_OPEN_IST}`) / 1000, end: Date.parse(`${day}T${SESSION_CLOSE_IST}`) / 1000 };
}
/** The smallest vertical range worth drawing, as a share of the previous close: below it a quiet day would be blown up into noise. */
export const MIN_SPAN = 0.004;
export function dayGeometry(d: DayIn, w: number, h: number, pad: Pad = { l: 6, r: 6, t: 12, b: 16 }): DayGeo | null {
  const raw = d.t.map((t, i) => ({ t, c: d.c[i] })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.c) && p.c > 0).sort((a, b) => a.t - b.t);
  if (raw.length < 2 || !(d.prev > 0)) return null;
  let { start, end } = d.nse === false ? { start: raw[0].t, end: raw[raw.length - 1].t } : sessionBounds(raw[0].t);
  start = Math.min(start, raw[0].t); end = Math.max(end, raw[raw.length - 1].t); if (end <= start) end = start + 1;
  let lo = Math.min(d.prev, ...raw.map((p) => p.c)), hi = Math.max(d.prev, ...raw.map((p) => p.c));
  const minSpan = d.prev * MIN_SPAN; if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  const room = (hi - lo) * 0.12; lo -= room; hi += room;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (t: number) => pad.l + ((t - start) / (end - start)) * iw; const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * ih;
  const pts: DayPt[] = raw.map((p) => ({ t: p.t, c: p.c, x: x(p.t), y: y(p.c) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  let high = pts[0], low = pts[0]; for (const p of pts) { if (p.c > high.c) high = p; if (p.c < low.c) low = p; }
  const last = pts[pts.length - 1];
  return { w, h, pad, lo, hi, start, end, x, y, pts, line, baseY: y(d.prev), open: pts[0], high, low, last, elapsed: Math.min(1, Math.max(0, (last.t - start) / (end - start))),
    where: (v) => (v > hi ? 'above' : v < lo ? 'below' : 'in'),
    nearest: (px) => { let best = 0, bd = Infinity; pts.forEach((p, i) => { const dd = Math.abs(p.x - px); if (dd < bd) { bd = dd; best = i; } }); return best; } };
}
/** "09:41" for an epoch second, on the Indian clock. */
export const hhmm = (t: number): string => { const d = new Date((t + 19800) * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
