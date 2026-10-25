'use client';
/** Today's progress: how much of today's routine is done, as one dotted arc and three small cards. The arc counts the
 *  followed names you marked reviewed today, beside the journal reviews that have come due. Counts from this browser only; none is
 *  a score of how well anything went, and with nothing followed the arc is replaced by a way to begin rather than a 0%. The market
 *  gate and the Barometer are NOT repeated here: the Signals card and the market read own them. */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DotGauge } from '@/components/DotGauge';
import { num } from '@/lib/format';
import { parseJournal } from '@/lib/journal';
import { reviewedToday, reviewsDue } from '@/lib/progress';
import { readSnapshots, type Snapshot } from '@/lib/review';
import { useStoredList } from '@/lib/store';
import { useFirstPlay } from '@/lib/useFirstPlay';

const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export function TodayProgress() {
  const [watch] = useStoredList('alpha-watchlist');
  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  const [due, setDue] = useState<number | null>(null);
  const play = useFirstPlay('alpha-played-progress');
  const day = istToday();
  useEffect(() => {
    const read = () => setSnaps(readSnapshots());
    read();
    window.addEventListener('alpha-reviewed', read);
    return () => window.removeEventListener('alpha-reviewed', read);
  }, []);
  useEffect(() => {
    const read = () => { try { setDue(reviewsDue(parseJournal(localStorage.getItem('alpha-journal')), day)); } catch { setDue(null); } };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, [day]);
  const rv = reviewedToday(watch, snaps, day);
  return (
    <section className="card pg" aria-labelledby="pg-h">
      <div className="card-h"><h2 id="pg-h">Today&apos;s progress</h2><Link className="more" href="/desk/">My Desk →</Link></div>
      <div className="pg-row">
        {rv.total > 0 ? (
          <div className="pg-hero">
            <DotGauge value={rv.done} max={rv.total} play={play} className="dg-sm">
              <b className="num dg-n">{num(rv.done)}</b>
              <span className="dg-u">of {num(rv.total)} reviewed</span>
            </DotGauge>
            <p className="pg-cap"><b>Names reviewed today</b><span>{rv.done === rv.total ? 'Every name you follow has been reviewed today.' : 'Open a name, then mark it reviewed. Counted in this browser.'}</span></p>
          </div>
        ) : (
          <div className="state"><b>Follow a company to start your daily review.</b><p>Reviewing a name saves a snapshot, so tomorrow it shows exactly what changed. Kept in this browser only.</p>
            <div className="acts"><button type="button" className="act primary" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Find a company</button></div></div>
        )}
        <div className="pg-c">
          <span className="pg-l">Journal</span>
          {due === null ? <span className="pg-s">Not available in this browser</span> : <>
            <b className="num">{due === 0 ? 'None due' : `${num(due)} to look at again`}</b>
            <span className="pg-s">{due === 0 ? 'Entries with a review date show here when it arrives.' : <Link className="link" href="/journal/">Write what happened</Link>}</span>
          </>}
        </div>
      </div>
    </section>
  );
}
