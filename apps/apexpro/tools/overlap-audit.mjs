// Layout audit: for each route and width, reports horizontal overflow, text that overlaps other text or a control, and fixed/sticky bars that cover content at rest.
// Usage: node apps/apexpro/tools/overlap-audit.mjs [baseUrl]   (needs the app served, e.g. `npm run dev` in apps/apexpro; chromium from playwright)
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:8810';
const routes = ['', 'discover', 'company/INFY', 'compare', 'desk', 'settings', 'about'];
const widths = [[1440, 900], [1024, 768], [390, 844]];
const probe = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const leaves = [...document.querySelectorAll('body *')].filter((el) => {
    if (!vis(el)) return false; if (el.closest('svg, canvas, [aria-hidden="true"], [hidden]')) return false;
    if (el.closest('details:not([open])') && !el.closest('summary')) return false;   // closed disclosures keep a layout box but draw nothing
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    return own || /^(BUTTON|INPUT|SELECT|A|TEXTAREA)$/.test(el.tagName) && !el.querySelector('*:not(svg):not(path):not(use):not(g)');
  });
  // fixed and sticky bars sit over scrolled content by design, so a fixed element is only compared with the other elements of the same fixed container (the sidebar's own button against the sidebar's own label: 19 Nov 2026)
  const fixedRoot = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) { const ps = getComputedStyle(p).position; if (ps === 'fixed' || ps === 'sticky') return p; } return null; };
  // a clipped (ellipsis) line is drawn only inside its own box; an element that draws its own text is measured by that text's rectangles (a wide block with short text is not a collision with whatever sits beside the text)
  const rect = (el) => { let r = el.getBoundingClientRect(); const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (own.length) { const rs = own.flatMap((n) => { const g = document.createRange(); g.selectNodeContents(n); return [...g.getClientRects()]; }).filter((q) => q.width > 0 && q.height > 0); if (rs.length) { const l = Math.min(...rs.map((q) => q.left)), t = Math.min(...rs.map((q) => q.top)), rt = Math.max(...rs.map((q) => q.right)), bt = Math.max(...rs.map((q) => q.bottom)); const box = el.getBoundingClientRect(), ox = getComputedStyle(el).overflowX !== 'visible'; r = { left: ox ? Math.max(l, box.left) : l, top: t, width: (ox ? Math.min(rt, box.right) : rt) - (ox ? Math.max(l, box.left) : l), height: bt - t }; } } return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
  const hits = [], seen = new Set();
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i], b = leaves[j]; if (a.contains(b) || b.contains(a)) continue;
    if (fixedRoot(a) !== fixedRoot(b)) continue;
    const ra = rect(a), rb = rect(b); const w = Math.min(ra.x + ra.w, rb.x + rb.w) - Math.max(ra.x, rb.x), h = Math.min(ra.y + ra.h, rb.y + rb.h) - Math.max(ra.y, rb.y);
    if (w > 4 && h > 4 && w * h > 0.2 * Math.min(ra.w * ra.h, rb.w * rb.h)) {
      // clipped or scroll containers legitimately stack; ignore pairs where either is clipped away by an overflow ancestor
      const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(o.overflowX + o.overflowY)) { const pr = p.getBoundingClientRect(), er = el.getBoundingClientRect(); if (er.right < pr.left || er.left > pr.right || er.bottom < pr.top || er.top > pr.bottom) return true; } } return false; };
      if (clipped(a) || clipped(b)) continue;
      const tag = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''} "${(el.textContent || el.value || '').trim().slice(0, 28)}"`;
      const key = tag(a) + '|' + tag(b); if (seen.has(key)) continue; seen.add(key); hits.push(`${tag(a)}  x  ${tag(b)}  (${Math.round(w)}x${Math.round(h)})`);
    }
  }
  const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const small = leaves.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 11).length;
  return { overflowX: over, overlaps: hits.slice(0, 12), nOverlaps: hits.length, subFloorText: small };
};
const browser = await chromium.launch(); let bad = 0;
for (const [w, h] of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  for (const r of routes) {
    await pg.goto(`${base}/#/${r}`); await pg.waitForTimeout(1800);
    const res = await pg.evaluate(probe); const flag = res.overflowX > 1 || res.nOverlaps > 0 || errs.length;
    if (flag) bad++; console.log(`${flag ? 'FLAG' : 'ok  '} ${w}px /${r}  overflowX=${res.overflowX} overlaps=${res.nOverlaps} subFloor=${res.subFloorText}${errs.length ? ' errors=' + errs.join(';') : ''}`);
    for (const o of res.overlaps) console.log('       ' + o);
  }
  await ctx.close();
}
await browser.close(); console.log(bad ? `${bad} route/width runs flagged` : 'no overlaps or overflow found'); process.exit(bad ? 1 : 0);
