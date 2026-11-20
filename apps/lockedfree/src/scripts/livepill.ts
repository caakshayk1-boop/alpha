// The live status pill in the header of every page (20 Nov 2026). It says what the page can honestly say about "live":
//   open and quotes arriving   ->  "Live · 12s"   (the age of the last quote; delayed quotes refreshed every 15 s by live.ts)
//   open, quotes late or none  ->  "Delayed · 2m"  /  "Waiting for quotes"
//   shut                       ->  "Market closed" / "Opens 09:15"
// No network of its own: the session comes from the IST clock and the calendar (market.ts); the age comes from the `rb-quotes` event live.ts fires after each successful pull.
import { marketState } from './market.ts';
const pill = document.querySelector<HTMLElement>('[data-livepill]'), text = pill?.querySelector<HTMLElement>('[data-livepill-text]');
let lastQuote = 0, unavailable = false;
const ago = (s: number) => (s < 90 ? `${s}s` : `${Math.round(s / 60)}m`);   // short on purpose: the header is narrow on a phone
function paint() {
  if (!pill || !text) return; const m = marketState(); const age = lastQuote ? Math.round((Date.now() - lastQuote) / 1000) : null;
  let state = m.state === 'open' ? 'wait' : 'closed', label = m.text;
  if (m.state === 'open') { if (unavailable) { state = 'late'; label = 'Quotes unavailable'; } else if (age == null) { label = 'Waiting for quotes'; } else if (age <= 60) { state = 'live'; label = `Delayed · ${ago(age)}`; } else { state = 'late'; label = `Delayed · ${ago(age)}`; } }
  pill.dataset.state = state; text.textContent = label;
}
addEventListener('rb-quote-status', event => { unavailable = !(event as CustomEvent).detail.okBatches; paint(); });
addEventListener('rb-quotes', event => {
  const quotes = (event as CustomEvent<Map<string, { t: number }>>).detail;
  const prints = [...quotes.values()].map(q => q.t).filter(Number.isFinite);
  if (prints.length) lastQuote = Math.max(...prints) * 1000;
  paint();
}); paint(); setInterval(paint, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) paint(); });
