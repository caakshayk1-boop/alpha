import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useChart } from '../data.ts';
import { aggregate, compareSeries, defaultRange, drawdownSeries, pathThrough, rangeAvailability, rsiSeries, smaSeries, dateLabel, downsample, geometry, geometryPair, nearestX, sliceRange, spanWord, stats, xTicks, yTicks, type Frame, type Pt, type RangeId } from '../chart.ts';
import { inr, pct } from '../fmt.ts';
import { Radios } from '../ui.tsx';

/** Price history: simple on purpose. One line, five ranges, daily or monthly, linear or log. Hover, touch or arrow keys scrub it.
 *  The line draws itself once per change (and not at all with reduced motion). Numbers never count up. */
/** Horizontal levels for a position the reader holds: the signal close, the stop and the two targets. Drawn only when they fall inside the price range being shown. */
import type { Level } from '../levels.ts';
const compact = (v: number) => (v >= 1e7 ? `${(v / 1e7).toFixed(2)} cr` : v >= 1e5 ? `${(v / 1e5).toFixed(2)} lakh` : v.toLocaleString('en-IN'));
const FRAME_WORD: Record<Frame, string> = { daily: 'day', weekly: 'week', monthly: 'month' };
export function PriceChart({ sym, fmt, name, levels = [] }: { sym: string; fmt?: (v: number) => string; name?: string; levels?: Level[] }) {
  const f = fmt ?? ((v: number) => inr(v)); const instrument = !!fmt;      // an index, metal, currency or coin: no Nifty line, no adjustment note
  const feed = useChart(sym); const gid = useId().replace(/:/g, '');
  const [rangeSel, setRange] = useState<RangeId | null>(null); const [view, setView] = useState<Frame>('daily'); const [log, setLog] = useState(false); const [vs, setVs] = useState(false); const [ma, setMa] = useState(false); const [dd, setDd] = useState(false);
  const [kind, setKind] = useState<'line' | 'candle'>('line'); const [vol, setVol] = useState(false); const [rsi, setRsi] = useState(false);
  const [cur, setCur] = useState<number | null>(null); const box = useRef<HTMLDivElement>(null);
  const all: Pt[] = useMemo(() => (feed.data ? feed.data.t.map((t, i) => ({ t, c: feed.data!.c[i], n: feed.data!.n ? feed.data!.n[i] : null, o: feed.data!.o?.[i] ?? null, h: feed.data!.h?.[i] ?? null, l: feed.data!.l?.[i] ?? null, v: feed.data!.v?.[i] ?? null })) : []), [feed.data]);
  const range: RangeId = rangeSel ?? defaultRange(all);      // the longest range the history can fill, until the reader picks one
  const avail = useMemo(() => rangeAvailability(all), [all]); const spanYears = all.length > 1 ? (all[all.length - 1].t - all[0].t) / (365.25 * 86400) : 0;
  const hasOhlc = all.some((q) => q.o != null && q.h != null && q.l != null), hasVol = all.some((q) => q.v != null);
  const hasNifty = !!feed.data?.n && !instrument;
  const win = useMemo(() => sliceRange(all, range), [all, range]);
  // monthly keeps the window's true first day as its start, so the return in the header is the return the line shows
  // candles and volume need whole bars: a bar that was thinned out would show a volume or a range that is not the day's. When the window holds too many days for that,
  // the bars are weekly (or monthly), and the page says so beside the chart.
  const bars = (kind === 'candle' && hasOhlc) || (vol && hasVol);
  const eff: Frame = useMemo(() => { if (!bars) return view; const n = (f: Frame) => aggregate(win.pts, f).length; if (view === 'daily') return win.pts.length <= 260 ? 'daily' : n('weekly') <= 260 ? 'weekly' : 'monthly'; if (view === 'weekly') return n('weekly') <= 260 ? 'weekly' : 'monthly'; return 'monthly'; }, [bars, view, win]);
  const shown = useMemo(() => {
    if (bars) return aggregate(win.pts, eff);
    return view === 'daily' ? downsample(win.pts, 700) : (win.pts.length ? [win.pts[0], ...aggregate(win.pts, view).filter((p) => p.t > win.pts[0].t)] : []);
  }, [win, view, eff, bars]);
  const cmp = useMemo(() => (vs && hasNifty ? compareSeries(shown) : null), [vs, hasNifty, shown]);
  const plot = cmp ? cmp.a : shown;                       // what the x axis and the scrubber run along
  const candles = kind === 'candle' && hasOhlc && !cmp;
  // candles and volume bars are drawn whole: the x domain is padded by half a bar at both ends, and in candle mode the last price is tagged in a right-hand gutter, clear of the final candle
  const barsMode = !cmp && (candles || (vol && hasVol));
  const [wpx, setWpx] = useState(340); const ready = !feed.loading && !!feed.data && all.length >= 30;
  useLayoutEffect(() => { const el = box.current; if (!el) return; const set = () => { const w = el.clientWidth; if (w > 0) setWpx((x) => (Math.abs(x - w) < 1 ? x : w)); }; set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect(); }, [ready]);
  const lastLen = shown.length ? f(shown[shown.length - 1].c).length : 8;
  const gutU = candles ? Math.round((Math.min(wpx * 0.3, Math.max(54, lastLen * 6.4 + 18)) / wpx) * 1000) : 0;
  const geo = useMemo(() => (cmp ? null : geometry(shown, log, 1000, 300, 12, candles, { bars: barsMode, gutter: gutU })), [cmp, shown, log, candles, barsMode, gutU]);
  // the line draws itself on the first reveal only; later changes of range, frame or scale move the line without drawing it again
  const [revealed, setRevealed] = useState(false); useEffect(() => { if (!ready || revealed) return; const t = window.setTimeout(() => setRevealed(true), 1400); return () => window.clearTimeout(t); }, [ready, revealed]);
  const pair = useMemo(() => (cmp ? geometryPair(cmp.a, cmp.b, log) : null), [cmp, log]);
  const st = useMemo(() => stats(win.pts), [win]);
  // moving averages are computed on the whole history and looked up by time, so a 200-day line is correct from the first point of a short window
  const smaMap = useMemo(() => { if (!ma || !all.length) return null; const a50 = smaSeries(all, 50), a200 = smaSeries(all, 200); const m = new Map<number, { a: number | null; b: number | null }>(); all.forEach((q, k) => m.set(q.t, { a: a50[k], b: a200[k] })); return m; }, [ma, all]);
  // RSI is computed on the whole history in the frame shown, so the first point of a short window is already warmed up
  const rsiFull = useMemo(() => { if (!rsi) return null; const m = new Map<number, number | null>(); const a = aggregate(all, eff); rsiSeries(a.map((q) => q.c)).forEach((v, k) => m.set(a[k].t, v)); return m; }, [rsi, all, eff]);
  const rsiNow = useMemo(() => (['daily', 'weekly', 'monthly'] as Frame[]).map((fr) => { const a = aggregate(all, fr); const r = rsiSeries(a.map((q) => q.c)); return { fr, v: r.length ? r[r.length - 1] : null }; }), [all]);
  const ddv = useMemo(() => (dd && !cmp ? drawdownSeries(shown) : null), [dd, cmp, shown]);
  const up = !st || st.ret >= 0; const color = up ? 'var(--up)' : 'var(--down)';
  const i = cur == null ? null : Math.min(cur, plot.length - 1); const p = i == null ? null : shown[(cmp ? shown.length - plot.length : 0) + i];
  const fromStart = p && st ? (p.c / st.first.c - 1) * 100 : null;
  const cmpA = cmp && i != null ? cmp.a[i].c - 100 : null, cmpB = cmp && i != null ? cmp.b[i].c - 100 : null;
  const text = p ? (cmp ? `${dateLabel(p.t, view === 'monthly')}, ${sym} ${pct(cmpA)}, Nifty ${pct(cmpB)} since the start` : `${dateLabel(p.t, view === 'monthly')}, ${f(p.c)}, ${pct(fromStart)} from the start of the window`) : '';
  const at = (e: PointerEvent) => { const r = box.current!.getBoundingClientRect(); const g = geo ?? pair; if (g) setCur(nearestX(g.xs, ((e.clientX - r.left) / r.width) * g.W)); };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1; const cc = i ?? plot.length - 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCur(Math.max(0, cc - step)); } else if (e.key === 'ArrowRight') { e.preventDefault(); setCur(Math.min(plot.length - 1, cc + step)); }
    else if (e.key === 'Home') { e.preventDefault(); setCur(0); } else if (e.key === 'End') { e.preventDefault(); setCur(plot.length - 1); } else if (e.key === 'Escape') setCur(null);
  };
  if (feed.loading) return <div className="card chart" aria-busy="true"><div className="sk" style={{ height: 22, width: '45%', marginBottom: 12 }} /><div className="sk" style={{ height: 200 }} /><span className="sr">Loading price history</span></div>;
  if (feed.err || !feed.data || all.length < 30) return <div className="card chart"><b>Price history</b><p className="dim small" style={{ margin: '6px 0 10px' }}>{feed.err === 'not published' || feed.err === 'no price history for this symbol' ? 'No price history is held for this symbol.' : feed.data ? 'Too little history to draw.' : `Could not load the price history${feed.err ? ` (${feed.err})` : ''}. Nothing is drawn in its place.`}</p><button className="btn sm" onClick={feed.retry}>Try again</button></div>;
  const yrs = st ? spanWord(st.years) : '';
  return <section className="card chart" aria-label="Price history">
    <div className="chart-head" aria-live="off">
      {p && cmp ? <><div className="k">{dateLabel(p.t, view === 'monthly')}</div><div className="num chart-big"><span className={(cmpA ?? 0) >= 0 ? 'up' : 'down'}>{pct(cmpA)}</span></div><div className="small num dim">{sym} · Nifty <b style={{ color: 'var(--tx)' }}>{pct(cmpB)}</b> over the same days</div></>
        : p ? <><div className="k">{dateLabel(p.t, view === 'monthly')}</div><div className="num chart-big">{f(p.c)}</div><div className={`num small ${fromStart != null && fromStart >= 0 ? 'up' : 'down'}`}>{pct(fromStart)} since the start of this window</div>{(p.o != null || p.v != null) && <div className="small num dim">{[p.o != null && p.h != null && p.l != null ? `O ${f(p.o)} · H ${f(p.h)} · L ${f(p.l)}` : '', p.v != null ? `volume ${compact(p.v)}` : ''].filter(Boolean).join(' · ')}</div>}</>
        : cmp ? <><div className="k">{range === 'Max' || !win.covers ? 'Since listing in this data' : `Last ${range === '1Y' ? 'year' : range.replace('Y', ' years')}`} · against the Nifty</div><div className={`num chart-big ${cmp.diff >= 0 ? 'up' : 'down'}`}>{cmp.diff >= 0 ? '+' : '−'}{Math.abs(cmp.diff).toFixed(1)} pts</div><div className="small dim num">{sym} {pct(cmp.stock)} · Nifty {pct(cmp.nifty)}</div></>
        : st ? <><div className="k">{range === 'Max' || !win.covers ? 'Since listing in this data' : `Last ${range === '1Y' ? 'year' : range.replace('Y', ' years')}`}</div><div className={`num chart-big ${up ? 'up' : 'down'}`}>{pct(st.ret, 1)}</div>
          <div className="small dim num">{yrs}{st.cagr != null ? ` · ${pct(st.cagr, 1)} a year` : ''}</div></> : null}
    </div>
    <div ref={box} className="chart-plot" tabIndex={0} role="slider" aria-label={`${sym} price, ${range}, ${view}. Use the arrow keys to move along the line.`} aria-valuemin={0} aria-valuemax={Math.max(0, plot.length - 1)} aria-valuenow={i ?? plot.length - 1} aria-valuetext={text || 'Latest close'}
      onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCur(null); }} onKeyDown={key} onBlur={() => setCur(null)} style={{ touchAction: 'pan-y' }}>
      {(geo || pair) && (() => {
        const W = (geo ?? pair)!.W, H = (geo ?? pair)!.H;
        // the axis: round values inside the data, and the grid lines they sit on. In the two-line view the axis is the index (100 = the start).
        const lo = geo ? geo.min : Math.min(...cmp!.a.map((q) => q.c), ...cmp!.b.map((q) => q.c)), hi = geo ? geo.max : Math.max(...cmp!.a.map((q) => q.c), ...cmp!.b.map((q) => q.c));
        const yOf = (c: number) => { const g = (v: number) => (log ? Math.log(v) : v); const l = g(lo), h = g(hi); return 12 + (1 - (g(c) - l) / ((h - l) || 1)) * (H - 24); };
        const ticks = yTicks(lo, hi, log, 4).map((v) => ({ v, y: yOf(v) }));
        return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {ticks.map((t) => <line key={t.v} x1="0" x2={W} y1={t.y} y2={t.y} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {pair && <g>
            <path className={`c-line${revealed ? ' settled' : ''}`} d={pair.lineB} pathLength={1} fill="none" stroke="var(--mute)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" style={{ strokeDasharray: '4 3', animation: 'none', strokeDashoffset: 0 }} />
            <path className={`c-line${revealed ? ' settled' : ''}`} d={pair.lineA} pathLength={1} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>}
          {geo && candles && (() => { const bw = geo.barW;
            return <g className="c-candles" shapeRendering="crispEdges">{shown.map((q, k) => { const x = geo.xs[k]; if (q.o == null || q.h == null || q.l == null) return <line key={k} x1={x - bw / 2} x2={x + bw / 2} y1={geo.ys[k]} y2={geo.ys[k]} stroke="var(--mute)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />;
              const col = q.c >= q.o ? 'var(--up)' : 'var(--down)'; const yt = geo.yOf(Math.max(q.o, q.c)), yb = geo.yOf(Math.min(q.o, q.c));
              return <g key={k}><line x1={x} x2={x} y1={geo.yOf(q.h)} y2={geo.yOf(q.l)} stroke={col} strokeWidth="1" vectorEffect="non-scaling-stroke" /><rect x={x - bw / 2} y={yt} width={bw} height={Math.max(1, yb - yt)} fill={col} /></g>; })}</g>; })()}
          {geo && !candles && <g><path className={`c-line${revealed ? ' settled' : ''}`} d={geo.line} pathLength={1} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></g>}
          {geo && <line x1="0" x2={W} y1={geo.ys[geo.ys.length - 1]} y2={geo.ys[geo.ys.length - 1]} stroke={color} strokeOpacity=".55" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
          {geo && smaMap && (['a', 'b'] as const).map((k) => <path key={k} className="c-ma" d={pathThrough(geo.xs, shown.map((q) => { const v = smaMap.get(q.t)?.[k]; return v == null ? null : geo.yOf(v); }))} fill="none" stroke={k === 'a' ? 'var(--a4)' : 'var(--a2)'} strokeWidth="1" strokeOpacity=".9" vectorEffect="non-scaling-stroke" />)}
          {geo && levels.filter((lv) => lv.v >= geo.min && lv.v <= geo.max).map((lv) => <line key={lv.label} x1="0" x2={W} y1={geo.yOf(lv.v)} y2={geo.yOf(lv.v)} stroke={lv.kind === 'stop' ? 'var(--down)' : lv.kind === 'target' ? 'var(--up)' : 'var(--mute)'} strokeWidth="1" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />)}
          {i != null && <line x1={(geo ?? pair)!.xs[i]} x2={(geo ?? pair)!.xs[i]} y1="0" y2={H} stroke="var(--tx)" strokeOpacity=".4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>;
      })()}
      {(geo || pair) && (() => {
        const H = (geo ?? pair)!.H; const lo = geo ? geo.min : 0, hi = geo ? geo.max : 0; void lo; void hi;
        const g = (v: number) => (log ? Math.log(v) : v); const mn = geo ? geo.min : 0, mx = geo ? geo.max : 0;
        const yPct = (c: number) => ((12 + (1 - (g(c) - g(mn)) / ((g(mx) - g(mn)) || 1)) * (H - 24)) / H) * 100;
        const ys = geo ? yTicks(mn, mx, log, 4) : []; const lastY = geo ? yPct(geo.max === geo.min ? geo.min : shown[shown.length - 1].c) : 0;
        return geo ? <>
          {ys.map((v) => { const y = yPct(v); return Math.abs(y - lastY) < 11 ? null : <span key={v} className="c-ylab" style={{ top: `${y}%` }}>{f(v)}</span>; })}
          <span className="c-last" style={{ top: `${lastY}%`, background: color }}>{f(shown[shown.length - 1].c)}</span>
          {levels.filter((lv) => lv.v >= mn && lv.v <= mx).map((lv) => <span key={lv.label} className="c-lvl" style={{ top: `${yPct(lv.v)}%`, color: lv.kind === 'stop' ? 'var(--down)' : lv.kind === 'target' ? 'var(--up)' : 'var(--dim)' }}>{lv.label} {f(lv.v)}</span>)}
        </> : null;
      })()}
      {pair && i != null && <><span className="c-dot" style={{ left: `${(pair.xs[i] / pair.W) * 100}%`, top: `${(pair.ysA[i] / pair.H) * 100}%`, background: color }} /><span className="c-dot" style={{ left: `${(pair.xs[i] / pair.W) * 100}%`, top: `${(pair.ysB[i] / pair.H) * 100}%`, background: 'var(--mute)' }} /></>}
      {geo && i != null && <span className="c-dot" style={{ left: `${(geo.xs[i] / geo.W) * 100}%`, top: `${(geo.ys[i] / geo.H) * 100}%`, background: color }} />}
    </div>
    {st && <div className="c-xaxis" aria-hidden="true">{xTicks(plot[0].t, plot[plot.length - 1].t, 5).map((x) => { const g = geo ?? pair; const fr = g ? (geo ? geo.xOf(x.t) : ((x.t - plot[0].t) / Math.max(1, plot[plot.length - 1].t - plot[0].t)) * g.W) / g.W : 0; return <span key={x.t} style={{ left: `${fr * 100}%` }}>{x.label}</span>; })}</div>}
    {ma && geo && <div className="small num" style={{ display: 'flex', gap: 14, marginTop: 4 }}><span><span className="c-key" style={{ background: 'var(--a4)' }} />50-day</span><span><span className="c-key" style={{ background: 'var(--a2)' }} />200-day</span></div>}
    {vol && hasVol && geo && !cmp && (() => { const H3 = 70; const vs2 = shown.map((q) => q.v ?? 0); const mx = Math.max(1, ...vs2); const bw = geo.barW;
      return <div className="chart-sub"><div className="k">Volume · {FRAME_WORD[eff]} bars{i != null && shown[i]?.v != null ? ` · ${compact(shown[i].v!)}` : ''}</div><div className="chart-plot sub" style={{ height: 56, cursor: 'default' }} role="img" aria-label={`Volume per ${FRAME_WORD[eff]}, highest ${compact(mx)}`}>
        <svg viewBox={`0 0 ${geo.W} ${H3}`} preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">{shown.map((q, k) => q.v == null ? null : <rect key={k} x={geo.xs[k] - bw / 2} y={H3 - (q.v / mx) * (H3 - 4)} width={bw} height={(q.v / mx) * (H3 - 4)} fill={(q.o != null ? q.c >= q.o : k > 0 ? q.c >= shown[k - 1].c : true) ? 'var(--up)' : 'var(--down)'} opacity={i === k ? 1 : 0.55} />)}</svg></div></div>; })()}
    {rsi && geo && !cmp && rsiFull && (() => { const H4 = 90; const y = (v: number) => 6 + (1 - v / 100) * (H4 - 12); const vals = shown.map((q) => rsiFull.get(q.t) ?? null); const d = pathThrough(geo.xs, vals.map((v) => (v == null ? null : y(v)))); const last = [...vals].reverse().find((v) => v != null) ?? null; const cur = i != null ? vals[i] : last;
      return <div className="chart-sub"><div className="row between"><span className="k">RSI 14 · {FRAME_WORD[eff]} closes{cur != null ? ` · ${cur.toFixed(1)}` : ''}</span><span className="small num dim">{rsiNow.map((x) => `${x.fr === 'daily' ? 'D' : x.fr === 'weekly' ? 'W' : 'M'} ${x.v == null ? '—' : x.v.toFixed(0)}`).join(' · ')}</span></div>
        <div className="chart-plot sub" style={{ height: 76, cursor: 'default' }} role="img" aria-label={`RSI 14 on ${FRAME_WORD[eff]} closes${cur != null ? `, ${cur.toFixed(1)}` : ''}. Daily ${rsiNow[0].v?.toFixed(0) ?? 'n/a'}, weekly ${rsiNow[1].v?.toFixed(0) ?? 'n/a'}, monthly ${rsiNow[2].v?.toFixed(0) ?? 'n/a'}.`}>
          <svg viewBox={`0 0 ${geo.W} ${H4}`} preserveAspectRatio="none" aria-hidden="true"><rect x="0" y={y(100)} width={geo.W} height={y(70) - y(100)} fill="var(--down)" opacity=".07" /><rect x="0" y={y(30)} width={geo.W} height={y(0) - y(30)} fill="var(--up)" opacity=".07" />
            {[30, 50, 70].map((v) => <line key={v} x1="0" x2={geo.W} y1={y(v)} y2={y(v)} stroke="var(--line2)" strokeWidth="1" strokeDasharray={v === 50 ? '1 4' : '4 3'} vectorEffect="non-scaling-stroke" />)}
            <path d={d} fill="none" stroke="var(--a4)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />{i != null && <line x1={geo.xs[i]} x2={geo.xs[i]} y1="0" y2={H4} stroke="var(--tx)" strokeOpacity=".4" vectorEffect="non-scaling-stroke" />}</svg>
          <span className="c-ylab" style={{ top: `${(y(70) / H4) * 100}%` }}>70</span><span className="c-ylab" style={{ top: `${(y(30) / H4) * 100}%` }}>30</span></div></div>; })()}
    {ddv && geo && (() => { const mn = Math.min(0, ...ddv); const H2 = 90; const y = (v: number) => 6 + (v / (mn || -1)) * (H2 - 12); const d = ddv.map((v, k) => `${k ? 'L' : 'M'}${geo.xs[k].toFixed(1)} ${y(v).toFixed(1)}`).join('');
      return <div style={{ marginTop: 8 }}><div className="k">Drawdown from the running peak · worst {pct(mn, 1)}</div><div className="chart-plot" style={{ height: 70, marginTop: 4, cursor: 'default' }} role="img" aria-label={`Drawdown from the running peak, worst ${pct(mn, 1)}`}>
        <svg viewBox={`0 0 ${geo.W} ${H2}`} preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2={geo.W} y1={y(0)} y2={y(0)} stroke="var(--line2)" strokeWidth="1" vectorEffect="non-scaling-stroke" /><path d={`${d}L${geo.xs[geo.xs.length - 1].toFixed(1)} ${y(0)}L${geo.xs[0].toFixed(1)} ${y(0)}Z`} fill="var(--down)" fillOpacity=".12" /><path d={d} fill="none" stroke="var(--down)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" /></svg></div></div>; })()}
    <div className="c-bar" role="group" aria-label="Chart controls">
      <Radios label="Range" value={range} onChange={(r) => { setRange(r); setCur(null); }} items={avail.map((r) => ({ id: r.id, label: r.id === 'Max' ? 'MAX' : r.id, disabled: !r.available, hint: r.note ?? undefined }))} />
      <Radios label="Detail" value={view} onChange={(v) => { setView(v); setCur(null); }} items={[{ id: 'daily', label: 'DAILY' }, { id: 'weekly', label: 'WEEKLY' }, { id: 'monthly', label: 'MONTHLY' }] as { id: Frame; label: string }[]} />
      {hasOhlc && !instrument ? <Radios label="Style" value={kind} onChange={(v) => { setKind(v); setCur(null); }} items={[{ id: 'line', label: 'LINE' }, { id: 'candle', label: 'CANDLES', disabled: !!cmp, hint: cmp ? 'Candles are not drawn against the Nifty' : undefined }] as { id: 'line' | 'candle'; label: string; disabled?: boolean; hint?: string }[]} /> : null}
      <Radios label="Scale" value={log ? 'log' : 'linear'} onChange={(v) => setLog(v === 'log')} items={[{ id: 'linear', label: 'LINEAR' }, { id: 'log', label: 'LOG' }]} />
      <div className="mini-seg" role="group" aria-label="Indicators"><button aria-pressed={ma} onClick={() => setMa(!ma)}>MA 50/200</button><button aria-pressed={vol} disabled={!!cmp || !hasVol} title={!hasVol ? 'This series carries no volume' : undefined} onClick={() => setVol(!vol)}>VOLUME</button><button aria-pressed={rsi} disabled={!!cmp} onClick={() => setRsi(!rsi)}>RSI 14</button><button aria-pressed={dd} disabled={!!cmp} onClick={() => setDd(!dd)}>DRAWDOWN</button></div>
      {!instrument && <Radios label="Compare" value={vs ? 'vs' : 'price'} onChange={(v) => { setVs(v === 'vs'); setCur(null); }} items={[{ id: 'price', label: 'PRICE' }, { id: 'vs', label: 'VS NIFTY', disabled: !hasNifty, hint: !hasNifty ? 'The Nifty could not be read' : undefined }]} />}
    </div>
    {avail.some((r) => !r.available) && <p className="small mute" style={{ margin: '8px 0 0' }}>{avail.filter((r) => !r.available).map((r) => r.note).join(' · ')}. Max shows all of it.</p>}
    {bars && eff !== view && !cmp && <p className="small mute" style={{ margin: '8px 0 0' }}>{kind === 'candle' ? 'Candles' : 'Volume'} are drawn as {FRAME_WORD[eff]} bars here: {win.pts.length.toLocaleString('en-IN')} daily bars would be too thin to read, and thinning them would misstate each day.</p>}
    {kind === 'candle' && candles && shown.some((q) => q.o == null || q.h == null || q.l == null) && <p className="small mute" style={{ margin: '8px 0 0' }}>{shown.filter((q) => q.o == null || q.h == null || q.l == null).length} bars have no open, high or low from the source and are drawn as a tick on the close.</p>}
    {cmp && <div className="row small" style={{ gap: 14, marginTop: 8, flexWrap: 'wrap' }}><span><span className="c-key" style={{ background: color }} />{sym}</span><span><span className="c-key dashed" />Nifty 50</span><span className="mute">both indexed to 100</span></div>}
    {cmp?.trimmed && <p className="small mute" style={{ margin: '8px 0 0' }}>Nifty data starts {dateLabel(cmp.from.t)}, so the comparison starts there.</p>}
    {st && !cmp && <div className="c-hl num"><span>LOW <b>{f(st.lo.c)}</b> <i>{dateLabel(st.lo.t, true)}</i></span><span>HIGH <b>{f(st.hi.c)}</b> <i>{dateLabel(st.hi.t, true)}</i></span></div>}
    {!win.covers && range !== 'Max' && <p className="small mute" style={{ margin: '6px 0 0' }}>Data starts {dateLabel(all[0].t)}: {range} shows all of it.</p>}
    <details className="ev" style={{ marginTop: 8 }}><summary>About this chart<span className="chev">▾</span></summary><div className="body small dim">
      <p style={{ margin: '0 0 6px' }}>{log ? 'Log scale: equal steps are equal percentage moves, so 100 to 200 looks the same as 200 to 400. Best for long ranges.' : `Linear scale: equal steps are equal amounts of price. Best for short ranges.${st && st.hi.c / Math.max(st.lo.c, 1e-9) >= 3 ? ' This window moved more than threefold, so older moves look small; LOG shows them in proportion.' : ''}`}</p>
      <p style={{ margin: 0 }}>{instrument ? `Daily closes from Yahoo Finance for ${name ?? sym}. Futures contracts roll to the next month, which can leave a small step in the line.` : 'Daily closes from Yahoo Finance, adjusted for splits and bonuses, not for dividends. The Nifty line is the index price, without dividends, like the stock. Past prices say nothing certain about future ones.'}</p></div></details>
    {shown.length > 1 && (() => { const hi = shown.reduce((a, b) => (b.c > a.c ? b : a)), lo = shown.reduce((a, b) => (b.c < a.c ? b : a)), a0 = shown[0], z = shown[shown.length - 1];
      return <details className="ev" style={{ marginTop: 8 }}><summary>The same chart as a table<span className="chev">▾</span></summary><div className="body"><table className="tbl" style={{ width: '100%' }}><caption className="sr">Key points of the {range} {view} chart for {sym}</caption><thead><tr><th scope="col" style={{ textAlign: 'left' }}>Point</th><th scope="col" style={{ textAlign: 'left' }}>Date</th><th scope="col" style={{ textAlign: 'right' }}>Price</th></tr></thead><tbody>
        <tr><th scope="row" style={{ textAlign: 'left' }}>First in window</th><td>{dateLabel(a0.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(a0.c)}</td></tr>
        <tr><th scope="row" style={{ textAlign: 'left' }}>Highest close</th><td>{dateLabel(hi.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(hi.c)}</td></tr>
        <tr><th scope="row" style={{ textAlign: 'left' }}>Lowest close</th><td>{dateLabel(lo.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(lo.c)}</td></tr>
        <tr><th scope="row" style={{ textAlign: 'left' }}>Latest close</th><td>{dateLabel(z.t, view === 'monthly')}</td><td className="num" style={{ textAlign: 'right' }}>{f(z.c)}</td></tr></tbody></table></div></details>; })()}
  </section>;
}
