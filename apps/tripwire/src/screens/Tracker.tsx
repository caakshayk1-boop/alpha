import { PositionTime } from '../components/PositionTime.tsx';
import { positionInsight } from '../positioninsight.ts';
import { useState } from 'react';
import { ENGINES } from '../quant.ts';
import { SLIPPAGE_PCT, pnlAt, rLevel } from '../tracker.ts';
import { dayWord, inr, inr0, pct } from '../fmt.ts';
import { markWord } from '../stamp.ts';
import { resultBasis } from '../provenance.ts';
import type { BookRow } from '../book.ts';
import { TvButton } from '../live.tsx';
import { DayChart, type DayRef } from '../components/DayChart.tsx';
import { useScreen } from '../data.ts';
import { TrendTag } from './common.tsx';
import { TARGETS_BACKFILL_ON, styleDef, styleOf, targetBasis } from '../exits.ts';
import { ladderInputFor } from '../ladder.ts';
import { PositionCard, Pill, type Tone } from '../components/index.ts';
import type { Outcome } from '../ledger.ts';

const sgn = (v: number | null | undefined, f: (n: number) => string) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`);
const R = (v: number | null | undefined) => sgn(v, (n) => n.toFixed(2) + 'R');
const money = (v: number | null | undefined) => sgn(v, (n) => inr0(n));

/** 11 Nov 2026 (revamp v2): the "Mine" list that lived here is now part of the one Positions board (Positions.tsx), beside the engine's own positions, each row labelled by who took it.
 *  TradeCard stays here: Positions and Record both draw it. */
export const engineName = (id: string) => ENGINES.find((e) => e.id === id)?.name ?? id;
/** The engine's name short enough for a chip on a phone row: the first word (Quality at a fair price reads Quality). The full name is in the details. */
export const shortEngine = (id: string) => engineName(id).split(' ')[0];

export function TradeCard({ r, cost, expanded, onToggle, onHide, live, outcome, owner, near }: { r: BookRow; cost: number; expanded: boolean; onToggle: () => void; onHide?: () => void; live: boolean; /** the ledger's own record of this pick, for the hit days and prices of a position it has already finished */ outcome?: Outcome | null; /** who took it: the engine book or you; absent in the Record, where every row is the forward ledger's */ owner?: 'engine' | 'you'; near?: { kind: 'stop' | 'target'; text: string } | null }) {
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
  const ladder = ladderInputFor(p, v, outcome);
  const bs = resultBasis(p, done || v.status === 'skipped', outcome); const tone: Tone = done ? ((v.r ?? 0) > 0 ? 'up' : (v.r ?? 0) < 0 ? 'down' : 'neutral') : 'neutral';
  const held = isOpen ? `Session ${v.sessions} of ${p.horizon}` : done ? `Held ${v.sessions} session${v.sessions === 1 ? '' : 's'}` : v.status === 'skipped' ? 'Never entered' : null;
  return <PositionCard id={p.id} sym={p.sym} name={row?.name} closed={done} expanded={expanded} onToggle={onToggle} ladder={ladder}
    chips={<>{owner && <span className={`own-chip ${owner}`} title={owner === 'engine' ? 'Taken by the engine book from the nightly record' : 'Taken by you from a pick'}>{owner === 'engine' ? 'Engine' : 'You'}</span>}<Pill>{shortEngine(p.engine)}</Pill></>} near={near}
    held={held}
    tags={<><Pill>{styleDef(styleOf(p.horizon)).label}</Pill>{bs.basis !== 'as-filed' && <Pill>{bs.short}</Pill>}{row && <TrendTag r={row} />}</>}
    status={{ label: `${W[v.status]}${v.dataNote ? ' · recorded state' : ''}`, tone }} entry={v.entry ?? null}
    price={isOpen || done ? { label: isOpen ? markWord(v.markKind, r.markT, Date.now()).word : 'Exit', value: isOpen ? v.mark : v.exit ?? null, sub: isOpen && q ? <span className={`small num ${q.px >= q.prev ? 'up' : 'down'}`}>{pct(((q.px / q.prev) - 1) * 100)} {live ? 'today' : 'last session'}</span> : undefined } : null}
    pnl={v.pnl} r={v.r} pct={v.pct}
    timeline={<PositionTime signal={p.asOf} view={v} outcome={outcome} />}
    line={isOpen || done ? undefined : v.status === 'skipped' ? <span className="down">{v.skipReason}. No trade was opened, and none is counted.</span> : <>{p.qty} shares · signal {inr(p.ref)} · stop {inr(p.stop)} · {p.horizon}-session limit</>}>
    {(isOpen || done) && <div>
      {isOpen && (() => { const i = positionInsight(v, p); return i ? <p className="small" style={{ margin: '4px 0 0' }} data-insight>{i.line}{i.badges.length > 0 && <span className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>{i.badges.map((b) => <span key={b} className="tag">{b}</span>)}</span>}</p> : null; })()}
      {spark && <div style={{ marginTop: 4 }}><div className="k">{live ? 'Today' : 'Last session'}</div><DayChart q={q!} nse label={`${p.sym} ${live ? 'today' : 'last session'}`} fmt={(x) => inr(x)} refs={[...(v.entry ? [{ v: v.entry, kind: 'entry', text: `Entry ${inr(v.entry)}` } as DayRef] : []), { v: v.ladder?.stop ?? p.stop, kind: 'stop', text: `Stop ${inr(v.ladder?.stop ?? p.stop)}` }, ...(v.ladder ? [{ v: v.ladder.t1, kind: 'target', text: `T1 ${inr(v.ladder.t1)}` } as DayRef, { v: v.ladder.t2, kind: 'target', text: `T2 ${inr(v.ladder.t2)}` } as DayRef] : [])]} /></div>}
      {v.ladder && <div className="small num" style={{ marginTop: 10 }}>
        <div className="k">Profit booking · {styleDef(styleOf(p.horizon)).label}</div>
        <div>Target 1 {inr(v.ladder.t1)} · {v.ladder.t1Hit ? 'filled, half sold, stop moved to the fill' : 'not reached'}</div>
        <div>Target 2 {inr(v.ladder.t2)} · {v.ladder.t2Hit ? 'filled, the rest sold' : 'not reached'}</div>
        <div className="dim">Banked {money(v.ladder.booked)} before costs · {Math.round(v.ladder.qtyLeft * 100) / 100} of {Math.round(p.qty * 100) / 100} shares still held · stop {inr(v.ladder.stop)}</div>
        {targetBasis(p) === 'backfilled' && <div className="mute">Filed before profit booking began; the ladder was applied from its entry bar on {dayWord(TARGETS_BACKFILL_ON)}, so any target already crossed is booked on the day it filled.</div>}
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
        <p style={{ margin: '0 0 6px' }}><b>{done ? 'Exit' : 'Latest'}</b> {inr(done ? v.exit : v.mark)}: {done ? v.reason?.toLowerCase() : markWord(v.markKind, r.markT, Date.now()).detail}.</p>
        <p style={{ margin: '0 0 6px' }} data-basis={bs.basis}><b>Rule basis: {bs.short}</b> ({bs.rules}). {bs.line}</p>
        {p.qty > 0 ? <p style={{ margin: 0 }}><b>P&L basis</b>: fill to {done ? 'exit' : 'latest'}, times {Math.round(p.qty * 100) / 100} shares, minus {cost}% of the entry value (costs) and {SLIPPAGE_PCT}% of the exit value (slippage). Dividends are not received.</p>
          : <p style={{ margin: 0 }}><b>Result basis</b>: R only. This pick is in the forward record but the paper book did not take it, so there is no rupee figure. Costs of {cost}% round trip and {SLIPPAGE_PCT}% slippage each side are in the R.</p>}
        {adj && <p style={{ margin: '6px 0 0' }}>A split or bonus was found since the signal (the price history is now quoted ×{adj.toFixed(3)}). The stop and the share count were moved to match, so value and risk are unchanged.</p>}
        {v.basis === 'unverified' && <p className="down" style={{ margin: '6px 0 0' }}>The signal day's bar was not available, so a split since the signal could not be checked.</p>}</div></details>
      {isOpen && <><div className="small dim num">Stop {inr(v.ladder?.stop ?? p.stop)} is {pct((((v.ladder?.stop ?? p.stop) / mark) - 1) * 100)} from here · session {v.sessions} of {p.horizon}, {v.left} left</div>
        <label className="l" htmlFor={`wi-${p.id}`}>What if it trades at…</label>
        <input id={`wi-${p.id}`} className="slider" type="range" min={lo} max={hi} step={step} value={price} onChange={(e) => setWi(Number(e.target.value))} />
        <div className="row between num" style={{ fontSize: '0.8125rem' }}><span>{inr(price)}</span><span className={(w!.pnl) >= 0 ? 'up' : 'down'}>{money(w!.pnl)} · {R(w!.r)} · {pct(w!.pct)}</span></div>
        <div className="small mute">After costs and slippage. {wi != null ? <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => setWi(null)}>Back to live</button> : 'Drag to see any price.'}</div></>}
      {v.dataNote && <p className="small dim" role="status">{v.dataNote}</p>}
      {!!p.transitions?.length && <details className="ev"><summary>Position history</summary><div className="body">{p.transitions.map((t, i) => <p key={i} className="small dim">{t.at} · {t.from} → {t.to}: {t.reason}</p>)}</div></details>}
      {done && <p className="small dim num" style={{ margin: '8px 0 0' }}>{v.reason} · {v.sessions} session{v.sessions === 1 ? '' : 's'} held{v.exitT ? ` · ${dayWord(new Date((v.exitT + 19800) * 1000).toISOString())}` : ''}</p>}
      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}><TvButton sym={p.sym} /><a className="btn sm" href={`#/c/${p.sym}`}>Research</a>{(done || v.status === 'skipped') && onHide && <button className="btn sm" onClick={onHide}>Hide</button>}</div>
    </div>}
    {!isOpen && !done && <div><div className="row" style={{ gap: 8 }}><TvButton sym={p.sym} /><a className="btn sm" href={`#/c/${p.sym}`}>Research</a>{v.status === 'skipped' && onHide && <button className="btn sm" onClick={onHide}>Hide</button>}</div></div>}
  </PositionCard>;
}
