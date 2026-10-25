'use client';
/** Today's progress: how much of today's routine is done, as one dotted arc and three small cards. The arc counts the
 *  followed names you marked reviewed today; the cards are the market gate (rules passed), the Barometer against the previous
 *  reading, and journal reviews that have come due. All counts, all from this browser or the site's own feeds; none is a score
 *  of how well anything went, and with nothing followed the arc is replaced by a way to begin rather than a 0%. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSignals } from '@/lib/data';
import { dateLabel, num } from '@/lib/format';
import { parseJournal } from '@/lib/journal';
import { arcDots, filledDots, reviewedToday, reviewsDue } from '@/lib/progress';
import { readSnapshots, type Snapshot } from '@/lib/review';
import { useStoredList } from '@/lib/store';
import { useBarometer } from '@/lib/useBarometer';

const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const DOTS = 24, R = 96, DOT = 6;

function Arc({ done, total }: { done: number; total: number }) {
  const dots = useMemo(() => arcDots(DOTS, R), []);
  const on = filledDots(done, total, DOTS);
  return (
    <svg className="pg-arc" viewBox={`${-DOT} ${-DOT} ${2 * R + 2 * DOT} ${R + 2 * DOT}`} aria-hidden focusable="false">
      {dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={DOT} className={i < on ? 'on' : ''} />)}
    </svg>
  );
}

export function TodayProgress() {
  const [watch] = useStoredList('alpha-watchlist');
  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  const [due, setDue] = useState<number | null>(null);
  const sig = useSignals();
  const baro = useBarometer();
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
  const g = sig.data?.gate ?? null;
  const r = baro.view?.reading ?? null, prev = baro.view?.previous ?? null;
  return (
    <section className="card pg" aria-labelledby="pg-h">
      <div className="card-h"><h2 id="pg-h">Today&apos;s progress</h2><Link className="more" href="/desk/">My Desk →</Link></div>
      <div className="pg-hero">
        {rv.total > 0 ? (
          <>
            <div className="pg-gauge"><Arc done={rv.done} total={rv.total} /><div className="pg-num"><b className="num">{num(rv.done)}</b><span> of {num(rv.total)}</span></div></div>
            <p className="pg-cap"><b>Names reviewed today</b><span>{rv.done === rv.total ? 'Every name you follow has been reviewed today.' : 'Open a name, then mark it reviewed. Counted from this browser.'}</span></p>
          </>
        ) : (
          <div className="state"><b>Follow a company to start your daily review.</b><p>Reviewing a name saves a snapshot, so tomorrow it shows exactly what changed. Kept in this browser only.</p>
            <div className="acts"><button type="button" className="act primary" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Find a company</button></div></div>
        )}
      </div>
      <ul className="pg-cards">
        <li className="pg-c">
          <span className="pg-l">Market gate</span>
          {g ? <>
            <span className="pg-seg" aria-hidden>{Array.from({ length: g.checks.length }, (_, i) => <i key={i} className={g.checks[i].ok ? 'on' : ''} />)}</span>
            <b className="num">{g.passed} of {g.checks.length} rules</b><span className="pg-s">{g.on ? 'Gate on' : 'Gate off: no new paper entries'}</span>
          </> : <span className="pg-s">{sig.error ? 'Not loaded' : 'Loading…'}</span>}
        </li>
        <li className="pg-c">
          <span className="pg-l">Barometer</span>
          {r ? <>
            <span className="pg-bar" aria-hidden><i style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }} /></span>
            <b className="num">{r.score}/100 · {r.band.t}</b>
            <span className="pg-s">{prev ? `${r.score > prev.score ? 'Up' : r.score < prev.score ? 'Down' : 'Unchanged'}${r.score !== prev.score ? ` ${num(Math.abs(r.score - prev.score))} points` : ''} from ${dateLabel(prev.date)}` : 'A research measure, not a probability'}</span>
          </> : <span className="pg-s">{baro.error ? 'Not loaded' : 'Loading…'}</span>}
        </li>
        <li className="pg-c">
          <span className="pg-l">Journal</span>
          {due === null ? <span className="pg-s">Not available in this browser</span> : <>
            <b className="num">{due === 0 ? 'None due' : `${num(due)} to look at again`}</b>
            <span className="pg-s">{due === 0 ? 'Entries with a review date show here when it arrives.' : <Link className="link" href="/journal/">Write what happened</Link>}</span>
          </>}
        </li>
      </ul>
    </section>
  );
}
