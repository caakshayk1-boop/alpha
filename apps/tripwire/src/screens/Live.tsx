import { useMemo, useState } from 'react';
import { useAppState } from '../app.tsx';
import { useAutoBook, useLiveBook, type BookRow } from '../book.ts';
import { useScreen } from '../data.ts';
import { dayCurve, lines, riskLens, totals, type Line } from '../blotter.ts';
import { styleDef } from '../exits.ts';
import { ENGINES } from '../quant.ts';
import { inr, inr0, pct } from '../fmt.ts';
import { LiveBadge, Observed, Tick } from '../live.tsx';
import { Empty } from '../ui.tsx';
import { Head, PageBar } from './common.tsx';

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const tone = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const R = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);
type Key = 'pnl' | 'pct' | 'dayPnl' | 'value' | 'toStop' | 'sym';
const COLS: { k: Key; h: string }[] = [{ k: 'pnl', h: 'P&L' }, { k: 'pct', h: '%' }, { k: 'dayPnl', h: 'TODAY' }, { k: 'value', h: 'VALUE' }, { k: 'toStop', h: 'TO STOP' }];

/** The day's P&L as a line against a zero rule. Drawn at the phone's width, with the last value tagged. */
function DayChart({ pts }: { pts: { t: number; v: number }[] }) {
  if (pts.length < 3) return null;
  const W = 1000, H = 160; const lo = Math.min(0, ...pts.map((p) => p.v)), hi = Math.max(0, ...pts.map((p) => p.v)); const span = hi - lo || 1; const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W, y = (v: number) => 10 + (1 - (v - lo) / span) * (H - 20);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(''); const last = pts[pts.length - 1].v; const col = last >= 0 ? 'var(--up)' : 'var(--down)';
  const tm = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(11, 16);
  return <div style={{ marginTop: 10 }}>
    <div className="chart-plot" style={{ height: 130, cursor: 'default' }} role="img" aria-label={`Today's profit and loss from ${tm(t0)} to ${tm(t1)}: ${money(last)} now`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line2)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /><path d={line} fill="none" stroke={col} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
      <span className="c-last" style={{ top: `${(y(last) / H) * 100}%`, background: col }}>{money(last)}</span>
    </div>
    <div className="row between small mute num" style={{ marginTop: 4 }}><span>{tm(t0)}</span><span>today, 5-minute</span><span>{tm(t1)}</span></div></div>;
}

/** One position's road: the stop on the left, the entry, the two targets to the right, and where the price is now. Scaled to those five numbers only. */
function Road({ l }: { l: Line }) {
  const pts = [l.stop, l.entry, l.last, ...(l.t1 != null ? [l.t1] : []), ...(l.t2 != null ? [l.t2] : [])]; const lo = Math.min(...pts), hi = Math.max(...pts); const w = hi > lo ? hi - lo : 1;
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / w) * 100))}%`;
  return <div className="road" role="img" aria-label={`Stop ${inr(l.stop)}, entry ${inr(l.entry)}, now ${inr(l.last)}${l.t1 != null ? `, first target ${inr(l.t1)}` : ''}${l.t2 != null ? `, second target ${inr(l.t2)}` : ''}`}>
    <i className="seg lose" style={{ left: at(l.stop), width: `calc(${at(l.entry)} - ${at(l.stop)})` }} />
    {l.t2 != null && <i className="seg win" style={{ left: at(l.entry), width: `calc(${at(l.t2)} - ${at(l.entry)})` }} />}
    <b className="mk stop" style={{ left: at(l.stop) }} /><b className="mk ent" style={{ left: at(l.entry) }} />
    {l.t1 != null && <b className="mk tgt" style={{ left: at(l.t1) }} />}{l.t2 != null && <b className="mk tgt" style={{ left: at(l.t2) }} />}
    <b className={`mk now ${l.pnl >= 0 ? 'up' : 'dn'}`} style={{ left: at(l.last) }} />
    <span className="lbl l">{inr0(l.stop)}</span>{l.t2 != null && <span className="lbl r">{inr0(l.t2)}</span>}
  </div>;
}

export function Live() {
  const s = useAppState(); const scr = useScreen(); const auto = useAutoBook(true); const own = useLiveBook(true);
  const [key, setKey] = useState<Key>('pnl'); const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const dupOf = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf);
  const rows: BookRow[] = useMemo(() => [...auto.rows, ...own.rows.filter((r) => !dupOf(r.p) && !ENGINES.some((e) => e.id === r.p.engine && e.retired))], [auto.rows, own.rows, auto.plan]);   // eslint-disable-line react-hooks/exhaustive-deps
  const ls = useMemo(() => lines(rows), [rows]); const tot = useMemo(() => totals(ls), [ls]); const curve = useMemo(() => dayCurve(rows), [rows]);
  const sectorOf = (sym: string) => scr.data?.rows.find((r) => r.sym === sym)?.sector ?? null;
  const closes = { ...(own.bars.data?.bars ?? {}), ...(auto.bars.data?.bars ?? {}) };
  const risk = useMemo(() => riskLens(ls, sectorOf, closes), [ls, closes, scr.data]);     // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => [...ls].sort((a, b) => { if (key === 'sym') return (dir === 'asc' ? 1 : -1) * a.sym.localeCompare(b.sym); const x = a[key], y = b[key]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (dir === 'asc' ? 1 : -1) * (x - y); }), [ls, key, dir]);
  const live = auto.session.phase === 'open'; const waiting = rows.filter((r) => r.v.status === 'pending' || r.v.status === 'waiting').length;
  const sort = (k: Key) => { if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setKey(k); setDir(k === 'toStop' || k === 'sym' ? 'asc' : 'desc'); } };
  if (!rows.length && !auto.ledger.loading) return <div><PageBar title="Live P&L" onBack /><Empty title="No paper position yet">When the first pick enters at its next open, it appears here with its own live P&L.</Empty></div>;
  return <div>
    <PageBar title="Live P&L" onBack sub={<><span className={live ? 'up' : ''}>{auto.session.label}</span> · {auto.session.detail}</>} />
    <section className={`card hero${live ? ' livecard' : ''}`}>
      <div className="row between"><LiveBadge live={live} label={live ? 'LIVE' : auto.session.label} /><span className="small mute"><Observed sec={auto.intra.obs} err={auto.intra.err} loading={auto.intra.loading} /></span></div>
      <div className="row between" style={{ alignItems: 'flex-end', marginTop: 10 }}>
        <div><div className="k">Open P&L (paper)</div><div className={`num amt ${tone(tot.pnl)}`} style={{ font: '700 1.75rem/1.1 var(--mono)' }}><Tick v={ls.length ? tot.pnl : null}>{ls.length ? money(tot.pnl) : '—'}</Tick></div>
          <div className={`small num ${tone(tot.pct)}`}>{tot.pct == null ? '' : `${pct(tot.pct)} on ${inr0(tot.cost)} invested`}</div></div>
        <div style={{ textAlign: 'right' }}><div className="k">{live ? 'Today' : 'Last session'}</div><div className={`num amt ${tone(tot.dayPnl)}`} style={{ font: '600 1.125rem/1.2 var(--mono)' }}><Tick v={tot.dayPnl}>{money(tot.dayPnl)}</Tick></div></div></div>
      <DayChart pts={curve} />
      <div className="row between small dim num" style={{ marginTop: 10 }}><span>{tot.open} open · {waiting} waiting for an open</span><span className="amt">value {inr0(tot.value)}</span></div>
      {tot.best && tot.worst && ls.length > 1 && <div className="row between small num" style={{ marginTop: 6 }}><span>Best <b>{tot.best.sym}</b> <span className={tone(tot.best.pnl)}>{money(tot.best.pnl)}</span></span><span>Worst <b>{tot.worst.sym}</b> <span className={tone(tot.worst.pnl)}>{money(tot.worst.pnl)}</span></span></div>}
      {auto.intra.err && <p className="small down" style={{ margin: '8px 0 0' }}>Live prices are unavailable: {auto.intra.err}. {own.bars.data || auto.bars.data ? 'Showing the last daily bars.' : 'Nothing is estimated in their place.'}</p>}
    </section>

    {ls.length > 0 && <><Head aside={<span className="small mute">stop · entry · targets</span>}>Positions</Head>
      <div className="poscards">{sorted.map((l: Line) => <a key={l.id} href={`#/c/${l.sym}`} className={`poscard ${l.pnl >= 0 ? 'win' : 'lose'}`}>
        <div className="row between"><b>{l.sym}</b><span className="tag">{styleDef(l.style).label}</span></div>
        <div className={`num amt big ${tone(l.pnl)}`}>{money(l.pnl)} <span className="small">{pct(l.pct)}</span></div>
        <Road l={l} />
        <div className="row between small mute num"><span>{inr(l.entry)} in</span><span>{l.live ? 'live' : 'close'} {inr(l.last)}</span></div>
      </a>)}</div></>}
    {waiting > 0 && <p className="small dim" style={{ margin: '10px 0 0' }}>Waiting ({waiting}): {rows.filter((r) => r.v.status === 'pending' || r.v.status === 'waiting').map((r) => r.p.sym).join(', ')}. {rows.some((r) => r.v.status === 'waiting') ? 'A name with no price history yet stays out of the P&L rather than being guessed.' : 'These enter at the next session\'s open, or at the first session whose daily bar is published.'}</p>}

    <Head aside={<span className="small mute">tap a heading to sort</span>}>Blotter</Head>
    {ls.length ? <div className="stbl-wrap"><table className="stbl"><caption className="sr">Open paper positions with live profit and loss. Tap a column heading to sort.</caption>
      <thead><tr><th scope="col" className="sticky"><button onClick={() => sort('sym')} aria-label="Sort by symbol">SYMBOL{key === 'sym' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th><th scope="col">QTY</th><th scope="col">ENTRY</th><th scope="col">LAST</th>
        {COLS.map((c) => <th scope="col" key={c.k} aria-sort={key === c.k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button onClick={() => sort(c.k)}>{c.h}{key === c.k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>)}<th scope="col">R</th><th scope="col">TARGETS</th></tr></thead>
      <tbody>{sorted.map((l: Line) => <tr key={l.id}>
        <th scope="row" className="sticky"><a href={`#/c/${l.sym}`}>{l.sym}</a><span className="sub2">{styleDef(l.style).label}</span></th>
        <td className="num">{Math.round(l.qty * 100) / 100}</td><td className="num">{inr(l.entry)}</td><td className="num"><Tick v={l.last}>{inr(l.last)}</Tick>{!l.live && <span className="sub2">close</span>}</td>
        <td className={`num amt ${tone(l.pnl)}`}>{money(l.pnl)}</td><td className={`num ${tone(l.pct)}`}>{pct(l.pct)}</td><td className={`num amt ${tone(l.dayPnl)}`}>{money(l.dayPnl)}</td><td className="num amt">{inr0(l.value)}</td>
        <td className="num down">{l.toStop == null ? '—' : pct(l.toStop)}<span className="sub2">{inr(l.stop)}</span></td><td className={`num ${tone(l.r)}`}>{R(l.r)}</td>
        <td className="num">{l.t1Hit ? <span className="up">T1 ✓</span> : l.toT1 != null ? <>T1 {pct(l.toT1)}</> : '—'}{l.toT2 != null && <span className="sub2">T2 {pct(l.toT2)}</span>}</td></tr>)}</tbody></table></div>
      : <div className="card dim">Nothing is open yet. {waiting} {waiting === 1 ? 'position is' : 'positions are'} waiting for the next open.</div>}

    {ls.length > 0 && <><Head>Risk lens</Head>
      <section className="card" aria-label="Risk lens">
        <div className="grid2">
          <div><div className="k">Biggest position</div><div className="num">{risk.topPosition ? `${risk.topPosition.sym} ${risk.topPosition.pct.toFixed(0)}%` : '—'}</div></div>
          <div style={{ textAlign: 'right' }}><div className="k">Biggest sector</div><div className="num">{risk.topSector ? `${risk.topSector.name} ${risk.topSector.pct.toFixed(0)}%` : '—'}</div></div>
          <div><div className="k">Effective bets</div><div className="num">{risk.effectiveBets ?? '—'} <span className="mute small">of {ls.length}</span></div></div>
          <div style={{ textAlign: 'right' }}><div className="k">Moved together</div><div className="num">{risk.avgCorrelation == null ? '—' : risk.avgCorrelation.toFixed(2)}</div></div>
          <div><div className="k">Worst day, {risk.sessions || '—'} sessions</div><div className={`num ${tone(risk.worstDay)}`}>{risk.worstDay == null ? '—' : pct(risk.worstDay)}</div></div>
          <div style={{ textAlign: 'right' }}><div className="k">1 day in 20 was worse than</div><div className={`num ${tone(risk.badDay)}`}>{risk.badDay == null ? '—' : pct(risk.badDay)}</div></div></div>
        <p className="small dim" style={{ margin: '10px 0 0' }}>{risk.effectiveBets != null && risk.effectiveBets < ls.length * 0.6 ? `The book behaves like ${risk.effectiveBets} equal positions, not ${ls.length}: a few names carry most of the weight. ` : ''}{risk.avgCorrelation != null && risk.avgCorrelation > 0.5 ? 'These names have been moving together, so owning many of them diversifies less than it looks. ' : ''}{risk.sessions ? `The last ${risk.sessions} sessions applied to today's weights. ` : 'Daily history for every name is needed (40 shared sessions) before the day figures can be drawn. '}This describes the past of this book. It is not a forecast, and paper money is not real.</p>
      </section></>}
    <p className="mute small" style={{ marginTop: 12 }}>Costs ({auto.cost}% round trip) and slippage are inside every P&L. A figure labelled "close" is the last close, not a live print.</p>
  </div>;
}
