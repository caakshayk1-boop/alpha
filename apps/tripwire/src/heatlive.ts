/** The live view of the sector heat map (18 Nov 2026). The published screen is a close-to-close snapshot, so during the session the map still showed yesterday. The live view re-reads
 *  the day's change from live quotes for the MOST TRADED names of each sector, and says so: it is a sample, never "the whole market".
 *
 *  Rules, in order of what could mislead:
 *   - The sample is the top `per` liquid names of each sector by traded value (turnover in crore on the last session). Its share of all liquid traded value is computed and printed.
 *   - A name counts only with a live print (isLiveQuote) and a finite price and previous close. No quote, a stale quote or a bad number leaves the name out: it is never read as zero.
 *   - The change is price against the previous close, in percent, exactly the 1-day figure the close view uses, so the two views are comparable.
 *   - The result is a list of rows with `r1d` replaced, so the one heat model (sectorheat.ts) draws it: no second calculation of a sector exists. */
import type { Row } from './screen.ts';
import type { Quote } from './data.ts';
import { isLiveQuote } from './stamp.ts';

export const LIVE_PER_SECTOR = 6;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const eligible = (r: Row): r is Row & { sector: string; turnover_cr: number } => !!r.liquid && !r.stale && !!r.sector && num(r.turnover_cr) && r.turnover_cr > 0;

/** The names to ask live prices for: the top `per` by traded value in every sector. */
export function liveSample(rows: readonly Row[], per = LIVE_PER_SECTOR): string[] {
  const by = new Map<string, (Row & { sector: string; turnover_cr: number })[]>();
  for (const r of rows) if (eligible(r)) (by.get(r.sector) ?? by.set(r.sector, []).get(r.sector)!).push(r);
  return [...by.values()].flatMap((g) => g.sort((a, b) => b.turnover_cr - a.turnover_cr || a.sym.localeCompare(b.sym)).slice(0, per).map((r) => r.sym));
}

export interface LiveHeat {
  /** rows that have a live change, with r1d set to it; every other row is absent */
  rows: Row[];
  asked: number; measured: number;
  /** share (0 to 1) of all liquid traded value that the measured names carry */
  share: number;
  /** epoch seconds of the newest print used, or null */
  obs: number | null;
  /** 'live': the session is on and every print is recent. 'today': the session has ended and every print is from today (Indian date), so these are the day's last prints. */
  basis: 'live' | 'today';
}
const istDate = (ms: number): string => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
/** `shut` is true when the session is not on. Then no print is "live", but a print dated TODAY (Indian date) is the day's last print, and is used, said to be so. A print from an earlier
 *  day (a weekend, a holiday, the morning before the open) is never used: the published close stays. */
export function liveHeat(rows: readonly Row[], sample: readonly string[], quotes: Record<string, Quote | null | undefined> | null, nowMs = Date.now(), shut = false): LiveHeat {
  const want = new Set(sample); const out: Row[] = []; let obs: number | null = null; let got = 0; let total = 0;
  for (const r of rows) {
    if (!eligible(r)) continue; total += r.turnover_cr;
    if (!want.has(r.sym)) continue;
    const q = quotes?.[r.sym]; if (!q || !num(q.px) || !num(q.prev) || q.px <= 0 || q.prev <= 0 || !(shut ? num(q.pt) && istDate(q.pt * 1000) === istDate(nowMs) : isLiveQuote(q, nowMs))) continue;
    out.push({ ...r, r1d: (q.px / q.prev - 1) * 100 }); got += r.turnover_cr; if (num(q.pt) && (obs == null || q.pt > obs)) obs = q.pt;
  }
  return { rows: out, asked: sample.length, measured: out.length, share: total > 0 ? got / total : 0, obs, basis: shut ? 'today' : 'live' };
}
/** The live view is offered only when most of the sample answered (a few late prints should not redraw the map from a handful of names). */
export const liveUsable = (h: LiveHeat): boolean => h.asked > 0 && h.measured >= Math.max(12, Math.ceil(h.asked * 0.6));
/** "13:46 IST" from epoch seconds. */
export const istTime = (sec: number): string => { const d = new Date(sec * 1000 + 330 * 60000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} IST`; };
