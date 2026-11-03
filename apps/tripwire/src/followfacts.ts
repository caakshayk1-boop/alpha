/** What is worth saying about a company you follow, from its published screen row. Pure, so every rule is unit-tested.
 *  A followed name used to show only its name and "No change recorded yet". These are the few facts that tell a person whether to open it: an approaching results date, a big move, where the price sits
 *  against its 52-week range, an extreme RSI, and the trend. At most `max`, most useful first; a figure the screen does not carry is never guessed, so a rule with no figure says nothing. */
import { trendOf, type Row } from './screen.ts';
import { dayWord } from './fmt.ts';

export interface FollowFact { id: 'results' | 'move' | 'high' | 'low' | 'rsi' | 'trend'; text: string; tone: 'up' | 'down' | '' }
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
export const RESULTS_WITHIN_DAYS = 30; export const BIG_MOVE_PCT = 3; export const FAR_BELOW_HIGH_PCT = 25; export const NEAR_LOW_PCT = 5;

export function followFacts(r: Row, today: string, max = 3): FollowFact[] {
  const out: FollowFact[] = [];
  if (r.next_earnings && /^\d{4}-\d{2}-\d{2}$/.test(r.next_earnings)) {
    const d = dayNum(r.next_earnings) - dayNum(today);
    if (d >= 0 && d <= RESULTS_WITHIN_DAYS) out.push({ id: 'results', text: d === 0 ? 'Results expected today' : d === 1 ? 'Results expected tomorrow' : `Results expected ${dayWord(r.next_earnings)} (in ${d} days)`, tone: '' });
  }
  if (num(r.r1d) && Math.abs(r.r1d) >= BIG_MOVE_PCT) out.push({ id: 'move', text: `${r.r1d > 0 ? 'Up' : 'Down'} ${Math.abs(r.r1d).toFixed(1)}% in the last session`, tone: r.r1d > 0 ? 'up' : 'down' });
  if (num(r.from_high) && r.from_high >= -1) out.push({ id: 'high', text: 'At its 52-week high', tone: 'up' });
  else if (num(r.price) && num(r.low52) && r.low52 > 0 && r.price <= r.low52 * (1 + NEAR_LOW_PCT / 100)) out.push({ id: 'low', text: 'Near its 52-week low', tone: 'down' });
  else if (num(r.from_high) && r.from_high <= -FAR_BELOW_HIGH_PCT) out.push({ id: 'high', text: `${Math.abs(r.from_high).toFixed(0)}% below its 52-week high`, tone: 'down' });
  if (num(r.rsi) && r.rsi >= 70) out.push({ id: 'rsi', text: `RSI ${r.rsi.toFixed(0)}: stretched`, tone: '' });
  else if (num(r.rsi) && r.rsi <= 30) out.push({ id: 'rsi', text: `RSI ${r.rsi.toFixed(0)}: washed out`, tone: '' });
  const t = trendOf(r).trend; if (t === 'up' || t === 'down') out.push({ id: 'trend', text: t === 'up' ? 'In an uptrend' : 'In a downtrend', tone: t });
  return out.slice(0, Math.max(0, max));
}
