import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useChart } from '../data.ts';
import { RANGES, compareSeries, dateLabel, downsample, geometry, geometryPair, monthly, nearest, sliceRange, stats, type Pt, type RangeId } from '../chart.ts';
import { inr, pct } from '../fmt.ts';

/** Price history: simple on purpose. One line, five ranges, daily or monthly, linear or log. Hover, touch or arrow keys scrub it.
 *  The line draws itself once per change (and not at all with reduced motion). Numbers never count up. */
export function PriceChart({ sym, fmt, name }: { sym: string; fmt?: (v: number) => string; name?: string }) {
  const f = fmt ?? ((v: number) => inr(v)); const instrument = !!fmt;      // an index, metal, currency or coin: no Nifty line, no adjustment note
  const feed = useChart(sym); const gid = useId().replace(/:/g, '');
  const [range, setRange] = useState<RangeId>('10Y'); const [view, setView] = useState<'daily' | 'monthly'>('daily'); const [log, setLog] = useState(false); const [vs, setVs] = useState(false);
  const [cur, setCur] = useState<number | null>(null); const box = useRef<HTMLDivElement>(null);
  const all: Pt[] = useMemo(() => (feed.data ? feed.data.t.map((t, i) => ({ t, c: feed.data!.c[i], n: feed.data!.n ? feed.data!.n[i] : null })) : []), [feed.data]);
  const hasNifty = !!feed.data?.n && !instrument;
  const win = useMemo(() => sliceRange(all, range), [all, range]);
  // monthly keeps the window's true first day as its start, so the return in the header is the return the line shows
  const shown = useMemo(() => (view === 'monthly' ? (win.pts.length ? [win.pts[0], ...monthly(win.pts).filter((p) => p.t > win.pts[0].t)] : []) : downsample(win.pts, 700)), [win, view]);
  const cmp = useMemo(() => (vs && hasNifty ? compareSeries(shown) : null), [vs, hasNifty, shown]);
  const plot = cmp ? cmp.a : shown;                       // what the x axis and the scrubber run along
  const geo = useMemo(() => (cmp ? null : geometry(shown, log)), [cmp, shown, log]);
  const pair = useMemo(() => (cmp ? geometryPair(cmp.a, cmp.b, log) : null), [cmp, log]);
  const st = useMemo(() => stats(win.pts), [win]);
  const up = !st || st.ret >= 0; const color = up ? 'var(--up)' : 'var(--down)';
  const i = cur == null ? null : Math.min(cur, plot.length - 1); const p = i == null ? null : shown[(cmp ? shown.length - plot.length : 0) + i];
  const fromStart = p && st ? (p.c / st.first.c - 1) * 100 : null;
  const cmpA = cmp && i != null ? cmp.a[i].c - 100 : null, cmpB = cmp && i != null ? cmp.b[i].c - 100 : null;
  const text = p ? (cmp ? `${dateLabel(p.t, view === 'monthly')}, ${sym} ${pct(cmpA)}, Nifty ${pct(cmpB)} since the start` : `${dateLabel(p.t, view === 'monthly')}, ${f(p.c)}, ${pct(fromStart)} from the start of the window`) : '';
  const at = (e: PointerEvent) => { const r = box.current!.getBoundingClientRect(); setCur(nearest(plot, (e.clientX - r.left) / r.width)); };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1; const cc = i ?? plot.length - 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCur(Math.max(0, cc - step)); } else if (e.key === 'ArrowRight') { e.preventDefault(); setCur(Math.min(plot.length - 1, cc + step)); }
    else if (e.key === 'Home') { e.preventDefault(); setCur(0); } else if (e.key === 'End') { e.preventDefault(); setCur(plot.length - 1); } else if (e.key === 'Escape') setCur(null);
  };
  if (feed.loading) return <div className="card chart" aria-busy="true"><div className="sk" style={{ height: 22, width: '45%', marginBottom: 12 }} /><div className="sk" style={{ height: 200 }} /><span className="sr">Loading price history</span></div>;
  if (feed.err || !feed.data || all.length < 30) return <div className="card chart"><b>Price history</b><p className="dim small" style={{ margin: '6px 0 10px' }}>{feed.err === 'not published' || feed.err === 'no price history for this symbol' ? 'No price history is held for this symbol.' : feed.data ? 'Too little history to draw.' : `Could not load the price history${feed.err ? ` (${feed.err})` : ''}. Nothing is drawn in its place.`}</p><button className="btn sm" onClick={feed.retry}>Try again</button></div>;
  const yrs = st ? (st.years >= 1.5 ? `${st.years.toFixed(st.years >= 10 ? 0 : 1)} years` : `${Math.round(st.years * 12)} months`) : '';
  return <section className="card chart" aria-label="Price history">
    <div className="chart-head" aria-live="off">
      {p && cmp ? <><div className="k">{dateLabel(p.t, view === 'monthly')}</div><div className="num chart-big"><span className={(cmpA ?? 0) >= 0 ? 'up' : 'down'}>{pct(cmpA)}</span></div><div className="small num dim">{sym} · Nifty <b style={{ color: 'var(--tx)' }}>{pct(cmpB)}</b> over the same days</div></>
        : p ? <><div className="k">{dateLabel(p.t, view === 'monthly')}</div><div className="num chart-big">{f(p.c)}</div><div className={`num small ${fromStart != null && fromStart >= 0 ? 'up' : 'down'}`}>{pct(fromStart)} since the start of this window</div></>
        : cmp ? <><div className="k">{range === 'Max' || !win.covers ? 'Since listing in this data' : `Last ${range === '1Y' ? 'year' : range.replace('Y', ' years')}`} · against the Nifty</div><div className={`num chart-big ${cmp.diff >= 0 ? 'up' : 'down'}`}>{cmp.diff >= 0 ? '+' : '−'}{Math.abs(cmp.diff).toFixed(1)} pts</div><div className="small dim num">{sym} {pct(cmp.stock)} · Nifty {pct(cmp.nifty)}</div></>
        : st ? <><div className="k">{range === 'Max' || !win.covers ? 'Since listing in this data' : `Last ${range === '1Y' ? 'year' : range.replace('Y', ' years')}`}</div><div className={`num chart-big ${up ? 'up' : 'down'}`}>{pct(st.ret, 1)}</div>
          <div className="small dim num">{yrs}{st.cagr != null ? ` · ${pct(st.cagr, 1)} a year` : ''}</div></> : null}
    </div>
    <div ref={box} className="chart-plot" tabIndex={0} role="slider" aria-label={`${sym} price, ${range}, ${view}. Use the arrow keys to move along the line.`} aria-valuemin={0} aria-valuemax={Math.max(0, plot.length - 1)} aria-valuenow={i ?? plot.length - 1} aria-valuetext={text || 'Latest close'}
      onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCur(null); }} onKeyDown={key} onBlur={() => setCur(null)} style={{ touchAction: 'pan-y' }}>
      {pair && <svg viewBox={`0 0 ${pair.W} ${pair.H}`} preserveAspectRatio="none" aria-hidden="true">
        <g key={`${sym}${range}${view}${log}vs`}>
          <path className="c-line" d={pair.lineB} pathLength={1} fill="none" stroke="var(--dim)" strokeWidth="1.8" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" style={{ strokeDasharray: '5 5', animation: 'none', strokeDashoffset: 0 }} />
          <path className="c-line" d={pair.lineA} pathLength={1} fill="none" stroke={color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {i != null && <line x1={pair.xs[i]} x2={pair.xs[i]} y1="0" y2={pair.H} stroke="var(--tx)" strokeOpacity=".35" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>}
      {pair && i != null && <><span className="c-dot" style={{ left: `${(pair.xs[i] / pair.W) * 100}%`, top: `${(pair.ysA[i] / pair.H) * 100}%`, background: color }} /><span className="c-dot" style={{ left: `${(pair.xs[i] / pair.W) * 100}%`, top: `${(pair.ysB[i] / pair.H) * 100}%`, background: 'var(--dim)' }} /></>}
      {geo && <svg viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={up ? '#c8f23c' : '#ff9a6c'} stopOpacity=".28" /><stop offset="1" stopColor={up ? '#c8f23c' : '#ff9a6c'} stopOpacity="0" /></linearGradient></defs>
        <g key={`${sym}${range}${view}${log}`}>
          <path className="c-area" d={geo.area} fill={`url(#g${gid})`} />
          <path className="c-line" d={geo.line} pathLength={1} fill="none" stroke={color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {i != null && <line x1={geo.xs[i]} x2={geo.xs[i]} y1="0" y2={geo.H} stroke="var(--tx)" strokeOpacity=".35" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>}
      {geo && i != null && <span className="c-dot" style={{ left: `${(geo.xs[i] / geo.W) * 100}%`, top: `${(geo.ys[i] / geo.H) * 100}%`, background: color }} />}
    </div>
    {st && <div className="row between small dim num" style={{ marginTop: 6 }}><span>{dateLabel(st.first.t, view === 'monthly')}</span><span>{dateLabel(st.last.t, view === 'monthly')}</span></div>}
    <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Range">{RANGES.map((r) => <button key={r.id} className="chip" aria-pressed={range === r.id} onClick={() => { setRange(r.id); setCur(null); }}>{r.id}</button>)}</div>
    <div className="row" style={{ marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
      <div className="mini-seg" role="group" aria-label="Detail">{(['daily', 'monthly'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => { setView(v); setCur(null); }}>{v === 'daily' ? 'Daily' : 'Monthly'}</button>)}</div>
      {!instrument && <div className="mini-seg" role="group" aria-label="Compare">{([false, true] as const).map((v) => <button key={String(v)} aria-pressed={vs === v} disabled={v && !hasNifty} title={v && !hasNifty ? 'The Nifty could not be read' : undefined} onClick={() => { setVs(v); setCur(null); }}>{v ? 'vs Nifty' : 'Price'}</button>)}</div>}
      <div className="mini-seg" role="group" aria-label="Scale">{([false, true] as const).map((l) => <button key={String(l)} aria-pressed={log === l} onClick={() => setLog(l)}>{l ? 'Log' : 'Linear'}</button>)}</div>
    </div>
    <p className="small dim" style={{ margin: '8px 0 0' }}>{log
      ? 'Log scale: equal steps are equal percentage moves, so 100 to 200 looks the same as 200 to 400. Best for long ranges, where a rise from 20 to 100 would otherwise squash everything before it flat.'
      : `Linear scale: equal steps are equal amounts of price. Best for short ranges.${st && st.hi.c / Math.max(st.lo.c, 1e-9) >= 3 ? ' This window moved more than threefold, so older moves look small here; Log shows them in proportion.' : ''}`}</p>
    {cmp && <div className="row small" style={{ gap: 14, marginTop: 8, flexWrap: 'wrap' }}><span><span className="c-key" style={{ background: color }} />{sym}</span><span><span className="c-key dashed" />Nifty 50</span><span className="mute">both indexed to 100</span></div>}
    {cmp?.trimmed && <p className="small down" style={{ margin: '8px 0 0' }}>Nifty data starts {dateLabel(cmp.from.t)}, so the comparison starts there.</p>}
    {st && !cmp && <div className="row between small num" style={{ marginTop: 10 }}><span className="dim">Low <b style={{ color: 'var(--tx)' }}>{f(st.lo.c)}</b> · {dateLabel(st.lo.t, true)}</span><span className="dim">High <b style={{ color: 'var(--tx)' }}>{f(st.hi.c)}</b> · {dateLabel(st.hi.t, true)}</span></div>}
    {!win.covers && range !== 'Max' && <p className="small down" style={{ margin: '8px 0 0' }}>History in this data starts {dateLabel(all[0].t)}, so {range} shows all of it.</p>}
    <p className="mute small" style={{ margin: '8px 0 0' }}>{instrument ? `Daily closes from Yahoo Finance for ${name ?? sym}. Futures contracts roll to the next month, which can leave a small step in the line.` : 'Daily closes from Yahoo Finance, adjusted for splits and bonuses, not for dividends. The Nifty line is the index price, without dividends, like the stock.'} Past prices say nothing certain about future ones.</p>
    {shown.length > 1 && (() => { const hi = shown.reduce((a, b) => (b.c > a.c ? b : a)), lo = shown.reduce((a, b) => (b.c < a.c ? b : a)), a0 = shown[0], z = shown[shown.length - 1];
      return <details className="ev" style={{ marginTop: 8 }}><summary>The same chart as a table<span className="chev">▾</span></summary><div className="body"><table className="tbl" style={{ width: '100%' }}><caption className="sr">Key points of the {range} {view} chart for {sym}</caption><thead><tr><th scope="col" style={{ textAlign: 'left' }}>Point</th><th scope="col" style={{ textAlign: 'left' }}>Date</th><th scope="col" style={{ textAlign: 'right' }}>Price</th></tr></thead><tbody>
        <tr><th scope="row" style={{ textAlign: 'left' }}>First in window</th><td>{dateLabel(a0.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(a0.c)}</td></tr>
        <tr><th scope="row" style={{ textAlign: 'left' }}>Highest close</th><td>{dateLabel(hi.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(hi.c)}</td></tr>
        <tr><th scope="row" style={{ textAlign: 'left' }}>Lowest close</th><td>{dateLabel(lo.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(lo.c)}</td></tr>
        <tr><th scope="row" style={{ textAlign: 'left' }}>Latest close</th><td>{dateLabel(z.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(z.c)}</td></tr></tbody></table></div></details>; })()}
  </section>;
}
