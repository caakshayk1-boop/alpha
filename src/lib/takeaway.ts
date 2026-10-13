/** The one-sentence read at the top of Today, and the facts behind it. Every word comes from a figure Alpha already holds
 *  (the Barometer's own band, the Nifty's distance from its high, India VIX, the share of stocks above their 200-day average).
 *  Nothing here predicts, recommends or rates: it says what the data says, in plain words, with its numbers beside it. */
import { dateLabel, num } from './format.ts';

export interface TakeawayInput {
  score: number | null;
  /** The Barometer's own band word: Strong, Firm, Mixed, Weak or Poor. */
  band: string | null;
  /** The Barometer's own second reading ("Slightly cheaper"), shown as its label, never as this page's advice. */
  stage: string | null;
  nifty: number | null;
  drawdownPct: number | null;
  vix: number | null;
  asOf: string | null;
  above200: number | null;
  with200: number | null;
  /** The reading before today's, so a change can be stated. */
  previous: { score: number; date: string } | null;
}

export type FactTone = 'up' | 'down' | 'neutral';
export interface Fact { id: string; label: string; value: string; note: string; tone: FactTone }
export interface Takeaway { headline: string; sub: string; facts: Fact[]; available: boolean }

/** The same words and cut-offs as `vix_word` in the Barometer's source (trading-dashboard/barometer.py). */
export const vixWord = (v: number): string => (v < 12 ? 'very calm' : v < 16 ? 'normal' : v < 20 ? 'unsettled' : v < 26 ? 'jumpy' : 'stressed');

const bandTone = (band: string): FactTone => (band === 'Strong' || band === 'Firm' ? 'up' : band === 'Weak' || band === 'Poor' ? 'down' : 'neutral');
const fin = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v);

export function takeaway(i: TakeawayInput): Takeaway {
  if (!fin(i.score) || !i.band) {
    return { headline: 'The market read is not available right now.', sub: 'The latest readings could not be loaded. Nothing below is estimated in their place.', facts: [], available: false };
  }
  const dd = fin(i.drawdownPct) ? i.drawdownPct : null;
  const headline = `A ${i.band.toLowerCase()} market${dd === null ? '' : dd >= 1 ? `, ${num(dd, 1)}% below its high` : ', close to its high'}.`;

  const change = i.previous ? ` (${i.score > i.previous.score ? 'up from' : i.score < i.previous.score ? 'down from' : 'unchanged from'} ${i.previous.score} on ${dateLabel(i.previous.date)})` : '';
  const parts = [`Barometer ${num(i.score, 0)} of 100${change}.`];
  if (fin(i.vix)) parts.push(`India VIX ${num(i.vix, 1)}, ${vixWord(i.vix)}.`);
  const breadth = fin(i.above200) && fin(i.with200) && i.with200 > 0 ? Math.round((i.above200 / i.with200) * 100) : null;
  if (breadth !== null) parts.push(`${breadth}% of stocks sit above their 200-day average.`);

  const facts: Fact[] = [
    { id: 'barometer', label: 'Market barometer', value: `${num(i.score, 0)} / 100`, note: `${i.band}${i.stage ? ` · ${i.stage}` : ''}`, tone: bandTone(i.band) },
  ];
  if (fin(i.nifty)) facts.push({ id: 'nifty', label: 'Nifty 50', value: num(i.nifty, 0), note: dd === null ? 'distance from high not available' : dd >= 1 ? `${num(dd, 1)}% below its high` : 'close to its high', tone: 'neutral' });
  if (breadth !== null) facts.push({ id: 'breadth', label: 'Stocks above 200-day', value: `${breadth}%`, note: `${num(i.above200 as number)} of ${num(i.with200 as number)} with history`, tone: 'neutral' });
  if (fin(i.vix)) facts.push({ id: 'vix', label: 'India VIX', value: num(i.vix, 1), note: vixWord(i.vix), tone: 'neutral' });
  return { headline, sub: parts.join(' '), facts, available: true };
}
