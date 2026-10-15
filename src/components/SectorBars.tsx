'use client';

import { Rv, Skel } from '@/components/ui';
import { dayLabel, useToday, type TodayData } from '@/components/widgets/DayContext';
import { useDay, useSummary } from '@/lib/data';
import { pct } from '@/lib/format';

/** Median one-day move of each sector's stocks, under the site's one rule for "today" (lib/live.ts): the live snapshot when it
 *  is a newer session than the end-of-day screen and covers 90% of it, otherwise the screen's close. The label says which and
 *  when. Bars grow left (fall) or right (rise) from a centre line, scaled to the largest move shown; the sign and the colour
 *  both say the direction, so colour is never the only cue. On the Today page it reads the page's shared copy; elsewhere
 *  (the Brief) it loads its own. */
export function SectorBars() {
  const shared = useToday();
  return shared ? <Bars t={shared} /> : <OwnBars />;
}

function OwnBars() {
  const { day, live, loading } = useDay();
  const sum = useSummary();
  return <Bars t={{ day, live, loading, screenAsOf: sum.data?.as_of ?? null, summaryError: sum.error }} />;
}

function Bars({ t }: { t: TodayData }) {
  const { day, live } = t;
  const list = day?.sectors ?? [];
  const max = Math.max(0.5, ...list.map((s) => Math.abs(s.median)));
  const failed = !day && !live.loading && !!t.summaryError;
  return (
    <Rv className="panel">
      <div className="eyebrow">Sectors · median one-day move · {dayLabel(day, live.snap) ?? '—'}</div>
      <div className="secbars">
        {!day && !failed && Array.from({ length: 11 }, (_, i) => <Skel key={i} h={22} />)}
        {failed && <p className="muted" style={{ margin: 0 }}>Sector moves could not be loaded. Nothing is estimated in their place.</p>}
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
