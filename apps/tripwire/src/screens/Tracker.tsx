import { useState } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { Empty, useUi } from '../ui.tsx';
import { archivePaper } from '../store.ts';
import { ENGINES } from '../quant.ts';
import { SLIPPAGE_PCT, pnlAt, rLevel } from '../tracker.ts';
import { dayWord, inr, inr0, pct } from '../fmt.ts';
import { useAutoBook, useLiveBook, type BookRow } from '../book.ts';
import { summarize } from '../tracker.ts';
import { LiveBadge, Observed, Spark, Tick, TvButton } from '../live.tsx';
import { useScreen } from '../data.ts';
import { TrendTag } from './common.tsx';
import { targetPrices } from '../levels.ts';
import { styleDef, styleOf } from '../exits.ts';

const sgn = (v: number | null | undefined, f: (n: number) => string) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`);
const R = (v: number | null | undefined) => sgn(v, (n) => n.toFixed(2) + 'R');
const money = (v: number | null | undefined) => sgn(v, (n) => inr0(n));

export function Tracker() {
  const s = useAppState(); const { open } = useSheets(); const { toast } = useUi();
  const b = useLiveBook(); const auto = useAutoBook(false); const [openId, setOpenId] = useState<string | null>(null);
  // what this list never shows or counts: a copy of a pick the auto book already holds (the same trade at another rupee size, so adding both counts it twice) and anything
  // a retired engine wrote. Both stay in the saved data and the backup; they are only kept out of the totals, and the count is stated once.
  const isDup = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf);
  const isGone = (p: { engine: string }) => ENGINES.some((e) => e.id === p.engine && e.retired);
  const rows = b.rows.filter((r) => !isDup(r.p) && !isGone(r.p)); const sum = summarize(rows.map((r) => r.v));
  const dayTotal = rows.some((r) => r.dayPnl != null) ? rows.reduce((a, r) => a + (r.dayPnl ?? 0), 0) : null;
  const dups = b.rows.filter((r) => isDup(r.p) && !isGone(r.p)).length; const retired = b.rows.filter((r) => isGone(r.p)).length;
  if (!rows.length) return <Empty title="You have taken no trade yourself" action={<button className="btn pri" onClick={() => go('/signals?v=picks')}>See the picks</button>}>Take a pick and Tripwire follows it with real prices: the next open fills it, the stop and the time limit close it. Nothing is real money.{dups + retired > 0 ? ` ${dups + retired} older ${dups + retired === 1 ? 'entry is' : 'entries are'} not shown (${[dups ? `${dups} duplicate${dups === 1 ? '' : 's'} of the auto book` : '', retired ? `${retired} from a retired engine` : ''].filter(Boolean).join(', ')}).` : ''}</Empty>;
  const openRows = rows.filter((r) => r.v.status === 'open'); const maxAbs = Math.max(1, ...openRows.map((r) => Math.abs(r.v.pnl ?? 0)));
  const live = b.session.phase === 'open'; const totalOpen = sum.openPnl;
  const hidden = s.paper.filter((p) => p.closedByUser).length;
  return <>
    <p className="small dim" style={{ margin: '0 0 8px' }}>The {rows.length} trade{rows.length === 1 ? '' : 's'} you took yourself. The engines' own picks are in the Auto tab.</p>
    <div className="card glass">
      <div className="row between"><LiveBadge live={live} label={live ? 'LIVE' : b.session.label} /><span className="small mute">{b.session.detail}</span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <div><div className="k">Open P&L (paper)</div>
          <div className={`num amt ${totalOpen > 0 ? 'up' : totalOpen < 0 ? 'down' : ''}`} style={{ font: '600 2rem/1.1 var(--sans)' }}><Tick v={openRows.length ? totalOpen : null}>{openRows.length ? money(totalOpen) : '—'}</Tick></div></div>
        <div style={{ textAlign: 'right' }}><div className="k">{live ? 'Today' : 'Last session'}</div>
          <div className={`num amt ${(dayTotal ?? 0) > 0 ? 'up' : (dayTotal ?? 0) < 0 ? 'down' : ''}`} style={{ font: '600 1.25rem/1.2 var(--sans)' }}><Tick v={dayTotal}>{money(dayTotal)}</Tick></div></div>
      </div>
      {openRows.length > 1 && <div style={{ marginTop: 10 }} aria-label="Contribution to open P&L by trade">{[...openRows].sort((x, y) => (y.v.pnl ?? 0) - (x.v.pnl ?? 0)).map((r) => { const w = (Math.abs(r.v.pnl ?? 0) / maxAbs) * 50; const pos = (r.v.pnl ?? 0) >= 0; return <div key={r.p.id} className="contrib"><span className="sym">{r.p.sym}</span><span className="bar2"><i style={{ width: `${w}%`, left: pos ? '50%' : `${50 - w}%`, background: pos ? 'var(--up)' : 'var(--down)' }} /></span><span className={`num amt ${pos ? 'up' : 'down'}`}>{money(r.v.pnl)}</span></div>; })}</div>}
      <div className="row between small dim" style={{ marginTop: 10 }}>
        <span>{sum.open} open · {sum.waiting} waiting for an open · {sum.skipped} skipped</span>
        <span><Observed sec={b.intra.obs} err={b.intra.err} loading={b.intra.loading} /></span></div>
      {b.intra.at && <div className="refresh" aria-hidden="true"><i key={b.intra.tick} /></div>}
      {b.intra.err && <p className="small down" style={{ margin: '8px 0 0' }}>Live prices are unavailable: {b.intra.err}. {b.bars.data ? 'Showing the last daily bars.' : 'Nothing is estimated in their place.'}</p>}
      {sum.closed > 0 && <p className="small" style={{ margin: '8px 0 0' }}>Closed: <b className="num">{R(sum.totalR)}</b> over {sum.closed} trade{sum.closed === 1 ? '' : 's'}.{!sum.enough ? <span className="dim"> Average R is withheld until 30 have closed.</span> : null}</p>}
    </div>
    {dups + retired > 0 && <p className="small mute" style={{ margin: '8px 0 0' }}>{dups + retired} older {dups + retired === 1 ? 'entry is' : 'entries are'} not shown or counted: {[dups ? `${dups} duplicate${dups === 1 ? '' : 's'} of the auto book` : '', retired ? `${retired} from a retired engine` : ''].filter(Boolean).join(', ')}. They stay in your backup.</p>}
    {rows.map((r) => <TradeCard key={r.p.id} r={r} cost={b.cost} expanded={openId === r.p.id} onToggle={() => setOpenId(openId === r.p.id ? null : r.p.id)} live={live}
      onHide={() => { setState((x) => archivePaper(x, r.p.id)); toast('Taken off the active list. The record is kept.'); }} />)}
    {hidden > 0 && <p className="mute small">{hidden} hidden by you. They stay in your backup.</p>}
    <div className="note info" style={{ marginTop: 12 }}><b>How a trade is followed.</b> Entry: the open of the first session after you took it, plus {SLIPPAGE_PCT}% slippage; skipped if it opens more than 2% above the signal close or at the stop. Exit: the stop (a gap exits at the open; a bar spanning the stop counts as stopped), or the close of the last session of the horizon. Costs {b.cost}% round trip plus {SLIPPAGE_PCT}% slippage each side. Real fills differ.</div>
    <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => open({ k: 'plan' })}>Open the position sizer</button>
  </>;
}

export function TradeCard({ r, cost, expanded, onToggle, onHide, live }: { r: BookRow; cost: number; expanded: boolean; onToggle: () => void; onHide?: () => void; live: boolean }) {
  const scr = useScreen(); const row = scr.data?.rows.find((x) => x.sym === r.p.sym);
  const { p: p0, v, q } = r; const adj = v.adjFactor && v.adjFactor !== 1 ? v.adjFactor : null;
  /* after a split or bonus the bars are quoted on the new basis: the stop and the share count move with them, so every figure below is on one basis */
  const p = adj ? { ...p0, ref: v.signal ?? p0.ref, stop: Math.round(p0.stop * adj * 100) / 100, qty: p0.qty / adj } : p0; const eng = ENGINES.find((e) => e.id === p.engine)?.name ?? p.engine;
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
      <div className="row between"><span><span className="sym">{p.sym}</span> <span className="tag">{eng}</span> <span className="tag">{styleDef(styleOf(p.horizon)).label}</span> {row && <TrendTag r={row} />}</span><span className={`tag ${isOpen ? 'lime' : v.status === 'skipped' ? 'peach' : ''}`}>{W[v.status]}</span></div>
      {(isOpen || done) ? <div className="row between" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <div><div className="k">{isOpen ? (v.markKind === 'live' ? 'Live' : 'Last close') : 'Exit'}</div><div className="num" style={{ font: '600 1.25rem/1.2 var(--sans)' }}><Tick v={isOpen ? v.mark : v.exit}>{inr(isOpen ? v.mark : v.exit)}</Tick></div>
          {isOpen && q && <div className={`small num ${q.px >= q.prev ? 'up' : 'down'}`}>{pct(((q.px / q.prev) - 1) * 100)} {live ? 'today' : 'last session'}</div>}</div>
        <div style={{ textAlign: 'right' }}><div className="k">P&L</div><div className={`num amt ${(v.pnl ?? 0) > 0 ? 'up' : (v.pnl ?? 0) < 0 ? 'down' : ''}`} style={{ font: '600 1.25rem/1.2 var(--sans)' }}><Tick v={v.pnl}>{money(v.pnl)}</Tick></div><div className="small dim num">{R(v.r)} · {pct(v.pct)}</div></div></div>
        : <p className="small dim num" style={{ margin: '8px 0 0' }}>{p.qty} shares · signal {inr(p.ref)} · stop {inr(p.stop)} · {p.horizon}-session limit{v.status === 'skipped' ? '' : ''}</p>}
      {(isOpen || v.status === 'pending' || v.status === 'waiting') && (() => { const t = targetPrices({ asOf: p.asOf, horizon: p.horizon, ref: v.signal ?? p.ref, stop: p.stop }); const L = v.ladder; const stopNow = L ? L.stop : p.stop;
        return <p className="small num" style={{ margin: '6px 0 0' }}><span className="down">stop {inr(stopNow)}{L && L.t1Hit && Math.abs(L.stop - (v.entry ?? 0)) < 0.01 ? ' (at the fill)' : ''}</span>{L ? <> · <span className={L.t1Hit ? 'up' : ''}>T1 {inr(L.t1)}{L.t1Hit ? ' ✓' : ''}</span> · <span className={L.t2Hit ? 'up' : ''}>T2 {inr(L.t2)}{L.t2Hit ? ' ✓' : ''}</span></> : t ? <span className="dim" title="Reference only: this pick was filed before profit booking began, so it exits on its stop and time limit."> · T1 {inr(t.t1)} · T2 {inr(t.t2)}{t.ref ? ' (ref)' : ''}</span> : null}</p>; })()}
      {v.status === 'skipped' && <p className="small down" style={{ margin: '8px 0 0' }}>{v.skipReason}. No trade was opened, and none is counted.</p>}
    </button>
    {expanded && (isOpen || done) && <div style={{ padding: '0 13px 13px' }}>
      {spark && <div style={{ marginTop: 4 }}><div className="k">{live ? 'Today, five-minute' : 'Last session, five-minute'}</div><Spark c={q!.c} up={q!.px >= q!.prev} refs={[{ v: q!.prev, kind: 'prev' }, ...(v.entry ? [{ v: v.entry, kind: 'entry' as const }] : []), { v: p.stop, kind: 'stop' }]} label={`${p.sym} today, with the previous close, your entry and your stop`} h={48} /><div className="small mute">dashed: previous close, your entry, your stop</div></div>}
      {v.ladder && <div className="small num" style={{ marginTop: 10 }}>
        <div className="k">Profit booking · {styleDef(styleOf(p.horizon)).label}</div>
        <div>Target 1 {inr(v.ladder.t1)} · {v.ladder.t1Hit ? 'filled, half sold, stop moved to the fill' : 'not reached'}</div>
        <div>Target 2 {inr(v.ladder.t2)} · {v.ladder.t2Hit ? 'filled, the rest sold' : 'not reached'}</div>
        <div className="dim">Banked {money(v.ladder.booked)} before costs · {Math.round(v.ladder.qtyLeft * 100) / 100} of {Math.round(p.qty * 100) / 100} shares still held · stop {inr(v.ladder.stop)}</div>
        <div className="mute">These targets are a chosen rule, not a tested one: the back-test never used targets.</div></div>}
      <div className="k" style={{ marginTop: 12 }}>Risk ladder</div>
      <div className="ladder" role="img" aria-label={`${p.sym} is at ${R(rl(mark))} of risk relative to your entry; the stop is at minus 1R`}>
        <div className="rail" />
        {[-1, 0, 1, 2, 3].map((x) => <div key={x} className={`lv ${x === -1 ? 'stop' : ''}`} style={{ left: pos(x) }}><span>{x === -1 ? 'stop' : x === 0 ? 'entry' : `+${x}R`}</span></div>)}
        <div className="mk" style={{ left: pos(rl(mark)) }} />{wi != null && isOpen && <div className="wi" style={{ left: pos(rl(wi)) }} />}
      </div>
      <details className="ev" style={{ marginTop: 10 }}><summary>Which price is which<span className="chev">▾</span></summary><div className="body small">
        <p style={{ margin: '0 0 6px' }}><b>Signal</b> {inr(p.ref)}: the engine's close on {dayWord(p.asOf)}. The stop is measured from here.</p>
        <p style={{ margin: '0 0 6px' }}><b>Fill</b> {v.entry != null ? inr(v.entry) : 'not yet'}: the next session's open plus {SLIPPAGE_PCT}% slippage. A paper fill is never at the signal close.</p>
        <p style={{ margin: '0 0 6px' }}><b>{done ? 'Exit' : 'Latest'}</b> {inr(done ? v.exit : v.mark)}: {done ? v.reason?.toLowerCase() : v.markKind === 'live' ? 'the last live print' : 'the last close'}.</p>
        <p style={{ margin: 0 }}><b>P&L basis</b>: fill to {done ? 'exit' : 'latest'}, times {Math.round(p.qty * 100) / 100} shares, minus {cost}% of the entry value (costs) and {SLIPPAGE_PCT}% of the exit value (slippage). Dividends are not received.</p>
        {adj && <p style={{ margin: '6px 0 0' }}>A split or bonus was found since the signal (the price history is now quoted ×{adj.toFixed(3)}). The stop and the share count were moved to match, so value and risk are unchanged.</p>}
        {v.basis === 'unverified' && <p className="down" style={{ margin: '6px 0 0' }}>The signal day's bar was not available, so a split since the signal could not be checked.</p>}</div></details>
      {isOpen && <><div className="small dim num">Stop {inr(v.ladder?.stop ?? p.stop)} is {pct((((v.ladder?.stop ?? p.stop) / mark) - 1) * 100)} from here · session {v.sessions} of {p.horizon}, {v.left} left</div>
        <label className="l" htmlFor={`wi-${p.id}`}>What if it trades at…</label>
        <input id={`wi-${p.id}`} className="slider" type="range" min={lo} max={hi} step={step} value={price} onChange={(e) => setWi(Number(e.target.value))} />
        <div className="row between num" style={{ fontSize: '0.8125rem' }}><span>{inr(price)}</span><span className={(w!.pnl) >= 0 ? 'up' : 'down'}>{money(w!.pnl)} · {R(w!.r)} · {pct(w!.pct)}</span></div>
        <div className="small mute">After costs and slippage. {wi != null ? <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => setWi(null)}>Back to live</button> : 'Drag to see any price.'}</div></>}
      {done && <p className="small dim num" style={{ margin: '8px 0 0' }}>{v.reason} · {v.sessions} session{v.sessions === 1 ? '' : 's'} held{v.exitT ? ` · ${dayWord(new Date((v.exitT + 19800) * 1000).toISOString())}` : ''}</p>}
      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}><TvButton sym={p.sym} /><a className="btn sm" href={`#/c/${p.sym}`}>Research</a>{(done || v.status === 'skipped') && onHide && <button className="btn sm" onClick={onHide}>Hide</button>}</div>
    </div>}
    {expanded && !isOpen && !done && <div style={{ padding: '0 13px 13px' }}><div className="row" style={{ gap: 8 }}><TvButton sym={p.sym} /><a className="btn sm" href={`#/c/${p.sym}`}>Research</a>{v.status === 'skipped' && onHide && <button className="btn sm" onClick={onHide}>Hide</button>}</div></div>}
  </div>;
}
