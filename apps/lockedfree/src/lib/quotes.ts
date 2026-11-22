export interface DatedQuote { px: number; t: number | null }
export const quoteDate = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
export function usableQuote(q: DatedQuote | null | undefined, closeDate?: string): q is DatedQuote {
  return !!q && Number.isFinite(q.px) && q.px > 0 && q.t != null && Number.isFinite(q.t) && q.t > 0 && (!closeDate || quoteDate(q.t) >= closeDate);
}
/** A quote may move the BOOK (the home P&L, the Calls table) only while the session is open. After 15:30 the ledger's own close stands: on 20 Nov 2026 the home page loaded at the ledger's -52,455, then
 *  switched to -59,815 when 15:28 prints arrived, because a same-day print counted as newer than the ledger's close. Per-stock pages may still show the last delayed price, dated; the book may not. */
export function bookQuote(q: DatedQuote | null | undefined, closeDate: string | undefined, open: boolean): q is DatedQuote { return open && usableQuote(q, closeDate); }
export function quoteStamp(t: number | null): string {
  if (t == null || !Number.isFinite(t) || t <= 0) return 'Quote time unavailable';
  return 'Delayed · ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(t * 1000) + ' IST';
}
