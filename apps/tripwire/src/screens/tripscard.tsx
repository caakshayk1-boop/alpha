import { useMemo } from 'react';
import type { Row } from '../screen.ts';
import { useLedger } from '../data.ts';
import { planAutoBook, DEFAULT_CFG } from '../autobook.ts';
import { tripsOf } from '../trips.ts';
import { dayWord } from '../fmt.ts';

/** Watchlist Trips (4.0, F7): each followed name's state against the latest screen and the paper book, with the date it was judged on.
 *  Reads only what the page already holds; it makes no request and stores nothing. The watchlist is the follow list kept on this device. */
export function TripsCard({ rows, day, follows }: { rows: readonly Row[]; day: string | null; follows: readonly string[] }) {
  const feed = useLedger(); const l = feed.data?.ledger ?? null;
  const plan = useMemo(() => (l ? planAutoBook(l, DEFAULT_CFG) : null), [l]);
  const trips = useMemo(() => tripsOf(follows, rows, day, l, plan), [follows, rows, day, l, plan]);
  if (!trips.length) return null;
  return <section className="tsec card trips" aria-labelledby="trips-h" data-trips>
    <h2 id="trips-h" className="sec">Your watchlist, tripwire by tripwire</h2>
    <ul className="trip-list">{trips.map((t) => <li key={t.sym} data-trip-state={t.state}>
      <a className="trip-sym" href={`#/c/${encodeURIComponent(t.sym)}`}>{t.sym}</a>
      <span className="trip-state" title={t.why}>{t.state}</span>
      <span className="small mute num">{t.asOf ? dayWord(t.asOf) : 'date unknown'}</span>
      <span className="small dim trip-why">{t.why}</span>
    </li>)}</ul>
    <p className="small mute">Judged on the latest screen and the paper book, on the date shown. The watchlist is the list you follow, kept only on this device: clearing this browser's site data clears it. Describes where a name stands; it is not a recommendation.</p>
  </section>;
}
