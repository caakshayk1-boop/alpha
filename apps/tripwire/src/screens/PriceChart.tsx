import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { setState, useAppState } from '../app.tsx';
import { useChart } from '../data.ts';
import { aggregate, compareSeries, drawdownSeries, pathThrough, rangeAvailability, rsiSeries, smaSeries, dateLabel, downsample, geometry, geometryPair, nearestX, sliceRange, spanWord, stats, xTicks, yTicks, type Frame, type Pt, type RangeId } from '../chart.ts';
import { inr, pct } from '../fmt.ts';
import { Radios } from '../ui.tsx';
import { BASIS, ChartFrame, ChartState, ChartTable, SeriesLegend, arrowOf, buildTable, chartStart, markerPath, priceTakeaway, signedPts, spreadLabels, styleOf, windowWords, type FrameMode } from '../charts/index.ts';
import type { Level } from '../levels.ts';

/** Price history inside the shared chart frame. A one-year view against the Nifty 50 is where a new reader starts (a saved choice wins); candles, log scale, averages, volume, RSI,
 *  drawdown and the longer ranges sit under "Chart options". Hover, touch or the arrow keys scrub it. The line draws itself once, and only with motion on (html.fx). */
const compact = (v: number) => (v >= 1e7 ? `${(v / 1e7).toFixed(2)} cr` : v >= 1e5 ? `${(v / 1e5).toFixed(2)} lakh` : v.toLocaleString('en-IN'));
const FRAME_WORD: Record<Frame, string> = { daily: 'day', weekly: 'week', monthly: 'month' };
/** A dated event drawn on the time axis. Only ever built from a date the data holds, with the source said in `basis`; the chart invents none. */
export interface ChartEvent { t: number; label: string; basis: string }
export function PriceChart({ sym, fmt, name, levels = [], events = [] }: { sym: string; fmt?: (v: number) => string; name?: string; levels?: Level[]; events?: ChartEvent[] }) {
  const f = fmt ?? ((v: number) => inr(v)); const instrument = !!fmt;      // an index, metal, currency or coin: no Nifty line, no adjustment note
  const feed = useChart(sym); const gid = useId().replace(/:/g, ''); void gid;
  const app = useAppState(); const savedPref = app.prefs.chart;
  const [rangeSel, setRange] = useState<RangeId | null>(null); const [vsSel, setVs] = useState<boolean | null>(null); const [view, setView] = useState<Frame>('daily'); const [log, setLog] = useState(false); const [ma, setMa] = useState(false); const [dd, setDd] = useState(false);
  const [lvOn, setLvOn] = useState(true); const [evOn, setEvOn] = useState(true); const [kind, setKind] = useState<'line' | 'candle'>('line'); const [vol, setVol] = useState(false); const [rsi, setRsi] = useState(false);
  const [mode, setMode] = useState<FrameMode>('chart');
  const [cur, setCur] = useState<number | null>(null); const box = useRef<HTMLDivElement>(null);
  const all: Pt[] = useMemo(() => (feed.data ? feed.data.t.map((t, i) => ({ t, c: feed.data!.c[i], n: feed.data!.n ? feed.data!.n[i] : null, o: feed.data!.o?.[i] ?? null, h: feed.data!.h?.[i] ?? null, l: feed.data!.l?.[i] ?? null, v: feed.data!.v?.[i] ?? null })) : []), [feed.data]);
  const start = useMemo(() => chartStart(all, savedPref as { range?: RangeId; vs?: boolean } | undefined, instrument), [all, savedPref, instrument]);
  const range: RangeId = rangeSel ?? start.range;      // a saved choice, else one year, else the longest range the history can fill
  const avail = useMemo(() => rangeAvailability(all), [all]);
  const hasOhlc = all.some((q) => q.o != null && q.h != null && q.l != null), hasVol = all.some((q) => q.v != null);
  const hasNifty = !!feed.data?.n && !instrument;
  const vs = (vsSel ?? start.vs) && hasNifty;
  const win = useMemo(() => sliceRange(all, range), [all, range]);
  // candles and volume need whole bars: a bar that was thinned out would show a volume or a range that is not the day's. When the window holds too many days for that,
  // the bars are weekly (or monthly), and the page says so beside the chart.
  const bars = !vs && ((kind === 'candle' && hasOhlc) || (vol && hasVol));
  const eff: Frame = useMemo(() => { if (!bars) return view; const n = (fr: Frame) => aggregate(win.pts, fr).length; if (view === 'daily') return win.pts.length <= 260 ? 'daily' : n('weekly') <= 260 ? 'weekly' : 'monthly'; if (view === 'weekly') return n('weekly') <= 260 ? 'weekly' : 'monthly'; return 'monthly'; }, [bars, view, win]);
  const shown = useMemo(() => {
    if (bars) return aggregate(win.pts, eff);
    return view === 'daily' ? downsample(win.pts, 700) : (win.pts.length ? [win.pts[0], ...aggregate(win.pts, view).filter((p) => p.t > win.pts[0].t)] : []);
  }, [win, view, eff, bars]);
  const cmp = useMemo(() => (vs && hasNifty ? compareSeries(shown) : null), [vs, hasNifty, shown]);
  const plot = cmp ? cmp.a : shown;                       // what the x axis and the scrubber run along
  const canLog = shown.every((q) => q.c > 0) && (!cmp || (cmp.a.every((q) => q.c > 0) && cmp.b.every((q) => q.c > 0)));
  const logOn = log && canLog;
  const candles = kind === 'candle' && hasOhlc && !cmp;
  const barsMode = !cmp && (candles || (vol && hasVol));
  const [wpx, setWpx] = useState(340); const ready = !feed.loading && !!feed.data && all.length >= 30;
  useLayoutEffect(() => { const el = box.current; if (!el) return; const set = () => { const w = el.clientWidth; if (w > 0) setWpx((x) => (Math.abs(x - w) < 1 ? x : w)); }; set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect(); }, [ready, mode]);
  const lastLen = shown.length ? f(shown[shown.length - 1].c).length : 8;
  const gutU = candles ? Math.round((Math.min(wpx * 0.3, Math.max(54, lastLen * 6.4 + 18)) / wpx) * 1000) : 0;
  const pairGut = Math.round((64 / wpx) * 1000);          // room at the right of a two-line chart for the end labels
  const geo = useMemo(() => (cmp ? null : geometry(shown, logOn, 1000, 300, 12, candles, { bars: barsMode, gutter: gutU })), [cmp, shown, logOn, candles, barsMode, gutU]);
  const [revealed, setRevealed] = useState(false); useEffect(() => { if (!ready || revealed) return; const t = window.setTimeout(() => setRevealed(true), 1400); return () => window.clearTimeout(t); }, [ready, revealed]);
  const pair = useMemo(() => (cmp ? geometryPair(cmp.a, cmp.b, logOn, 1000, 300, 12, pairGut) : null), [cmp, logOn, pairGut]);
  const st = useMemo(() => stats(win.pts), [win]);
  const smaMap = useMemo(() => { if (!ma || !all.length) return null; const a50 = smaSeries(all, 50), a200 = smaSeries(all, 200); const m = new Map<number, { a: number | null; b: number | null }>(); all.forEach((q, k) => m.set(q.t, { a: a50[k], b: a200[k] })); return m; }, [ma, all]);
  const rsiFull = useMemo(() => { if (!rsi) return null; const m = new Map<number, number | null>(); const a = aggregate(all, eff); rsiSeries(a.map((q) => q.c)).forEach((v, k) => m.set(a[k].t, v)); return m; }, [rsi, all, eff]);
  const rsiNow = useMemo(() => (['daily', 'weekly', 'monthly'] as Frame[]).map((fr) => { const a = aggregate(all, fr); const r = rsiSeries(a.map((q) => q.c)); return { fr, v: r.length ? r[r.length - 1] : null }; }), [all]);
  const ddv = useMemo(() => (dd && !cmp ? drawdownSeries(shown) : null), [dd, cmp, shown]);
  const evIn = events.filter((e) => plot.length > 1 && e.t >= plot[0].t && e.t <= plot[plot.length - 1].t);
  const S = styleOf(0, sym), B = styleOf(-1, 'Nifty 50'); const color = S.color;
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
  const remember = (c: { range?: RangeId; vs?: boolean }) => setState((x) => ({ ...x, prefs: { ...x.prefs, chart: { ...x.prefs.chart, ...c } } }));
  const chooseRange = (r: RangeId) => { setRange(r); setCur(null); remember({ range: r }); };
  const chooseVs = (v: boolean) => { setVs(v); setCur(null); remember({ vs: v }); };
  // an indicator that is drawn for the stock alone switches the benchmark view off, and the note beside the chart says so
  const solo = (fn: () => void) => { fn(); if (vs) setVs(false); setCur(null); };

  if (feed.loading) return <ChartState title="Price history" busy />;
  if (feed.err || !feed.data || all.length < 30) return <ChartState title="Price history" action={<button className="btn sm" onClick={feed.retry}>Try again</button>}>{feed.err === 'not published' || feed.err === 'no price history for this symbol' ? 'No price history is held for this symbol.' : feed.data ? 'Too little history to draw.' : `Could not load the price history${feed.err ? ` (${feed.err})` : ''}. Nothing is drawn in its place.`}</ChartState>;
  const yrs = st ? spanWord(st.years) : '';
  const cmpYears = cmp ? (cmp.a[cmp.a.length - 1].t - cmp.a[0].t) / (365.25 * 86400) : 0;
  const words = cmp?.trimmed ? `the ${spanWord(cmpYears)} since ${dateLabel(cmp.from.t)}` : windowWords(range, win.covers, st?.years ?? 0);
  const take = priceTakeaway({ sym, pts: cmp ? cmp.a : shown, bench: cmp ? cmp.b : null, words, monthly: view === 'monthly' });
  const legend = <SeriesLegend items={cmp ? [{ style: S, value: pct(cmp.stock), arrow: arrowOf(cmp.stock) }, { style: B, value: pct(cmp.nifty), arrow: arrowOf(cmp.nifty) }] : [{ style: S, value: st ? pct(st.ret) : undefined, arrow: st ? arrowOf(st.ret) : undefined }]} />;
  // the table is built from the arrays the chart draws
  const table = (() => {
    const monthly = view === 'monthly' || eff === 'monthly';
    if (cmp) { const t = cmp.a.map((q) => q.t); return buildTable(t, [{ key: 's', label: `${sym} (index)`, v: cmp.a.map((q) => q.c) }, { key: 'n', label: 'Nifty 50 (index)', v: cmp.b.map((q) => q.c) }, { key: 'g', label: 'Gap (pts)', v: cmp.a.map((q, k) => q.c - cmp.b[k].c) }], { monthly }); }
    const dv = drawdownSeries(shown); return buildTable(shown.map((q) => q.t), [{ key: 'c', label: 'Close', unit: instrument ? '' : '₹', v: shown.map((q) => q.c) }, { key: 'd', label: 'From peak', unit: '%', digits: 1, v: dv }], { monthly });
  })();
  const unitWord = `${FRAME_WORD[bars ? eff : view]} ${cmp ? 'points' : 'closes'}`;
  const metaBits = [`${range === 'Max' ? 'All history held' : range}`, FRAME_WORD[bars ? eff : view] + ' closes', cmp ? 'indexed to 100 at the start' : instrument ? `${name ?? sym} units` : '₹ per share', `through ${dateLabel(all[all.length - 1].t)}`];
  const endLabs = (() => { if (!pair || !cmp) return []; const ws = spreadLabels([pair.ysA[pair.ysA.length - 1] / pair.H, pair.ysB[pair.ysB.length - 1] / pair.H]); return [{ s: S, y: ws[0], t: `${arrowOf(cmp.stock)} ${pct(cmp.stock)}` }, { s: B, y: ws[1], t: `${arrowOf(cmp.nifty)} ${pct(cmp.nifty)}` }]; })();
  const tipLeft = (geo ?? pair) && i != null ? ((geo ?? pair)!.xs[i] / (geo ?? pair)!.W) * 100 : 0;
  const tip = p && i != null ? (cmp ? `${dateLabel(p.t, view === 'monthly')} · ${sym} ${pct(cmpA)} · Nifty ${pct(cmpB)}` : `${dateLabel(p.t, view === 'monthly')} · ${f(p.c)}`) : null;

  const chart = <>
    <div className="chart-head" aria-live="off">
      {p && cmp ? <><div className="k">{dateLabel(p.t, view === 'monthly')}</div><div className="num chart-big"><span>{arrowOf(cmpA)} {pct(cmpA)}</span></div><div className="small num dim">{sym} · Nifty <b style={{ color: 'var(--tx)' }}>{arrowOf(cmpB)} {pct(cmpB)}</b> over the same days</div></>
        : p ? <><div className="k">{dateLabel(p.t, view === 'monthly')}</div><div className="num chart-big">{f(p.c)}</div><div className="num small">{arrowOf(fromStart)} {pct(fromStart)} since the start of this window</div>{(p.o != null || p.v != null) && <div className="small num dim">{[p.o != null && p.h != null && p.l != null ? `O ${f(p.o)} · H ${f(p.h)} · L ${f(p.l)}` : '', p.v != null ? `volume ${compact(p.v)}` : ''].filter(Boolean).join(' · ')}</div>}</>
        : cmp ? <><div className="k">{range === 'Max' || !win.covers ? 'Since listing in this data' : `Last ${range === '1Y' ? 'year' : range.replace('Y', ' years')}`} · against the Nifty</div>
            <div className="cf-figs"><div className="cf-fig"><span className="k">Price change (absolute)</span><b className="num">{arrowOf(cmp.stock)} {pct(cmp.stock)}</b></div><div className="cf-fig"><span className="k">Relative to the Nifty 50</span><b className="num">{arrowOf(cmp.diff)} {signedPts(cmp.diff)} pts</b></div></div></>
        : st ? <><div className="k">{range === 'Max' || !win.covers ? 'Since listing in this data' : `Last ${range === '1Y' ? 'year' : range.replace('Y', ' years')}`}</div><div className="num chart-big">{arrowOf(st.ret)} {pct(st.ret, 1)}</div>
          <div className="small dim num">{yrs}{st.cagr != null ? ` · ${pct(st.cagr, 1)} a year` : ''}</div></> : null}
    </div>
    <div ref={box} className="chart-plot" tabIndex={0} role="slider" aria-label={`${sym} price, ${range}, ${view}. Use the arrow keys to move along the line.`} aria-describedby={undefined} aria-valuemin={0} aria-valuemax={Math.max(0, plot.length - 1)} aria-valuenow={i ?? plot.length - 1} aria-valuetext={text || (shown.length ? `Latest close ${f(shown[shown.length - 1].c)}, ${dateLabel(shown[shown.length - 1].t, view === 'monthly')}` : 'Latest close')}
      onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCur(null); }} onKeyDown={key} onBlur={() => setCur(null)} style={{ touchAction: 'pan-y' }}>
      {(geo || pair) && (() => {
        const W = (geo ?? pair)!.W, H = (geo ?? pair)!.H;
        const lo = geo ? geo.min : Math.min(...cmp!.a.map((q) => q.c), ...cmp!.b.map((q) => q.c)), hi = geo ? geo.max : Math.max(...cmp!.a.map((q) => q.c), ...cmp!.b.map((q) => q.c));
        const yOf = (c: number) => { const g = (v: number) => (logOn ? Math.log(v) : v); const l = g(lo), h = g(hi); return 12 + (1 - (g(c) - l) / ((h - l) || 1)) * (H - 24); };
        const ticks = yTicks(lo, hi, logOn, 4).map((v) => ({ v, y: yOf(v) }));
        return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {ticks.map((t) => <line key={t.v} x1="0" x2={W} y1={t.y} y2={t.y} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {pair && cmp && <g>
            <line x1="0" x2={W} y1={yOf(100)} y2={yOf(100)} stroke="var(--line-2)" strokeWidth="1" strokeDasharray="1 4" vectorEffect="non-scaling-stroke" />
            <path className={`c-line${revealed ? ' settled' : ''}`} d={pair.lineB} pathLength={1} fill="none" stroke={B.color} strokeWidth={B.width} vectorEffect="non-scaling-stroke" style={{ strokeDasharray: B.dash, animation: 'none', strokeDashoffset: 0 }} />
            <path className={`c-line${revealed ? ' settled' : ''}`} d={pair.lineA} pathLength={1} fill="none" stroke={S.color} strokeWidth={S.width} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </g>}
          {geo && candles && (() => { const bw = geo.barW;
            // up bars are hollow, down bars solid: direction is readable without colour
            return <g className="c-candles" shapeRendering="crispEdges">{shown.map((q, k) => { const x = geo.xs[k]; if (q.o == null || q.h == null || q.l == null) return <line key={k} x1={x - bw / 2} x2={x + bw / 2} y1={geo.ys[k]} y2={geo.ys[k]} stroke="var(--mute)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />;
              const upBar = q.c >= q.o; const col = upBar ? 'var(--up)' : 'var(--down)'; const yt = geo.yOf(Math.max(q.o, q.c)), yb = geo.yOf(Math.min(q.o, q.c));
              return <g key={k}><line x1={x} x2={x} y1={geo.yOf(q.h)} y2={geo.yOf(q.l)} stroke={col} strokeWidth="1" vectorEffect="non-scaling-stroke" /><rect x={x - bw / 2} y={yt} width={bw} height={Math.max(1, yb - yt)} fill={upBar ? 'var(--bg)' : col} stroke={col} strokeWidth="1" vectorEffect="non-scaling-stroke" /></g>; })}</g>; })()}
          {geo && !candles && <g><path className={`c-line${revealed ? ' settled' : ''}`} d={geo.line} pathLength={1} fill="none" stroke={color} strokeWidth={S.width} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></g>}
          {geo && <line x1="0" x2={W} y1={geo.ys[geo.ys.length - 1]} y2={geo.ys[geo.ys.length - 1]} stroke={color} strokeOpacity=".55" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
          {geo && smaMap && (['a', 'b'] as const).map((k) => <path key={k} className="c-ma" d={pathThrough(geo.xs, shown.map((q) => { const v = smaMap.get(q.t)?.[k]; return v == null ? null : geo.yOf(v); }))} fill="none" stroke={k === 'a' ? 'var(--a4)' : 'var(--a2)'} strokeWidth="1" strokeOpacity=".9" strokeDasharray={k === 'b' ? '3 3' : undefined} vectorEffect="non-scaling-stroke" />)}
          {geo && lvOn && levels.filter((lv) => lv.v >= geo.min && lv.v <= geo.max).map((lv) => <line key={lv.label} x1="0" x2={W} y1={geo.yOf(lv.v)} y2={geo.yOf(lv.v)} stroke={lv.kind === 'stop' ? 'var(--down)' : lv.kind === 'target' ? 'var(--up)' : 'var(--mute)'} strokeWidth="1" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />)}
          {i != null && <line x1={(geo ?? pair)!.xs[i]} x2={(geo ?? pair)!.xs[i]} y1="0" y2={H} stroke="var(--tx)" strokeOpacity=".4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>;
      })()}
      {(geo || pair) && (() => {
        const H = (geo ?? pair)!.H; const g = (v: number) => (logOn ? Math.log(v) : v); const mn = geo ? geo.min : 0, mx = geo ? geo.max : 0;
        const yPct = (c: number) => ((12 + (1 - (g(c) - g(mn)) / ((g(mx) - g(mn)) || 1)) * (H - 24)) / H) * 100;
        const ys = geo ? yTicks(mn, mx, logOn, 4) : []; const lastY = geo ? yPct(geo.max === geo.min ? geo.min : shown[shown.length - 1].c) : 0;
        return geo ? <>
          {ys.map((v) => { const y = yPct(v); return Math.abs(y - lastY) < 11 ? null : <span key={v} className="c-ylab" style={{ top: `${y}%` }}>{f(v)}</span>; })}
          <span className="c-last" style={{ top: `${lastY}%`, background: color }}>{f(shown[shown.length - 1].c)}</span>
          {lvOn && levels.filter((lv) => lv.v >= mn && lv.v <= mx).map((lv) => <span key={lv.label} className="c-lvl" style={{ top: `${yPct(lv.v)}%`, color: lv.kind === 'stop' ? 'var(--down)' : lv.kind === 'target' ? 'var(--up)' : 'var(--dim)' }}>{lv.label} {f(lv.v)}</span>)}
        </> : (pair ? (() => { const all2 = [...cmp!.a, ...cmp!.b].map((q) => q.c); const lo2 = Math.min(...all2), hi2 = Math.max(...all2); const g2 = (v: number) => (logOn ? Math.log(v) : v);
          return <>{yTicks(lo2, hi2, logOn, 4).map((v) => <span key={v} className="c-ylab" style={{ top: `${((12 + (1 - (g2(v) - g2(lo2)) / ((g2(hi2) - g2(lo2)) || 1)) * (H - 24)) / H) * 100}%`, right: 'auto', left: 6 }}>{v.toFixed(0)}</span>)}
            {endLabs.map((l) => <span key={l.s.label} className="c-end" style={{ top: `${l.y * 100}%` }}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d={markerPath(l.s.marker, 6, 6, 3.6)} fill={l.s.color} /></svg>{l.t}</span>)}</>; })() : null);
      })()}
      {evOn && (geo || pair) && evIn.map((e) => { const g = (geo ?? pair)!; const x = geo ? geo.xOf(e.t) : ((e.t - plot[0].t) / Math.max(1, plot[plot.length - 1].t - plot[0].t)) * g.W; return <span key={e.t + e.label} className="c-ev" style={{ left: `${(x / g.W) * 100}%` }} title={`${dateLabel(e.t)}: ${e.label}. ${e.basis}`} aria-hidden="true" />; })}
      {pair && i != null && <><span className="c-dot" style={{ left: `${(pair.xs[i] / pair.W) * 100}%`, top: `${(pair.ysA[i] / pair.H) * 100}%`, background: S.color }} /><span className="c-dot" style={{ left: `${(pair.xs[i] / pair.W) * 100}%`, top: `${(pair.ysB[i] / pair.H) * 100}%`, background: B.color }} /></>}
      {geo && i != null && <span className="c-dot" style={{ left: `${(geo.xs[i] / geo.W) * 100}%`, top: `${(geo.ys[i] / geo.H) * 100}%`, background: color }} />}
      {tip && <span className="c-tip" aria-hidden="true" style={tipLeft > 55 ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}>{tip}</span>}
    </div>
    {st && <div className="c-xaxis" aria-hidden="true">{xTicks(plot[0].t, plot[plot.length - 1].t, 5).map((x) => { const g = geo ?? pair; const fr = g ? (geo ? geo.xOf(x.t) : ((x.t - plot[0].t) / Math.max(1, plot[plot.length - 1].t - plot[0].t)) * (pair ? pair.xs[pair.xs.length - 1] : g.W)) / g.W : 0; return <span key={x.t} style={{ left: `${fr * 100}%` }}>{x.label}</span>; })}</div>}
    {ma && geo && <div className="small num" style={{ display: 'flex', gap: 14, marginTop: 4 }}><span><span className="c-key" style={{ background: 'var(--a4)' }} />50-day (solid)</span><span><span className="c-key dashed" style={{ background: 'repeating-linear-gradient(90deg,var(--a2) 0 3px,transparent 3px 6px)' }} />200-day (dotted)</span></div>}
    {vol && hasVol && geo && !cmp && (() => { const H3 = 70; const vs2 = shown.map((q) => q.v ?? 0); const mx = Math.max(1, ...vs2); const bw = geo.barW;
      return <div className="chart-sub"><div className="k">Volume · {FRAME_WORD[eff]} bars{i != null && shown[i]?.v != null ? ` · ${compact(shown[i].v!)}` : ''}</div><div className="chart-plot sub" style={{ height: 56, cursor: 'default' }} role="img" aria-label={`Volume per ${FRAME_WORD[eff]}, highest ${compact(mx)}`}>
        <svg viewBox={`0 0 ${geo.W} ${H3}`} preserveAspectRatio="none" aria-hidden="true" shapeRendering="crispEdges">{shown.map((q, k) => { if (q.v == null) return null; const upBar = q.o != null ? q.c >= q.o : k > 0 ? q.c >= shown[k - 1].c : true; const col = upBar ? 'var(--up)' : 'var(--down)'; return <rect key={k} x={geo.xs[k] - bw / 2} y={H3 - (q.v / mx) * (H3 - 4)} width={bw} height={(q.v / mx) * (H3 - 4)} fill={upBar ? 'var(--bg)' : col} stroke={col} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity={i === k ? 1 : 0.7} />; })}</svg></div><p className="small mute" style={{ margin: '4px 0 0' }}>Hollow bars: the {FRAME_WORD[eff]} closed at or above its open (or the previous close). Solid bars: it closed lower.</p></div>; })()}
    {rsi && geo && !cmp && rsiFull && (() => { const H4 = 90; const y = (v: number) => 6 + (1 - v / 100) * (H4 - 12); const vals = shown.map((q) => rsiFull.get(q.t) ?? null); const d = pathThrough(geo.xs, vals.map((v) => (v == null ? null : y(v)))); const last = [...vals].reverse().find((v) => v != null) ?? null; const curv = i != null ? vals[i] : last;
      return <div className="chart-sub"><div className="row between"><span className="k">RSI 14 · {FRAME_WORD[eff]} closes{curv != null ? ` · ${curv.toFixed(1)}` : ''}</span><span className="small num dim">{rsiNow.map((x) => `${x.fr === 'daily' ? 'D' : x.fr === 'weekly' ? 'W' : 'M'} ${x.v == null ? '—' : x.v.toFixed(0)}`).join(' · ')}</span></div>
        <div className="chart-plot sub" style={{ height: 76, cursor: 'default' }} role="img" aria-label={`RSI 14 on ${FRAME_WORD[eff]} closes${curv != null ? `, ${curv.toFixed(1)}` : ''}. Daily ${rsiNow[0].v?.toFixed(0) ?? 'n/a'}, weekly ${rsiNow[1].v?.toFixed(0) ?? 'n/a'}, monthly ${rsiNow[2].v?.toFixed(0) ?? 'n/a'}.`}>
          <svg viewBox={`0 0 ${geo.W} ${H4}`} preserveAspectRatio="none" aria-hidden="true"><rect x="0" y={y(100)} width={geo.W} height={y(70) - y(100)} fill="var(--down)" opacity=".07" /><rect x="0" y={y(30)} width={geo.W} height={y(0) - y(30)} fill="var(--up)" opacity=".07" />
            {[30, 50, 70].map((v) => <line key={v} x1="0" x2={geo.W} y1={y(v)} y2={y(v)} stroke="var(--line2)" strokeWidth="1" strokeDasharray={v === 50 ? '1 4' : '4 3'} vectorEffect="non-scaling-stroke" />)}
            <path d={d} fill="none" stroke="var(--a4)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />{i != null && <line x1={geo.xs[i]} x2={geo.xs[i]} y1="0" y2={H4} stroke="var(--tx)" strokeOpacity=".4" vectorEffect="non-scaling-stroke" />}</svg>
          <span className="c-ylab" style={{ top: `${(y(70) / H4) * 100}%` }}>70</span><span className="c-ylab" style={{ top: `${(y(30) / H4) * 100}%` }}>30</span></div></div>; })()}
    {ddv && geo && (() => { const mn = Math.min(0, ...ddv); const H2 = 90; const y = (v: number) => 6 + (v / (mn || -1)) * (H2 - 12); const d = ddv.map((v, k) => `${k ? 'L' : 'M'}${geo.xs[k].toFixed(1)} ${y(v).toFixed(1)}`).join('');
      return <div style={{ marginTop: 8 }}><div className="k">Drawdown from the running peak · worst {pct(mn, 1)}</div><div className="chart-plot" style={{ height: 70, marginTop: 4, cursor: 'default' }} role="img" aria-label={`Drawdown from the running peak, worst ${pct(mn, 1)}`}>
        <svg viewBox={`0 0 ${geo.W} ${H2}`} preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2={geo.W} y1={y(0)} y2={y(0)} stroke="var(--line2)" strokeWidth="1" vectorEffect="non-scaling-stroke" /><path d={`${d}L${geo.xs[geo.xs.length - 1].toFixed(1)} ${y(0)}L${geo.xs[0].toFixed(1)} ${y(0)}Z`} fill="var(--down)" fillOpacity=".12" /><path d={d} fill="none" stroke="var(--down)" strokeWidth="1.25" strokeDasharray="6 2" vectorEffect="non-scaling-stroke" /></svg></div></div>; })()}
  </>;

  return <ChartFrame label="Price history" mode={mode} onMode={(m) => { setMode(m); setCur(null); }}
    title={cmp ? `${sym} against the Nifty 50` : `${name ?? sym} price`} meta={metaBits.join(' · ')} takeaway={take} legend={legend} table={<ChartTable data={table} caption={`${cmp ? 'Indexed comparison' : 'Closing prices'} for ${sym}, ${range}`} unitWord={unitWord} />}
    basis={cmp ? `${BASIS.stock} ${BASIS.nifty} Both lines are indexed to 100 on ${dateLabel(cmp.from.t)} (units: index points).` : instrument ? BASIS.instrument(name ?? sym) : `${BASIS.stock}${candles ? " Candles show each bar's open, high, low and close." : ''} The live price is not drawn here and never moves this chart.`}
    tableLabel="The same figures as a table"
    notes={<>
      {mode === 'chart' && <>
        {bars && eff !== view && !cmp && <p className="small mute" style={{ margin: '8px 0 0' }}>{kind === 'candle' ? 'Candles' : 'Volume'} are drawn as {FRAME_WORD[eff]} bars here: {win.pts.length.toLocaleString('en-IN')} daily bars would be too thin to read, and thinning them would misstate each day.</p>}
        {kind === 'candle' && candles && shown.some((q) => q.o == null || q.h == null || q.l == null) && <p className="small mute" style={{ margin: '8px 0 0' }}>{shown.filter((q) => q.o == null || q.h == null || q.l == null).length} bars have no open, high or low from the source and are drawn as a tick on the close. Up candles are hollow, down candles solid.</p>}
        {kind === 'candle' && candles && !shown.some((q) => q.o == null || q.h == null || q.l == null) && <p className="small mute" style={{ margin: '8px 0 0' }}>Up candles are hollow, down candles solid.</p>}
        {cmp?.trimmed && <p className="small mute" style={{ margin: '8px 0 0' }}>Nifty data starts {dateLabel(cmp.from.t)}, so the comparison starts there.</p>}
        {!hasNifty && !instrument && <p className="small mute" style={{ margin: '8px 0 0' }}>The Nifty 50 could not be read for this window, so there is no benchmark line.</p>}
        {!canLog && log && <p className="small mute" style={{ margin: '8px 0 0' }}>Log scale needs every close above zero; this window has one that is not, so it is drawn linear.</p>}
        {st && !cmp && <div className="c-hl num"><span>LOW <b>{f(st.lo.c)}</b> <i>{dateLabel(st.lo.t, true)}</i></span><span>HIGH <b>{f(st.hi.c)}</b> <i>{dateLabel(st.hi.t, true)}</i></span></div>}
      </>}
      {evOn && evIn.length > 0 && <p className="small mute" style={{ margin: '6px 0 0' }}>{evIn.map((e) => `${dateLabel(e.t)}: ${e.label} (${e.basis})`).join(' · ')}. No other dated events (dividend, split, announcement) are held in this data, so none are marked.</p>}
      {!win.covers && range !== 'Max' && <p className="small mute" style={{ margin: '6px 0 0' }}>Data starts {dateLabel(all[0].t)}: {range} shows all of it.</p>}
      {avail.some((r) => !r.available) && <p className="small mute" style={{ margin: '8px 0 0' }}>{avail.filter((r) => !r.available).map((r) => r.note).join(' · ')}. Max shows all of it.</p>}
      <div className="c-prim" role="group" aria-label="Chart controls">
        <Radios label="Range" value={range} onChange={chooseRange} items={avail.map((r) => ({ id: r.id, label: r.id === 'Max' ? 'MAX' : r.id, disabled: !r.available, hint: r.note ?? undefined }))} />
        {!instrument && <Radios label="Compare" value={vs ? 'vs' : 'price'} onChange={(v) => chooseVs(v === 'vs')} items={[{ id: 'price', label: 'PRICE' }, { id: 'vs', label: 'VS NIFTY', disabled: !hasNifty, hint: !hasNifty ? 'The Nifty could not be read' : undefined }]} />}
      </div>
      <details className="ev c-adv"><summary>Chart options<span className="chev">▾</span></summary><div className="c-bar" role="group" aria-label="Chart options">
        <Radios label="Detail" value={view} onChange={(v) => { setView(v); setCur(null); }} items={[{ id: 'daily', label: 'DAILY' }, { id: 'weekly', label: 'WEEKLY' }, { id: 'monthly', label: 'MONTHLY' }] as { id: Frame; label: string }[]} />
        {hasOhlc && !instrument ? <Radios label="Style" value={kind} onChange={(v) => solo(() => setKind(v))} items={[{ id: 'line', label: 'LINE' }, { id: 'candle', label: 'CANDLES', hint: vs ? 'Candles are drawn for the stock alone: this switches off the Nifty comparison' : undefined }] as { id: 'line' | 'candle'; label: string; hint?: string }[]} /> : null}
        <Radios label="Scale" value={logOn ? 'log' : 'linear'} onChange={(v) => setLog(v === 'log')} items={[{ id: 'linear', label: 'LINEAR' }, { id: 'log', label: 'LOG', disabled: !canLog, hint: !canLog ? 'Log scale needs every close above zero' : undefined }]} />
        <div className="mini-seg" role="group" aria-label="Indicators"><button aria-pressed={ma} onClick={() => setMa(!ma)}>MA 50/200</button><button aria-pressed={vol} disabled={!hasVol} title={!hasVol ? 'This series carries no volume' : vs ? 'Volume is drawn for the stock alone: this switches off the Nifty comparison' : undefined} onClick={() => solo(() => setVol(!vol))}>VOLUME</button><button aria-pressed={rsi} onClick={() => solo(() => setRsi(!rsi))}>RSI 14</button><button aria-pressed={dd} onClick={() => solo(() => setDd(!dd))}>DRAWDOWN</button>{levels.length > 0 && <button aria-pressed={lvOn} disabled={!!cmp} title="Entry, stop and targets of a position you hold or a pick, drawn only where they fall inside the price range shown" onClick={() => setLvOn(!lvOn)}>LEVELS</button>}{events.length > 0 && <button aria-pressed={evOn} disabled={evIn.length === 0} title={evIn.length === 0 ? 'No dated event falls inside this window' : undefined} onClick={() => setEvOn(!evOn)}>EVENTS</button>}</div>
      </div></details>
      <details className="ev" style={{ marginTop: 8 }}><summary>About this chart<span className="chev">▾</span></summary><div className="body small dim">
        <p style={{ margin: '0 0 6px' }}>{logOn ? 'Log scale: equal steps are equal percentage moves, so 100 to 200 looks the same as 200 to 400. Best for long ranges.' : `Linear scale: equal steps are equal amounts of price. Best for short ranges.${st && st.hi.c / Math.max(st.lo.c, 1e-9) >= 3 ? ' This window moved more than threefold, so older moves look small; LOG shows them in proportion.' : ''}`}</p>
        <p style={{ margin: 0 }}>{instrument ? `Daily closes from Yahoo Finance for ${name ?? sym}. Futures contracts roll to the next month, which can leave a small step in the line.` : 'Daily closes from Yahoo Finance, adjusted for splits and bonuses, not for dividends. The Nifty line is the index price, without dividends, like the stock. A price change is the stock on its own; the relative figure is the stock minus the Nifty in percentage points. Past prices say nothing certain about future ones.'}</p></div></details>
    </>}>
    {chart}
  </ChartFrame>;
}
