import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui.tsx';
import { tvUrl } from './tv.ts';
import { rollDiff, type RollChange } from './roll.ts';
import { fmtIst, quoteAge } from './stamp.ts';

/** A small price line. `refs` are horizontal guides (previous close, entry, stop) drawn only when they fall inside the range. */
export function Spark({ c, refs = [], up, h = 34, label }: { c: number[]; refs?: { v: number; kind: 'prev' | 'entry' | 'stop' }[]; up: boolean; h?: number; label: string }) {
  if (c.length < 2) return null;
  // the scale follows the price line, the previous close and the entry; a stop far below is not allowed to flatten the line (it is drawn only when it is near)
  const near = [...c, ...refs.filter((r) => r.kind !== 'stop').map((r) => r.v)]; let lo = Math.min(...near), hi = Math.max(...near); if (hi === lo) { hi += 1; lo -= 1; }
  const span = hi - lo; const stop = refs.find((r) => r.kind === 'stop');
  if (stop && stop.v >= lo - span * 1.5 && stop.v <= hi + span * 1.5) { lo = Math.min(lo, stop.v); hi = Math.max(hi, stop.v); }
  refs = refs.filter((r) => r.v >= lo && r.v <= hi);
  const W = 100, y = (v: number) => 3 + (1 - (v - lo) / (hi - lo)) * (h - 6); const pts = c.map((v, i) => `${i ? 'L' : 'M'}${((i / (c.length - 1)) * W).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const col = up ? 'var(--up)' : 'var(--down)';
  return <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" role="img" aria-label={label} style={{ width: '100%', height: h, display: 'block', overflow: 'visible' }}>
    {refs.map((r) => <line key={r.kind} x1="0" x2={W} y1={y(r.v)} y2={y(r.v)} stroke={r.kind === 'stop' ? 'var(--peach)' : 'var(--dim)'} strokeOpacity={r.kind === 'stop' ? .7 : .45} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
    <path d={pts} fill="none" stroke={col} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

/** A figure that changes: tinted for a moment (green up, coral down), and its changed digits roll for 200 ms. At rest the text is plain. */
export function Roll({ text }: { text: string }) {
  const prev = useRef(text); const [chg, setChg] = useState<Map<number, RollChange>>(new Map());
  useEffect(() => {
    if (prev.current === text) return;
    const d = rollDiff(prev.current, text); prev.current = text;
    if (!d.length || !document.documentElement.classList.contains('fx')) { setChg(new Map()); return; }
    setChg(new Map(d.map((c) => [c.fromEnd, c]))); const t = window.setTimeout(() => setChg(new Map()), 230); return () => window.clearTimeout(t);
  }, [text]);
  const cs = [...text];
  return <span className="roll">{cs.map((c, i) => { const k = cs.length - 1 - i; const ch = chg.get(k); return <span key={k} className={`rd${ch ? ` ${ch.dir}` : ''}`}><span className="cur">{c}</span>{ch && <span className="old" aria-hidden="true">{ch.from}</span>}</span>; })}</span>;
}
export function Tick({ v, children, className = '' }: { v: number | null | undefined; children: ReactNode; className?: string }) {
  const prev = useRef<number | null | undefined>(v); const [dir, setDir] = useState<'' | 'u' | 'd'>('');
  useEffect(() => {
    if (v != null && prev.current != null && v !== prev.current) { setDir(v > prev.current ? 'u' : 'd'); prev.current = v; const t = window.setTimeout(() => setDir(''), 1150); return () => window.clearTimeout(t); }
    prev.current = v;
  }, [v]);
  return <span className={`tick ${dir} ${className}`}>{typeof children === 'string' ? <Roll text={children} /> : children}</span>;
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

/** When the exchange last printed, in Indian time, and how old that is NOW. Read from the quote's own timestamp, so a refresh that brings back the same print
 *  does not look fresh. The source and the measured lag sit in the tooltip; a failed update is said beside the last good time, never instead of it. */
export function Observed({ sec, err, nse = true, source = 'Yahoo Finance', loading = false }: { sec: number | null; err?: string | null; nse?: boolean; source?: string; loading?: boolean }) {
  const [, force] = useState(0); useEffect(() => { const i = window.setInterval(() => force((x) => x + 1), 1000); return () => window.clearInterval(i); }, []);
  if (sec == null) return <span className={err ? 'down' : 'mute'}>{err ? 'prices unavailable' : loading ? '' : ''}</span>;
  const now = Date.now(); const a = quoteAge(sec, now, nse); if (!a) return null;
  const tip = `Source: ${source}. Observed ${fmtIst(sec, now)} (exchange timestamp). Age now ${Math.round(a.lagSec)} s. Prices come through this app's Worker; the age is measured from the print, not from the last refresh.`;
  return <span className={a.tone === 'bad' ? 'down' : a.tone === 'warn' ? 'warnc' : ''} title={tip} aria-label={a.text}>{a.text}{err ? <span className="down"> · update failed</span> : null}</span>;
}
