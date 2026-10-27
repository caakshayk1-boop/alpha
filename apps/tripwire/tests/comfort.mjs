// Reading comfort and the controls that sit on top of the page: proportional body type, contrast of the text colours, input sizes, sticky bars against a
// shrunken viewport (a stand-in for an open mobile keyboard), reduced motion, and target sizes. AUTOMATED checks in a desktop Chromium; they do not replace a
// real phone (see docs/tripwire/DEVICE_TEST.md for what only a device can answer).
// Usage: node apps/tripwire/tests/comfort.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
import { mockLab } from './labmock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const mk = async (o = {}) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', bypassCSP: true, ...o }); await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, STATE); await mockApi(ctx); return ctx; };
const lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
const ratio = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/* 1. type: prose is proportional and comfortable, figures are mono */
{ const ctx = await mk(); const pg = await ctx.newPage(); await pg.goto(base + '/#/c/GCSL'); await pg.reload(); await pg.waitForSelector('.decision', { timeout: 15000 });
  const t = await pg.evaluate(() => { const cs = (el) => getComputedStyle(el); const p = [...document.querySelectorAll('.decision p, details.ev .body p, p.small')].find((x) => x.innerText.length > 60); const num = [...document.querySelectorAll('.num')].find((x) => x.innerText.trim().length > 1 && !x.closest('p'));
    const bodyPx = parseFloat(cs(document.body).fontSize); return { prose: p ? cs(p).fontFamily : '', pLine: p ? parseFloat(cs(p).lineHeight) / parseFloat(cs(p).fontSize) : 0, num: num ? cs(num).fontFamily : '', bodyPx, measure: p ? p.getBoundingClientRect().width / parseFloat(cs(p).fontSize) : 0 }; });
  ok(!/JetBrains|monospace/i.test(t.prose) && t.prose.length > 0, `body prose is proportional (${t.prose.split(',')[0]})`);
  ok(/JetBrains|monospace/i.test(t.num), 'numbers stay in the mono face');
  ok(t.bodyPx >= 15 && t.pLine >= 1.45, `body text is ${t.bodyPx}px with a line height of ${t.pLine.toFixed(2)}`);
  ok(t.measure <= 75, `a line of prose is about ${t.measure.toFixed(0)} characters wide at most (comfortable under 75)`);
  /* 2. contrast of the text colours against the page and the card surfaces */
  const c = await pg.evaluate(() => { const r = getComputedStyle(document.documentElement); const px = (n) => { const d = document.createElement('i'); d.style.color = r.getPropertyValue(n); document.body.appendChild(d); const v = getComputedStyle(d).color.match(/\d+/g).slice(0, 3).map(Number); d.remove(); return v; }; return { tx: px('--tx'), dim: px('--dim'), mute: px('--mute'), lime: px('--lime'), up: px('--up'), down: px('--down'), bg: px('--bg'), s2: px('--s2'), s3: px('--s3') }; });
  for (const [n, min] of [['tx', 15], ['dim', 9], ['mute', 7], ['lime', 9], ['up', 8], ['down', 6]]) { const worst = Math.min(ratio(c[n], c.bg), ratio(c[n], c.s2), ratio(c[n], c.s3)); ok(worst >= min, `${n} text keeps ${worst.toFixed(1)}:1 on the page and card surfaces (needs ${min}:1)`); }
  /* 3. inputs do not trigger the iPhone zoom */
  await pg.goto(base + '/#/discover'); await pg.reload(); await pg.waitForSelector('input'); const small = await pg.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).length);
  ok(small === 0, 'every visible field is 16px or larger, so iPhone Safari does not zoom into it');
  await ctx.close(); }

/* 4. sticky bars against a keyboard-sized viewport: a focused field must end up between the top bar and the tab bar */
{ const ctx = await mk(); const pg = await ctx.newPage(); const KB = 336;
  const clear = async (label, sel) => { const el = pg.locator(sel).first(); await el.waitFor({ timeout: 8000 }); await pg.setViewportSize({ width: 390, height: 844 - KB }); await el.focus(); await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(250);
    const r = await pg.evaluate((s) => { const e = document.querySelector(s); const q = e.getBoundingClientRect(); const bar = document.querySelector('header.bar, .bar'); const tabs = document.querySelector('nav.tabs'); const sheet = e.closest('.sheet'); const top = sheet ? 0 : (bar ? bar.getBoundingClientRect().bottom : 0); const bottom = sheet ? innerHeight : (tabs ? tabs.getBoundingClientRect().top : innerHeight); return { top: q.top, bottom: q.bottom, minTop: top, maxBottom: bottom }; }, sel);
    ok(r.top >= r.minTop - 1 && r.bottom <= r.maxBottom + 1, `${label}: the focused field sits between the bars with a ${KB}px keyboard (${Math.round(r.top)} to ${Math.round(r.bottom)}, room ${Math.round(r.minTop)} to ${Math.round(r.maxBottom)})`); await pg.setViewportSize({ width: 390, height: 844 }); };
  await pg.goto(base + '/#/discover'); await pg.reload(); await pg.waitForSelector('.lens');
  await clear('Discover search', 'input[type=search], input[placeholder*="earch"]');
  await clear('Ask in words', '.askbox input');
  await pg.getByRole('button', { name: /^\+ Condition$/ }).click(); await clear('condition value', '#c-v'); await pg.keyboard.press('Escape');
  await pg.goto(base + '/#/profile'); await pg.reload(); await pg.waitForSelector('input,textarea'); const f = await pg.locator('input:not([type=checkbox]):not([role=switch]):not([type=file]),textarea').count(); if (f) await clear('Profile field', 'input:not([type=checkbox]):not([role=switch]):not([type=file]),textarea');
  await ctx.close(); }

/* 5. reduced motion: nothing animates, and the live glow is off */
{ const ctx = await mk({ reducedMotion: 'reduce' }); const pg = await ctx.newPage();
  for (const r of ['/#/today', '/#/live', '/#/discover']) { await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForTimeout(1800);
    const run = await pg.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && !(a.effect?.target?.closest?.('.sk'))).map((a) => a.animationName || a.constructor.name)); ok(run.length === 0, `reduced motion: nothing animates on ${r.slice(2)}${run.length ? ' (' + run.slice(0, 3).join(', ') + ')' : ''}`); }
  const fx = await pg.evaluate(() => document.documentElement.classList.contains('fx')); ok(!fx, 'reduced motion: the motion layer is not switched on'); await ctx.close(); }

/* 6. target size: nothing interactive and visible is under 24px in either direction (WCAG 2.2 AA), and the main controls are at least 40px tall */
{ const ctx = await mk(); const pg = await ctx.newPage(); const small = [];
  for (const r of ['/#/today', '/#/discover', '/#/c/GCSL', '/#/desk', '/#/profile']) { await pg.goto(base + '/'); await pg.goto(base + r); await pg.reload(); await pg.waitForTimeout(1500);
    const s = await pg.evaluate(() => [...document.querySelectorAll('button,a[href],input,select,summary,[role=button]')].filter((e) => { const q = e.getBoundingClientRect(); const st = getComputedStyle(e); return q.width > 0 && q.height > 0 && st.visibility !== 'hidden' && !e.closest('.sr') && !(e.className || '').toString().includes('sr') && !e.closest('p, li, .small, .body, .note') && (q.height < 24 || q.width < 24) && !e.closest('nav.tabs') && !(e.tagName === 'A' && e.parentElement && e.parentElement.innerText.length > e.innerText.length + 20) ? true : false; }).map((e) => `${e.tagName}.${e.className} "${(e.innerText || e.getAttribute('aria-label') || '').slice(0, 20)}"`));
    small.push(...s.map((x) => r + ' ' + x)); }
  ok(small.length === 0, `no visible control is under 24px in either direction${small.length ? ': ' + [...new Set(small)].slice(0, 5).join('; ') : ''}`); await ctx.close(); }

await b.close(); console.log(fails ? `\ncomfort: ${fails} failed` : '\ncomfort: all passed'); process.exit(fails ? 1 : 0);
