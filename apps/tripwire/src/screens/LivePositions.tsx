import { useState } from 'react';
import type { BookRow } from '../book.ts';
import { styleDef, styleOf } from '../exits.ts';
import { inr, inr0, pct } from '../fmt.ts';
import { Tick } from '../live.tsx';

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const tone = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');

/** Every open position with its own live P&L, biggest move first, and the ones still waiting for their open with the move since the signal.
 *  A waiting position has no fill, so its figure is labelled as a move of the last price against the signal close, never as profit. */
export function LivePositions({ rows, live }: { rows: BookRow[]; live: boolean }) {
  const [all, setAll] = useState(false);
  const open = rows.filter((r) => r.v.status === 'open').sort((a, b) => Math.abs(b.v.pnl ?? 0) - Math.abs(a.v.pnl ?? 0));
  const wait = rows.filter((r) => r.v.status === 'pending' || r.v.status === 'waiting');
  if (!open.length && !wait.length) return null;
  const shown = all ? open : open.slice(0, 5);
  return <div className="livepos" aria-label="Open positions">
    <div className="row between" style={{ marginTop: 10 }}><span className="k">Open positions{open.length ? ` · ${open.length}` : ''}</span><span className="small mute">{live ? 'live' : 'last close'}</span></div>
    {open.length === 0 && <p className="small dim" style={{ margin: '4px 0' }}>Nothing is open yet: {wait.length} waiting for the next open.</p>}
    {shown.map((r) => <a key={r.p.id} className="posrow" href={`#/c/${r.p.sym}`}>
      <span className="grow"><span className="sym">{r.p.sym}</span> <span className="tag">{styleDef(styleOf(r.p.horizon)).label}</span>{r.v.ladder?.t1Hit && <span className="tag lime" title="Target 1 has filled: half is sold and the stop is at the fill">T1 ✓</span>}
        <span className="small dim num" style={{ display: 'block' }}>{inr(r.v.mark)} · {r.v.markKind === 'live' ? 'live' : 'close'} · in at {inr(r.v.entry)}</span></span>
      <span style={{ textAlign: 'right' }}><span className={`num amt ${tone(r.v.pnl)}`} style={{ font: '600 1rem/1.2 var(--mono)', display: 'block' }}><Tick v={r.v.pnl}>{money(r.v.pnl)}</Tick></span><span className={`small num ${tone(r.v.pnl)}`}>{pct(r.v.pct)}{r.v.r != null ? ` · ${r.v.r > 0 ? '+' : r.v.r < 0 ? '−' : ''}${Math.abs(r.v.r).toFixed(2)}R` : ''}</span></span></a>)}
    {open.length > 5 && !all && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setAll(true)}>Show all {open.length}</button>}
    {wait.length > 0 && open.length > 0 && <div className="k" style={{ marginTop: 10 }}>Enter at the next open · {wait.length}</div>}
    {wait.slice(0, all ? wait.length : 5).map((r) => { const px = r.q?.px; const mv = px && r.p.ref > 0 ? (px / r.p.ref - 1) * 100 : null; return <a key={r.p.id} className="posrow" href={`#/c/${r.p.sym}`}>
      <span className="grow"><span className="sym">{r.p.sym}</span> <span className="tag">{styleDef(styleOf(r.p.horizon)).label}</span><span className="small dim num" style={{ display: 'block' }}>signal {inr(r.p.ref)} · not filled yet</span></span>
      <span className="small num dim" style={{ textAlign: 'right' }}>{mv == null ? 'no price yet' : <><span className={tone(mv)}>{pct(mv)}</span><span style={{ display: 'block' }}>since signal, not a fill</span></>}</span></a>; })}
    {wait.length > 5 && !all && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setAll(true)}>Show all {wait.length} waiting</button>}
  </div>;
}
