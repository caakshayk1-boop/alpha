// One synchronous paint owns Last, P&L and their source timestamp for each call.
import { liveMark } from '../lib/livecalls.ts';
import { quoteStamp, bookQuote } from '../lib/quotes.ts';
import { marketState } from './market.ts';
import type { Quote } from './live.ts';
export function paintCalls(quotes: Map<string, Quote>) {
  const open = marketState().state === 'open', fmt = (v: number, d: number, suf = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
  const cells = (tr: HTMLTableRowElement) => [tr.querySelector<HTMLElement>('[data-q-px]'), ...['gross', 'gpct', 'net'].map((k) => tr.querySelector<HTMLElement>(`[data-pl="${k}"]`))];
  const prints: number[] = [];
  for (const tr of document.querySelectorAll<HTMLTableRowElement>('tr[data-call]')) {
    const q = quotes.get(tr.dataset.call!);
    if (!bookQuote(q, tr.dataset.closeDate, open)) {   // session over (or no usable print): the ledger's own figures, restored if a live print had replaced them
      if (tr.dataset.live) { const saved = JSON.parse(tr.dataset.live) as string[]; cells(tr).forEach((c, i) => { if (c) c.innerHTML = saved[i] ?? ''; }); delete tr.dataset.live; }
      continue;
    }
    const m = liveMark(Number(tr.dataset.qty), Number(tr.dataset.entryPx), q!.px); if (!m) continue;
    if (!tr.dataset.live) tr.dataset.live = JSON.stringify(cells(tr).map((c) => c?.innerHTML ?? ''));
    const px = tr.querySelector<HTMLElement>('[data-q-px]'); if (q!.t != null) prints.push(q!.t);
    if (px) px.textContent = q!.px.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    for (const [key, v, d, suffix] of [['gross', m.gross, 0, ''], ['gpct', m.grossPct, 2, '%'], ['net', m.net, 0, '']] as const) {
      const td = tr.querySelector<HTMLElement>(`[data-pl="${key}"]`); if (!td) continue;
      td.dataset.v = String(v); const span = document.createElement('span'); span.className = `delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}`.trim(); span.textContent = fmt(v, d, suffix); td.replaceChildren(span);
    }
  }
  // the basis is said ONCE, above the table, not in every row
  const note = document.querySelector<HTMLElement>('[data-calls-basis]'); if (note) { if (!note.dataset.ssr) note.dataset.ssr = note.textContent ?? ''; note.textContent = prints.length ? `Last ₹ and P&L use delayed quotes; latest print ${quoteStamp(Math.max(...prints)).replace('Delayed · ', '')}.` : note.dataset.ssr; }
}
