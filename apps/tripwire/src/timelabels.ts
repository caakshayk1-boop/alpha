/** THREE TIMES, ONE VOCABULARY. Every place that shows news or a price says which of three different times it is showing, in the same words, in Indian time:
 *
 *    published   when the SOURCE put the story out (a story's own time).                    "Published 10:12 IST"
 *    checked     when this app last SUCCESSFULLY looked for news (the scheduled check).      "Checked 10:40 IST"
 *    quote       when the EXCHANGE printed the price (the quote's own timestamp).            "Price 14:32 IST" / "Last print 15:29 IST"
 *
 *  plus the two facts that are not times of a fetch: the screen's close ("Screen: close of Fri 23 Oct"), which is a trading day, and an on-demand refresh ("Refreshed on demand 14:40 IST"),
 *  which is the Worker looking because the scheduled check was late, and which never replaces the checked time.
 *
 *  Rules these helpers keep (pinned by tests/timelabels.test.ts):
 *    - "checked" is never "published": a check time is never printed beside a story as if the story were that new.
 *    - a time that is missing, unreadable or in the future is said to be unknown, never "just now" and never invented.
 *    - nothing here says "live". Only a price whose own print is recent (stamp.ts, five minutes) may be called live, and that decision is made there, not here.
 *    - a screen is a close, never a moment: its label names the trading day, not a clock time. */
import { dayWord } from './fmt.ts';
import { fmtIst, quoteAge } from './stamp.ts';

const sec = (iso: string | number | null | undefined): number | null => { if (typeof iso === 'number') return Number.isFinite(iso) ? iso : null; const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? Math.floor(t / 1000) : null; };
/** A time in the future by more than ten minutes is a wrong clock or a wrong date, not news. */
const usable = (s: number | null, nowMs: number): s is number => s != null && s * 1000 <= nowMs + 600_000;

/** "Published 10:12 IST" (today) or "Published Fri 23 Oct 10:12 IST". Unknown stays unknown. */
export function publishedLabel(publishedAt: string | null | undefined, nowMs: number): string {
  const s = sec(publishedAt); return usable(s, nowMs) ? `Published ${fmtIst(s, nowMs)}` : 'Publication time unknown';
}
/** "Checked 10:40 IST": the last SUCCESSFUL check. `ok: false` says the latest attempt failed and that this is the last good copy; it never prints a failed attempt's time as a check. */
export function checkedLabel(lastGoodAt: string | null | undefined, nowMs: number, opts: { ok?: boolean } = {}): string {
  const s = sec(lastGoodAt); if (!usable(s, nowMs)) return 'Not checked yet';
  return `Checked ${fmtIst(s, nowMs)}${opts.ok === false ? ' (last good copy; the latest check failed)' : ''}`;
}
/** "Refreshed on demand 14:40 IST": the Worker looked because the scheduled check was late. Not a scheduled check, and not a time any story was published. */
export function onDemandLabel(at: string | null | undefined, nowMs: number): string | null {
  const s = sec(at); return usable(s, nowMs) ? `Refreshed on demand ${fmtIst(s, nowMs)}` : null;
}
/** The price's own time. Live only when the print is recent (five minutes, by the quote's own timestamp); otherwise the last print, with its time, never "now". `nse` false for round-the-clock markets. */
export function quoteLabel(printSec: number | null | undefined, nowMs: number, nse = true): { text: string; live: boolean } {
  const a = quoteAge(printSec ?? null, nowMs, nse); if (!a) return { text: 'No price time', live: false };
  if (a.state === 'live') return { text: `Price ${fmtIst(printSec as number, nowMs)}`, live: true };
  if (a.state === 'lagging') return { text: `Price ${fmtIst(printSec as number, nowMs)}, ${Math.round(a.lagSec / 60)} min old`, live: false };
  return { text: a.state === 'stale' ? `No print since ${fmtIst(printSec as number, nowMs)}` : `Last print ${fmtIst(printSec as number, nowMs)}`, live: false };
}
/** The screen is a close. "Screen: close of Fri 23 Oct", with how far behind the last finished session it is when it is. */
export function screenLabel(asOf: string | null | undefined, behind: number | null = null): string {
  if (!asOf) return 'Screen: date unknown';
  return `Screen: close of ${dayWord(asOf)}${behind ? `, ${behind === 1 ? 'one session' : `${behind} sessions`} behind` : ''}`;
}
/** The three times at a glance, for one place that has to show more than one: published and checked for a story list, price for a quote. `now` is the clock the page is read on. */
export function timesLine(p: { publishedAt?: string | null; lastGoodAt?: string | null; printSec?: number | null; nse?: boolean }, nowMs: number): string[] {
  const out: string[] = [];
  if (p.publishedAt !== undefined) out.push(publishedLabel(p.publishedAt, nowMs));
  if (p.lastGoodAt !== undefined) out.push(checkedLabel(p.lastGoodAt, nowMs));
  if (p.printSec !== undefined) out.push(quoteLabel(p.printSec, nowMs, p.nse).text);
  return out;
}
