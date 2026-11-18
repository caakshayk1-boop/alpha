/** The open book beside the closed record (Tripwire 6.0, 18 Nov 2026). Closed trades have already met a stop, a target or the horizon; open positions have not been tested yet, so a
 *  closed total alone reads worse than the book is and an open total alone reads better. Both are shown, per engine, in R and in counts, and never added into one claim.
 *  No rate, no average and no "expectancy" here: those stay withheld until MIN_TRADES have closed (ledger.ts), exactly as the headline above states. */
import { useMemo } from 'react';
import type { Ledger } from '../ledger.ts';
import { snapshotOf, bookSeries } from '../booksnap.ts';
import { useSnapshots } from '../data.ts';
import { ENGINES } from '../quant.ts';
import { SectionHeader } from '../components/index.ts';
import { dayWord } from '../fmt.ts';

const R = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}R`;
const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

export function BookToday({ l }: { l: Ledger }) {
  const snap = useMemo(() => snapshotOf(l), [l]); const feed = useSnapshots();
  const pts = useMemo(() => bookSeries(feed.data), [feed.data]);
  if (!snap) return null;
  const rows = Object.entries(snap.engines);
  const W = 300, H = 90, pad = 8; const ys = [0, ...pts.map((p) => p.total)]; const lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const x = (i: number) => pad + (i / Math.max(1, pts.length - 1)) * (W - 2 * pad); const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.total).toFixed(1)}`).join(' ');
  const first = pts[0]?.day ?? null;
  return <section className="rec-sec card book-today" aria-labelledby="rec-book" data-book-today>
    <SectionHeader id="rec-book" title="The open book, beside the closed record" description="Closed trades have already met a stop, Target 2 or the horizon. Open positions have not, and their R is a mark that changes every night. Both are shown so neither is read alone; they are not added into one claim." />
    <div className="scroll-x" tabIndex={0} role="region" aria-label="Closed and open book by engine, scrolls sideways"><table className="tbl">
      <thead><tr><th scope="col">Engine</th><th scope="col">Closed</th><th scope="col">Closed R</th><th scope="col">Open</th><th scope="col">Open R</th><th scope="col" className="t1">Past Target 1</th></tr></thead>
      <tbody>{rows.map(([e, s]) => <tr key={e} data-engine={e}><th scope="row">{ENGINES.find((d) => d.id === e)?.name ?? e}</th><td className="num">{s.closed}</td><td className={`num ${tone(s.closedR)}`}>{s.closed ? R(s.closedR) : '—'}</td><td className="num">{s.open}</td><td className={`num ${tone(s.openR)}`}>{s.open ? R(s.openR) : '—'}</td><td className="num t1">{s.t1}</td></tr>)}</tbody>
      <tfoot><tr data-engine="all"><th scope="row">All engines</th><td className="num">{snap.closed}</td><td className={`num ${tone(snap.closedR)}`}>{snap.closed ? R(snap.closedR) : '—'}</td><td className="num">{snap.open}</td><td className={`num ${tone(snap.openR)}`}>{snap.open ? R(snap.openR) : '—'}</td><td className="num t1">{snap.t1}</td></tr></tfoot>
    </table></div>
    <p className="rec-line" data-book-note>Marks are as of the close of {dayWord(snap.day)}{snap.unmarked ? `; ${snap.unmarked} open position${snap.unmarked === 1 ? ' has' : 's have'} no mark yet and ${snap.unmarked === 1 ? 'is' : 'are'} left out of Open R` : ''}. The record is young, so most positions are still open: they have not yet met their stop, Target 2 or the 20-session horizon, and the closed column holds only the early resolutions. Counts per engine are small. Both columns describe what has happened so far and say nothing about what comes next.</p>
    {pts.length >= 2 ? <>
      <svg className="curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Closed R plus open marks by session: ${pts.map((p) => `${dayWord(p.day)} ${R(p.total)}`).join(', ')}.`}><line x1="0" x2={W} y1={y(0)} y2={y(0)} className="curve-zero" /><path d={line} className="curve-line" />{pts.map((p, i) => <circle key={p.day} cx={x(i)} cy={y(p.total)} r="3" className="curve-dot" />)}</svg>
      <p className="rec-line" data-book-curve>Closed R plus the open positions' marks, one point per session since {dayWord(first)}. It is a marked book, not a result, and it begins on that day because the ledger did not keep earlier marks.</p>
    </> : <p className="rec-line" data-book-curve>{feed.loading ? 'Loading the daily snapshots.' : pts.length === 1 ? `Daily snapshots began ${dayWord(first)}. A line needs two sessions.` : 'Daily snapshots have not started yet.'}{' '}The ledger kept only each position's latest mark, so earlier days cannot be rebuilt.</p>}
  </section>;
}
