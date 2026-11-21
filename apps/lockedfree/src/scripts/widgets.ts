// Dashboard widgets: show or hide each one (remembered on this device only), and the position-size calculator.
import { positionSize } from '../lib/accounting.ts';
const KEY = 'rb-widgets-hidden';
// Native disclosure groups keep the first visit brief. Saved widget choices still apply.
const SIMPLE = ['movers', 'volume', 'calc', 'risk', 'health'];
let hidden: string[]=[];
try { const saved=JSON.parse(localStorage.getItem(KEY) ?? '[]'); if(Array.isArray(saved)) hidden=saved.filter(x=>typeof x==='string'); } catch {}
const read=()=>hidden;
const write=(ids:string[])=>{hidden=ids;try{localStorage.setItem(KEY,JSON.stringify(ids));}catch{/* Keep the choice for this visit. */}};
const btn = document.querySelector<HTMLButtonElement>('[data-customize]'), menu = document.querySelector<HTMLElement>('[data-wmenu]');
function apply() { const hid = new Set(read()); document.querySelectorAll<HTMLElement>('[data-widget]').forEach((w) => { w.hidden = hid.has(w.dataset.widget!); }); document.querySelectorAll<HTMLInputElement>('[data-wtoggle]').forEach((c) => { c.checked = !hid.has(c.dataset.wtoggle!); }); document.querySelectorAll<HTMLElement>('.today-group').forEach(g => g.hidden = !g.querySelector('[data-widget]:not([hidden])')); }
apply();
btn?.addEventListener('click', () => { const open = menu!.hidden; menu!.hidden = !open; btn.setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', (e) => { if (menu && !menu.hidden && !(e.target as HTMLElement).closest('[data-wmenu], [data-customize]')) { menu.hidden = true; btn?.setAttribute('aria-expanded', 'false'); } }); addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) { menu.hidden = true; btn?.setAttribute('aria-expanded', 'false'); btn?.focus(); } });
document.querySelectorAll<HTMLInputElement>('[data-wtoggle]').forEach((c) => c.addEventListener('change', () => { const hid = new Set(read()); c.checked ? hid.delete(c.dataset.wtoggle!) : hid.add(c.dataset.wtoggle!); write([...hid]); apply(); }));
document.querySelector('[data-wreset]')?.addEventListener('click', () => { write([]); apply(); });
document.querySelector('[data-wsimple]')?.addEventListener('click', () => { write(SIMPLE); apply(); });
// calculator: account x risk % / (entry - stop), whole shares down, in integer paise (the same function the Gate uses)
const f = document.querySelector<HTMLFormElement>('[data-calc]'), out = document.querySelector<HTMLElement>('[data-calc-out]');
if (f && out) { try { const b = JSON.parse(localStorage.getItem('rulebook-book/1') || '{}'); if (b.rules?.accountSize) (f.elements.namedItem('acct') as HTMLInputElement).value = String(b.rules.accountSize); if (b.rules?.riskPct) (f.elements.namedItem('risk') as HTMLInputElement).value = String(b.rules.riskPct); } catch { /* defaults stay */ }
  const n = (k: string) => { const v = parseFloat(((f.elements.namedItem(k) as HTMLInputElement).value || '').replace(/,/g, '')); return Number.isFinite(v) ? v : null; }; const money = (x: number) => '₹' + Math.round(x).toLocaleString('en-IN');
  const calc = () => { const a = n('acct'), r = n('risk'), e = n('entry'), s = n('stop'); if (a == null || r == null || e == null || s == null) { out.textContent = 'Enter an entry and a stop below it.'; return; } if (r <= 0 || r > 5) { out.textContent = 'Risk must be above 0 and at most 5%.'; return; } if (s >= e) { out.textContent = 'The stop must be below the entry price.'; return; }
    const q = positionSize(a, r, e, s); if (!q) { out.textContent = 'At this risk, stop distance and account size the position is under one share.'; return; } out.textContent = `${q.toLocaleString('en-IN')} shares · position ${money(q * e)} (${((q * e / a) * 100).toFixed(1)}% of the account) · ${money(q * (e - s))} at risk if the stop is hit.`; };
  f.addEventListener('input', calc); f.addEventListener('submit', (ev) => ev.preventDefault()); calc(); }
