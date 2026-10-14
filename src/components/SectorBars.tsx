'use client';

import { Rv, Skel } from '@/components/ui';
import { useSummary } from '@/lib/data';
import { dateLabel, pct } from '@/lib/format';

/** Median one-day move of each sector's stocks, from /api/summary: the same rows and the same day as the breadth figures it
 *  sits beside. Bars grow left (fall) or right (rise) from a centre line, scaled to the largest move shown; the sign and the
 *  colour both say the direction, so colour is never the only cue. */
export function SectorBars() {
  const sum = useSummary();
  const list = sum.data?.sectors ?? [];
  const max = Math.max(0.5, ...list.map((s) => Math.abs(s.median)));
  return (
    <Rv className="panel">
      <div className="eyebrow">Sectors · median one-day move · {sum.data ? dateLabel(sum.data.as_of) : '—'}</div>
      <div className="secbars">
        {!sum.data && !sum.error && Array.from({ length: 11 }, (_, i) => <Skel key={i} h={22} />)}
        {sum.error && <p className="muted" style={{ margin: 0 }}>Sector moves could not be loaded. Nothing is estimated in their place.</p>}
        {list.map((s) => {
          const w = (Math.abs(s.median) / max) * 50;
          return (
            <div className="secbar" key={s.name} title={`median of ${s.n} stocks`}>
              <span>{s.name}</span>
              <span className="track" aria-hidden><i style={s.median >= 0 ? { left: '50%', width: `${w}%`, background: 'var(--up)' } : { right: '50%', width: `${w}%`, background: 'var(--down)' }} /></span>
              <span className={`v num ${s.median > 0 ? 'up' : s.median < 0 ? 'down' : ''}`}>{pct(s.median, 2)}</span>
            </div>
          );
        })}
      </div>
    </Rv>
  );
}
