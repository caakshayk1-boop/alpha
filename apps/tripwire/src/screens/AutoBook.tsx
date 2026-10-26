import { useState } from 'react';
import { useAutoBook } from '../book.ts';
import { TradeCard } from './Tracker.tsx';
import { Ago, LiveBadge, Tick } from '../live.tsx';
import { Empty } from '../ui.tsx';
import { Head, Loading } from './common.tsx';
import { inr0 } from '../fmt.ts';
import { dayWord } from '../fmt.ts';

const sgn = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const R = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`;

/** The automatic paper book: every pick of the nightly record, taken that night, 30 at a time at most and ₹1,00,000 each at most. */
export function AutoBook() {
  const b = useAutoBook(); const [openId, setOpenId] = useState<string | null>(null); const [allClosed, setAllClosed] = useState(false); const [allLog, setAllLog] = useState(false);
  if (b.ledger.loading && !b.plan) return <Loading what="the automatic book" />;
  if (!b.plan) return <Empty title="The automatic book has not started" action={<button className="btn" onClick={b.ledger.retry}>Check again</button>}>It follows the nightly record, which starts with the first nightly run. {b.ledger.err && b.ledger.err !== 'not published' ? `The record could not be read (${b.ledger.err}).` : ''}</Empty>;
  const live = b.session.phase === 'open';
  const open = b.rows.filter((r) => r.v.status === 'open').sort((x, y) => (y.v.pnl ?? 0) - (x.v.pnl ?? 0));
  const wait = b.rows.filter((r) => r.v.status === 'pending' || r.v.status === 'waiting');
  const closed = b.rows.filter((r) => r.v.status === 'closed').sort((x, y) => (y.v.exitT ?? 0) - (x.v.exitT ?? 0));
  const skipped = b.rows.filter((r) => r.v.status === 'skipped');
  const openPnl = b.sum.openPnl; const maxAbs = Math.max(1, ...open.map((r) => Math.abs(r.v.pnl ?? 0)));
  const log = b.plan.log; const shownLog = allLog ? log : log.slice(0, 25);
  const total = openPnl + b.sum.closedPnl;
  const toggle = (id: string) => setOpenId(openId === id ? null : id);
  return <>
    <div className="card glass">
      <div className="row between"><LiveBadge live={live} label={live ? 'LIVE' : b.session.label} /><span className="small mute">{b.session.detail}</span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <div><div className="k">Open P&L (paper)</div>
          <div className={`num amt ${openPnl > 0 ? 'up' : openPnl < 0 ? 'down' : ''}`} style={{ font: '600 2rem/1.1 var(--sans)' }}><Tick v={open.length ? openPnl : null}>{open.length ? sgn(openPnl) : '—'}</Tick></div></div>
        <div style={{ textAlign: 'right' }}><div className="k">{live ? 'Today' : 'Last session'}</div>
          <div className={`num amt ${(b.dayTotal ?? 0) > 0 ? 'up' : (b.dayTotal ?? 0) < 0 ? 'down' : ''}`} style={{ font: '600 1.25rem/1.2 var(--sans)' }}><Tick v={b.dayTotal}>{sgn(b.dayTotal)}</Tick></div></div></div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div><div className="k">Realised</div><div className={`num amt ${b.sum.closedPnl > 0 ? 'up' : b.sum.closedPnl < 0 ? 'down' : ''}`} style={{ font: '600 1.125rem/1.2 var(--sans)' }}>{b.sum.closed ? sgn(b.sum.closedPnl) : '—'}</div><div className="small dim">{b.sum.closed} closed</div></div>
        <div style={{ textAlign: 'right' }}><div className="k">Overall</div><div className={`num amt ${total > 0 ? 'up' : total < 0 ? 'down' : ''}`} style={{ font: '600 1.125rem/1.2 var(--sans)' }}>{b.rows.some((r) => r.v.pnl != null) ? sgn(total) : '—'}</div><div className="small dim">realised + open</div></div></div>
      <div style={{ marginTop: 12 }}><div className="row between small"><span className="k">Positions</span><span className="num"><b>{b.slots}</b> of {b.cfg.maxOpen}</span></div>
        <div className="slots" role="img" aria-label={`${b.slots} of ${b.cfg.maxOpen} positions in use`}>{Array.from({ length: b.cfg.maxOpen }, (_, i) => <i key={i} className={i < b.slots ? 'on' : ''} />)}</div></div>
      <div className="row between small dim" style={{ marginTop: 10 }}>
        <span>{open.length} open · {wait.length} waiting for an open · <span className="amt">{inr0(b.deployed)}</span> invested</span>
        <span>{b.intra.err ? <span className="down">prices unavailable</span> : b.intra.at ? <>updated <Ago at={b.intra.at} /></> : ''}</span></div>
      {open.length > 1 && <div style={{ marginTop: 10 }} aria-label="Contribution to open P&L by position">{open.slice(0, 8).map((r) => { const w = (Math.abs(r.v.pnl ?? 0) / maxAbs) * 50; const pos = (r.v.pnl ?? 0) >= 0; return <div key={r.p.id} className="contrib" style={{ gridTemplateColumns: '104px 1fr auto' }}><span className="sym trunc">{r.p.sym}</span><span className="bar2"><i style={{ width: `${w}%`, left: pos ? '50%' : `${50 - w}%`, background: pos ? 'var(--up)' : 'var(--down)' }} /></span><span className={`num amt ${pos ? 'up' : 'down'}`}>{sgn(r.v.pnl)}</span></div>; })}{open.length > 8 && <div className="small mute">Largest 8 of {open.length} shown.</div>}</div>}
      {b.intra.err && <p className="small down" style={{ margin: '8px 0 0' }}>Live prices are unavailable: {b.intra.err}. {b.bars.data ? 'Showing the last daily bars.' : 'Nothing is estimated in their place.'}</p>}
    </div>

    {!b.rows.length ? <Empty title="No position yet">Picks are written into the record each night after the market closes and taken here at once. The first one enters at the next open.</Empty> : <>
      {open.length > 0 && <Head aside={<span className="tag num">{open.length}</span>}>Open</Head>}
      {open.map((r) => <TradeCard key={r.p.id} r={r} cost={b.cost} expanded={openId === r.p.id} onToggle={() => toggle(r.p.id)} live={live} />)}
      {wait.length > 0 && <Head aside={<span className="tag num">{wait.length}</span>}>Enters at the next open</Head>}
      {wait.map((r) => <TradeCard key={r.p.id} r={r} cost={b.cost} expanded={openId === r.p.id} onToggle={() => toggle(r.p.id)} live={live} />)}
      {closed.length > 0 && <Head aside={<span className="tag num">{closed.length}</span>}>Closed</Head>}
      {(allClosed ? closed : closed.slice(0, 6)).map((r) => <TradeCard key={r.p.id} r={r} cost={b.cost} expanded={openId === r.p.id} onToggle={() => toggle(r.p.id)} live={live} />)}
      {closed.length > 6 && !allClosed && <button className="btn" style={{ width: '100%' }} onClick={() => setAllClosed(true)}>Show all {closed.length} closed</button>}
      {skipped.length > 0 && <p className="mute small">{skipped.length} pick{skipped.length === 1 ? ' was' : 's were'} skipped at the open by the entry rule and never counted; they are in the log.</p>}
    </>}

    <Head aside={<span className="tag num">{log.length}</span>}>Log</Head>
    {log.length ? <div className="card" style={{ padding: '2px 14px' }}><div className="list">{shownLog.map((e) => <div key={e.kind + e.id} className="li" style={{ alignItems: 'flex-start' }}>
      <span className={`tag ${e.kind === 'closed' ? 'lime' : e.kind === 'refused' || e.kind === 'skipped' ? 'peach' : ''}`} style={{ flex: 'none', minWidth: 60, justifyContent: 'center' }}>{dayWord(e.day).replace(/^\w+ /, '')}</span>
      <span className="grow small">{e.text}</span></div>)}</div>
      {log.length > 25 && !allLog && <button className="btn sm" style={{ margin: '4px 0 12px' }} onClick={() => setAllLog(true)}>Show all {log.length} entries</button>}</div> : <div className="card dim">Nothing has happened yet.</div>}
    <div className="note info" style={{ marginTop: 12 }}><b>How this book works.</b> Every pick the active engines write into the nightly record is taken here the same night, best score first, with two fixed limits: at most {b.cfg.maxOpen} positions at a time and at most {inr0(b.cfg.ticket)} in any one (quantity = ticket ÷ signal close, rounded down). A pick is refused, and the log says why, if the name is already held, one share costs more than the ticket, or {b.cfg.maxOpen} positions are running. Entry is the next open plus 0.1% slippage, skipped if it opens more than 2% above the signal close; the stop is fixed; the time exit is the close of the last session; costs {b.cost}% round trip. It is paper only, it is built from the record and not from anything you press, and it does not choose between engines. {b.sum.enough ? '' : `Average R and win rate stay hidden until 30 trades have closed (${b.sum.closed} so far).`} The engines have no historical edge: see Evidence.</div>
  </>;
}
