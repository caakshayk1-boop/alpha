// One synchronous paint owns Last, P&L and their source timestamp for each call.
import { liveMark } from '../lib/livecalls.ts';
import { quoteStamp, usableQuote } from '../lib/quotes.ts';
import type { Quote } from './live.ts';
export function paintCalls(quotes: Map<string, Quote>) {
  const fmt = (v: number, d: number, suf = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
  for (const tr of document.querySelectorAll<HTMLTableRowElement>('tr[data-call]')) {
    const q = quotes.get(tr.dataset.call!); if (!usableQuote(q, tr.dataset.closeDate)) continue;
    const m = liveMark(Number(tr.dataset.qty), Number(tr.dataset.entryPx), q!.px); if (!m) continue;
    const px = tr.querySelector<HTMLElement>('[data-q-px]'), stamp = tr.querySelector<HTMLElement>('[data-q-time]');
    if (px) px.textContent = q!.px.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (stamp) stamp.textContent = quoteStamp(q!.t);
    for (const [key, v, d, suffix] of [['gross', m.gross, 0, ''], ['gpct', m.grossPct, 2, '%'], ['net', m.net, 0, '']] as const) {
      const td = tr.querySelector<HTMLElement>(`[data-pl="${key}"]`); if (!td) continue;
      td.dataset.v = String(v); const span = document.createElement('span'); span.className = `delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}`.trim(); span.textContent = fmt(v, d, suffix); td.replaceChildren(span);
    }
  }
}
