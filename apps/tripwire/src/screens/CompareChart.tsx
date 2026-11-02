import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { setState, useAppState } from '../app.tsx';
import { SLOW_DOWN, getJson, hasHistory, type ChartFeed } from '../data.ts';
import { RANGES, alignIndexed, dateLabel, nearestX, xTicks, yTicks, type RangeId, type Series } from '../chart.ts';
import { pct } from '../fmt.ts';
import { Radios } from '../ui.tsx';
import { BASIS, ChartFrame, ChartState, ChartTable, SeriesLegend, arrowOf, buildTable, compareTakeaway, coverageOf, drawdownLines, isRangeId, markerPath, spreadLabels, styleOf, windowWords } from '../charts/index.ts';

function useCharts(syms: string[]) {
  const key = syms.join(','); const [st, set] = useState<{ data: Record<string, ChartFeed>; err: Record<string, string> }>({ data: {}, err: {} });
  useEffect(() => {
    let live = true; set({ data: {}, err: {} });
    syms.forEach((s) => getJson<ChartFeed>(`/api/chart?s=${encodeURIComponent(s)}`).then((d) => { if (!live) return; if (!hasHistory(d)) throw new Error('The price history could not be read right now.'); set((x) => ({ ...x, data: { ...x.data, [s]: d } })); }).catch((e: Error) => live && set((x) => ({ ...x, err: { ...x.err, [s]: e.message } }))));
    return () => { live = false; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
type Metric = 'return' | 'drawdown';
/** The chosen stocks (and the Nifty) from one shared start, each indexed to 100, in the shared chart frame: takeaway first, then the lines, then what the shared window cost each name.
 *  A drawdown view of the same window sits beside the indexed return. */
export function CompareChart({ syms }: { syms: string[] }) {
  const { data, err } = useCharts(syms); const app = useAppState(); const saved = app.prefs.chart?.range;
  const [rangeSel, setRange] = useState<RangeId | null>(null); const range: RangeId = rangeSel ?? (isRangeId(saved) ? saved : '1Y');
  const [log, setLog] = useState(false); const [metric, setMetric] = useState<Metric>('return');
  const [cur, setCur] = useState<number | null>(null); const box = useRef<HTMLDivElement>(null); const [wpx, setWpx] = useState(340);
  const failed = Object.keys(err); const ready = syms.every((s) => data[s]);
  useEffect(() => { const el = box.current; if (!el) return; const set = () => { const w = el.clientWidth; if (w > 0) setWpx(w); }; set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect(); }, [ready, metric]);
  const series: Series[] = useMemo(() => (ready ? syms.map((s) => ({ id: s, t: data[s].t, c: data[s].c, n: data[s].n })) : []), [ready, data, syms.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const al = useMemo(() => (ready ? alignIndexed(series, range) : null), [ready, series, range]);
  const lines = useMemo(() => {
    if (!al) return null;
    const ret = [...al.lines.map((l, k) => ({ id: l.id, v: l.v, st: styleOf(k, l.id) })), ...(al.nifty ? [{ id: 'Nifty 50', v: al.nifty, st: styleOf(-1, 'Nifty 50') }] : [])];
    const dd = drawdownLines(al).map((l, k) => ({ ...l, st: k < al.lines.length ? styleOf(k, l.id) : styleOf(-1, 'Nifty 50') }));
    return { ret, dd };
  }, [al]);
  const geo = useMemo(() => {
    if (!al || !lines) return null; const W = 1000, H = 300, pad = 12; const gut = Math.round((64 / wpx) * 1000); const L = metric === 'return' ? lines.ret : lines.dd; const useLog = log && metric === 'return';
    const f = (v: number) => (useLog ? Math.log(v) : v); const all = L.flatMap((l) => l.v); const vals = all.map(f);
    let lo = Math.min(...vals), hi = Math.max(...vals); if (metric === 'drawdown') hi = 0; if (hi === lo) { hi += 1; lo -= 1; }
    const t0 = al.t[0], span = Math.max(1, al.t[al.t.length - 1] - t0); const xs = al.t.map((t) => ((t - t0) / span) * (W - gut)); const y = (v: number) => pad + (1 - (f(v) - lo) / (hi - lo)) * (H - 2 * pad);
    const paths = L.map((l) => l.v.map((v, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)} ${y(v).toFixed(1)}`).join(''));
    return { W, H, xs, y, paths, L, ticks: yTicks(Math.min(...all), Math.max(...all, metric === 'drawdown' ? 0 : -Infinity), useLog, 4), zeroY: metric === 'drawdown' ? y(0) : y(100) };
  }, [al, lines, log, metric, wpx]);
  if (failed.length) return <ChartState title="Price comparison">{failed.every((f) => err[f] === SLOW_DOWN) ? `${SLOW_DOWN}, then reload this page. Nothing is drawn in its place.` : `Could not load the price history for ${failed.join(', ')} (${err[failed[0]]}). Nothing is drawn in its place.`}</ChartState>;
  if (!ready) return <ChartState title="Price comparison" busy />;
  if (!al || !geo || !lines) return <ChartState title="Price comparison" action={<Radios label="Range" value={range} onChange={(r) => setRange(r)} items={RANGES.map((r) => ({ id: r.id, label: r.id === 'Max' ? 'MAX' : r.id }))} />}>These names do not share enough trading days in this window to compare. Try a longer range.</ChartState>;
  const last = al.t.length - 1; const i = cur == null ? last : Math.min(cur, last);
  const at = (e: PointerEvent) => { const r = box.current!.getBoundingClientRect(); setCur(nearestX(geo.xs, ((e.clientX - r.left) / r.width) * geo.W)); };
  const key = (e: KeyboardEvent) => { const step = e.shiftKey ? 10 : 1; if (e.key === 'ArrowLeft') { e.preventDefault(); setCur(Math.max(0, i - step)); } else if (e.key === 'ArrowRight') { e.preventDefault(); setCur(Math.min(last, i + step)); } else if (e.key === 'Home') { e.preventDefault(); setCur(0); } else if (e.key === 'End') { e.preventDefault(); setCur(last); } else if (e.key === 'Escape') setCur(null); };
  const cov = coverageOf(series, al, range);
  const words = cov.shorter || range === 'Max' ? `the ${cov.spanYears >= 1.5 ? cov.spanYears.toFixed(1) + ' years' : Math.max(1, Math.round(cov.spanYears * 12)) + ' months'} since ${dateLabel(al.t[0])}` : windowWords(range, true, cov.spanYears);
  const take = compareTakeaway({ t: al.t, lines: al.lines, nifty: al.nifty, words });
  const L = geo.L; const value = (v: number) => (metric === 'return' ? pct(v - 100) : pct(v)); const dir = (v: number) => arrowOf(metric === 'return' ? v - 100 : v);
  const ends = spreadLabels(L.map((l) => geo.y(l.v[last]) / geo.H));
  const table = buildTable(al.t, L.map((l) => ({ key: l.id, label: l.id, unit: metric === 'return' ? '(index)' : '(% from peak)', digits: metric === 'return' ? 1 : 1, v: l.v })), { monthly: false });
  const setR = (r: RangeId) => { setRange(r); setCur(null); setState((x) => ({ ...x, prefs: { ...x.prefs, chart: { ...x.prefs.chart, range: r } } })); };
  return <ChartFrame label="Price comparison"
    title={metric === 'return' ? 'Price change, each indexed to 100' : 'Fall from the running peak'} meta={`${range === 'Max' ? 'All shared history' : range} · daily closes · ${metric === 'return' ? 'index points (100 = the start)' : '% below the highest close so far'} · from ${dateLabel(al.t[0])} through ${dateLabel(al.t[last])}`}
    takeaway={take} busy={false}
    legend={<SeriesLegend items={L.map((l) => ({ style: l.st, value: value(l.v[i]), arrow: dir(l.v[i]), title: cur == null ? undefined : dateLabel(al.t[i]) }))} label={cur == null ? 'Lines on this chart, latest values' : `Lines on this chart at ${dateLabel(al.t[i])}`} />}
    table={<ChartTable data={table} caption={`${syms.join(', ')} ${metric === 'return' ? 'indexed to 100' : 'drawdown'}, ${range}`} unitWord="daily points" />}
    basis="Daily closes, indexed to 100, split-adjusted, dividends not included"
    notes={<>
      {cov.notes.map((n) => <p key={n} className="small mute" role="note" style={{ margin: '8px 0 0' }}>{n}</p>)}
      {!al.nifty && <p className="small mute" style={{ margin: '8px 0 0' }}>The Nifty 50 line is missing: the first stock has no Nifty close on the first shared day.</p>}
      <div className="c-prim" role="group" aria-label="Chart controls">
        <Radios label="Range" value={range} onChange={setR} items={RANGES.map((r) => ({ id: r.id, label: r.id === 'Max' ? 'MAX' : r.id }))} />
        <div className="c-prim2"><Radios label="Measure" value={metric} onChange={(m) => { setMetric(m); setCur(null); }} items={[{ id: 'return', label: 'RETURN' }, { id: 'drawdown', label: 'DRAWDOWN' }]} />
        <Radios label="Scale" value={log && metric === 'return' ? 'log' : 'linear'} onChange={(v) => setLog(v === 'log')} items={[{ id: 'linear', label: 'LINEAR' }, { id: 'log', label: 'LOG', disabled: metric !== 'return', hint: metric !== 'return' ? 'Log applies to the indexed return' : undefined }]} /></div>
      </div>
      <details className="ev" style={{ marginTop: 8 }}><summary>About this chart<span className="chev">▾</span></summary><div className="body small dim"><p style={{ margin: '0 0 6px' }}>{BASIS.stock}</p><p style={{ margin: '0 0 6px' }}>{BASIS.nifty}</p><p style={{ margin: 0 }}>Every line starts at 100 on the first day all of them traded together ({dateLabel(al.t[0])}).</p></div></details>
    </>}>
    <div ref={box} className="cchart chart-plot" tabIndex={0} role="slider" aria-label={`${syms.join(', ')} compared since ${dateLabel(al.t[0])}. Use the arrow keys to move along the lines.`} aria-valuemin={0} aria-valuemax={last} aria-valuenow={i}
      aria-valuetext={`${dateLabel(al.t[i])}: ${L.map((l) => `${l.id} ${value(l.v[i])}`).join(', ')}`} style={{ touchAction: 'pan-y', height: 220 }}
      onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCur(null); }} onKeyDown={key} onBlur={() => setCur(null)}>
      <svg viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" aria-hidden="true" style={{ height: '100%' }}>
        {geo.ticks.map((v) => <line key={v} x1="0" x2={geo.W} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <line x1="0" x2={geo.W} y1={geo.zeroY} y2={geo.zeroY} stroke="var(--line-2)" strokeWidth="1" strokeDasharray="1 4" vectorEffect="non-scaling-stroke" />
        {[...geo.paths].map((d, k) => k).reverse().map((k) => <path key={L[k].id} className="c-line settled" d={geo.paths[k]} fill="none" stroke={L[k].st.color} strokeWidth={L[k].st.width} strokeDasharray={L[k].st.dash || undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />)}
        {cur != null && <line x1={geo.xs[i]} x2={geo.xs[i]} y1="0" y2={geo.H} stroke="var(--tx)" strokeOpacity=".4" vectorEffect="non-scaling-stroke" />}
      </svg>
      {geo.ticks.map((v) => <span key={v} className="c-ylab" style={{ top: `${(geo.y(v) / geo.H) * 100}%`, right: 'auto', left: 6 }}>{metric === 'return' ? v.toFixed(0) : `${v.toFixed(0)}%`}</span>)}
      {L.map((l, k) => <span key={l.id} className="c-end" style={{ top: `${ends[k] * 100}%` }}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d={markerPath(l.st.marker, 6, 6, 3.6)} fill={l.st.color} /></svg>{dir(l.v[last])} {value(l.v[last])}</span>)}
      {cur != null && L.map((l) => <span key={l.id} className="c-dot" style={{ left: `${(geo.xs[i] / geo.W) * 100}%`, top: `${(geo.y(l.v[i]) / geo.H) * 100}%`, background: l.st.color }} />)}
      {cur != null && <span className="c-tip" aria-hidden="true" style={geo.xs[i] / geo.W > 0.55 ? { right: `${100 - (geo.xs[i] / geo.W) * 100 + 2}%` } : { left: `${(geo.xs[i] / geo.W) * 100 + 2}%` }}>{dateLabel(al.t[i])} · {L.map((l) => `${l.id} ${value(l.v[i])}`).join(' · ')}</span>}
    </div>
    <div className="c-xaxis" aria-hidden="true">{xTicks(al.t[0], al.t[last], 5).map((x) => <span key={x.t} style={{ left: `${(((x.t - al.t[0]) / Math.max(1, al.t[last] - al.t[0])) * (geo.xs[last] / geo.W)) * 100}%` }}>{x.label}</span>)}</div>
  </ChartFrame>;
}
