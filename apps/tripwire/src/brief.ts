/** "Your market brief": one short factual paragraph built only from figures the page already holds. Deterministic and pure.
 *  It states what is measured. It gives no cause, no forecast and no advice, and a missing figure is left out, never replaced by a guess. */
import { dayWord } from './fmt.ts';

export interface BriefIn {
  niftyCh: number | null; bankCh: number | null; vixCh: number | null;
  /** share of liquid names in an uptrend / downtrend, 0 to 100, with the count they are a share of */
  upPct: number | null; downPct: number | null; nTrend: number;
  /** the screen's data day (YYYY-MM-DD), and how many NSE sessions behind the last finished one it is */
  day: string | null; behind: number | null;
  /** true when today's prints are live; false when these changes are against the previous close of a finished session */
  live: boolean;
}
const sg = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
export function briefLines(b: BriefIn): string[] {
  const out: string[] = [];
  if (b.niftyCh != null) {
    let s = `Nifty ${sg(b.niftyCh)}`;
    if (b.bankCh != null) { const lead = Math.round((b.bankCh - b.niftyCh) * 100) / 100; s += lead === 0 ? ', Bank Nifty level with it' : `, Bank Nifty ${lead > 0 ? 'ahead by' : 'behind by'} ${Math.abs(lead).toFixed(2)} pts`; }
    out.push(s + (b.live ? '' : ' at the last close') + '.');
  }
  if (b.vixCh != null) out.push(`India VIX ${sg(b.vixCh)}.`);
  if (b.upPct != null && b.downPct != null && b.nTrend > 0) out.push(`${Math.round(b.upPct)}% of liquid names are in an uptrend and ${Math.round(b.downPct)}% in a downtrend (${b.nTrend.toLocaleString('en-IN')} measured).`);
  if (b.day) out.push(`Screen data through ${dayWord(b.day)}${b.behind ? `, ${b.behind === 1 ? 'one session' : `${b.behind} sessions`} behind` : ''}.`);
  return out;
}
/** Words a brief must never contain: it does not predict, advise or explain causes. Exported so a test can hold the generator to it. */
export const FORBIDDEN = /\b(will|would|expected?|likely|outlook|forecast|bullish|bearish|rall(?:y|ies)|crash|because|due to|driven by|thanks to|buy|sell|target)\b/i;
