import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dayGeometry, hhmm, type DayGeo } from '../daychart.ts';
import type { Quote } from '../data.ts';

/** One session, drawn properly. Scaled to today's own range and the previous close (never to the entry price), on the whole 09:15 to 15:30 axis for Indian names, so a half-finished day looks half finished.
 *  Green above the previous close, coral below it. Price readouts and range facts sit outside the plot so labels cannot collide. `full` adds the time axis, levels of the person's own (entry, stop, targets) and scrubbing by
 *  touch, mouse or arrow keys; `compact` is the line and its previous-close baseline, for a row or a tile, with no text. Direction is carried by an arrow and a sign as well as colour. */
export interface DayRef { v: number; kind: 'entry' | 'stop' | 'target'; text: string }
const FULL = { w: 320, h: 210 }, COMPACT = { w: 100, h: 40 };
export function DayChart({ q, label, size = 'full', refs = [], nse = true, fmt, good }: { q: Quote; label: string; size?: 'compact' | 'full'; refs?: DayRef[]; nse?: boolean; fmt?: (v: number) => string; /** the colour follows this instead of up/down (a rising VIX is not good news) */ good?: boolean }) {
  const gid = useId().replace(/:/g, ''); const [cur, setCur] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null); const [full, setFull] = useState(FULL);
  const dims = size === 'full' ? full : COMPACT;
  const g = useMemo<DayGeo | null>(() => dayGeometry({ t: q.t, c: q.c, prev: q.prev, nse }, dims.w, dims.h, size === 'full' ? { l: 8, r: 8, t: 16, b: 24 } : { l: 1, r: 1, t: 3, b: 3 }), [q.t, q.c, q.prev, nse, size, dims.w, dims.h]);
  const valid = !!g;
  useEffect(() => {
    const el = wrap.current; if (size !== 'full' || !el) return;
    const measure = () => { const w = Math.max(180, Math.round(el.getBoundingClientRect().width)); const h = w < 600 ? 210 : 280; setFull((old) => old.w === w && old.h === h ? old : { w, h }); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, [size, valid]);
  if (!g) return null;
  const f = fmt ?? ((v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const chg = (v: number) => ((v / q.prev - 1) * 100); const sgn = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`; const arrow = (v: number) => (v >= q.prev ? '▲' : '▼');
  const up = good ?? g.last.c >= q.prev; const col = up ? 'var(--up)' : 'var(--down)';
  const area = `${g.line}L${g.last.x.toFixed(1)} ${g.baseY.toFixed(1)}L${g.open.x.toFixed(1)} ${g.baseY.toFixed(1)}Z`;
  const summary = `${label}: open ${f(g.open.c)}, high ${f(g.high.c)}, low ${f(g.low.c)}, last ${f(g.last.c)}, ${sgn(chg(g.last.c))} against the previous close of ${f(q.prev)}. ${Math.round(g.elapsed * 100)} percent of the session shown.`;
  if (size === 'compact') {
    return <svg className="dc dc-compact" viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="none" role="img" aria-label={summary} focusable="false">
      <defs><clipPath id={`${gid}a`}><rect x="0" y="0" width={dims.w} height={g.baseY} /></clipPath><clipPath id={`${gid}b`}><rect x="0" y={g.baseY} width={dims.w} height={dims.h - g.baseY} /></clipPath></defs>
      <path d={area} className="dc-fill up" clipPath={`url(#${gid}a)`} /><path d={area} className="dc-fill down" clipPath={`url(#${gid}b)`} />
      <line x1="0" x2={dims.w} y1={g.baseY} y2={g.baseY} className="dc-prev" vectorEffect="non-scaling-stroke" />
      <path d={g.line} className="dc-line" stroke={col} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>;
  }
  const idx = Math.min(cur ?? g.pts.length - 1, g.pts.length - 1); const p = g.pts[idx]; const scrubbing = cur != null;
  const move = (e: PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); if (r.width) setCur(g.nearest(((e.clientX - r.left) / r.width) * dims.w)); };
  const key = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCur(Math.max(0, idx - 1)); } else if (e.key === 'ArrowRight') { e.preventDefault(); setCur(Math.min(g.pts.length - 1, idx + 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setCur(0); } else if (e.key === 'End' || e.key === 'Escape') { e.preventDefault(); setCur(null); }
  };

  const noon = Date.parse(`${new Date((g.start + 19800) * 1000).toISOString().slice(0, 10)}T12:00:00+05:30`) / 1000;
  const ticks = g.end - g.start > 3600 * 5 ? [g.start, nse && noon > g.start && noon < g.end ? noon : g.start + (g.end - g.start) / 2, g.end] : [g.start, g.end];
  const edges = refs.map((r) => ({ ...r, at: g.where(r.v) }));
  return <div className="dc-wrap" ref={wrap}>
    <div className="dc-readout"><div><span className="small dim">{label} · {scrubbing ? hhmm(p.t) : `last ${hhmm(g.last.t)}`} IST</span><strong className="num">{f(p.c)}</strong></div><span className={`num ${scrubbing ? '' : up ? 'up' : 'down'}`}>{arrow(p.c)} {sgn(chg(p.c))}</span></div>
    <svg className="dc dc-full" viewBox={`0 0 ${dims.w} ${dims.h}`} style={{ height: dims.h }} role="img" aria-label={`${summary} Use the left and right arrow keys to move along the day.`} tabIndex={0} focusable="false" data-daychart
      onPointerMove={move} onPointerDown={move} onPointerLeave={() => setCur(null)} onPointerCancel={() => setCur(null)} onKeyDown={key} onBlur={() => setCur(null)}>
      <defs><clipPath id={`${gid}a`}><rect x="0" y="0" width={dims.w} height={g.baseY} /></clipPath><clipPath id={`${gid}b`}><rect x="0" y={g.baseY} width={dims.w} height={dims.h - g.baseY} /></clipPath>
        <linearGradient id={`${gid}u`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--up)" stopOpacity=".34" /><stop offset="1" stopColor="var(--up)" stopOpacity=".02" /></linearGradient>
        <linearGradient id={`${gid}d`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="var(--down)" stopOpacity=".34" /><stop offset="1" stopColor="var(--down)" stopOpacity=".02" /></linearGradient></defs>
      {[.25, .5, .75].map((f) => <line key={f} x1={g.pad.l} x2={dims.w - g.pad.r} y1={g.pad.t + f * (dims.h - g.pad.t - g.pad.b)} y2={g.pad.t + f * (dims.h - g.pad.t - g.pad.b)} className="dc-grid" />)}
      <rect x={g.x(g.last.t)} y={g.pad.t} width={Math.max(0, g.x(g.end) - g.x(g.last.t))} height={dims.h - g.pad.t - g.pad.b} className="dc-rest" />
      <path d={area} fill={`url(#${gid}u)`} clipPath={`url(#${gid}a)`} /><path d={area} fill={`url(#${gid}d)`} clipPath={`url(#${gid}b)`} />
      <line x1={g.pad.l} x2={dims.w - g.pad.r} y1={g.baseY} y2={g.baseY} className="dc-prev" /><text x={dims.w - g.pad.r - 2} y={g.baseY - 3} textAnchor="end" className="dc-t dc-faint">prev {f(q.prev)}</text>
      {edges.filter((r) => r.at === 'in').map((r) => <g key={r.kind + r.text}><line x1={g.pad.l} x2={dims.w - g.pad.r} y1={g.y(r.v)} y2={g.y(r.v)} className={`dc-ref ${r.kind}`} /><text x={dims.w - g.pad.r - 2} y={g.y(r.v) - 3} textAnchor="end" className={`dc-t dc-ref-t ${r.kind}`}>{r.text}</text></g>)}
      <path d={g.line} className="dc-line" stroke={col} pathLength={1} />
      {!scrubbing && <circle cx={g.last.x} cy={g.last.y} r="4" fill={col} className="dc-dot" />}
      {scrubbing && <g><line x1={p.x} x2={p.x} y1={g.pad.t} y2={dims.h - g.pad.b} className="dc-cursor" /><circle cx={p.x} cy={p.y} r="4" fill={col} className="dc-dot" /></g>}
      {ticks.map((t, i) => <text key={t} x={i === 0 ? g.x(t) : i === ticks.length - 1 ? g.x(t) : g.x(t)} y={dims.h - 4} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} className="dc-t dc-faint">{hhmm(t)}</text>)}
    </svg>
    <div className="dc-facts num" aria-label="Session price range">{[['Open', g.open.c], ['High', g.high.c], ['Low', g.low.c], ['Prev close', q.prev]].map(([label, value]) => <span key={String(label)}><small>{label}</small><b>{f(Number(value))}</b></span>)}</div>
    {edges.filter((r) => r.at !== 'in').length > 0 && <ul className="dc-edge small num" aria-label="Your levels outside today's range">{edges.filter((r) => r.at !== 'in').map((r) => <li key={r.kind + r.text} className={r.kind}><span aria-hidden="true">{r.at === 'above' ? '▲' : '▼'}</span> {r.text} <span className="mute">· {r.at === 'above' ? 'above' : 'below'} today's range</span></li>)}</ul>}
    <p className="small mute dc-note" aria-live="polite">{scrubbing ? `${hhmm(p.t)} · ${f(p.c)} · ${sgn(chg(p.c))}` : `${Math.round(g.elapsed * 100)}% of the session shown · 5-minute closes · scale is today's range, not your entry or stop`}</p>
    <details className="more dc-table"><summary>Day chart as a table</summary>
      <table className="num"><thead><tr><th scope="col">Time (IST)</th><th scope="col">Price</th><th scope="col">Change</th></tr></thead>
        <tbody>{[...g.pts].reverse().map((r) => <tr key={r.t}><th scope="row">{hhmm(r.t)}</th><td>{f(r.c)}</td><td className={r.c >= q.prev ? 'up' : 'down'}>{arrow(r.c)} {sgn(chg(r.c))}</td></tr>)}</tbody></table>
    </details>
  </div>;
}
