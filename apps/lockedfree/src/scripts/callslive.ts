// Calls table, marked to delayed live prices (19 Nov 2026). live.ts fills each Last cell from /api/quotes and announces the quotes; this recomputes the three P&L cells of each open call from its own fill, through the same charges module the ledger uses. Nothing is written back: the ledger still marks at the close, and a name with no quote keeps its ledger figures.
import { liveMark } from '../lib/livecalls.ts'; import type { Quote } from './live.ts';
const rows = [...document.querySelectorAll<HTMLTableRowElement>('tr[data-call]')];
if (rows.length) {
  const fmt = (v: number, d: number, suf = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}${suf}`;
  const set = (td: Element | null, v: number, d: number, suf = '') => { if (!td) return; (td as HTMLElement).dataset.v = String(v); const s = document.createElement('span'); s.className = `delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}`.trim(); s.textContent = fmt(v, d, suf); td.replaceChildren(s); };
  addEventListener('rb-quotes', (e) => {
    const q = (e as CustomEvent<Map<string, Quote>>).detail;
    for (const tr of rows) {
      const qq = q.get(tr.dataset.call!); if (!qq) continue;
      const m = liveMark(Number(tr.dataset.qty), Number(tr.dataset.entryPx), qq.px); if (!m) continue;
      set(tr.querySelector('[data-pl="gross"]'), m.gross, 0); set(tr.querySelector('[data-pl="gpct"]'), m.grossPct, 2, '%'); set(tr.querySelector('[data-pl="net"]'), m.net, 0);
    }
  });
}
