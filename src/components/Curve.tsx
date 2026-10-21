'use client';

import { useEffect, useRef } from 'react';
import { canAnimate, gsap } from '@/lib/motion';
import { num } from '@/lib/format';

/** Cumulative R by month for the rule book against random picks. Both are drawn on one scale. */
export default function Curve({ a, b, label = 'rules' }: { a: [string, number][]; b: [string, number][]; label?: string }) {
  const pa = useRef<SVGPathElement>(null);
  const W = 640, H = 220, pad = 36;
  const months = Array.from(new Set([...a, ...b].map(([m]) => m))).sort();
  const lo = Math.min(0, ...a.map((x) => x[1]), ...b.map((x) => x[1]));
  const hi = Math.max(1, ...a.map((x) => x[1]), ...b.map((x) => x[1]));
  const X = (m: string) => pad + (months.indexOf(m) / Math.max(1, months.length - 1)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const path = (s: [string, number][]) => s.map(([m, v], i) => `${i ? 'L' : 'M'}${X(m).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  useEffect(() => {
    const p = pa.current;
    if (!p || !canAnimate()) return;
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.out', immediateRender: false, clearProps: 'strokeDasharray,strokeDashoffset' });
  }, [a.length]);
  if (a.length < 2) return <p className="muted">Not enough trades to draw a curve.</p>;
  const ticks = months.filter((_, i) => i % Math.ceil(months.length / 6) === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 760, height: 'auto', display: 'block', margin: '0 auto' }} role="img" aria-label={`Cumulative R by month, ${label} against random picks`}>
      <line x1={pad} x2={W - pad} y1={Y(0)} y2={Y(0)} stroke="var(--line-2)" strokeDasharray="3 4" />
      {[lo, (lo + hi) / 2, hi].map((v) => <text key={v} x={4} y={Y(v) + 4} fontSize="10" fontFamily="var(--f-mono)" fill="var(--dim)">{num(v, 0)}R</text>)}
      {ticks.map((m) => <text key={m} x={X(m)} y={H - 10} fontSize="10" fontFamily="var(--f-mono)" fill="var(--dim)" textAnchor="middle">{m.slice(2)}</text>)}
      <path d={path(b)} fill="none" stroke="var(--dim)" strokeWidth="1.6" strokeDasharray="5 4" />
      <path ref={pa} d={path(a)} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
      <text x={W - pad} y={Y(a[a.length - 1][1]) - 8} fontSize="11" fill="var(--accent-2)" textAnchor="end" fontWeight="600">{label}</text>
      <text x={W - pad} y={Y(b[b.length - 1]?.[1] ?? 0) + 16} fontSize="11" fill="var(--dim)" textAnchor="end">random picks, same exits</text>
    </svg>
  );
}
