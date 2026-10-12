import type { EngineStats } from '@/lib/types';

/** One tone map for every engine verdict on the site. */
export const VERDICT_TONE: Record<string, string> = {
  'EDGE SHOWN': 'up', 'LEANING POSITIVE': 'acc', 'NO EDGE SHOWN': 'warn', 'NO RANKING SKILL': 'down', 'WORSE THAN RANDOM': 'down',
  'NOT ENOUGH TRADES': '', 'NOT ENOUGH DATA': '', 'PROFITABLE AFTER COSTS': 'up', 'POSITIVE, NOT SIGNIFICANT': 'acc',
  'BREAK-EVEN AFTER COSTS': 'warn', 'LOSES AFTER COSTS': 'down',
};

/** An engine's two claims, always together: how well it ranks stocks, and what trading its plan returned after costs. They differ, so no surface may show one alone. */
export function EngineVerdict({ e, compact = false }: { e: Pick<EngineStats, 'ranking_status' | 'ranking_why' | 'trading_status' | 'trading_why'>; compact?: boolean }) {
  return (
    <span className="verdict" style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className={`tag ${VERDICT_TONE[e.ranking_status] ?? ''}`} title={e.ranking_why}>{compact ? '' : 'Ranking · '}{e.ranking_status}</span>
      <span className={`tag ${VERDICT_TONE[e.trading_status] ?? ''}`} title={e.trading_why}>{compact ? '' : 'Trading · '}{e.trading_status}</span>
    </span>
  );
}
