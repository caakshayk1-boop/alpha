// Home page live layer. live.ts fills every [data-q] with its delayed quote and fires "rb-quotes"; this file turns those quotes into the board:
// the market chip, sector tone, the paper calls against their entry price, and the sweep line. Nothing is computed from a missing quote: it stays a dash.
import { usableQuote, quoteStamp } from '../lib/quotes.ts';
import { marketState } from './market.ts';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; type Q = { px: number; prev: number | null; t: number | null };
const $$ = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
const chips = $$('[data-market-chip]');
const tickChip = () => { const s = marketState(); for (const c of chips) { c.dataset.state = s.state; const t = c.querySelector('[data-market-text]'); if (t) t.textContent = c.hasAttribute('data-short') ? (s.state === 'open' ? 'NSE live' : 'NSE closed') : s.state === 'open' ? 'NSE open · live, delayed' : `${s.text} · showing last close`; } };
tickChip(); setInterval(tickChip, 30000);
const tone = (c: number) => (c >= 1.5 ? 'u2' : c > 0.05 ? 'u1' : c <= -1.5 ? 'd2' : c < -0.05 ? 'd1' : 'flat');
const calls = (() => { try { return JSON.parse(document.getElementById('calls-data')?.textContent ?? '[]') as { s: string; q: number; e: number; m: number | null }[]; } catch { return []; } })();
const inr = (x: number) => (x < 0 ? '−' : x > 0 ? '+' : '') + '₹' + Math.abs(Math.round(x)).toLocaleString('en-IN');
// The calls are asked for through hidden [data-q] hosts, because live.ts requests every [data-q] symbol on the page.
const host = document.createElement('div'); host.hidden = true; for (const c of calls) { const e = document.createElement('i'); e.dataset.q = c.s; host.append(e); } document.body.append(host); dispatchEvent(new Event('rb-symbols-changed'));
addEventListener('rb-quotes', (ev) => {
  const m = (ev as CustomEvent<Map<string, Q>>).detail;
  for (const t of $$('.st[data-q]')) { const ch = t.querySelector<HTMLElement>('[data-q-chg]'); const c = ch?.dataset.chg; if (c != null && c !== '') t.dataset.tone = tone(parseFloat(c)); }
  // every call is counted: at its live price if it has one, otherwise at its last close, so a partly failed refresh never understates the total
  let sum = 0, live = 0, up = 0, down = 0;
  for (const c of calls) {
    const raw = m.get(c.s); const q = usableQuote(raw, document.querySelector<HTMLElement>('[data-pl]')?.dataset.closeDate) ? raw : undefined; const px = q?.px ?? c.m; const a = document.querySelector<HTMLElement>(`[data-call="${c.s}"]`); if (px == null || !(c.e > 0)) continue;
    const pct = (px / c.e - 1) * 100; sum += c.q * (px - c.e); if (q) live++; if (pct > 0) up++; else if (pct < 0) down++;
    if (a) { a.dataset.tone = tone(pct * 2); const s = a.querySelector('[data-call-pct]'); if (s) s.textContent = `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}%`; }
  }
  const pl = document.querySelector<HTMLElement>('[data-pl]'), pn = document.querySelector<HTMLElement>('[data-pl-n]');
  if (pl && live) { pl.textContent = inr(sum); pl.className = 'big ' + (sum > 0 ? 'up' : sum < 0 ? 'down' : ''); pl.title = `${live} of ${calls.length} calls have a live price; the rest are at their last close`; }
  if (pn && live) pn.textContent = `${up} · ${down}${live < calls.length ? ` · ${calls.length - live} at last close` : ''}`;
  const basis = document.querySelector<HTMLElement>('[data-pl-basis]'); const times = calls.map((c) => m.get(c.s)?.t).filter((t): t is number => t != null); if (basis && times.length) basis.textContent = `${live} of ${calls.length} calls have delayed quotes. Earliest print: ${quoteStamp(Math.min(...times))}. Latest print: ${quoteStamp(Math.max(...times))}.${live < calls.length ? ' Remaining calls use the dated ledger close; see Calls for each row’s basis.' : ' Entry dates and exit rules are on Calls.'}`;
  const board = document.querySelector<HTMLElement>('[data-board]');
  if (board && !reduce) { board.classList.toggle('scan', false); void board.offsetWidth; board.classList.toggle('scan', true); }
});
