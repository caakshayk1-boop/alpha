/** NSE session state read from the market's own last trade. */
const IST = { timeZone: 'Asia/Kolkata' } as const;

/** NSE open or closed, read from the Nifty's own last trade, not from a clock: Alpha has no holiday calendar, so a clock
 *  would call a holiday "open". Open = a Nifty trade in the last 15 minutes during 09:15-15:30 IST on a weekday. */
export function sessionOf(at: number | null | undefined, now = Date.now()): { open: boolean; label: string } | null {
  if (!at) return null;
  const ist = new Date(now).toLocaleString('en-GB', { ...IST, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const [wd, hm] = ist.replace(',', '').split(' ');
  const mins = Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
  const inHours = !['Sat', 'Sun'].includes(wd) && mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  const fresh = now - at * 1000 < 15 * 60 * 1000;
  const last = new Date(at * 1000).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return inHours && fresh ? { open: true, label: `NSE open · Nifty last traded ${last} IST` } : { open: false, label: `NSE closed · Nifty last traded ${last} IST` };
}

