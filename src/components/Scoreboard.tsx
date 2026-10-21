'use client';

import { useMemo } from 'react';
import { Bar, Rv } from '@/components/ui';
import { dash, dateLabel, num } from '@/lib/format';
import { MIN_LIVE_CLOSED, scoreboard } from '@/lib/scoreboard';
import type { EnginesFeed } from '@/lib/types';

const sgn = (v: number | null, d = 2, suf = '') => (v === null ? dash : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}${suf}`);
const tone = (v: number | null) => (v === null ? '' : v >= 0 ? 'up' : 'down');

/** Backtest next to live, per engine. The live side stays a progress count until enough trades have closed. */
export default function Scoreboard({ feed }: { feed: EnginesFeed }) {
  const rows = useMemo(() => scoreboard(feed), [feed]);
  const closedAll = rows.reduce((n, r) => n + r.closed, 0);
  const issuedAll = rows.reduce((n, r) => n + r.issued, 0);
  return (
    <Rv className="panel" style={{ marginTop: 18 }}>
      <div className="eyebrow">Backtest against live</div>
      <p className="muted" style={{ margin: '6px 0 10px', maxWidth: '80ch' }}>
        {closedAll === 0
          ? `Nothing has closed since launch${feed.launched ? ` on ${dateLabel(feed.launched)}` : ''}; ${issuedAll} ${issuedAll === 1 ? 'signal' : 'signals'} issued.`
          : `${closedAll} trades have closed since launch. A live average is set beside the backtest only after ${MIN_LIVE_CLOSED} closed trades for that engine.`}
      </p>
      <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
        <table className="tbl">
          <thead><tr><th>Engine</th><th>Backtest, unseen data</th><th>Live since launch</th><th>Closed trades needed</th><th>Live vs backtest</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ cursor: 'default' }}>
                <td><b>{r.name}</b><div className="dim" style={{ fontSize: 13 }}>{r.tradingStatus.toLowerCase()}</div></td>
                <td className="num">{r.holdoutN !== null ? `${num(r.holdoutN)} trades` : dash}<div className={tone(r.holdoutExpR)}>{sgn(r.holdoutExpR, 2, 'R')} avg</div><div className="dim" style={{ fontSize: 13 }}>{r.holdoutWinPct !== null ? `${r.holdoutWinPct.toFixed(1)}% won` : dash}</div></td>
                <td className="num">{r.issued} issued<div className="dim" style={{ fontSize: 13 }}>{r.pending} waiting, {r.open} open, {r.closed} closed</div>{r.closed > 0 && <div className={tone(r.liveAvgR)}>{sgn(r.liveAvgR, 2, 'R')} avg{r.liveWinPct !== null ? `, ${r.liveWinPct.toFixed(1)}% won` : ''}</div>}</td>
                <td style={{ minWidth: 150 }}><Bar pct={r.progress * 100} /><div className="dim num" style={{ fontSize: 13, marginTop: 4 }}>{r.closed} of {MIN_LIVE_CLOSED}</div></td>
                <td className={`num ${tone(r.gapR)}`}>{r.gapR !== null ? `${sgn(r.gapR, 2, 'R')}` : <span className="dim">{r.state === 'none' ? 'no result yet' : 'too early'}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Rv>
  );
}
