import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useChart } from '../data.ts';
import { RANGES, dateLabel, downsample, geometry, monthly, nearest, sliceRange, stats, type Pt, type RangeId } from '../chart.ts';
import { inr, pct } from '../fmt.ts';

/** Price history: simple on purpose. One line, five ranges, daily or monthly, linear or log. Hover, touch or arrow keys scrub it.
 *  The line draws itself once per change (and not at all with reduced motion). Numbers never count up. */
export function PriceChart({ sym }: { sym: string }) {
  const feed = useChart(sym); const gid = useId().replace(/:/g, '');
  const [range, setRange] = useState<RangeId>('10Y'); const [view, setView] = useState<'daily' | 'monthly'>('daily'); const [log, setLog] = useState(false);
  const [cur, setCur] = useState<number | null>(null); const box = useRef<HTMLDivElement>(null);
  const all: Pt[] = useMemo(() => (feed.data ? feed.data.t.map((t, i) => ({ t, c: feed.data!.c[i] })) : []), [feed.data]);
  const win = useMemo(() => sliceRange(all, range), [all, range]);
  const shown = useMemo(() => (view === 'monthly' ? monthly(win.pts) : downsample(win.pts, 700)), [win, view]);
  const geo = useMemo(() => geometry(shown, log), [shown, log]);
  const st = useMemo(() => stats(win.pts), [win]);
  const up = !st || st.ret >= 0; const color = up ? 'var(--lime)' : 'var(--peach)';
  const i = cur == null ? null : Math.min(cur, shown.length - 1); const p = i == null ? null : shown[i];
  const fromStart = p && st ? (p.c / st.first.c - 1) * 100 : null;
  const text = p ? `${dateLabel(p.t, view === 'monthly')}, ${inr(p.c)}, ${pct(fromStart)} from the start of the window` : '';
  const at = (e: PointerEvent) => { const r = box.current!.getBoundingClientRect(); setCur(nearest(shown, (e.clientX - r.left) / r.width)); };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1; const cc = i ?? shown.length - 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCur(Math.max(0, cc - step)); } else if (e.key === 'ArrowRight') { e.preventDefault(); setCur(Math.min(shown.length - 1, cc + step)); }
    else if (e.key === 'Home') { e.preventDefault(); setCur(0); } else if (e.key === 'End') { e.preventDefault(); setCur(shown.length - 1); } else if (e.key === 'Escape') setCur(null);
  };
  if (feed.loading) return <div className="card chart" aria-busy="true"><div className="sk" style={{ height: 22, width: '45%', marginBottom: 12 }} /><div className="sk" style={{ height: 200 }} /><span className="sr">Loading price history</span></div>;
  if (feed.err || !feed.data || all.length < 30) return <div className="card chart"><b>Price history</b><p className="dim small" style={{ margin: '6px 0 10px' }}>{feed.err === 'not published' || feed.err === 'no price history for this symbol' ? 'No price history is held for this symbol.' : feed.data ? 'Too little history to draw.' : `Could not load the price history${feed.err ? ` (${feed.err})` : ''}. Nothing is drawn in its place.`}</p><button className="btn sm" onClick={feed.retry}>Try again</button></div>;
  const yrs = st ? (st.years >= 1.5 ? `${st.years.toFixed(st.years >= 10 ? 0 : 1)} years` : `${Math.round(st.years * 12)} months`) : '';
  return <section className="card chart" aria-label="Price history">
    <div className="chart-head" aria-live="off">
      {p ? <><div className="k">{dateLabel(p.t, view === 'monthly')}</div><div className="num chart-big">{inr(p.c)}</div><div className={`num small ${fromStart != null && fromStart >= 0 ? 'up' : 'down'}`}>{pct(fromStart)} since the start of this window</div></>
        : st ? <><div className="k">{range === 'Max' || !win.covers ? 'Since listing in this data' : `Last ${range === '1Y' ? 'year' : range.replace('Y', ' years')}`}</div><div className={`num chart-big ${up ? 'up' : 'down'}`}>{pct(st.ret, 1)}</div>
          <div className="small dim num">{yrs}{st.cagr != null ? ` · ${pct(st.cagr, 1)} a year` : ''}</div></> : null}
    </div>
    <div ref={box} className="chart-plot" tabIndex={0} role="slider" aria-label={`${sym} price, ${range}, ${view}. Use the arrow keys to move along the line.`} aria-valuemin={0} aria-valuemax={Math.max(0, shown.length - 1)} aria-valuenow={i ?? shown.length - 1} aria-valuetext={text || 'Latest close'}
      onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCur(null); }} onKeyDown={key} onBlur={() => setCur(null)} style={{ touchAction: 'pan-y' }}>
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
    <div className="row between" style={{ marginTop: 6, gap: 8 }}>
      <div className="mini-seg" role="group" aria-label="Detail">{(['daily', 'monthly'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => { setView(v); setCur(null); }}>{v === 'daily' ? 'Daily' : 'Monthly'}</button>)}</div>
      <div className="mini-seg" role="group" aria-label="Scale">{([false, true] as const).map((l) => <button key={String(l)} aria-pressed={log === l} onClick={() => setLog(l)}>{l ? 'Log' : 'Linear'}</button>)}</div>
    </div>
    {st && <div className="row between small num" style={{ marginTop: 10 }}><span className="dim">Low <b style={{ color: 'var(--tx)' }}>{inr(st.lo.c)}</b> · {dateLabel(st.lo.t, true)}</span><span className="dim">High <b style={{ color: 'var(--tx)' }}>{inr(st.hi.c)}</b> · {dateLabel(st.hi.t, true)}</span></div>}
    {!win.covers && range !== 'Max' && <p className="small down" style={{ margin: '8px 0 0' }}>History in this data starts {dateLabel(all[0].t)}, so {range} shows all of it.</p>}
    <p className="mute small" style={{ margin: '8px 0 0' }}>Daily closes from Yahoo Finance, adjusted for splits and bonuses, not for dividends. Log scale shows percentage moves evenly. Past prices say nothing certain about future ones.</p>
  </section>;
}
