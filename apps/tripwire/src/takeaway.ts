/** Today's and Markets' one-line market takeaway. Pure and deterministic: it is built ONLY from figures the page also shows (the Nifty's move, the share of liquid names in an uptrend and in a downtrend,
 *  the India VIX move), by fixed rules, so a test can drive every branch. It states what is measured and where two measures disagree. It gives no cause, no forecast and no advice, and a figure that
 *  is missing is left out of the sentence, never replaced by a guess. (`brief.ts` FORBIDDEN is the list of words it must never contain; a test holds this file to it.) */
import { breadthWord } from './breadthstats.ts';

export interface TakeawayIn {
  niftyCh: number | null; vixCh: number | null;
  /** share of counted liquid names in an uptrend / downtrend, 0 to 100, and how many names that is a share of */
  upPct: number | null; downPct: number | null; nTrend: number;
  /** true when the Nifty's change is a live print; false when it is against the previous close of a finished session */
  live: boolean;
  /** sessions the screen's data trails the last finished one by (0 or null: current) */
  behind: number | null;
}
export interface Takeaway {
  /** the sentence, e.g. "Nifty +0.9% at the last close. Mixed: 38% of 812 liquid names are in an uptrend and 22% in a downtrend." */
  text: string;
  /** which parts were measured, so a caller can show what the sentence rests on */
  parts: { index: boolean; breadth: boolean; vix: boolean };
  /** the Nifty's move and the breadth point opposite ways by the printed thresholds */
  disagree: boolean;
  /** the breadth word (Broad strength / Mixed / Broad weakness) or null when there is no breadth */
  word: string | null;
}
/** The Nifty must have moved this far (percent, either way) before an index move and a breadth read can be said to disagree. A flat index agrees with anything. */
export const DISAGREE_MOVE_PCT = 0.5;
/** The VIX is mentioned only when it moved at least this much (percent): a quiet VIX is not news. */
export const VIX_MENTION_PCT = 5;
const sg = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;

export function marketTakeaway(i: TakeawayIn): Takeaway | null {
  const idx = i.niftyCh != null && Number.isFinite(i.niftyCh);
  const br = i.upPct != null && i.downPct != null && i.nTrend > 0;
  const vix = i.vixCh != null && Number.isFinite(i.vixCh) && Math.abs(i.vixCh) >= VIX_MENTION_PCT;
  if (!idx && !br) return null;
  const word = br ? breadthWord(i.upPct!, i.downPct!, 100).word : null;
  const disagree = !!(idx && br && ((i.niftyCh! >= DISAGREE_MOVE_PCT && word === 'Broad weakness') || (i.niftyCh! <= -DISAGREE_MOVE_PCT && word === 'Broad strength')));
  const out: string[] = [];
  if (idx) out.push(`Nifty ${sg(i.niftyCh!)}${i.live ? '' : ' at the last close'}.`);
  if (br) out.push(`${word}: ${Math.round(i.upPct!)}% of ${i.nTrend.toLocaleString('en-IN')} liquid names are in an uptrend and ${Math.round(i.downPct!)}% in a downtrend.`);
  if (disagree) out.push(`The index and the breadth point different ways.`);
  if (vix) out.push(`India VIX ${sg(i.vixCh!)}.`);
  if (br && i.behind) out.push(`Breadth is from a screen ${i.behind === 1 ? 'one session' : `${i.behind} sessions`} behind.`);
  return { text: out.join(' '), parts: { index: idx, breadth: br, vix }, disagree, word };
}
