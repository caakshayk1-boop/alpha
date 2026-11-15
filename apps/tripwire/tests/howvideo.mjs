// The "How it works" explainer on the landing page: reserved 16:9 box (no layout shift), poster, controls, no sound track, a text alternative, and the file is really served.
// AUTOMATED checks. Usage: node apps/tripwire/tests/howvideo.mjs [baseUrl]
import { chromium } from 'playwright';
import { mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' }); await mockApi(ctx);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await pg.goto(base + '/'); await pg.waitForSelector('.how-video-el', { state: 'attached' });
  const v = await pg.evaluate(() => { const e = document.querySelector('.how-video-el'); const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, muted: e.muted, controls: e.controls, poster: e.getAttribute('poster'), label: e.getAttribute('aria-label'), vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }; });
  ok(Math.abs(v.w / v.h - 16 / 9) < 0.02, `${name}: the box is 16:9 before any byte of video arrives (${v.w.toFixed(0)}x${v.h.toFixed(0)})`);
  ok(v.muted && v.controls && !!v.label && v.poster === '/media/how-it-works-poster.jpg', `${name}: muted, has controls, a poster and an accessible name`);
  ok(v.sw <= v.vw, `${name}: no sideways scroll`);
  await pg.locator('.how-video-tx summary').click();
  ok(/Close.*Screen.*Rules.*Picks.*Paper book.*Ledger/.test(await pg.locator('.how-video-tx p').innerText()), `${name}: the transcript names all six stops`);
  for (const u of ['/media/how-it-works.mp4', '/media/how-it-works-poster.jpg']) { const r = await pg.request.get(base + u); ok(r.status() === 200 && +(r.headers()['content-length'] ?? 1) > 1000, `${name}: ${u} is served (${r.status()})`); }
  ok(errs.length === 0, `${name}: no page errors ${errs.join('|')}`);
  await ctx.close();
}
{ // reduced motion / Data Saver: nothing is fetched ahead and nothing autoplays
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' }); await mockApi(ctx);
  const pg = await ctx.newPage(); await pg.goto(base + '/'); await pg.waitForSelector('.how-video-el', { state: 'attached' }); await pg.waitForTimeout(600);
  const s = await pg.evaluate(() => { const e = document.querySelector('.how-video-el'); return { paused: e.paused, preload: e.preload }; });
  ok(s.paused && s.preload === 'none', `reduced motion: stays paused and preloads nothing (${JSON.stringify(s)})`); await ctx.close();
}
await b.close(); if (fails) { console.log(`${fails} failed`); process.exit(1); } console.log('howvideo: ok');
