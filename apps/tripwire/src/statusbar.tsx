import { useEffect, useState } from 'react';
import { nseClockOpen } from './stamp.ts';
import { OPEN_MIN, closureToday, istClock, isTradingDay } from './calendar.ts';

/** One line under the page bar: whether the NSE clock says open, the IST time, and when the screen data was built.
 *  It states the exchange clock and calendar only (a trading day, 09:15 to 15:30 IST; NSE holidays from calendar.ts), never that a price is current:
 *  that is each price's own timestamp. It ticks once a minute and fetches nothing. */
export function StatusBar({ asOf }: { asOf?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const open = nseClockOpen(now);
  const hm = new Date(now + 330 * 60000).toISOString().slice(11, 16); const { day, mins } = istClock(now); const holiday = closureToday(now);
  const phase = open ? 'open' : holiday ? 'holiday' : isTradingDay(day) && mins >= 9 * 60 && mins < OPEN_MIN ? 'pre' : 'closed';
  return <div className="statusbar" role="status" aria-label="Market session">
    <span className="brand"><i aria-hidden="true" />TRIPWIRE</span>
    <span>NSE <b className={phase === 'open' ? 'on' : phase === 'pre' ? 'pre' : 'off'} title={holiday ?? undefined}>{phase === 'open' ? 'OPEN' : phase === 'pre' ? 'PRE-OPEN' : phase === 'holiday' ? 'HOLIDAY' : 'CLOSED'}</b></span>
    <span>IST <b>{hm}</b></span>
    <span className="sp" />
    {asOf ? <span className="data">Data through <b>{asOf}</b></span> : null}
  </div>;
}
