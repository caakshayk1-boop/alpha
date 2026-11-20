// The screener: all 999 stocks, filtered and sorted in the browser from /data/universe.json. State lives in the URL so any view can be shared. Rows re-order with GSAP Flip.
import { gsap } from 'gsap'; import { Flip } from 'gsap/Flip'; gsap.registerPlugin(Flip);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
type Col = { k: string; l: string; f: (v: any) => string; num?: boolean; cls?: (v: any) => string; group: string };
const pct = (d = 1) => (v: number) => `${v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}%`; const spct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`; const sc = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : ''); const n1 = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const COLS: Col[] = [
  { k: 'sym', l: 'Symbol', f: (v) => v, group: 'core' }, { k: 'sector', l: 'Sector', f: (v) => v, group: 'core' }, { k: 'mcap_cr', l: 'Mkt cap ₹cr', f: (v) => Math.round(v).toLocaleString('en-IN'), num: true, group: 'core' }, { k: 'price', l: 'Price ₹', f: (v) => v.toLocaleString('en-IN', { minimumFractionDigits: 2 }), num: true, group: 'core' },
  { k: 'r1d', l: '1D', f: spct, num: true, cls: sc, group: 'returns' }, { k: 'r1m', l: '1M', f: spct, num: true, cls: sc, group: 'returns' }, { k: 'r3m', l: '3M', f: spct, num: true, cls: sc, group: 'returns' }, { k: 'r1y', l: '1Y', f: spct, num: true, cls: sc, group: 'returns' }, { k: 'rs3m', l: 'RS 3M vs Nifty', f: spct, num: true, cls: sc, group: 'returns' },
  { k: 'pe', l: 'P/E', f: n1, num: true, group: 'value' }, { k: 'pb', l: 'P/B', f: n1, num: true, group: 'value' }, { k: 'div_yield', l: 'Div yld', f: pct(2), num: true, group: 'value' },
  { k: 'roce', l: 'ROCE', f: pct(), num: true, group: 'quality' }, { k: 'roe', l: 'ROE', f: pct(), num: true, group: 'quality' }, { k: 'ebit_margin', l: 'EBIT mgn', f: pct(), num: true, group: 'quality' }, { k: 'cfo_pat', l: 'CFO/PAT', f: (v) => v.toFixed(2) + '×', num: true, group: 'quality' }, { k: 'de', l: 'D/E', f: (v) => v.toFixed(2), num: true, group: 'quality' },
  { k: 'rev_cagr', l: 'Rev CAGR', f: pct(), num: true, group: 'growth' }, { k: 'eps_cagr', l: 'EPS CAGR', f: pct(), num: true, group: 'growth' },
  { k: 'q', l: 'Quality', f: (v) => Math.round(v) + '', num: true, group: 'scores' }, { k: 'g', l: 'Growth', f: (v) => Math.round(v) + '', num: true, group: 'scores' }, { k: 'v', l: 'Value', f: (v) => Math.round(v) + '', num: true, group: 'scores' }, { k: 'tech', l: 'Trend', f: (v) => Math.round(v) + '', num: true, group: 'scores' }, { k: 'comp', l: 'Composite', f: (v) => Math.round(v) + '', num: true, group: 'scores' },
  { k: 'piotroski', l: 'Piotroski', f: (v) => v + '/9', num: true, group: 'checks' }, { k: 'rsi', l: 'RSI', f: (v) => Math.round(v) + '', num: true, group: 'trend' }, { k: 'from_high', l: 'vs 52W high', f: spct, num: true, cls: sc, group: 'trend' }, { k: 'sd1y', l: 'Vol 1Y', f: pct(), num: true, group: 'trend' }, { k: 'risk', l: 'Risk flags', f: (v) => v, group: 'checks' },
];
const GROUPS = ['core', 'returns', 'value', 'quality', 'growth', 'scores', 'trend', 'checks']; let active = new Set(['core', 'returns', 'quality', 'scores']);
const PRESETS: Record<string, { l: string; f: Record<string, [number | null, number | null]>; why: string }> = {
  quality: { l: 'High returns on capital, low debt', why: 'ROCE ≥ 20%, debt/equity ≤ 0.3, cash conversion ≥ 0.8×', f: { roce: [20, null], de: [null, 0.3], cfo_pat: [0.8, null] } },
  value: { l: 'Low multiples, positive profit', why: 'P/E 0–15, ROCE ≥ 12%', f: { pe: [0.01, 15], roce: [12, null] } },
  momentum: { l: 'Trend and relative strength', why: 'RS vs Nifty over 3M ≥ 5 points, trend score ≥ 70', f: { rs3m: [5, null], tech: [70, null] } },
  growth: { l: 'Fast compounding', why: 'Revenue CAGR ≥ 18%, EPS CAGR ≥ 18%', f: { rev_cagr: [18, null], eps_cagr: [18, null] } },
  income: { l: 'Dividend income', why: 'Dividend yield ≥ 2.5%, debt/equity ≤ 1', f: { div_yield: [2.5, null], de: [null, 1] } },
  piotroski: { l: 'Financial strength: Piotroski ≥ 8', why: 'Piotroski F-score of 8 or 9', f: { piotroski: [8, null] } },
};
interface U { cols: string[]; rows: any[][]; asOf: string }
(async () => {
  const response = await fetch('/data/universe.json'); if (!response.ok) throw new Error('load failed'); const u: U = await response.json(); if (!Array.isArray(u.rows) || !Array.isArray(u.cols)) throw new Error('invalid stock list'); const ix = Object.fromEntries(u.cols.map((c, i) => [c, i])); const Q = new URLSearchParams(location.search);
  let page = 0;
  let sort = Q.get('sort') || 'comp', dir = Q.get('dir') === 'asc' ? 1 : -1, sector = Q.get('sector') || '', text = Q.get('q') || '', preset = Q.get('preset') || '', filters: Record<string, [number | null, number | null]> = {};
  if (PRESETS[preset]) filters = JSON.parse(JSON.stringify(PRESETS[preset].f)); for (const g of (Q.get('cols') || '').split(',')) if (GROUPS.includes(g)) { if (g === (Q.get('cols') || '').split(',')[0]) active = new Set(); active.add(g); } if (!active.has('core')) active.add('core');
  const sectors = [...new Set(u.rows.map((r) => r[ix.sector]).filter(Boolean))].sort() as string[];
  const sel = $<HTMLSelectElement>('[data-f-sector]'); sectors.forEach((s) => sel.append(new Option(s, s))); sel.value = sector; const search = $<HTMLInputElement>('[data-f-text]'); search.value = text;
  const presetBar = $('[data-presets]'); const why = $('[data-why]'); const count = $('[data-count-shown]'); const head = $('[data-head]'), body = $('[data-body]');
  const sync = () => { page = 0; const p = new URLSearchParams(); if (sort !== 'comp') p.set('sort', sort); if (dir === 1) p.set('dir', 'asc'); if (sector) p.set('sector', sector); if (text) p.set('q', text); if (preset) p.set('preset', preset); const s = p.toString(); history.replaceState(null, '', s ? `?${s}` : location.pathname); };
  const withinSelection = (r: any[]) => { if (sector && r[ix.sector] !== sector) return false; if (text) { const t = text.toLowerCase(); if (!(String(r[ix.sym]).toLowerCase().includes(t) || String(r[ix.name]).toLowerCase().includes(t))) return false; } return true; };
  const financialRatio = () => ['roce', 'de', 'cfo_pat'].some(key => key in filters);
  const unavailable = (r: any[]) => Object.keys(filters).some(key => r[ix[key]] == null);
  const inapplicable = (r: any[]) => financialRatio() && r[ix.sector] === 'Financial Services';
  const pass = (r: any[]) => { if (!withinSelection(r) || inapplicable(r)) return false;
    for (const [k, [lo, hi]] of Object.entries(filters)) { const v = r[ix[k]]; if (v == null) return false; if (lo != null && v < lo) return false; if (hi != null && v > hi) return false; } return true; };
  const cols = () => COLS.filter((c) => active.has(c.group));
  const cell = (c: Col, r: any[]) => { const td = document.createElement('td'); const v = r[ix[c.k]]; if (c.k === 'sym') { const a = document.createElement('a'); a.href = `/stock/${v}/`; a.textContent = v; a.title = r[ix.name]; a.dataset.vt = `stock-${v}`; td.append(a); return td; } if (v == null) { td.textContent = '—'; td.className = c.num ? 'num gap' : 'gap'; td.title = 'missing in the source data'; return td; } td.textContent = c.f(v); if (c.num) td.className = 'num'; if (c.cls) td.className += ' ' + c.cls(v); return td; };
   const LIVE_ROWS = 25;   // 20 Nov 2026: the first 25 rows follow delayed live quotes; the rest are closes, as the page says
  function draw(animate: boolean) {
    const cs = cols(); const state = animate && !reduce ? Flip.getState([...body.children]) : null; const rows = u.rows.filter(pass).sort((a, b) => { const x = a[ix[sort]], y = b[ix[sort]]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir || String(a[0]).localeCompare(String(b[0])); });
    count.textContent = `${rows.length.toLocaleString('en-IN')} of ${u.rows.length.toLocaleString('en-IN')} stocks`; if (preset && PRESETS[preset]) {
      const selected = u.rows.filter(withinSelection);
      const comparable = selected.filter(r => !inapplicable(r));
      const missing = comparable.filter(unavailable).length;
      why.textContent = `Rule: ${PRESETS[preset].why}. Eligible: ${comparable.length - missing}. Missing inputs: ${missing}. Sector-inapplicable: ${selected.length - comparable.length} (financial-company capital ratios).`;
    }
    const start = page * 100; const shown = rows.slice(start, start + 100);
    head.replaceChildren(...cs.map((c) => { const th = document.createElement('th'); th.textContent = c.l; if (c.num) th.className = 'num'; th.tabIndex = 0; th.setAttribute('role', 'columnheader'); if (sort === c.k) th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending'); const go = () => { if (sort === c.k) dir = (dir * -1) as 1 | -1; else { sort = c.k; dir = c.num ? -1 : 1; } sync(); draw(true); }; th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); return th; }));
    const basisHead = document.createElement("th"); basisHead.scope = "col"; basisHead.textContent = "Price basis"; head.append(basisHead);
    const trs = shown.map((r, i) => { const tr = document.createElement('tr'); tr.dataset.flipId = r[0]; for (const c of cs) tr.append(cell(c, r));
      if (i < LIVE_ROWS) { tr.dataset.q = r[0]; tr.dataset.qStamp = 'on'; tr.dataset.closeDate = u.asOf; const k = cs.findIndex((c) => c.k === 'price'), d = cs.findIndex((c) => c.k === 'r1d'); if (k >= 0 && tr.children[k]) { const sp = document.createElement('span'); sp.dataset.qPx = ''; sp.textContent = tr.children[k].textContent; tr.children[k].replaceChildren(sp); } if (d >= 0 && tr.children[d]) { const sp = document.createElement('span'); sp.dataset.qChg = ''; sp.textContent = tr.children[d].textContent; tr.children[d].replaceChildren(sp); } }
      const basis = tr.insertCell(); basis.className = 'src'; basis.dataset.qTime = ''; basis.textContent = 'Close ' + u.asOf;
      return tr; }); body.replaceChildren(...trs);
    if (!trs.length) { const tr = document.createElement('tr'), td = document.createElement('td'); td.colSpan = cs.length + 1; td.className = 'pad'; td.append('No stocks match these filters. '); const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'tchip'; clear.textContent = 'Clear search and filters'; clear.addEventListener('click', () => { text = ''; sector = ''; preset = ''; filters = {}; search.value = ''; sel.value = ''; why.textContent = ''; presetBar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); sync(); draw(false); search.focus(); }); td.append(clear); tr.append(td); body.append(tr); }

    if (state) Flip.from(state, { duration: 0.32, ease: 'power2.inOut', absolute: false, onEnter: (e) => gsap.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.2 }) });
    dispatchEvent(new CustomEvent('rb-symbols-changed'));   // the live loop re-reads which symbols are on screen
    $('[data-more]').textContent = rows.length ? `Showing ${start + 1}–${start + shown.length} of ${rows.length}` : '';
    $('[data-prev]').hidden = page === 0;
    $('[data-next]').hidden = start + shown.length >= rows.length;
  }
  $('[data-prev]').onclick = () => { page--; draw(false); };
  $('[data-next]').onclick = () => { page++; draw(false); };
  presetBar.replaceChildren(...Object.entries(PRESETS).map(([k, p]) => { const b = document.createElement('button'); b.className = 'tchip'; b.type = 'button'; b.textContent = p.l; b.setAttribute('aria-pressed', String(k === preset)); b.addEventListener('click', () => { preset = preset === k ? '' : k; filters = preset ? JSON.parse(JSON.stringify(PRESETS[k].f)) : {}; presetBar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false')); if (preset) b.setAttribute('aria-pressed', 'true'); why.textContent = preset ? `Rule: ${PRESETS[k].why}. Stocks missing any of these inputs are left out, not guessed.` : ''; sync(); draw(true); }); return b; }));
  why.textContent = preset && PRESETS[preset] ? `Rule: ${PRESETS[preset].why}. Stocks missing any of these inputs are left out, not guessed.` : '';
  $('[data-groups]').replaceChildren(...GROUPS.filter((g) => g !== 'core').map((g) => { const b = document.createElement('button'); b.className = 'tchip'; b.type = 'button'; b.textContent = g[0].toUpperCase() + g.slice(1); b.setAttribute('aria-pressed', String(active.has(g))); b.addEventListener('click', () => { active.has(g) ? active.delete(g) : active.add(g); b.setAttribute('aria-pressed', String(active.has(g))); draw(false); }); return b; }));
  sel.addEventListener('change', () => { sector = sel.value; sync(); draw(true); }); let tm = 0; search.addEventListener('input', () => { clearTimeout(tm); tm = window.setTimeout(() => { text = search.value.trim(); sync(); draw(true); }, 120); });
  $('[data-csv]').addEventListener('click', () => { const cs = cols(); const rows = u.rows.filter(pass); const esc = (v: any) => { let s = v == null ? '' : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; const csv = [cs.map((c) => esc(c.k === 'price' ? 'Close INR ' + u.asOf : c.l)).join(','), ...rows.map((r) => cs.map((c) => esc(r[ix[c.k]])).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `rulebook-screener-${u.asOf}.csv`; a.click(); URL.revokeObjectURL(a.href); });
  draw(false);
})().catch(() => {
  const status = $('[data-count-shown]');
  status.textContent = 'Filters unavailable. Showing the build-time stock list. ';
  const retry = document.createElement('button');
  retry.className = 'tchip';
  retry.textContent = 'Retry filters';
  retry.onclick = () => location.reload();
  status.append(retry);
});
