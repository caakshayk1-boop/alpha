import { useEffect, useState } from 'react';
import { nseClockOpen } from './stamp.ts';

/** One line under the page bar: whether the NSE clock says open, the IST time, and when the screen data was built.
 *  It states the exchange clock only (weekday 09:15 to 15:30 IST; exchange holidays are not modelled), never that a price is current:
 *  that is each price's own timestamp. It ticks once a minute and fetches nothing. */
export function StatusBar({ asOf }: { asOf?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const open = nseClockOpen(now);
  const ist = new Date(now + 330 * 60000); const hm = ist.toISOString().slice(11, 16); const wd = ist.getUTCDay(); const m = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const phase = open ? 'open' : wd >= 1 && wd <= 5 && m < 9 * 60 + 15 ? 'pre' : 'closed';
  return <div className="statusbar" role="status" aria-label="Market session">
    <span>NSE <b className={phase === 'open' ? 'on' : phase === 'pre' ? 'pre' : 'off'}>{phase === 'open' ? 'OPEN' : phase === 'pre' ? 'PRE-OPEN' : 'CLOSED'}</b></span>
    <span>IST <b>{hm}</b></span>
    <span className="sp" />
    {asOf ? <span>Data through <b>{asOf}</b></span> : null}
  </div>;
}
