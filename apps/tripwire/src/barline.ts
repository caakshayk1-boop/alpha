/** The one line a price chart prints about its LAST bar (13 Nov 2026, v5; master prompt 2.3b). Pure: the clock is a parameter.
 *
 *  A daily bar is confirmed, forming, stale or missing (ledgerview.barStatus). A chart that ends on a forming bar draws a provisional endpoint, and a chart whose newest bar is older than the last finished session
 *  is out of date; neither may read as a normal, finished series. A confirmed last bar needs no caption (the data-through date in the header already says it), so it returns no text.
 *  Nothing here changes what is drawn or any rule: it only names the state. */
import { barStatus, barsCaption, type BarStatus } from './ledgerview.ts';
import { dateLabel } from './chart.ts';

export interface BarLine { status: BarStatus; /** the sentence to print; null when the last bar is confirmed */ text: string | null; /** the measured detail (confirmed-through day, observation time), for a tooltip */ detail: string | null }
export function barLine(raw: readonly { t: number; forming?: boolean }[] | null | undefined, nowMs: number): BarLine {
  const bars = raw ? raw.filter((b) => Number.isFinite(b.t)) : null;   // a bar with no readable time is not a bar
  const cap = barsCaption(bars, nowMs); const last = bars && bars.length ? bars[bars.length - 1] : null;
  if (!last || cap.status === 'missing') return { status: 'missing', text: 'No daily bars to show.', detail: null };
  const hm = `${new Date(nowMs + 19800000).toISOString().slice(11, 16)} IST`;
  if (barStatus(last, nowMs) === 'forming') return { status: 'forming', text: `Last bar still forming: ${dateLabel(last.t)} is provisional until its session closes (seen ${hm}).`, detail: cap.provisional };
  if (cap.status === 'stale') return { status: 'stale', text: `Last bar is ${dateLabel(last.t)}: a newer session has finished and its bar is not in this data yet.`, detail: cap.through ? `Confirmed through ${cap.through}` : null };
  return { status: 'confirmed', text: null, detail: cap.through ? `Confirmed through ${cap.through}` : null };
}
