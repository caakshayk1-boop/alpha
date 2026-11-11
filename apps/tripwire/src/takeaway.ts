/** Today's and Markets' one-line market takeaway. Pure and deterministic: it is built ONLY from figures the page also shows (the Nifty's move, the share of liquid names in an uptrend and in a downtrend,
 *  the India VIX move), by fixed rules, so a test can drive every branch. It states the index move and whether breadth agrees with it. It gives no cause, no forecast and no advice, and a figure that
 *  is missing is left out of the sentence, never replaced by a guess. (`brief.ts` FORBIDDEN is the list of words it must never contain; a test holds this file to it.)
 *  11 Nov 2026 (revamp v2): the sentence no longer restates the breadth SHARES (the gauge beside it shows them) nor how far behind the screen is (the app banner and the header pill say that once). */
import { breadthWord } from './breadthstats.ts';

export interface TakeawayIn {
  niftyCh: number | null; vixCh: number | null;
  /** share of counted liquid names in an uptrend / downtrend, 0 to 100, and how many names that is a share of */
  upPct: number | null; downPct: number | null; nTrend: number;
  /** true when the Nifty's change is a live print; false when it is against the previous close of a finished session */
  live: boolean;
  /** sessions the screen's data trails the last finished one by. Accepted for callers that still pass it; the sentence no longer says it (the banner does). */
  behind?: number | null;
  /** add the breadth shares as a second sentence: for a page with no breadth gauge beside the sentence (Markets). Today leaves it off, because its gauge shows them. */
  shares?: boolean;
}
export interface Takeaway {
  /** the sentence, e.g. "Nifty +1.4%, but breadth is weak." */
  text: string;
  /** which parts were measured, so a caller can show what the sentence rests on */
  parts: { index: boolean; breadth: boolean; vix: boolean };
  /** the Nifty's move and the breadth point opposite ways by the printed thresholds */
  disagree: boolean;
  /** the breadth word (Broad strength / Mixed / Broad weakness) or null when there is no breadth */
  word: string | null;
}
/** The Nifty must have moved this far (percent, either way) before an index move and a breadth read can be said to agree or disagree. A flat index agrees with anything. */
export const DISAGREE_MOVE_PCT = 0.5;
/** The VIX is mentioned only when it moved at least this much (percent): a quiet VIX is not news. */
export const VIX_MENTION_PCT = 5;
const sg = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
const STATE: Record<string, string> = { 'Broad strength': 'strong', 'Broad weakness': 'weak', Mixed: 'mixed' };

export function marketTakeaway(i: TakeawayIn): Takeaway | null {
  const idx = i.niftyCh != null && Number.isFinite(i.niftyCh);
  const br = i.upPct != null && i.downPct != null && i.nTrend > 0;
  const vix = i.vixCh != null && Number.isFinite(i.vixCh) && Math.abs(i.vixCh) >= VIX_MENTION_PCT;
  if (!idx && !br) return null;
  const word = br ? breadthWord(i.upPct!, i.downPct!, 100).word : null; const st = word ? STATE[word] ?? 'mixed' : null;
  const dir = idx ? (i.niftyCh! >= DISAGREE_MOVE_PCT ? 'up' : i.niftyCh! <= -DISAGREE_MOVE_PCT ? 'down' : 'flat') : null;
  const disagree = !!(dir && st && ((dir === 'up' && st === 'weak') || (dir === 'down' && st === 'strong')));
  const agree = !!(dir && st && ((dir === 'up' && st === 'strong') || (dir === 'down' && st === 'weak')));
  let text: string;
  if (idx) {
    const ix = `Nifty ${sg(i.niftyCh!)}${i.live ? '' : ' at the last close'}`;
    text = !st ? `${ix}.` : disagree ? `${ix}, but breadth is ${st}.` : agree ? `${ix}, and breadth agrees.` : `${ix}; breadth is ${st}.`;
  } else text = `Breadth is ${st}.`;
  if (br && i.shares) text += ` ${Math.round(i.upPct!)}% of ${i.nTrend.toLocaleString('en-IN')} liquid names are in an uptrend and ${Math.round(i.downPct!)}% in a downtrend.`;
  if (vix) text += ` India VIX ${sg(i.vixCh!)}.`;
  return { text, parts: { index: idx, breadth: br, vix }, disagree, word };
}
