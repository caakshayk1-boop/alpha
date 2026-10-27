/** What the whole liquid screen says about the market's state at the last close: how many names sit above their long averages, near a high, stretched or washed out.
 *  Pure. Every share is of the names that HAVE the figure (a name with no 200-day average is not counted as below it), and the denominator is returned so the page can say it. */
import { trendOf, type Row } from './screen.ts';

export interface Share { n: number; of: number; pct: number | null }
export interface BreadthStats { liquid: number; above50: Share; above200: Share; nearHigh: Share; stretched: Share; washed: Share }
const share = (n: number, of: number): Share => ({ n, of, pct: of ? (n / of) * 100 : null });
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function breadthStats(rows: readonly Row[]): BreadthStats {
  const L = rows.filter((r) => r.liquid);
  const c = (has: (r: Row) => boolean, yes: (r: Row) => boolean) => { const h = L.filter(has); return share(h.filter(yes).length, h.length); };
  return {
    liquid: L.length,
    above50: c((r) => num(r.price) && num(r.sma50), (r) => r.price! > r.sma50!),
    above200: c((r) => num(r.price) && num(r.sma200), (r) => r.price! > r.sma200!),
    nearHigh: c((r) => num(r.from_high), (r) => r.from_high! >= -5),
    stretched: c((r) => num(r.rsi), (r) => r.rsi! >= 70),
    washed: c((r) => num(r.rsi), (r) => r.rsi! <= 30),
  };
}
/** A one-word state from the share of names in an uptrend and in a downtrend, by a rule the page prints. It describes today; it forecasts nothing. */
export function breadthWord(up: number, down: number, n: number): { word: string; rule: string } {
  const rule = 'Broad strength: half or more in an uptrend and at least twice as many as in a downtrend. Broad weakness: 40% or more in a downtrend and more than in an uptrend. Otherwise mixed.';
  if (!n) return { word: 'No read', rule };
  const u = (up / n) * 100, d = (down / n) * 100;
  return { word: u >= 50 && u >= 2 * d ? 'Broad strength' : d >= 40 && d > u ? 'Broad weakness' : 'Mixed', rule };
}
export interface Shortcut { id: string; title: string; line: string; n: number; href: string }
/** Three questions a reader asks of the map, each as a Discover link with the number of names that answer it today. Screens, not recommendations. */
export function shortcuts(rows: readonly Row[]): Shortcut[] {
  const L = rows.filter((r) => r.liquid);
  const t = (r: Row) => trendOf(r).trend;
  const a = L.filter((r) => t(r) === 'up' && num(r.from_high) && r.from_high! >= -5).length;
  const b = L.filter((r) => t(r) === 'up' && num(r.rsi) && r.rsi! >= 35 && r.rsi! <= 50).length;
  const c = L.filter((r) => t(r) === 'down' && num(r.rsi) && r.rsi! <= 30).length;
  return [
    { id: 'leaders', title: 'In an uptrend, within 5% of the high', line: 'the strongest names, already extended', n: a, href: '#/discover?trend=up&momentum=near-high' },
    { id: 'pullback', title: 'In an uptrend, RSI 35 to 50', line: 'a rest inside a rising trend', n: b, href: '#/discover?trend=up&rsi=35-50' },
    { id: 'washed', title: 'In a downtrend, RSI 30 or less', line: 'sold hard and still falling', n: c, href: '#/discover?trend=down&rsi=0-30' },
  ];
}
