import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { getJson, type ChartFeed } from '../data.ts';
import { RANGES, alignIndexed, dateLabel, nearest, type RangeId } from '../chart.ts';
import { pct } from '../fmt.ts';

const COLORS = ['#c8f23c', '#ff9a6c', '#7fb8ff'];
function useCharts(syms: string[]) {
  const key = syms.join(','); const [st, set] = useState<{ data: Record<string, ChartFeed>; err: Record<string, string> }>({ data: {}, err: {} });
  useEffect(() => {
    let live = true; set({ data: {}, err: {} });
    syms.forEach((s) => getJson<ChartFeed>(`/api/chart?s=${encodeURIComponent(s)}`).then((d) => live && set((x) => ({ ...x, data: { ...x.data, [s]: d } }))).catch((e: Error) => live && set((x) => ({ ...x, err: { ...x.err, [s]: e.message } }))));
    return () => { live = false; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
/** The chosen stocks (and the Nifty) from one shared start, each indexed to 100. Answers "which of these did better over this window?" */
export function CompareChart({ syms }: { syms: string[] }) {
  const { data, err } = useCharts(syms); const [range, setRange] = useState<RangeId>('3Y'); const [log, setLog] = useState(false); const [cur, setCur] = useState<number | null>(null); const box = useRef<HTMLDivElement>(null);
  const failed = Object.keys(err); const ready = syms.every((s) => data[s]);
  const al = useMemo(() => (ready ? alignIndexed(syms.map((s) => ({ id: s, t: data[s].t, c: data[s].c, n: data[s].n })), range) : null), [ready, data, range]);   // eslint-disable-line react-hooks/exhaustive-deps
  const geo = useMemo(() => {
    if (!al) return null; const W = 1000, H = 300, pad = 12; const f = (v: number) => (log ? Math.log(v) : v);
    const all = [...al.lines.flatMap((l) => l.v), ...(al.nifty ?? [])].map(f); let lo = Math.min(...all), hi = Math.max(...all); if (hi === lo) { hi += 1; lo -= 1; }
    const t0 = al.t[0], span = Math.max(1, al.t[al.t.length - 1] - t0); const x = (t: number) => ((t - t0) / span) * W; const y = (v: number) => pad + (1 - (f(v) - lo) / (hi - lo)) * (H - 2 * pad);
    const path = (v: number[]) => al.t.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(v[i]).toFixed(1)}`).join('');
    return { W, H, lines: al.lines.map((l) => path(l.v)), nifty: al.nifty ? path(al.nifty) : null, x, y };
  }, [al, log]);
  if (failed.length) return <div className="card chart"><b>Price comparison</b><p className="dim small" style={{ margin: '6px 0 0' }}>Could not load the price history for {failed.join(', ')} ({err[failed[0]]}). Nothing is drawn in its place.</p></div>;
  if (!ready) return <div className="card chart" aria-busy="true"><div className="sk" style={{ height: 190 }} /><span className="sr">Loading price history</span></div>;
  if (!al || !geo) return <div className="card chart"><b>Price comparison</b><p className="dim small" style={{ margin: '6px 0 0' }}>These names do not share enough trading days in this window to compare. Try a longer range.</p></div>;
  const last = al.t.length - 1; const i = cur == null ? last : Math.min(cur, last);
  const at = (e: PointerEvent) => { const r = box.current!.getBoundingClientRect(); setCur(nearest(al.t.map((t) => ({ t, c: 0 })), (e.clientX - r.left) / r.width)); };
  const ret = (v: number[], k: number) => v[k] - 100;
  const order = al.lines.map((l, k) => ({ id: l.id, k, r: ret(l.v, i) })).sort((a, b) => b.r - a.r);
  return <section className="card chart" aria-label="Price comparison">
    <div className="k">{cur == null ? `Since ${dateLabel(al.t[0])}` : dateLabel(al.t[i])} · each indexed to 100</div>
    <div className="num" style={{ font: '600 1.25rem/1.3 var(--sans)', marginTop: 4 }}>{order.map((o, n) => <span key={o.id}>{n ? <span className="dim"> · </span> : null}<span style={{ color: COLORS[o.k] }}>{o.id}</span> <span className={o.r >= 0 ? 'up' : 'down'}>{pct(o.r)}</span></span>)}</div>
    {al.nifty && <div className="small dim num">Nifty 50 {pct(ret(al.nifty, i))} over the same days</div>}
    <div ref={box} className="cchart" style={{ marginTop: 8 }} role="img" aria-label={`${syms.join(', ')} since ${dateLabel(al.t[0])}: ${order.map((o) => `${o.id} ${pct(o.r)}`).join(', ')}`} onPointerMove={at} onPointerDown={at} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setCur(null); }}>
      <svg viewBox={`0 0 ${geo.W} ${geo.H}`} preserveAspectRatio="none" aria-hidden="true">
        {geo.nifty && <path d={geo.nifty} fill="none" stroke="var(--dim)" strokeWidth="1.6" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        {geo.lines.map((d, k) => <path key={syms[k]} d={d} fill="none" stroke={COLORS[k]} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />)}
        {cur != null && <line x1={geo.x(al.t[i])} x2={geo.x(al.t[i])} y1="0" y2={geo.H} stroke="var(--tx)" strokeOpacity=".35" vectorEffect="non-scaling-stroke" />}
      </svg></div>
    <div className="cleg">{syms.map((s, k) => <span key={s}><i style={{ background: COLORS[k] }} />{s}</span>)}{al.nifty && <span className="dim"><i style={{ background: 'var(--dim)' }} />Nifty 50</span>}</div>
    <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Range">{RANGES.map((r) => <button key={r.id} className="chip" aria-pressed={range === r.id} onClick={() => { setRange(r.id); setCur(null); }}>{r.id}</button>)}
      <button className="chip" aria-pressed={log} onClick={() => setLog(!log)}>{log ? 'Log' : 'Linear'}</button></div>
    <p className="mute small" style={{ margin: '8px 0 0' }}>The window starts on the first day all of them traded together, so a recent listing shortens it. {log ? 'Log: equal steps are equal percentage moves.' : 'Linear: equal steps are equal amounts, indexed to 100.'} Prices only (splits and bonuses adjusted, dividends not included).</p>
  </section>;
}
