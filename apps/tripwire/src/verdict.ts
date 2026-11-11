/** Verdict at a glance (revamp v2, 11 Nov 2026): the company page's hero row of three or four chips. Every chip is a WORD the page already derives elsewhere, read off the same rule:
 *    Trend      trendOf (screen.ts), the four-rule uptrend and its mirror
 *    Quality    the one-minute read's ROCE word (research.ts, 15% threshold); absent where ROCE is not meaningful (the financial sector)
 *    Valuation  the one-minute read's PE word (the trailing PE's percentile in its own history: 20th / 80th); absent with no positive PE
 *    Flags      the screen's flag level (eligibility.ts#riskGradeOf), with the number of flags; absent where the grade is withheld
 *  No new score, no threshold of its own, no figure that is not printed elsewhere on the page. A chip that cannot be read is left out, never shown as a default. */
import type { Company } from './data.ts';
import { companyRead } from './research.ts';
import { trendOf, TREND_WORD, type Row } from './screen.ts';

export interface VerdictChip { id: 'trend' | 'quality' | 'valuation' | 'flags'; k: string; v: string; glyph: string; tone: 'up' | 'down' | 'warn' | 'neutral'; basis: string }
const VAL_SHORT: Record<string, string> = { 'Low in its own history': 'Low vs own history', 'High in its own history': 'High vs own history', 'Mid historical range': 'Mid of own range', 'Historical comparison unavailable': 'No history held' };
export function verdictChips(c: Pick<Company, 'row' | 'years' | 'inst' | 'sym' | 'built_on'>, flagLevel: string | null, flagCount: number | null): VerdictChip[] {
  const out: VerdictChip[] = []; const r = c.row as Row;
  const tr = trendOf(r).trend;
  if (tr) out.push({ id: 'trend', k: 'Trend', v: TREND_WORD[tr], glyph: tr === 'up' ? '↑' : tr === 'down' ? '↓' : '→', tone: tr === 'up' ? 'up' : tr === 'down' ? 'down' : 'neutral', basis: 'The four-rule trend at the last close: price over its 20 and 50-day averages, the 50-day 1% over the 200-day, and a positive 3-month return (mirrored for a downtrend).' });
  const read = companyRead(c as Company);
  const q = read.find((x) => x.id === 'roce'); if (q) out.push({ id: 'quality', k: 'Quality', v: q.read, glyph: '', tone: 'neutral', basis: `${q.fact}. ${q.rule}` });
  const v = read.find((x) => x.id === 'pe'); if (v) out.push({ id: 'valuation', k: 'Valuation', v: VAL_SHORT[v.read] ?? v.read, glyph: '', tone: 'neutral', basis: `${v.fact}. ${v.rule}` });
  if (flagLevel) { const lvl = flagLevel.toUpperCase(); out.push({ id: 'flags', k: 'Screen flags', v: `${lvl[0]}${lvl.slice(1).toLowerCase()}${flagCount == null ? '' : ` · ${flagCount}`}`, glyph: '', tone: lvl === 'HIGH' ? 'warn' : 'neutral', basis: `Screen flag level ${lvl}${flagCount == null ? '' : `, ${flagCount} flag${flagCount === 1 ? '' : 's'} raised`}. It counts warnings on the latest statements and trading; it reads no trend and forecasts nothing.` }); }
  return out;
}
