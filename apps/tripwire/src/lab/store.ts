/** What the Lab remembers on this device: the rule being edited, and the number of DIFFERENT rules ever tried. That number is what raises the bar in
 *  verdict.ts; there is deliberately no way to reset it from the page (a reset would be a way to launder a search). Clearing site data does clear it, and
 *  the page says the count is local. Kept outside the app's backup file: it is a research log, not a decision. */
import type { Strategy } from './engine.ts';
import { strategyKey } from './engine.ts';

const KEY = 'tripwire:lab:v1';
export interface LabState { draft: Strategy | null; tried: string[] }
export const DEFAULT_STRATEGY: Strategy = { conds: [{ m: 'r6m', op: 'gte', v: 20 }, { m: 'from_high', op: 'gte', v: -10 }], rankBy: 'r6m', rankDir: 'desc', positions: 10, horizon: 20, stopPct: 8 };

export function readLab(st: Pick<Storage, 'getItem'> | null): LabState {
  try { const raw = st?.getItem(KEY); if (!raw) return { draft: null, tried: [] }; const j = JSON.parse(raw);
    return { draft: j?.draft && Array.isArray(j.draft.conds) ? (j.draft as Strategy) : null, tried: Array.isArray(j?.tried) ? j.tried.filter((x: unknown) => typeof x === 'string').slice(-500) : [] };
  } catch { return { draft: null, tried: [] }; }
}
export function writeLab(st: Pick<Storage, 'setItem'> | null, s: LabState) { try { st?.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: the count then lives for this visit only */ } }
/** Record a run. The count rises only for a rule not seen before. */
export function recordRun(s: LabState, strat: Strategy): { state: LabState; tried: number } {
  const k = strategyKey(strat); const tried = s.tried.includes(k) ? s.tried : [...s.tried, k];
  return { state: { draft: strat, tried }, tried: tried.length };
}

/** Starting points, each stated in the figures it is made of and what it is meant to catch. None is recommended, none has a track record here. */
export const PRESETS: { id: string; name: string; line: string; s: Strategy }[] = [
  { id: 'leaders', name: 'Leaders near highs', line: 'Up 20% in six months and within 10% of the 52-week high; strongest first.', s: DEFAULT_STRATEGY },
  { id: 'pullback', name: 'Pullback in an uptrend', line: 'Above the 200-day, up 20% over a year, RSI at 40 or less; most oversold first.', s: { conds: [{ m: 'dist200', op: 'gte', v: 0 }, { m: 'r1y', op: 'gte', v: 20 }, { m: 'rsi', op: 'lte', v: 40 }], rankBy: 'rsi', rankDir: 'asc', positions: 10, horizon: 20, stopPct: 8 } },
  { id: 'oversold', name: 'Oversold bounce', line: 'RSI at 30 or less and down 15% in a month; most oversold first.', s: { conds: [{ m: 'rsi', op: 'lte', v: 30 }, { m: 'r1m', op: 'lte', v: -15 }], rankBy: 'rsi', rankDir: 'asc', positions: 10, horizon: 10, stopPct: 8 } },
  { id: 'calm', name: 'Calm risers', line: 'Up 15% over six months with yearly volatility under 30%; calmest first.', s: { conds: [{ m: 'r6m', op: 'gte', v: 15 }, { m: 'sd1y', op: 'lte', v: 30 }], rankBy: 'sd1y', rankDir: 'asc', positions: 10, horizon: 30, stopPct: 8 } },
];
