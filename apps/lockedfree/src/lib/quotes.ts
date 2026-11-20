export interface DatedQuote { px: number; t: number | null }
export const quoteDate = (t: number) => new Date((t + 19800) * 1000).toISOString().slice(0, 10);
export function usableQuote(q: DatedQuote | null | undefined, closeDate?: string): q is DatedQuote {
  return !!q && Number.isFinite(q.px) && q.px > 0 && q.t != null && Number.isFinite(q.t) && q.t > 0 && (!closeDate || quoteDate(q.t) >= closeDate);
}
export function quoteStamp(t: number | null): string {
  if (t == null || !Number.isFinite(t) || t <= 0) return 'Quote time unavailable';
  return 'Delayed · ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(t * 1000) + ' IST';
}
