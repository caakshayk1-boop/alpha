/** NSE session state read from the market's own last trade. */
import { nseClock } from './live.ts';
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


const WEEKDAY_LONG = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const IST_HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The page headline's date line: the newest session any figure describes, and the market's state now.
 *  "Tuesday 20 October · live 14:42 IST" while trades are fresh in NSE hours; "Tuesday 20 October · market close" once that
 *  session is over; "Monday 19 October · latest close · NSE opens 09:15 IST today" before the bell, at weekends and on
 *  holidays (when the newest session is not today). Never a date older than the newest data. */
export function sessionHead(session: string | null, snap: { newest: number; session: string } | null, now = Date.now()): string | null {
  if (!session) return null;
  const wd = WEEKDAY_LONG.format(new Date(`${session}T12:00:00Z`));
  const today = IST_DAY.format(new Date(now));
  const hm = Number(IST_HM.format(new Date(now)).replace(':', ''));
  const inHours = hm >= 915 && hm < 1530;
  if (snap && snap.session === session && inHours && now / 1000 - snap.newest < 15 * 60) return `${wd} · live ${IST_HM.format(new Date(snap.newest * 1000))} IST`;
  if (session === today) return `${wd} · market close`;
  return `${wd} · latest close · NSE ${nseClock(now).nextLabel}`;
}
