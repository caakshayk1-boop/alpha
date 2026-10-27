/** The figures that matter FOR THIS ENGINE, for one pick: what made it qualify, each with its value, so two picks from two engines never read the same.
 *  Pure, from the screen row. A figure that is not measured is left out (never shown as zero), and a financial-sector name shows no ratio the eligibility rule withholds. */
import type { Row } from './screen.ts';
import { eligibilityOf, meaningful } from './eligibility.ts';
import { mom12_1, type EngineId } from './quant.ts';

export interface Fact { k: string; v: string; tone?: 'up' | 'down' | '' }
const n = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sg = (v: number, dp = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}%`;
const tone = (v: number): 'up' | 'down' | '' => (v > 0 ? 'up' : v < 0 ? 'down' : '');
export function pickFacts(engine: EngineId, r: Row | undefined | null): Fact[] {
  if (!r) return [];
  const out: Fact[] = []; const el = eligibilityOf(r);
  if (engine === 'MOM') {
    const m = mom12_1(r as Parameters<typeof mom12_1>[0]);
    if (n(m)) out.push({ k: '12-1 month', v: sg(m, 0), tone: tone(m) });
    if (n(r.from_high)) out.push({ k: 'From 52w high', v: sg(r.from_high), tone: tone(r.from_high) });
    if (n(r.rs3m)) out.push({ k: 'vs Nifty 3m', v: `${r.rs3m > 0 ? '+' : r.rs3m < 0 ? '−' : ''}${Math.abs(r.rs3m).toFixed(0)} pts`, tone: tone(r.rs3m) });
    if (n(r.rsi)) out.push({ k: 'RSI', v: r.rsi.toFixed(0) });
    if (n(r.vol_spike)) out.push({ k: 'Volume', v: `${r.vol_spike.toFixed(1)}× avg` });
  } else if (engine === 'QLT') {
    if (meaningful(el, 'roce') && n(r.roce_med)) out.push({ k: 'ROCE (median)', v: `${r.roce_med.toFixed(0)}%` });
    if (n((r as Row & { piotroski?: number | null }).piotroski)) out.push({ k: 'F-score', v: `${(r as Row & { piotroski?: number }).piotroski} of 9` });
    const mf = (r as Row & { mf?: { rank?: number; of?: number } | null }).mf; if (mf && n(mf.rank) && n(mf.of)) out.push({ k: 'Magic rank', v: `${mf.rank} of ${mf.of}` });
    if (n(r.pe) && r.pe > 0) out.push({ k: 'PE', v: r.pe.toFixed(1) });
    if (meaningful(el, 'leverage') && n(r.de)) out.push({ k: 'Debt/equity', v: r.de.toFixed(2) });
    if (n(r.rev_cagr)) out.push({ k: 'Sales 3y', v: sg(r.rev_cagr, 0), tone: tone(r.rev_cagr) });
  } else {
    if (n((r as Row & { sd1y?: number | null }).sd1y)) out.push({ k: 'Volatility', v: `${(r as Row & { sd1y?: number }).sd1y!.toFixed(0)}% a year` });
    if (n((r as Row & { r6m?: number | null }).r6m)) out.push({ k: '6 months', v: sg((r as Row & { r6m?: number }).r6m!), tone: tone((r as Row & { r6m?: number }).r6m!) });
    if (r.risk_lvl) out.push({ k: 'Risk grade', v: r.risk_lvl });
  }
  return out;
}
/** A short line for a list row: the first three facts. */
export const factLine = (f: Fact[], k = 3) => f.slice(0, k).map((x) => `${x.k} ${x.v}`).join(' · ');
