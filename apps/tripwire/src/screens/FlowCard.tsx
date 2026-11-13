import { useMemo } from 'react';
import { useFiiDii } from '../data.ts';
import { sessionsBehind } from '../freshness.ts';
import { dayWord } from '../fmt.ts';
import { crSigned, FLOW_MAX_BEHIND, readFlows, validFile, type FlowDay } from '../fiidii.ts';

/** Institutional flows on Markets: the newest day's net FII and DII figure, one plain sentence about it, the last five sessions as diverging bars, and the figures as a table.
 *  Hidden (not an error box) when there is no file yet, it is unreadable, or its newest day is more than FLOW_MAX_BEHIND sessions old: a stale flow figure is history, not a reading.
 *  Direction is carried by an arrow and a sign as well as colour. It describes what was traded and says so; it forecasts nothing. */
const W = 280, H = 76, MID = H / 2;
export function FlowCard({ slim = false }: { slim?: boolean } = {}) {
  const feed = useFiiDii();
  const rows = useMemo<FlowDay[]>(() => (feed.data && validFile(feed.data) ? feed.data.rows : []), [feed.data]);
  const last = rows[rows.length - 1]; const behind = last ? sessionsBehind(last.date) : null;
  if (!last || behind == null || behind > FLOW_MAX_BEHIND) return null;
  const r = readFlows(rows)!; const w = rows.slice(-5); const max = Math.max(1, ...w.flatMap((d) => [Math.abs(d.fii.net), Math.abs(d.dii.net)]));
  const gap = W / w.length, bw = Math.min(16, gap / 2.6); const y = (v: number) => (Math.abs(v) / max) * (MID - 4);
  const arrow = (v: number) => (v >= 0 ? '▲' : '▼');
  return <section className={`card flows${slim ? ' mk-card mk-flows' : ''}`} data-fiidii aria-labelledby="fl-h">
    <div className="row between"><h2 id="fl-h" className={slim ? 'mk-h' : 'sec'} style={{ margin: 0 }}>FII and DII flows</h2><span className="small dim">{dayWord(r.date)}{slim ? ' · NSE provisional' : ''}</span></div>
    <div className="fl-pair">
      <div><span className="k">FIIs · net</span><b className={`num ${r.fii >= 0 ? 'up' : 'down'}`}>{arrow(r.fii)} {crSigned(r.fii)}</b></div>
      <div><span className="k">DIIs · net</span><b className={`num ${r.dii >= 0 ? 'up' : 'down'}`}>{arrow(r.dii)} {crSigned(r.dii)}</b></div>
    </div>
    <p className="fl-read" data-fiidii-line>{r.line}</p>
    {r.window && <p className="small dim" style={{ margin: '4px 0 0' }}>{r.window}</p>}
    {w.length >= 2 && <svg className="fl-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Net FII and DII flows, last ${w.length} sessions, in rupees crore. Table below.`} focusable="false">
      <line x1="0" x2={W} y1={MID} y2={MID} className="fl-axis" />
      {w.map((d, i) => { const cx = gap * i + gap / 2; return <g key={d.date}>
        <rect x={cx - bw - 1} width={bw} y={d.fii.net >= 0 ? MID - y(d.fii.net) : MID} height={Math.max(1, y(d.fii.net))} className={`fl-fii ${d.fii.net >= 0 ? 'up' : 'down'}`} />
        <rect x={cx + 1} width={bw} y={d.dii.net >= 0 ? MID - y(d.dii.net) : MID} height={Math.max(1, y(d.dii.net))} className={`fl-dii ${d.dii.net >= 0 ? 'up' : 'down'}`} /></g>; })}
    </svg>}
    {w.length >= 2 && <p className="small mute fl-key" aria-hidden="true">Left bar FIIs, right bar DIIs, per session; up is net buying, down is net selling.</p>}
    {!slim && <p className="small mute" style={{ margin: '8px 0 0' }}>Provisional figures as published by NSE, in ₹ crore, for FII/FPI and DII as NSE groups them. They describe what was traded, not what will happen.</p>}
    <details className="more"><summary>Flows as a table</summary>
      <table className="num"><thead><tr><th scope="col">Session</th><th scope="col">FII net</th><th scope="col">DII net</th></tr></thead>
        <tbody>{[...w].reverse().map((d) => <tr key={d.date}><th scope="row">{dayWord(d.date)}</th><td className={d.fii.net >= 0 ? 'up' : 'down'}>{arrow(d.fii.net)} {crSigned(d.fii.net)}</td><td className={d.dii.net >= 0 ? 'up' : 'down'}>{arrow(d.dii.net)} {crSigned(d.dii.net)}</td></tr>)}</tbody></table>
    </details>
  </section>;
}

/** The same figures as ONE line for Today's brief, linking to the full card on Markets. Hidden under the same rules as the card (none, damaged, or too old). */
export function FlowLine() {
  const feed = useFiiDii(); const rows = useMemo<FlowDay[]>(() => (feed.data && validFile(feed.data) ? feed.data.rows : []), [feed.data]);
  const last = rows[rows.length - 1]; const behind = last ? sessionsBehind(last.date) : null; if (!last || behind == null || behind > FLOW_MAX_BEHIND) return null;
  const r = readFlows(rows)!;
  return <p className="small dim brief-flow" data-flow-line><a href="#/markets" className="tx">{r.line.replace(/\.$/, '')} <span className="mute">({dayWord(r.date)}, NSE provisional)</span></a></p>;
}
