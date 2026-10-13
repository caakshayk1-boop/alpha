/** Backtest against live, per engine. The backtest (holdout) result is what the model showed on data it had not seen; the live record is what
 *  trades issued since launch actually did. Both are in R and net of the same round-trip cost. Until enough live trades have closed the live
 *  side is shown as progress, never as a result. The gap is descriptive only: a live average over a few dozen trades carries a wide error. */
import type { EngineSignal, EngineStats, EnginesFeed } from './types';

/** Closed live trades needed before a live average is set beside the backtest one. A judgement call, not a significance test. */
export const MIN_LIVE_CLOSED = 30;

export type ScoreState = 'none' | 'building' | 'comparable';
export interface ScoreRow {
  key: string; name: string;
  holdoutN: number | null; holdoutWinPct: number | null; holdoutExpR: number | null; tradingStatus: string;
  issued: number; pending: number; open: number; closed: number;
  liveWinPct: number | null; liveAvgR: number | null;
  state: ScoreState; progress: number; gapR: number | null;
}

const fin = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function scoreboard(feed: Pick<EnginesFeed, 'engines' | 'signals' | 'live_record'>): ScoreRow[] {
  const sigs: EngineSignal[] = feed.signals ?? [];
  return Object.values(feed.engines ?? {})
    .sort((a: EngineStats, b: EngineStats) => a.id - b.id)
    .map((e): ScoreRow => {
      const mine = sigs.filter((s) => s.engine === e.key);
      const rec = feed.live_record?.[e.key];
      // The engine's own record is the authority on closed trades; fall back to counting signals only if it is missing.
      const closed = rec ? Math.max(0, Math.floor(rec.closed)) : mine.filter((s) => s.status === 'closed').length;
      const holdout = e.trades?.holdout;
      const holdoutExpR = fin(holdout?.expectancy_r);
      const liveAvgR = rec ? fin(rec.avg_r) : null;
      const state: ScoreState = closed === 0 ? 'none' : closed < MIN_LIVE_CLOSED ? 'building' : 'comparable';
      return {
        key: e.key, name: e.name,
        holdoutN: fin(holdout?.n), holdoutWinPct: fin(holdout?.win_rate), holdoutExpR, tradingStatus: e.trading_status,
        issued: mine.length, pending: mine.filter((s) => s.status === 'pending').length, open: mine.filter((s) => s.status === 'open').length, closed,
        liveWinPct: rec ? fin(rec.win_rate) : null, liveAvgR,
        state, progress: Math.min(1, closed / MIN_LIVE_CLOSED),
        gapR: state === 'comparable' && liveAvgR !== null && holdoutExpR !== null ? liveAvgR - holdoutExpR : null,
      };
    });
}
