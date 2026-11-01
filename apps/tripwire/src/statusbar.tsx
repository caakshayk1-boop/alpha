import { useEffect, useState } from 'react';
import { nseClockOpen } from './stamp.ts';
import { throughWord } from './freshness.ts';
import { OPEN_MIN, closureToday, istClock, isTradingDay } from './calendar.ts';
import { SessionPill, GatePill } from './components/pills.tsx';

/** The slim top bar: the wordmark on the left, the freshness pill beside it, the Signals gate pill on the right. On a wide screen it also says whether the NSE clock is open.
 *  It states the exchange clock and calendar only (a trading day, 09:15 to 15:30 IST; NSE holidays from calendar.ts), never that a price is current:
 *  that is each price's own timestamp. The clock ticks once a minute; nothing is fetched here (the gate pill reads the signals file the app already holds, and renders nothing without it). */
export function StatusBar({ asOf }: { asOf?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const open = nseClockOpen(now);
  const hm = new Date(now + 330 * 60000).toISOString().slice(11, 16); const { day, mins } = istClock(now); const holiday = closureToday(now);
  const phase = open ? 'open' : holiday ? 'holiday' : isTradingDay(day) && mins >= 9 * 60 && mins < OPEN_MIN ? 'pre' : 'closed';
  return <div className="statusbar" role="status" aria-label="Market session">
    <span className="brand"><i aria-hidden="true" />Tripwire</span>
    <SessionPill asOf={asOf} showDay />
    <span className="sp" />
    <span className="data" title={holiday ?? undefined}>NSE <b className={phase === 'open' ? 'on' : phase === 'pre' ? 'pre' : 'off'}>{phase === 'open' ? 'open' : phase === 'pre' ? 'pre-open' : phase === 'holiday' ? 'holiday' : 'closed'}</b> · {hm} IST</span>
    <GatePill />
  </div>;
}
