'use client';

import { useEffect, useRef } from 'react';
import { canAnimate, gsap } from '@/lib/motion';

/** A vertical price ladder: stop, entry and three targets drawn to scale, so reward against risk is seen, not computed. */
export default function Ladder({ sl, entry, targets, last }: { sl: number; entry: number; targets: number[]; last?: number }) {
  const ref = useRef<SVGGElement>(null);
  const top = targets[targets.length - 1];
  const span = top - sl || 1;
  const H = 150;
  const y = (p: number) => 8 + (1 - (p - sl) / span) * (H - 16);
  useEffect(() => {
    if (!ref.current || !canAnimate()) return;
    gsap.fromTo(ref.current.querySelectorAll('.lv'), { scaleX: 0 }, { scaleX: 1, transformOrigin: '0 50%', duration: 0.7, stagger: 0.08, ease: 'power3.out', immediateRender: false, clearProps: 'transform' });
  }, [sl, entry, top]);
  const rows: [string, number, string][] = [
    ...targets.map((t, i) => [`T${i + 1}`, t, 'var(--up)'] as [string, number, string]),
    ['Entry', entry, 'var(--text)'],
    ['Stop', sl, 'var(--down)'],
  ];
  return (
    <svg viewBox={`0 0 170 ${H}`} width="170" height={H} role="img" aria-label={`Trade ladder: stop ${sl}, entry ${entry}, targets ${targets.join(', ')}`}>
      <rect x="0" y={y(entry)} width="170" height={y(sl) - y(entry)} fill="var(--down-soft)" />
      <rect x="0" y={y(top)} width="170" height={y(entry) - y(top)} fill="var(--up-soft)" />
      <g ref={ref}>
        {rows.map(([label, p, c]) => (
          <g key={label}>
            <line className="lv" x1="40" x2="170" y1={y(p)} y2={y(p)} stroke={c} strokeWidth="1.5" />
            <text x="0" y={y(p) + 4} fontSize="10.5" fontFamily="var(--f-mono)" fill={c}>{label}</text>
          </g>
        ))}
        {typeof last === 'number' && last > sl && last < top && <circle cx="40" cy={y(last)} r="4.5" fill="var(--accent)" />}
      </g>
    </svg>
  );
}
