// Tap targets, in a real browser with iPhone-size emulation (touch, mobile, 390 and 320 wide): every interactive control on Today, Discover, a Company page, the Book and the
// My Desk plan form has a hit area of at least 44 x 44 CSS px (the --hit token). The hit area is the element's own box, or, for a control drawn inside a bigger tappable parent, that parent's box.
// Exempt, and counted out loud: the skip link (it is off screen until focused), controls that are not rendered, and a link that sits inside a sentence (WCAG 2.5.8 inline exception: its line box is the
// text, and padding it would change the reading).
// AUTOMATED checks, not user research. Usage: node apps/tripwire/tests/tapsize.mjs [baseUrl]
import { chromium, devices } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let bad = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) bad++; };
const b = await chromium.launch();
const MIN = 44, SLACK = 0.5;   // sub-pixel rounding only
const GUEST = { ...STATE, follows: [], entries: [], paper: [], snaps: {} };

const PICK = `a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [role=radio], [role=menuitem], [tabindex]:not([tabindex="-1"])`;
/** Runs in the page: the interactive controls that are drawn, with their box. */
async function audit(pg) {
  return pg.evaluate(({ sel, min, slack }) => {
    const out = []; let exempt = 0, inline = 0;
    const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return false; for (let p = e; p; p = p.parentElement) { const c = getComputedStyle(p); if ((p.tagName === 'DETAILS' && !p.open && !e.closest('summary') ) || c.display === 'none' || c.visibility === 'hidden' || p.hasAttribute('hidden') || p.getAttribute('aria-hidden') === 'true') return false; } return true; };
    const scope = document.querySelector('.sheet') || document;   // an open sheet makes the page behind it unreachable
    for (const e of scope.querySelectorAll(sel)) {
      if (!vis(e)) continue;
      if (e.classList.contains('skip')) { exempt++; continue; }
      // a radio / checkbox drawn small inside a label: the label is the target
      let box = e.getBoundingClientRect();
      const lab = e.closest('label'); if (lab && (e.matches('input[type=checkbox],input[type=radio]'))) box = lab.getBoundingClientRect();
      // a link inside running text (siblings are text): WCAG 2.5.8 inline exception
      if (e.tagName === 'A' && getComputedStyle(e).display === 'inline') {
        const p = e.parentElement; const own = [...p.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1).length;
        if (own > 0) { inline++; continue; }
      }
      // focusable only so a keyboard can scroll it or read its tooltip: it has no action to tap, so it is not a control
      if (e.matches('[tabindex]') && !e.matches('a[href],button,input,select,textarea,summary,[role]')) { exempt++; continue; }
      // a control whose drawn box is smaller than --hit may extend its hit area with a pseudo-element: measure what the browser actually hits
      if (box.width + slack < min || box.height + slack < min) {
        e.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2, STEP = 2; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (let y = cy - 40; y <= cy + 40; y += STEP) for (let x = cx - 40; x <= cx + 40; x += STEP) {
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          const t = document.elementFromPoint(x, y); if (t && (t === e || e.contains(t) || t.closest(sel) === e)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + STEP); y0 = Math.min(y0, y); y1 = Math.max(y1, y + STEP); }
        }
        if (x1 > x0 && y1 - y0 + slack >= min && x1 - x0 + slack >= min) continue;
        box = { width: Math.max(box.width, x1 - x0), height: Math.max(box.height, y1 - y0), left: box.left, top: box.top };
        const label = (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || e.id || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        out.push({ tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 50) + ' < ' + String(e.parentElement?.className || e.parentElement?.tagName).slice(0, 40), label, w: Math.round(box.width * 10) / 10, h: Math.round(box.height * 10) / 10, x: Math.round(box.left), y: Math.round(box.top + scrollY) });
      }
    }
    return { small: out, exempt, inline };
  }, { sel: PICK, min: MIN, slack: SLACK });
}

const iphone = devices['iPhone 13'];
const open = async (state, width, route) => {
  const ctx = await b.newContext({ ...iphone, viewport: { width, height: 844 }, screen: { width, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('tripwire:v1', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } } catch {} }, state); await mockApi(ctx);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await pg.goto(base + route); await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1800);
  return { ctx, pg, errs };
};

const ROUTES = [
  ['Today', STATE, '/#/today'],
  ['Today (first visit)', GUEST, '/#/today'],
  ['Discover', STATE, '/#/discover'],
  ['Company', STATE, '/#/c/TCS'],
  ['Book', STATE, '/#/signals'],
  ['Book / Paper', STATE, '/#/signals?v=positions'],
  ['My Desk / My plans', STATE, '/#/desk?v=plans'],
  ['Menu', STATE, '/#/more'],
];
for (const w of [390, 320]) {
  for (const [name, st, route] of ROUTES) {
    const { ctx, pg, errs } = await open(st, w, route);
    const r = await audit(pg);
    ok(r.small.length === 0, `${name} @${w}: every interactive control is at least ${MIN}x${MIN} (${r.small.length} under; ${r.inline} inline links in sentences and ${r.exempt} off-screen skip link exempt)` + (r.small.length ? '\n      ' + r.small.slice(0, 30).map((s) => `${s.tag}.${s.cls} "${s.label}" ${s.w}x${s.h} @${s.x},${s.y}`).join('\n      ') : ''));
    ok(errs.length === 0, `${name} @${w}: no page errors`);
    await ctx.close();
  }
}

/* The plan form itself (the planner sheet opened from My Desk > Plans): its fields, buttons and chips. */
for (const w of [390, 320]) {
  const { ctx, pg } = await open(STATE, w, '/#/desk?v=plans');
  const btn = pg.getByRole('button', { name: 'Size a paper position' }).first();
  if (await btn.count()) { await btn.click().catch(() => {}); await pg.waitForSelector('.sheet', { timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(600); }
  const sheet = await pg.locator('.sheet').count();
  if (sheet) { const r = await audit(pg); ok(r.small.length === 0, `Plan form @${w}: every control in the open sheet is at least ${MIN}x${MIN} (${r.small.length} under)` + (r.small.length ? '\n      ' + r.small.slice(0, 30).map((s) => `${s.tag}.${s.cls} "${s.label}" ${s.w}x${s.h}`).join('\n      ') : '')); }
  else ok(false, `Plan form @${w}: the planner sheet opened (no sheet found)`);
  await ctx.close();
}
await b.close(); console.log(bad ? `${bad} failed` : 'all passed'); process.exit(bad ? 1 : 0);
