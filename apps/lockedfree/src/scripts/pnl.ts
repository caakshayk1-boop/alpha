// Live P&L: the visitor's open paper trades from the Gate (kept in this browser), marked with delayed quotes through the SAME accounting module the Ledger uses.
import { evaluate } from '../lib/accounting.ts'; import { chargesFor } from '../lib/charges.ts'; import type { Quote } from './live.ts';
const host = document.querySelector<HTMLElement>('[data-pnl]'); if (host) {
  type T = { id: string; symbol: string; stop: number; qty: number; entry: { date: string; price: number }; exit: unknown };
  const load = (): T[] => { try { const b = JSON.parse(localStorage.getItem('rulebook-book/1') || '{}'); return (b.trades || []).filter((t: T) => !t.exit); } catch { return []; } };
  const money = (x: number) => `${x < 0 ? '−' : ''}₹${Math.abs(x).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; const sg = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
  const trades = load(); host.dataset.n = String(trades.length);
  if (!trades.length) { const p = document.createElement('p'); p.className = 'gap pad'; p.append('No open paper trades. Positions you open in '); const a = document.createElement('a'); a.href = '/gate/'; a.textContent = 'The Gate'; p.append(a, ' appear here, marked to delayed quotes.'); host.replaceChildren(p); }
  else {
    const t = document.createElement('table'); t.className = 't-table'; t.innerHTML = '<thead><tr><th>Symbol</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Delayed</th><th class="num">P&amp;L</th><th class="num">R</th></tr></thead>'; const tb = document.createElement('tbody'); const rows = new Map<string, HTMLTableRowElement>();
    for (const x of trades) { const tr = document.createElement('tr'); tr.dataset.q = x.symbol; tr.dataset.id = x.id; const c = (txt: string, cls = '') => { const d = document.createElement('td'); d.className = ('num ' + cls).trim(); d.textContent = txt; return d; };
      const s = document.createElement('td'); const a = document.createElement('a'); a.href = `/stock/${x.symbol}/`; a.textContent = x.symbol; s.append(a); const px = c('—'); px.dataset.qPx = ''; const pl = c('—'); pl.dataset.pl = ''; const r = c('—'); r.dataset.r = ''; tr.append(s, c(String(x.qty)), c(x.entry.price.toFixed(2)), px, pl, r); tb.append(tr); rows.set(x.id, tr); }
    const foot = document.createElement('p'); foot.className = 'stamp'; foot.dataset.total = ''; foot.textContent = 'Waiting for quotes…'; t.append(tb); host.replaceChildren(t, foot); dispatchEvent(new CustomEvent('rb-symbols-changed'));
    addEventListener('rb-quotes', (e) => { const q = (e as CustomEvent<Map<string, Quote>>).detail; let total = 0, have = 0;
      for (const x of trades) { const tr = rows.get(x.id)!, qq = q.get(x.symbol); if (!qq) continue; const fills = [{ date: x.entry.date, side: 'buy' as const, qty: x.qty, price: x.entry.price, charges: chargesFor('buy', x.qty, x.entry.price) }]; const r = evaluate(fills, x.stop, qq.px);
        const pl = tr.querySelector<HTMLElement>('[data-pl]')!, rr = tr.querySelector<HTMLElement>('[data-r]')!; pl.textContent = `${r.total > 0 ? '+' : ''}${money(r.total)}`; pl.className = `num ${sg(r.total)}`; rr.textContent = r.r == null ? '—' : `${r.r > 0 ? '+' : r.r < 0 ? '−' : ''}${Math.abs(r.r).toFixed(2)} R`; rr.className = `num ${sg(r.total)}`; total += r.total; have++; }
      const f = host.querySelector<HTMLElement>('[data-total]'); if (f) f.textContent = have ? `Open paper P&L ${total > 0 ? '+' : ''}${money(total)} on ${have} of ${trades.length} positions (after buy-side charges; exit charges not yet incurred). Simulated — not real returns.` : 'No quote for these symbols yet.'; });
  }
}
