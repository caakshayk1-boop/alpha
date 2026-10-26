import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui.tsx';
import { tvUrl } from './tv.ts';

/** A small price line. `refs` are horizontal guides (previous close, entry, stop) drawn only when they fall inside the range. */
export function Spark({ c, refs = [], up, h = 34, label }: { c: number[]; refs?: { v: number; kind: 'prev' | 'entry' | 'stop' }[]; up: boolean; h?: number; label: string }) {
  if (c.length < 2) return null;
  // the scale follows the price line, the previous close and the entry; a stop far below is not allowed to flatten the line (it is drawn only when it is near)
  const near = [...c, ...refs.filter((r) => r.kind !== 'stop').map((r) => r.v)]; let lo = Math.min(...near), hi = Math.max(...near); if (hi === lo) { hi += 1; lo -= 1; }
  const span = hi - lo; const stop = refs.find((r) => r.kind === 'stop');
  if (stop && stop.v >= lo - span * 1.5 && stop.v <= hi + span * 1.5) { lo = Math.min(lo, stop.v); hi = Math.max(hi, stop.v); }
  refs = refs.filter((r) => r.v >= lo && r.v <= hi);
  const W = 100, y = (v: number) => 3 + (1 - (v - lo) / (hi - lo)) * (h - 6); const pts = c.map((v, i) => `${i ? 'L' : 'M'}${((i / (c.length - 1)) * W).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const col = up ? 'var(--lime)' : 'var(--peach)';
  return <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" role="img" aria-label={label} style={{ width: '100%', height: h, display: 'block', overflow: 'visible' }}>
    {refs.map((r) => <line key={r.kind} x1="0" x2={W} y1={y(r.v)} y2={y(r.v)} stroke={r.kind === 'stop' ? 'var(--peach)' : 'var(--dim)'} strokeOpacity={r.kind === 'stop' ? .7 : .45} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
    <path className="c-line" d={pts} pathLength={1} fill="none" stroke={col} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

/** Wraps a number that changes with a brief tint (lime for up, peach for down). Numbers never count through intermediate values. */
export function Tick({ v, children, className = '' }: { v: number | null | undefined; children: ReactNode; className?: string }) {
  const prev = useRef<number | null | undefined>(v); const [dir, setDir] = useState<'' | 'u' | 'd'>(''); const [n, setN] = useState(0);
  useEffect(() => { if (v != null && prev.current != null && v !== prev.current) { setDir(v > prev.current ? 'u' : 'd'); setN((x) => x + 1); } prev.current = v; }, [v]);
  return <span key={n} className={`tick ${dir} ${className}`}>{children}</span>;
}

export function LiveBadge({ live, label }: { live: boolean; label: string }) {
  return <span className={`livebadge ${live ? 'on' : ''}`}><i aria-hidden="true" />{label}</span>;
}

/** Seconds since a timestamp, redrawn every second, as "updated 12s ago". */
export function Ago({ at }: { at: number | null }) {
  const [, force] = useState(0); useEffect(() => { const i = window.setInterval(() => force((x) => x + 1), 1000); return () => window.clearInterval(i); }, []);
  if (!at) return null; const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  return <>{s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`}</>;
}

export function TvButton({ sym, className = 'btn sm', label = 'TradingView' }: { sym: string; className?: string; label?: string }) {
  return <a className={className} href={tvUrl(sym)} target="_blank" rel="noopener noreferrer"><Icon n="chart" />{label}<span className="sr">{label ? ` (${sym} on TradingView, opens in a new tab)` : `${sym} on TradingView, opens in a new tab`}</span></a>;
}

export function TvIcon({ sym }: { sym: string }) {
  return <a className="icon-btn" href={tvUrl(sym)} target="_blank" rel="noopener noreferrer" title="Open on TradingView"><Icon n="chart" /><span className="sr">{sym} on TradingView, opens in a new tab</span></a>;
}
