import { QuestionOrb } from '../components/QuestionOrb.tsx';
import { PositionTime } from '../components/PositionTime.tsx';
import { useId, useMemo, useState } from 'react';
import { useAppState } from '../app.tsx';
import { useAutoBook, useLiveBook, type BookRow } from '../book.ts';
import { SLOW_DOWN, useScreen } from '../data.ts';
import { dayCurve, lines, riskLens, totals, type Line } from '../blotter.ts';
import { styleDef } from '../exits.ts';
import { ENGINES } from '../quant.ts';
import { inr, inr0, pct } from '../fmt.ts';
import { LiveBadge, Observed, Tick } from '../live.tsx';
import { freshestPrint, quoteWord } from '../stamp.ts';
import { wordTick } from '../tickbasis.ts';
import { Empty } from '../ui.tsx';
import { Head, PageBar } from './common.tsx';
import { snapshotOf, OPEN_TRADE_LABEL } from '../ledgerview.ts';
import { TrustRow, TotalRow } from './pnlstrip.tsx';

const money = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${inr0(Math.abs(v))}`);
const tone = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const R = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`);
const sessionDay = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
type Key = 'pnl' | 'pct' | 'dayPnl' | 'value' | 'toStop' | 'sym';
const COLS: { k: Key; h: string }[] = [{ k: 'pnl', h: 'P&L' }, { k: 'pct', h: '%' }, { k: 'dayPnl', h: 'TODAY' }, { k: 'value', h: 'VALUE' }, { k: 'toStop', h: 'TO STOP' }];

/** The day's P&L as a line against a zero rule. Drawn at the phone's width, with the last value tagged. */
function DayChart({ pts }: { pts: { t: number; v: number }[] }) {
  const gradient = useId();
  if (pts.length < 3) return <div className="live-chart-empty"><strong>A chart needs a complete price series.</strong><span>Intraday history is unavailable. The dated position values remain below; no line is estimated.</span></div>;
  const W = 1000, H = 260; const lo = Math.min(0, ...pts.map((p) => p.v)), hi = Math.max(0, ...pts.map((p) => p.v)); const span = hi - lo || 1; const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W, y = (v: number) => 10 + (1 - (v - lo) / span) * (H - 20);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(''); const last = pts[pts.length - 1].v; const col = last >= 0 ? 'var(--up)' : 'var(--down)';
  const tm = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(11, 16);
  return <div style={{ marginTop: 10 }}>
    <div className="chart-plot" style={{ cursor: 'default' }} role="img" aria-label={`Remaining-position price movement on ${sessionDay(t1)} from ${tm(t0)} to ${tm(t1)}: ${money(last)}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity=".18" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs><path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${gradient})`} /><line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line2)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /><path d={line} fill="none" stroke={col} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>
      <span className="c-last" style={{ top: `${(y(last) / H) * 100}%`, background: col }}>{money(last)}</span>
    </div>
    <div className="row between small mute num" style={{ marginTop: 4 }}><span>{tm(t0)}</span><span>{sessionDay(t1)} · 5-minute · IST</span><span>{tm(t1)}</span></div></div>;
}

/** One position's road: the stop on the left, the entry, the two targets to the right, and where the price is now. Scaled to those five numbers only. */
function Road({ l }: { l: Line }) {
  const pts = [l.stop, l.entry, l.last, ...(l.t1 != null ? [l.t1] : []), ...(l.t2 != null ? [l.t2] : [])]; const lo = Math.min(...pts), hi = Math.max(...pts); const w = hi > lo ? hi - lo : 1;
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / w) * 100))}%`;
  return <div className="road" role="img" aria-label={`Stop ${inr(l.stop)}, entry ${inr(l.entry)}, now ${inr(l.last)}${l.t1 != null ? `, ${l.ref ? 'reference first level' : 'first target'} ${inr(l.t1)}` : ''}${l.t2 != null ? `, ${l.ref ? 'reference second level' : 'second target'} ${inr(l.t2)}` : ''}`}>
    <i className="seg lose" style={{ left: at(l.stop), width: `calc(${at(l.entry)} - ${at(l.stop)})` }} />
    {l.t2 != null && <i className={`seg win${l.ref ? ' ref' : ''}`} style={{ left: at(l.entry), width: `calc(${at(l.t2)} - ${at(l.entry)})` }} />}
    <b className="mk stop" style={{ left: at(l.stop) }} /><b className="mk ent" style={{ left: at(l.entry) }} />
    {l.t1 != null && <b className={`mk tgt${l.ref ? ' ref' : ''}`} style={{ left: at(l.t1) }} />}{l.t2 != null && <b className={`mk tgt${l.ref ? ' ref' : ''}`} style={{ left: at(l.t2) }} />}
    <b className={`mk now ${l.pnl >= 0 ? 'up' : 'dn'}`} style={{ left: at(l.last) }} />
    <span className="lbl l">{inr0(l.stop)}</span>{l.t2 != null && <span className="lbl r">{inr0(l.t2)}</span>}
  </div>;
}

export function Live() {
  const s = useAppState(); const scr = useScreen(); const auto = useAutoBook(true); const own = useLiveBook(true);
  const [asking, setAsking] = useState(false); const [question, setQuestion] = useState('What contributes to open-trade P&L?');
  const [key, setKey] = useState<Key>('pnl'); const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const dupOf = (p: { sym: string; engine: string; asOf: string }) => !!auto.plan?.taken.some((t) => t.pick.sym === p.sym && t.pick.engine === p.engine && t.pick.asOf === p.asOf);
  const rows: BookRow[] = useMemo(() => [...auto.rows, ...own.rows.filter((r) => !dupOf(r.p) && !ENGINES.some((e) => e.id === r.p.engine && e.retired))], [auto.rows, own.rows, auto.plan]);   // eslint-disable-line react-hooks/exhaustive-deps
  const hasOwn = rows.some((r) => !auto.rows.includes(r));
  const snap = snapshotOf(rows.map((r) => ({ p: r.p, v: r.v, dayPnl: r.dayPnl, markT: r.markT, owner: auto.rows.includes(r) ? 'engine' as const : 'you' as const })), auto.cost, auto.ledger.data?.ledger.updated ?? null);   // ONE snapshot for this page
  const ls = useMemo(() => lines(rows), [rows]); const tot = useMemo(() => totals(ls), [ls]); const curve = useMemo(() => {
    const open = rows.filter((r) => r.v.status === 'open');
    // A subset or mixed sessions cannot stand in for a portfolio curve.
    if (!open.length || open.some((r) => r.v.dataNote || !r.q || r.q.t.length < 3 || r.v.entry == null)) return [];
    const dates = new Set(open.flatMap((r) => r.q!.t.map(sessionDay)));
    return dates.size === 1 ? dayCurve(open) : [];
  }, [rows]);
  const curveLast = curve.length ? curve[curve.length - 1].v : null;
  const sectorOf = (sym: string) => scr.data?.rows.find((r) => r.sym === sym)?.sector ?? null;
  const closes = { ...(own.bars.data?.bars ?? {}), ...(auto.bars.data?.bars ?? {}) };
  const risk = useMemo(() => riskLens(ls, sectorOf, closes), [ls, closes, scr.data]);     // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => [...ls].sort((a, b) => { if (key === 'sym') return (dir === 'asc' ? 1 : -1) * a.sym.localeCompare(b.sym); const x = a[key], y = b[key]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (dir === 'asc' ? 1 : -1) * (x - y); }), [ls, key, dir]);
  const live = auto.session.phase === 'open'; const word = quoteWord(freshestPrint([auto.intra.obs, own.intra.obs]), Date.now(), { loading: (auto.intra.loading || own.intra.loading) && !auto.intra.err }); const waiting = rows.filter((r) => r.v.status === 'pending' || r.v.status === 'waiting').length;
  const sort = (k: Key) => { if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setKey(k); setDir(k === 'toStop' || k === 'sym' ? 'asc' : 'desc'); } };
  if (!rows.length && !auto.ledger.loading) return <div><PageBar title="Paper P&L" onBack /><Empty title="No paper position yet">When the first pick enters at its next open, it appears here with its own live P&L.</Empty></div>;
  return <div>
    <PageBar title="Paper P&L" onBack sub={<><span className={live ? 'up' : ''}>{auto.session.label}</span> · {auto.session.detail}</>} />
    <div className="live-overview">
      <section className="live-value l4-live" aria-label="Paper portfolio snapshot" data-snapshot={snap.id}>
        {/* 12 Nov 2026 (Tripwire 2.0, 2.1 and 3.1): the heading names the scope; the answer is Total P&L; the remaining value is supporting; quote freshness and exit verification are two statuses */}
        <h2 data-scope-name>{hasOwn ? 'Engine paper book and my paper plans' : 'Engine paper book'}</h2>
        <TrustRow snap={snap} scope="engine" onScope={() => {}} hasMine={false} throughWord={null} priceWord={word} />
        <TotalRow snap={snap} dayLabel={live ? 'Today' : 'Last session'} />
        <dl><div><dt>{OPEN_TRADE_LABEL}</dt><dd className={`amt ${tone(tot.pnl)}`}>{ls.length ? money(tot.pnl) : '—'}</dd></div>
          <div><dt>Open position value</dt><dd className="amt">{ls.length ? inr0(tot.value) : '—'}</dd></div>
          <div><dt>Positions</dt><dd>{tot.open} open · {waiting} awaiting entry</dd></div></dl>
      </section>
      <section className="live-performance" aria-label="Session performance">
        <div className="row between"><h2>Session performance</h2><span className="small mute">Remaining positions · ₹</span></div>
        <div className={`num amt ${tone(curveLast)}`} style={{ fontSize: '1.75rem' }}>{money(curveLast)}</div>
        <DayChart pts={curve} />
        <p className="small mute">Price movement × remaining quantity, from the previous close (entry price for fills that session). Excludes fees and booked exits; it differs from the book’s full-session P&L.</p>
      </section>
    </div>
    {auto.intra.err && <p className="small down">{auto.intra.err === SLOW_DOWN ? `${SLOW_DOWN}: prices will refresh on their own.` : `Intraday prices unavailable: ${auto.intra.err}.`} Showing available dated daily bars.</p>}
    <section className="live-question" aria-label="Questions about your paper portfolio">
      <QuestionOrb label="Ask about the paper portfolio" expanded={asking} onClick={() => setAsking(!asking)} />
      {asking && <><div className="chips">{['What contributes to open-trade P&L?', 'Where is the concentration?', 'How is P&L calculated?'].map((q) => <button key={q} className="chip" aria-pressed={question === q} onClick={() => setQuestion(q)}>{q}</button>)}</div>
        <p aria-live="polite" className="small amt">{question === 'What contributes to open-trade P&L?' ? tot.best ? <><a href={`#/c/${tot.best.sym}`}>{tot.best.sym}</a> contributes {money(tot.best.pnl)} to the current open P&L of {money(tot.pnl)}. {tot.worst && tot.worst.id !== tot.best.id ? `${tot.worst.sym} contributes ${money(tot.worst.pnl)}. ` : ''}Basis: since entry, booked partials included. Each name contributes to that figure; none is said to have caused it.</> : 'No measured open position is available.' : question === 'Where is the concentration?' ? risk.topPosition ? <><a href={`#/c/${risk.topPosition.sym}`}>{risk.topPosition.sym}</a> is {risk.topPosition.pct.toFixed(1)}% of the measured open value. {risk.topSector ? `${risk.topSector.name} is the largest sector at ${risk.topSector.pct.toFixed(1)}%.` : ''} Weights use the displayed prices and remaining paper quantities.</> : 'Complete position values are needed to measure concentration.' : 'P&L combines booked partial exits and the remaining quantity marked at its observed price, less the recorded cost and slippage assumptions. Entry dates and observed sessions are shown on every position below. This is paper analysis, not executed returns.'}</p>
        <p className="small mute">Calculated locally from this book. Open a company to inspect the evidence.</p></>}
    </section>

    {ls.length > 0 && <><Head aside={<span className="small mute">stop · entry · targets{ls.some((l) => l.ref) ? ' (ref = shown for orientation, not traded)' : ''}</span>}>Positions</Head>
      <div className="poscards">{sorted.map((l: Line) => <a key={l.id} href={`#/c/${l.sym}`} className={`poscard ${l.pnl >= 0 ? 'win' : 'lose'}`}>
        <div className="row between"><b>{l.sym}</b><span className="tag">{styleDef(l.style).label}</span></div>
        <div className={`num amt big ${tone(l.pnl)}`}>{money(l.pnl)} <span className="small">{pct(l.pct)}</span></div>
        {(() => { const r = rows.find((r) => r.p.id === l.id); return r ? <PositionTime signal={r.p.asOf} view={r.v} /> : null; })()}
        <Road l={l} />
        {l.insight && <p className="small mute" style={{ margin: '4px 0 2px' }} data-insight>{l.insight}</p>}
        <div className="row between small mute num"><span>{inr(l.entry)} in</span><span title={l.wordDetail}>{l.word} {inr(l.last)}</span></div>
        <div className="row between small num" style={{ marginTop: 2 }}><span className="down">stop {inr0(l.stop)}</span>{l.t1 != null ? <span className={l.ref ? 'dim' : 'up'} title={l.ref ? 'Reference only: this pick was filed before profit booking began, so it exits on its stop and time limit.' : 'Profit-booking targets'}>{l.t1Hit ? 'T1 ✓ · ' : ''}T1 {inr0(l.t1)}{l.t2 != null ? ` · T2 ${inr0(l.t2)}` : ''}{l.ref ? ' (ref)' : ''}</span> : <span className="dim">no targets</span>}</div>
      </a>)}</div></>}
    {waiting > 0 && <p className="small dim" style={{ margin: '10px 0 0' }}>Awaiting entry ({waiting}): {rows.filter((r) => r.v.status === 'pending' || r.v.status === 'waiting').map((r) => r.p.sym).join(', ')}. {rows.some((r) => r.v.status === 'waiting') ? 'A name with no price history yet stays out of the P&L rather than being guessed.' : 'These enter at the next session\'s open, or at the first session whose daily bar is published.'}</p>}

    <details className="more"><summary>Full position table · sort and compare</summary>
    {ls.length ? <div className="stbl-wrap"><table className="stbl"><caption className="sr">Open paper positions with live profit and loss. Tap a column heading to sort.</caption>
      <thead><tr><th scope="col" className="sticky"><button onClick={() => sort('sym')} aria-label="Sort by symbol">SYMBOL{key === 'sym' ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th><th scope="col">QTY</th><th scope="col">ENTRY</th><th scope="col">LAST</th>
        {COLS.map((c) => <th scope="col" key={c.k} aria-sort={key === c.k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button onClick={() => sort(c.k)}>{c.h}{key === c.k ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>)}<th scope="col">R</th><th scope="col">TARGETS</th></tr></thead>
      <tbody>{sorted.map((l: Line) => <tr key={l.id}>
        <th scope="row" className="sticky"><a href={`#/c/${l.sym}`}>{l.sym}</a><span className="sub2">{styleDef(l.style).label}</span></th>
        <td className="num">{Math.round(l.qty * 100) / 100}</td><td className="num">{inr(l.entry)}</td><td className="num"><Tick v={l.last} {...wordTick(l.word)}>{inr(l.last)}</Tick>{!l.live && <span className="sub2" title={l.wordDetail}>{l.word}</span>}</td>
        <td className={`num amt ${tone(l.pnl)}`}>{money(l.pnl)}</td><td className={`num ${tone(l.pct)}`}>{pct(l.pct)}</td><td className={`num amt ${tone(l.dayPnl)}`}>{money(l.dayPnl)}</td><td className="num amt">{inr0(l.value)}</td>
        <td className="num down">{l.toStop == null ? '—' : pct(l.toStop)}<span className="sub2">{inr(l.stop)}</span></td><td className={`num ${tone(l.r)}`}>{R(l.r)}</td>
        <td className="num">{l.t1Hit ? <span className="up">T1 ✓</span> : l.t1 != null ? <span className={l.ref ? 'dim' : ''} title={l.ref ? 'Reference level, not traded' : undefined}>T1 {inr0(l.t1)}{l.toT1 != null ? ` (${pct(l.toT1)})` : ''}</span> : '—'}{l.t2 != null && <span className="sub2">T2 {inr0(l.t2)}{l.toT2 != null ? ` (${pct(l.toT2)})` : ''}{l.ref ? ' ref' : ''}</span>}</td></tr>)}</tbody></table></div>
      : <div className="card dim">Nothing is open yet. {waiting} {waiting === 1 ? 'position is' : 'positions are'} awaiting entry at the next open.</div>}

    </details>
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
    <p className="mute small" style={{ marginTop: 12 }}>Costs ({auto.cost}% round trip) and slippage are inside every P&L. A price is Live while the market is open and the price feed is current: a stock that last traded a few minutes ago keeps that trade as its live price and says when it traded. A stock with no trade yet today says "Not traded yet" and shows yesterday's close. Delayed means the feed itself has gone quiet. After the close it is Last traded, with the time of the print.</p>
  </div>;
}
