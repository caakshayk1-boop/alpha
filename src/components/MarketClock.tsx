'use client';

import { useEffect, useState } from 'react';
import { useLive } from '@/lib/data';
import { nseClock } from '@/lib/live';

const IST_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const dur = (m: number) => (m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

/** The header's market clock. "Open" needs both the hours and a trade in the last 15 minutes (a holiday has the hours but no
 *  trades), so it never claims a market is trading when it is not. Ticks on a 30 s timer, not rAF. */
export function MarketClock() {
  const { snap } = useLive();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  if (now === null) return <span className="mclock" aria-hidden />;
  const c = nseClock(now);
  const trading = c.inHours && !!snap && now / 1000 - snap.newest < 15 * 60;
  const label = trading
    ? `NSE open · prices ${IST_TIME.format(new Date(snap!.newest * 1000))} IST`
    : c.inHours ? 'NSE: no trades in 15 min' : `NSE closed · ${c.nextLabel}`;
  return (
    <span className={`mclock${trading ? ' on' : ''}`} role="status" title={trading ? `Closes in ${dur(c.minutesToNext)}` : `${c.nextLabel}, in ${dur(c.minutesToNext)}`}>
      <i aria-hidden />{label}
    </span>
  );
}
