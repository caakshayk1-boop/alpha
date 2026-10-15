/** One stock's price and day move under the site's one "today" rule (lib/live.ts pickDay), per symbol.
 *
 *  Three sources can price a stock: the live snapshot of the whole screen (/api/live), a per-symbol quote (/api/px), and the
 *  end-of-day screen row (price, r1d, last_date). The newer session wins; on a tie the screen close wins, because it is the
 *  vetted close. Every view says which one it shows: "live 10:26 IST", "last trade 10:05 IST" or "14 Oct 2026 close".
 *  Pure functions only: tested in tests/lib.test.ts. */
import { istDate, nseClock, type LiveSnap } from './live.ts';

export interface CloseRow { price?: number | null; r1d?: number | null; last_date?: string | null }
export interface QuoteLike { price: number; pct: number; at: number | null }
export interface PriceView {
  price: number | null;
  /** one-day change in percent against the previous close */
  pct: number | null;
  /** 'stale': the live source has this stock, but its last trade is older than the current session (suspended, illiquid or
   *  unadjusted): the price is shown with that date and NO day move, because the "previous close" may not be comparable. */
  source: 'live' | 'quote' | 'close' | 'stale';
  /** the IST session (YYYY-MM-DD) the figures describe */
  session: string | null;
  /** epoch seconds of the trade behind a live or quote figure; null for a screen close */
  at: number | null;
}

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function priceView(sym: string, row: CloseRow | null | undefined, snap: LiveSnap | null | undefined, quote?: QuoteLike | null): PriceView {
  const close = row?.last_date ?? null;
  const lp = snap?.price[sym];
  if (snap && ok(lp) && lp > 0) {
    const own = snap.at?.[sym] ?? snap.newest;
    const ownDay = istDate(own);
    if (ownDay < snap.session) {
      // did not trade in the live session: never a "today" move. Show the last trade only if it is newer than the close.
      if (!close || ownDay > close) return { price: lp, pct: null, source: 'stale', session: ownDay, at: own };
    } else if (!close || snap.session > close) return { price: lp, pct: ok(snap.pct[sym]) ? snap.pct[sym] : null, source: 'live', session: snap.session, at: own };
  }
  if (quote && quote.at && ok(quote.price) && quote.price > 0) {
    const s = istDate(quote.at);
    const stale = !!snap && s < snap.session;
    if (!close || s > close) return { price: quote.price, pct: stale ? null : ok(quote.pct) ? quote.pct : null, source: stale ? 'stale' : 'quote', session: s, at: quote.at };
  }
  return { price: ok(row?.price) ? row!.price! : null, pct: ok(row?.r1d) ? row!.r1d! : null, source: 'close', session: close, at: null };
}

const IST_HM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
/** "14 Oct 2026" from YYYY-MM-DD, independent of the reader's timezone. */
export const sessionLabel = (iso: string | null | undefined): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'date not stated';
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
export const istTime = (epochS: number): string => IST_HM.format(new Date(epochS * 1000));

/** How a price is labelled. Live only inside NSE hours with a trade in the last 15 minutes; a same-day trade inside hours that
 *  has gone quiet is "last trade"; anything else is that session's close. */
export function priceLabel(v: Pick<PriceView, 'source' | 'session' | 'at'>, now = Date.now()): { live: boolean; text: string } {
  if (v.source === 'stale') return { live: false, text: `last traded ${sessionLabel(v.session)}` };
  if (v.source !== 'close' && v.at) {
    const c = nseClock(now);
    if (c.inHours && now / 1000 - v.at < 15 * 60) return { live: true, text: `live ${istTime(v.at)} IST` };
    if (c.inHours && v.session === istDate(now / 1000)) return { live: false, text: `last trade ${istTime(v.at)} IST` };
  }
  return { live: false, text: `${sessionLabel(v.session)} close` };
}
