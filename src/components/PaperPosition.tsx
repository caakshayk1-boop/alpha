'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chg, Flash } from '@/components/ui';
import { dash, num, tone } from '@/lib/format';
import { STATE_TEXT, railOf, summarise, type PlanState, type Position } from '@/lib/positions';
import { istTime, sessionLabel } from '@/lib/price';
import { companyHref } from '@/lib/slug';
import type { EngineSignal } from '@/lib/types';

const sR = (v: number | null | undefined, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}R` : dash);
const sP = (v: number | null | undefined, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%` : dash);
const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

export const STATE_TONE: Record<PlanState, string> = { 'awaiting-entry': '', hold: 'acc', 'stop-hit': 'down', 'target-hit': 'up', 'all-targets': 'up', 'time-due': 'warn', 'time-passed': 'warn', closed: '', void: 'warn' };

/** "Paper · live 10:26 IST", "Paper · last trade 15:29 IST" or "Paper · 19 Oct 2026 close". */
export function markLabel(p: Pick<Position, 'live' | 'at' | 'session' | 'source'>, now = Date.now()): string {
  if (p.live && p.at) {
    const fresh = now / 1000 - p.at < 15 * 60;
    return fresh ? `Paper · live ${istTime(p.at)} IST` : `Paper · last trade ${sessionLabel(p.session)} ${istTime(p.at)} IST`;
  }
  return p.source === 'signal' ? `Signal close · ${sessionLabel(p.session)}` : `Paper · ${sessionLabel(p.session)} close`;
}

/** Stop, entry and targets on one linear price scale, with the latest price marked. Booked targets are filled. */
export function Rail({ s, p }: { s: Pick<EngineSignal, 'sl' | 'targets'>; p: Position }) {
  const rail = railOf({ entry: p.entry, stop: p.stop, price: p.price, sl: s.sl, targets: s.targets });
  const at = rail.at;
  const marks: { k: string; v: number; cls: string }[] = [
    { k: 'Stop', v: s.sl, cls: 'stop' },
    { k: p.stop === p.entry && p.phase === 'open' ? 'Entry · stop' : 'Entry', v: p.entry, cls: 'entry' },
    ...s.targets.map((t, i) => ({ k: `T${i + 1}${p.phase === 'open' && i === 0 && p.stop === t ? ' · stop' : ''}`, v: t, cls: `tgt${i < p.booked ? ' got' : ''}` })),
  ];
  const px = p.price;
  const from = at(p.entry), to = px === null ? from : at(px);
  const label = `Price ${px === null ? 'not available' : `₹${num(px, 2)}`}; stop ₹${num(p.stop, 2)}, entry ₹${num(p.entry, 2)}, targets ${s.targets.map((t) => `₹${num(t, 2)}`).join(', ')}.`;
  return (
    <div className="prail" role="img" aria-label={label}>
      <div className="prail-track">
        {px !== null && p.phase === 'open' && <i className={`prail-fill ${px >= p.entry ? 'up' : 'down'}`} style={{ left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%` }} />}
        {p.stop !== s.sl && <i className="prail-tick stopnow" style={{ left: `${at(p.stop)}%` }} />}
        {marks.map((m) => <i key={m.k} className={`prail-tick ${m.cls}`} style={{ left: `${at(m.v)}%` }} />)}
        {px !== null && <b className={`prail-px ${tone(px - p.entry)}`} style={{ left: `${to}%` }} />}
      </div>
      <div className="prail-labels" aria-hidden>
        {marks.map((m) => <span key={m.k} className={m.cls} style={{ left: `${at(m.v)}%` }}>{m.k}</span>)}
      </div>
    </div>
  );
}

/** The live block on a signal card: the trade marked to the latest price, the plan's state and the action its rules prescribe. */
export function PaperBlock({ s, p }: { s: EngineSignal; p: Position }) {
  const pending = p.phase === 'pending' || p.state === 'awaiting-entry';
  const closedLike = p.phase === 'closed' || p.phase === 'void';
  if (closedLike) return null;
  const rv = r2(p.r);
  const lastEvent = p.changed;
  return (
    <div className={`pblock${p.live ? ' is-live' : ''}`} aria-label="Paper position at the latest price">
      <div className="pblock-top">
        <div className="pblock-r">
          <span className="k">{pending ? 'No position yet' : p.booked > 0 ? 'Paper mark · booked thirds + open' : 'Paper mark · unrealised'}</span>
          {pending ? (
            <span className="v num">{p.live && p.price !== null ? sP((p.price / s.ref_price - 1) * 100, 2) : dash}<small>{p.live ? ' vs signal close' : ' waiting for the open'}</small></span>
          ) : (
            <span className={`v num ${tone(rv)}`}><Flash value={rv}>{sR(rv)}</Flash><small className="num"> · <Flash value={p.pct === null ? null : Math.round(p.pct * 100) / 100}>{sP(p.pct, 2)}</Flash> of entry value</small></span>
          )}
        </div>
        <div className="pblock-since">
          <span className="k">{pending ? `Signal close ${sessionLabel(s.date)}` : p.closeOn ? `Since the ${sessionLabel(p.closeOn)} close` : 'Since the engines\' last close (date not stated)'}</span>
          <span className="v">{pending ? `₹${num(s.ref_price, 2)}` : p.sinceClose === null ? <span className="dim">no newer trade</span> : <Chg v={p.sinceClose} />}</span>
        </div>
      </div>
      <Rail s={s} p={p} />
      <div className="pblock-dist num">
        <span>{p.toStop ? <>{p.toStop.label} <b>{sP(p.toStop.pct)}</b> · {sR(p.toStop.r)}</> : dash}</span>
        <span>{p.toNext ? <>{p.toNext.label} <b>{sP(p.toNext.pct)}</b> · {sR(p.toNext.r)}</> : 'All targets reached'}</span>
      </div>
      <p className="pblock-act"><span className={`tag ${STATE_TONE[p.state]}`}>{STATE_TEXT[p.state]}</span> {p.action}</p>
      <p className="pblock-foot dim num">{markLabel(p)}{p.price !== null && !pending ? ` · ₹${num(p.price, 2)}` : ''} · last change: {lastEvent.what}{lastEvent.at ? ` ${istTime(lastEvent.at)} IST` : lastEvent.session ? `, ${sessionLabel(lastEvent.session)}` : ''}</p>
    </div>
  );
}

type SortKey = 'sym' | 'engine' | 'entry' | 'price' | 'r' | 'state';
const STATE_ORDER: PlanState[] = ['stop-hit', 'time-passed', 'time-due', 'all-targets', 'target-hit', 'hold', 'awaiting-entry', 'closed', 'void'];

/** "Paper book, live": every open signal across the engines, marked to the latest price, with a sortable table. */
/** Sorted by symbol until the reader picks a column, so a live refresh changes values, never row order; the table has a fixed
 *  height from the open count, so nothing below it moves. `ready` is false until the live prices have answered once. */
export function PaperBook({ rows, engineName, cost, ready = true }: { rows: { s: EngineSignal; p: Position }[]; engineName: (k: string) => string; cost?: number; ready?: boolean }) {
  const open = useMemo(() => rows.filter((x) => x.p.phase === 'open'), [rows]);
  const pending = rows.length - open.length;
  const book = useMemo(() => summarise(open.map((x) => x.p)), [open]);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'sym', dir: 1 });
  const sorted = useMemo(() => {
    const val = (x: { s: EngineSignal; p: Position }): string | number => {
      switch (sort.k) {
        case 'sym': return x.s.sym;
        case 'engine': return engineName(x.s.engine);
        case 'entry': return x.p.entry;
        case 'price': return x.p.price ?? -Infinity;
        case 'r': return x.p.r ?? -Infinity;
        default: return STATE_ORDER.indexOf(x.p.state);
      }
    };
    return [...open].sort((a, b) => { const va = val(a), vb = val(b); return (va < vb ? -1 : va > vb ? 1 : a.s.sym.localeCompare(b.s.sym)) * sort.dir; });
  }, [open, sort, engineName]);
  const head = (k: SortKey, label: string) => (
    <th aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="pbook-sort" onClick={() => setSort((x) => ({ k, dir: x.k === k ? (x.dir === 1 ? -1 : 1) : k === 'sym' || k === 'engine' || k === 'state' ? 1 : -1 }))}>{label}{sort.k === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</button>
    </th>
  );
  const newest = book.newest.at ? markLabel({ live: true, at: book.newest.at, session: book.newest.session, source: 'live' }) : `Paper · ${sessionLabel(book.newest.session)} close`;
  return (
    <section className="pbook panel" aria-labelledby="pbook-h">
      <div className="pbook-h">
        <h2 id="pbook-h">Paper book, live</h2>
        <span className={`lw-stamp${book.live ? ' on' : ''}`}>{book.live ? `${newest} · ${book.live} of ${book.marked} live` : newest}</span>
      </div>
      <div className="pbook-kpis">
        <div><span className="k">Open</span><span className="v num">{book.open}</span><span className="n">{pending ? `+${pending} waiting for entry` : 'none waiting'}</span></div>
        <div><span className="k">Total, marked</span><span className={`v num ${tone(r2(book.totalR))}`}><Flash value={r2(book.totalR)}>{sR(book.totalR)}</Flash></span><span className="n">sum over {book.marked}</span></div>
        <div><span className="k">Average per trade</span><span className={`v num ${tone(r2(book.avgR))}`}><Flash value={r2(book.avgR)}>{sR(book.avgR)}</Flash></span><span className="n">before costs</span></div>
        <div><span className="k">Near the stop</span><span className="v num">{book.nearStop}</span><span className="n">within 0.25R or past it</span></div>
        <div><span className="k">Near a target</span><span className="v num">{book.nearTarget}</span><span className="n">within 0.25R or past it</span></div>
      </div>
      <div className="tbl-wrap pbook-tbl" tabIndex={0} role="region" aria-label="Open paper positions (scrolls sideways on small screens)" aria-busy={!ready} style={{ height: Math.min(360, 44 + Math.max(1, open.length) * 42) }}>
        <table className="tbl">
          <thead><tr>{head('sym', 'Stock')}{head('engine', 'Engine')}{head('entry', 'Entry')}{head('price', 'Price')}{head('r', 'Marked R')}{head('state', 'Plan state')}</tr></thead>
          <tbody>
            {sorted.map(({ s, p }) => (
              <tr key={s.id}>
                <td><Link href={companyHref(s.sym)} prefetch={false}><b>{s.sym}</b></Link></td>
                <td className="dim">{engineName(s.engine)}</td>
                <td className="num">₹{num(p.entry, 2)}</td>
                <td className="num">₹{num(p.price, 2)}<span className="dim pbook-src">{p.live && p.at && Date.now() / 1000 - p.at < 15 * 60 ? ' live' : p.live ? ' last trade' : ' close'}</span></td>
                <td className={`num ${tone(r2(p.r))}`}><Flash value={r2(p.r)}>{sR(p.r)}</Flash></td>
                <td><span className={`tag ${STATE_TONE[p.state]}`}>{STATE_TEXT[p.state]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="dim pbook-note">A paper record: Alpha places no order, and nothing here is a gain or loss anyone has made. Each trade is the engine&apos;s own plan marked to the latest price; booked thirds are counted at the prices the evening run recorded. In the tests fills are at the next session&apos;s open, no slippage is modelled{typeof cost === 'number' ? `, and the ${cost}% round-trip cost is not taken off these marks` : ''}. Levels are checked against the latest price only; the evening run checks the day&apos;s full high and low and books what happened. The state and action are the plan&apos;s rules applied to that price, not advice.</p>
    </section>
  );
}
