// The stock price chart (ADR-020): a clean, hand-drawn SVG, no library. A soft area line by default, candles on request, range and Daily/Weekly/Monthly buttons,
// round-number price axis, a last-price tag, 52-week high/low labels, and a crosshair that drives the big readout above it. Delayed, unofficial data; says so when it cannot load.
import { historyInterval, byInterval, inRange, niceTicks, priceLabel, money, decimate, dateTicks, shortDate, changeOver, signedPct, trendWords, MAX_CANDLES, type C, type Interval, type Range } from '../lib/pricechart.ts';
const host = document.querySelector<HTMLElement>('[data-price-chart]');
if (host) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const SVGNS = 'http://www.w3.org/2000/svg';
  const note = document.querySelector<HTMLElement>('[data-chart-note]'), trendEl = document.querySelector<HTMLElement>('[data-trend]');
  const rPx = document.querySelector<HTMLElement>('[data-r-px]'), rChg = document.querySelector<HTMLElement>('[data-r-chg]'), rSub = document.querySelector<HTMLElement>('[data-r-sub]');
  const st = { range: 'MAX' as Range, ivl: 'D' as Interval, style: 'line' as 'line' | 'candles' }; let daily: C[] = []; let drawn = false;
  const el = (n: string, a: Record<string, string | number> = {}, kids: (SVGElement | string)[] = []) => { const e = document.createElementNS(SVGNS, n); for (const [k, v] of Object.entries(a)) e.setAttribute(k, String(v)); for (const c of kids) e.append(c); return e; };
  const hi = parseFloat(host.dataset.hi || ''), lo = parseFloat(host.dataset.lo || '');
  const setReadout = (b: C, prev: C | undefined, over: string | null) => {
    if (rPx) rPx.textContent = '₹' + money(b.c);
    if (rChg) { const c = prev ? (b.c / prev.c - 1) * 100 : null; const rc = over != null ? changeOver(current()) : c; rChg.textContent = signedPct(rc); rChg.className = rc == null ? '' : rc > 0 ? 'up' : rc < 0 ? 'down' : ''; }
    if (rSub) rSub.textContent = `${shortDate(b.t, 'full')} · O ${money(b.o)} · H ${money(b.h)} · L ${money(b.l)} · C ${money(b.c)}${over ? ` · ${over}` : ''}`;
  };
  const current = (): C[] => { let b = inRange(byInterval(daily, st.ivl), st.range); if (st.style === 'candles' && b.length > MAX_CANDLES) b = b.slice(-MAX_CANDLES); return b; };
  function render() {
    const bars = current(); const W = Math.max(280, Math.floor(host!.clientWidth)); if (!bars.length) return;
    const mobile = W < 520, H = mobile ? 300 : 360, L = 6, R = mobile ? 62 : 74, T = 14, B = 30, pw = W - L - R, ph = H - T - B; const n = bars.length;
    const candles = st.style === 'candles'; let min = Infinity, max = -Infinity; for (const b of bars) { min = Math.min(min, candles ? b.l : b.c); max = Math.max(max, candles ? b.h : b.c); }
    const pad = (max - min) * 0.07 || max * 0.02 || 1; min -= pad; max += pad; const x = (i: number) => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw), y = (v: number) => T + ((max - v) / (max - min)) * ph;
    const { ticks, step } = niceTicks(min, max, mobile ? 4 : 5); const svg = el('svg', { class: 'pc', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-hidden': 'true' });
    const defs = el('defs', {}, [el('linearGradient', { id: 'pcg', x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: '0%', class: 'g0' }), el('stop', { offset: '100%', class: 'g1' })]), el('clipPath', { id: 'pcc' }, [el('rect', { x: L, y: T - 4, width: pw + 2, height: ph + 8 })])]); svg.append(defs);
    for (const v of ticks) { const py = y(v); svg.append(el('line', { class: 'grid', x1: L, x2: W - R, y1: py, y2: py })); const t = el('text', { class: 'ax', x: W - R + 10, y: py + 4 }); t.textContent = priceLabel(v, step); svg.append(t); }
    let edge = -1e9; for (const t of dateTicks(bars)) { const w = t.label.length * 6.6, cx = Math.min(W - R, Math.max(L + w / 2, x(t.i))), a = t.i === 0 ? L : t.i === n - 1 ? W - R - w : cx - w / 2; if (a < edge + 14) continue; edge = a + w; const tx = el('text', { class: 'ax', x: a, y: H - 8 }); tx.textContent = t.label; svg.append(tx); }
    const g = el('g', { 'clip-path': 'url(#pcc)' });
    if (candles) {
      const cw = Math.max(1, Math.min(11, (pw / n) * 0.62));
      bars.forEach((b, i) => { const up = b.c >= b.o, cls = up ? 'cu' : 'cd'; g.append(el('line', { class: cls, x1: x(i), x2: x(i), y1: y(b.h), y2: y(b.l) }), el('rect', { class: cls, x: x(i) - cw / 2, y: Math.min(y(b.o), y(b.c)), width: cw, height: Math.max(1, Math.abs(y(b.o) - y(b.c))) })); });
    } else {
      const idx = decimate(n, Math.floor(pw), (i) => bars[i].c, (i) => bars[i].c); const d = idx.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(bars[i].c).toFixed(1)}`).join('');
      g.append(el('path', { class: 'area' + (drawn || reduce ? '' : ' fade'), d: `${d}L${x(n - 1).toFixed(1)},${(T + ph).toFixed(1)}L${x(0).toFixed(1)},${(T + ph).toFixed(1)}Z`, fill: 'url(#pcg)' }), el('path', { class: 'line' + (drawn || reduce ? '' : ' draw'), d, pathLength: 1, fill: 'none' }));
    }
    svg.append(g);
    const tag = (cls: string, v: number, text: string) => { const py = Math.min(T + ph, Math.max(T, y(v))); const w = text.length * 6.6 + 12; svg.append(el('line', { class: cls + ' ref', x1: L, x2: W - R, y1: py, y2: py }), el('rect', { class: cls + ' pill', x: W - R + 2, y: py - 9, width: w, height: 18, rx: 4 })); const t = el('text', { class: 'pt', x: W - R + 8, y: py + 4 }); t.textContent = text; svg.append(t); };
    const last = bars[n - 1]; const apart = (v: number) => Math.abs(y(v) - y(last.c)) > 22; const short = st.range !== 'MAX' && st.range !== '5Y';    // 52-week lines only mean something on a view of a year or less
    if (short && hi && hi < max && hi > min && apart(hi)) tag('hi', hi, '52w high'); if (short && lo && lo < max && lo > min && apart(lo)) tag('lo', lo, '52w low'); tag('last', last.c, money(last.c).replace(/\.00$/, ''));
    const xh = el('g', { class: 'xh', visibility: 'hidden' }); const vl = el('line', { y1: T, y2: T + ph }); const dot = el('circle', { r: 4.5, class: 'dot' }); const dp = el('rect', { class: 'dp', height: 18, rx: 4, y: H - 20 }); const dt = el('text', { class: 'dpt', y: H - 7, 'text-anchor': 'middle' }); xh.append(vl, dot, dp, dt); svg.append(xh);
    host!.replaceChildren(svg); host!.classList.remove('loading'); drawn = true;
    const prevOf = (i: number) => (i > 0 ? bars[i - 1] : undefined); const over = `${changeOver(bars) == null ? '' : 'over ' + (st.range === 'MAX' ? 'all history' : st.range)}`;
    setReadout(last, undefined, over || null); let at = n - 1;
    const show = (i: number) => { at = Math.max(0, Math.min(n - 1, i)); const b = bars[at]; xh.setAttribute('visibility', 'visible'); const px = x(at); vl.setAttribute('x1', String(px)); vl.setAttribute('x2', String(px)); dot.setAttribute('cx', String(px)); dot.setAttribute('cy', String(y(candles ? b.c : b.c)));
      const label = shortDate(b.t, 'full'); const w = label.length * 6.6 + 14; const cx = Math.min(W - R - w / 2, Math.max(L + w / 2, px)); dp.setAttribute('x', String(cx - w / 2)); dp.setAttribute('width', String(w)); dt.setAttribute('x', String(cx)); dt.textContent = label; setReadout(b, prevOf(at), null); };
    const reset = () => { xh.setAttribute('visibility', 'hidden'); setReadout(last, undefined, over || null); };
    const idxAt = (cx: number) => { const r = svg.getBoundingClientRect(); const px = ((cx - r.left) / r.width) * W; return Math.round(((px - L) / pw) * (n - 1)); };
    host!.onpointermove = (e) => show(idxAt(e.clientX)); host!.onpointerleave = reset; host!.onpointercancel = reset; host!.onpointerdown = (e) => show(idxAt(e.clientX));
    host!.onkeydown = (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); } else if (e.key === 'Home') { e.preventDefault(); show(0); } else if (e.key === 'End') { e.preventDefault(); show(n - 1); } else if (e.key === 'Escape') reset(); };
    host!.setAttribute('aria-label', `Price chart, ${candles ? 'candles' : 'line'}, ${st.ivl === 'D' ? 'daily' : st.ivl === 'W' ? 'weekly' : 'monthly'}, ${n} points from ${bars[0].t} to ${last.t}. Left and right arrow keys move along it.`);
    if (note) note.textContent = `${daily.length.toLocaleString('en-IN')} ${({ D: 'daily', W: 'weekly', M: 'monthly' })[historyInterval(daily)]} observations to ${daily[daily.length - 1].t} · delayed, unofficial${st.ivl !== 'D' ? ' · aggregated from source observations' : ''}${candles && inRange(byInterval(daily, st.ivl), st.range).length > MAX_CANDLES ? ` · latest ${MAX_CANDLES} candles shown` : ''}`;
  }
  const press = (sel: string, v: string) => document.querySelectorAll<HTMLElement>(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[sel.includes('range') ? 'range' : sel.includes('ivl') ? 'ivl' : 'style'] === v)));
  document.querySelectorAll<HTMLElement>('[data-range]').forEach((b) => b.addEventListener('click', () => { st.range = b.dataset.range as Range; press('[data-range]', st.range); render(); }));
  document.querySelectorAll<HTMLElement>('[data-ivl]').forEach((b) => b.addEventListener('click', () => { st.ivl = b.dataset.ivl as Interval; press('[data-ivl]', st.ivl); render(); }));
  document.querySelectorAll<HTMLElement>('[data-style]').forEach((b) => b.addEventListener('click', () => { st.style = b.dataset.style as 'line' | 'candles'; press('[data-style]', st.style); render(); }));
  async function load() {
    host!.classList.add('loading');
    try { const r = await fetch(`/api/chart?s=${encodeURIComponent(host!.dataset.priceChart!)}`); const j = await r.json().catch(() => ({})) as { points?: C[] }; if (!r.ok || !j.points?.length) throw new Error('empty'); daily = j.points; const sourceInterval = historyInterval(daily); if (sourceInterval !== 'D') { st.ivl = sourceInterval; document.querySelectorAll<HTMLButtonElement>('[data-ivl]').forEach((b) => { b.disabled = b.dataset.ivl === 'D' || (sourceInterval === 'M' && b.dataset.ivl === 'W'); }); press('[data-ivl]', sourceInterval); } if (trendEl) trendEl.textContent = trendWords(daily); render(); new ResizeObserver(() => render()).observe(host!); }
    catch { host!.className = 'chart-empty'; host!.textContent = 'The price history could not be loaded just now. Nothing is shown in its place.'; if (note) note.textContent = 'unavailable'; }
  }
  load();
}
