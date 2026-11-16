/** Regime Weather (Tripwire 4.0, F5): one plain-English line describing the market's condition at the last close, from the SAME screen rows Research shows for that date.
 *  Descriptive only: weather describes conditions; it never advises a trade and changes no rule. Pure.
 *  Every share is of the liquid names that HAVE the figure, and each figure names its denominator. A figure the screen cannot give (the 60-day high, the previous session's breadth:
 *  the screen file holds one day) is left out, never estimated. */
import { trendOf, type Row } from './screen.ts';
import { breadthStats, breadthWord } from './breadthstats.ts';
import { dayWord } from './fmt.ts';

export interface Weather {
  asOf: string | null; /** sessions the data trails the last finished one; null = unknown */ behind: number | null; stale: boolean;
  word: string; rule: string; liquid: number;
  above200: { n: number; of: number; pct: number | null }; nearHigh: { n: number; of: number; pct: number | null };
  /** median distance of liquid names from their 52-week high, in percent (0 or below); null without figures */ medianFromHigh: number | null;
  /** share of liquid names that rose on the day (r1d > 0), of those with a 1-day return: what the day did, not a change in breadth */ advancing: { n: number; of: number; pct: number | null };
  line: string;
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const p0 = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`);
const median = (a: number[]): number | null => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function weatherOf(rows: readonly Row[], asOf: string | null, behind: number | null): Weather {
  const L = rows.filter((r) => r.liquid); const st = breadthStats(rows);
  let up = 0, down = 0, n = 0; for (const r of L) { const t = trendOf(r).trend; if (t) { n++; if (t === 'up') up++; else if (t === 'down') down++; } }
  const bw = breadthWord(up, down, n);
  const day = L.filter((r) => num(r.r1d)); const adv = { n: day.filter((r) => r.r1d! > 0).length, of: day.length, pct: day.length ? (day.filter((r) => r.r1d! > 0).length / day.length) * 100 : null };
  const mfh = median(L.filter((r) => num(r.from_high)).map((r) => r.from_high!));
  const stale = behind == null || behind > 0;
  const parts: string[] = [];
  if (st.above200.of) parts.push(`${p0(st.above200.pct)} of ${st.above200.of} liquid names are above their 200-day average`);
  if (st.nearHigh.of) parts.push(`${p0(st.nearHigh.pct)} are within 5% of a 52-week high${mfh == null ? '' : `, the median name ${Math.abs(Math.round(mfh * 10) / 10)}% below its high`}`);
  if (adv.of) parts.push(`${p0(adv.pct)} rose on the day`);
  const asWord = asOf ? `As of the close of ${dayWord(asOf)}` : 'Date unknown';
  const staleWord = asOf == null ? ' · stale: no data date' : behind == null ? ' · stale: the data date cannot be checked' : behind > 0 ? ` · stale: the data is ${behind} session${behind === 1 ? '' : 's'} old` : '';
  const line = n ? `${bw.word}. ${parts.join('; ')}. ${asWord}${staleWord}.` : `No read: the screen has too few figures. ${asWord}${staleWord}.`;
  return { asOf, behind, stale, word: n ? bw.word : 'No read', rule: bw.rule, liquid: st.liquid, above200: st.above200, nearHigh: st.nearHigh, medianFromHigh: mfh == null ? null : Math.round(mfh * 10) / 10, advancing: adv, line };
}
