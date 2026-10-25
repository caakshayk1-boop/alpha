'use client';
/** A dotted-arc gauge: a measured value against a stated maximum, as lit dots on concentric semicircles, with its figure in the
 *  centre as real text. The dots are decoration (aria-hidden); the figure and the caption carry the meaning. With `play` the dots
 *  light in sequence once (CSS; the site's motion setting and reduced-motion remove it). A missing value lights nothing. */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { fraction, gaugeBox, gaugeDots, lit } from '@/lib/gauge';

const RINGS = 3, BASE = 13, R0 = 62, GAP = 15, DOT = 5;

export function DotGauge({ value, max = 100, play = false, className = '', children }: { value: number | null | undefined; max?: number; play?: boolean; className?: string; children?: ReactNode }) {
  const dots = useMemo(() => gaugeDots(RINGS, BASE, R0, GAP, DOT), []);
  const box = useMemo(() => gaugeBox(RINGS, R0, GAP, DOT), []);
  const f = fraction(value, max);
  return (
    <div className={`dg ${className}`} data-play={play ? '' : undefined}>
      <svg viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden focusable="false">
        {dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={DOT} className={lit(p.t, f) ? 'on' : ''} style={{ '--d': `${Math.round(p.t * 700)}ms` } as CSSProperties} />)}
      </svg>
      <div className="dg-c">{children}</div>
    </div>
  );
}
