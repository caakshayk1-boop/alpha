import { useState } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { Empty, useUi } from '../ui.tsx';
import { archivePaper } from '../store.ts';
import { ENGINES } from '../quant.ts';
import { SLIPPAGE_PCT, pnlAt, rLevel } from '../tracker.ts';
import { dayWord, inr, inr0, pct } from '../fmt.ts';
import { useLiveBook, type BookRow } from '../book.ts';
import { Ago, LiveBadge, Spark, Tick, TvButton } from '../live.tsx';
import { useScreen } from '../data.ts';
import { TrendTag } from './common.tsx';

const sgn = (v: number | null | undefined, f: (n: number) => string) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`);
const R = (v: number | null | undefined) => sgn(v, (n) => n.toFixed(2) + 'R');
const money = (v: number | null | undefined) => sgn(v, (n) => inr0(n));

export function Tracker() {
  const s = useAppState(); const { open } = useSheets(); const { toast } = useUi();
  const b = useLiveBook(); const [openId, setOpenId] = useState<string | null>(null);
  if (!s.paper.length) return <Empty title="Your paper book is empty" action={<button className="btn pri" onClick={() => go('/signals?v=picks')}>See the picks</button>}>Take a pick and Tripwire follows it with real prices: the next open fills it, the stop and the time limit close it. Nothing is real money.</Empty>;
  const openRows = b.rows.filter((r) => r.v.status === 'open'); const maxAbs = Math.max(1, ...openRows.map((r) => Math.abs(r.v.pnl ?? 0)));
  const live = b.session.phase === 'open'; const totalOpen = b.sum.openPnl;
  const hidden = s.paper.filter((p) => p.closedByUser).length;
  return <>
    <div className="card glass">
      <div className="row between"><LiveBadge live={live} label={live ? 'LIVE' : b.session.label} /><span className="small mute">{b.session.detail}</span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <div><div className="k">Open P&L (paper)</div>
          <div className={`num ${totalOpen > 0 ? 'up' : totalOpen < 0 ? 'down' : ''}`} style={{ font: '600 32px/1.1 var(--sans)' }}><Tick v={openRows.length ? totalOpen : null}>{openRows.length ? money(totalOpen) : '—'}</Tick></div></div>
        <div style={{ textAlign: 'right' }}><div className="k">{live ? 'Today' : 'Last session'}</div>
          <div className={`num ${(b.dayTotal ?? 0) > 0 ? 'up' : (b.dayTotal ?? 0) < 0 ? 'down' : ''}`} style={{ font: '600 20px/1.2 var(--sans)' }}><Tick v={b.dayTotal}>{money(b.dayTotal)}</Tick></div></div>
      </div>
      {openRows.length > 1 && <div style={{ marginTop: 10 }} aria-label="Contribution to open P&L by trade">{[...openRows].sort((x, y) => (y.v.pnl ?? 0) - (x.v.pnl ?? 0)).map((r) => { const w = (Math.abs(r.v.pnl ?? 0) / maxAbs) * 50; const pos = (r.v.pnl ?? 0) >= 0; return <div key={r.p.id} className="contrib"><span className="sym">{r.p.sym}</span><span className="bar2"><i style={{ width: `${w}%`, left: pos ? '50%' : `${50 - w}%`, background: pos ? 'var(--lime)' : 'var(--peach)' }} /></span><span className={`num ${pos ? 'up' : 'down'}`}>{money(r.v.pnl)}</span></div>; })}</div>}
      <div className="row between small dim" style={{ marginTop: 10 }}>
        <span>{b.sum.open} open · {b.sum.waiting} waiting for an open · {b.sum.skipped} skipped</span>
        <span>{b.intra.err ? <span className="down">prices unavailable</span> : b.intra.at ? <>updated <Ago at={b.intra.at} /></> : b.intra.loading ? 'loading…' : ''}</span></div>
      {b.intra.at && <div className="refresh" aria-hidden="true"><i key={b.intra.tick} /></div>}
      {b.intra.err && <p className="small down" style={{ margin: '8px 0 0' }}>Live prices are unavailable: {b.intra.err}. {b.bars.data ? 'Showing the last daily bars.' : 'Nothing is estimated in their place.'}</p>}
      {b.sum.closed > 0 && <p className="small" style={{ margin: '8px 0 0' }}>Closed: <b className="num">{R(b.sum.totalR)}</b> over {b.sum.closed} trade{b.sum.closed === 1 ? '' : 's'}.{!b.sum.enough ? <span className="dim"> Average R is withheld until 30 have closed.</span> : null}</p>}
    </div>
    {b.rows.map((r) => <TradeCard key={r.p.id} r={r} cost={b.cost} expanded={openId === r.p.id} onToggle={() => setOpenId(openId === r.p.id ? null : r.p.id)} live={live}
      onHide={() => { setState((x) => archivePaper(x, r.p.id)); toast('Taken off the active list. The record is kept.'); }} />)}
    {hidden > 0 && <p className="mute small">{hidden} hidden by you. They stay in your backup.</p>}
    <div className="note info" style={{ marginTop: 12 }}><b>How a trade is followed.</b> Entry: the open of the first session after you took it, plus {SLIPPAGE_PCT}% slippage; skipped if it opens more than 2% above the signal close or at the stop. Exit: the stop (a gap exits at the open; a bar spanning the stop counts as stopped), or the close of the last session of the horizon. Costs {b.cost}% round trip plus {SLIPPAGE_PCT}% slippage each side. Real fills differ.</div>
    <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => open({ k: 'plan' })}>Open the position sizer</button>
  </>;
}

export function TradeCard({ r, cost, expanded, onToggle, onHide, live }: { r: BookRow; cost: number; expanded: boolean; onToggle: () => void; onHide?: () => void; live: boolean }) {
  const scr = useScreen(); const row = scr.data?.rows.find((x) => x.sym === r.p.sym);
  const { p, v, q } = r; const eng = ENGINES.find((e) => e.id === p.engine)?.name ?? p.engine;
  const W = { waiting: 'Waiting for prices', pending: 'Enters at the next open', open: 'Open', closed: 'Closed', skipped: 'Skipped' } as const;
  const isOpen = v.status === 'open'; const done = v.status === 'closed';
  const [wi, setWi] = useState<number | null>(null);
  const entry = v.entry ?? p.ref; const mark = v.mark ?? entry;
  const lo = Math.round(p.stop * 0.97 * 100) / 100, hi = Math.round(entry * 1.25 * 100) / 100; const step = Math.max(0.05, Math.round(entry * 0.0005 * 100) / 100);
  const price = wi ?? mark; const w = isOpen ? pnlAt(p, entry, price, cost) : null;
  const rl = (x: number) => rLevel(x, entry, p.stop); const pos = (x: number | null) => `${Math.min(100, Math.max(0, (((x ?? 0) + 1.2) / 4.2) * 100))}%`;
  const spark = q && q.c.length > 1 ? q.c : null;
  return <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
    <button className="tcard-head" aria-expanded={expanded} onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: 13 }}>
      <div className="row between"><span><span className="sym">{p.sym}</span> <span className="tag">{eng}</span> {row && <TrendTag r={row} />}</span><span className={`tag ${isOpen ? 'lime' : v.status === 'skipped' ? 'peach' : ''}`}>{W[v.status]}</span></div>
      {(isOpen || done) ? <div className="row between" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <div><div className="k">{isOpen ? (v.markKind === 'live' ? 'Live' : 'Last close') : 'Exit'}</div><div className="num" style={{ font: '600 20px/1.2 var(--sans)' }}><Tick v={isOpen ? v.mark : v.exit}>{inr(isOpen ? v.mark : v.exit)}</Tick></div>
          {isOpen && q && <div className={`small num ${q.px >= q.prev ? 'up' : 'down'}`}>{pct(((q.px / q.prev) - 1) * 100)} {live ? 'today' : 'last session'}</div>}</div>
        <div style={{ textAlign: 'right' }}><div className="k">P&L</div><div className={`num ${(v.pnl ?? 0) > 0 ? 'up' : (v.pnl ?? 0) < 0 ? 'down' : ''}`} style={{ font: '600 20px/1.2 var(--sans)' }}><Tick v={v.pnl}>{money(v.pnl)}</Tick></div><div className="small dim num">{R(v.r)} · {pct(v.pct)}</div></div></div>
        : <p className="small dim num" style={{ margin: '8px 0 0' }}>{p.qty} shares · signal {inr(p.ref)} · stop {inr(p.stop)} · {p.horizon}-session limit{v.status === 'skipped' ? '' : ''}</p>}
      {v.status === 'skipped' && <p className="small down" style={{ margin: '8px 0 0' }}>{v.skipReason}. No trade was opened, and none is counted.</p>}
    </button>
    {expanded && (isOpen || done) && <div style={{ padding: '0 13px 13px' }}>
      {spark && <div style={{ marginTop: 4 }}><div className="k">{live ? 'Today, five-minute' : 'Last session, five-minute'}</div><Spark c={q!.c} up={q!.px >= q!.prev} refs={[{ v: q!.prev, kind: 'prev' }, ...(v.entry ? [{ v: v.entry, kind: 'entry' as const }] : []), { v: p.stop, kind: 'stop' }]} label={`${p.sym} today, with the previous close, your entry and your stop`} h={48} /><div className="small mute">dashed: previous close, your entry, your stop</div></div>}
      <div className="k" style={{ marginTop: 12 }}>Risk ladder</div>
      <div className="ladder" role="img" aria-label={`${p.sym} is at ${R(rl(mark))} of risk relative to your entry; the stop is at minus 1R`}>
        <div className="rail" />
        {[-1, 0, 1, 2, 3].map((x) => <div key={x} className={`lv ${x === -1 ? 'stop' : ''}`} style={{ left: pos(x) }}><span>{x === -1 ? 'stop' : x === 0 ? 'entry' : `+${x}R`}</span></div>)}
        <div className="mk" style={{ left: pos(rl(mark)) }} />{wi != null && isOpen && <div className="wi" style={{ left: pos(rl(wi)) }} />}
      </div>
      {isOpen && <><div className="small dim num">Stop {inr(p.stop)} is {pct(((p.stop / mark) - 1) * 100)} from here · session {v.sessions} of {p.horizon}, {v.left} left</div>
        <label className="l" htmlFor={`wi-${p.id}`}>What if it trades at…</label>
        <input id={`wi-${p.id}`} className="slider" type="range" min={lo} max={hi} step={step} value={price} onChange={(e) => setWi(Number(e.target.value))} />
        <div className="row between num" style={{ fontSize: 13 }}><span>{inr(price)}</span><span className={(w!.pnl) >= 0 ? 'up' : 'down'}>{money(w!.pnl)} · {R(w!.r)} · {pct(w!.pct)}</span></div>
        <div className="small mute">After costs and slippage. {wi != null ? <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => setWi(null)}>Back to live</button> : 'Drag to see any price.'}</div></>}
      {done && <p className="small dim num" style={{ margin: '8px 0 0' }}>{v.reason} · {v.sessions} session{v.sessions === 1 ? '' : 's'} held{v.exitT ? ` · ${dayWord(new Date((v.exitT + 19800) * 1000).toISOString())}` : ''}</p>}
      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}><TvButton sym={p.sym} /><a className="btn sm" href={`#/c/${p.sym}`}>Research</a>{(done || v.status === 'skipped') && onHide && <button className="btn sm" onClick={onHide}>Hide</button>}</div>
    </div>}
    {expanded && !isOpen && !done && <div style={{ padding: '0 13px 13px' }}><div className="row" style={{ gap: 8 }}><TvButton sym={p.sym} /><a className="btn sm" href={`#/c/${p.sym}`}>Research</a>{v.status === 'skipped' && onHide && <button className="btn sm" onClick={onHide}>Hide</button>}</div></div>}
  </div>;
}
