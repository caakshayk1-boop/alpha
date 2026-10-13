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
    <Rv className="panel" style={{ marginTop: 28 }}>
      <div className="eyebrow">Backtest against live</div>
      <h3 className="disp" style={{ fontSize: 26, margin: '8px 0 6px' }}>What the models showed, and what has happened since.</h3>
      <p className="muted" style={{ margin: '0 0 14px', maxWidth: '80ch' }}>
        {closedAll === 0
          ? `Nothing has closed since launch${feed.launched ? ` on ${dateLabel(feed.launched)}` : ''}: ${issuedAll} ${issuedAll === 1 ? 'signal has' : 'signals have'} been issued and none has resolved yet, so there is no live result to show. That is the honest position, and it will fill in as trades close.`
          : `${closedAll} trades have closed since launch. A live average is set beside the backtest only after ${MIN_LIVE_CLOSED} closed trades for that engine.`}
      </p>
      <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
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
      <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0', maxWidth: '85ch' }}>
        Both sides are average R per trade, after the same {feed.backtest.cost_round_trip_pct}% round-trip cost. The backtest is trades on data the model had not seen, which can still overstate what comes next; the live record is the only number that cannot have been fitted to the past. Even at {MIN_LIVE_CLOSED} closed trades a live average carries a wide error, so the gap is a description, not a verdict.
      </p>
    </Rv>
  );
}
