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
  // the two portrait films beside it (17 Nov 2026)
  await pg.waitForSelector('.film-el', { state: 'attached' });
  const fl = await pg.evaluate(() => [...document.querySelectorAll('.film-el')].map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, muted: e.muted, controls: e.controls, poster: e.getAttribute('poster'), label: e.getAttribute('aria-label'), src: e.querySelector('source')?.getAttribute('src') }; }));
  ok(fl.length === 2, `${name}: two portrait films beside the wide one (${fl.length})`);
  for (const f of fl) {
    ok(Math.abs(f.w / f.h - 9 / 16) < 0.02, `${name}: ${f.src} is 9:16 before any byte of video arrives (${f.w.toFixed(0)}x${f.h.toFixed(0)})`);
    ok(f.muted && f.controls && !!f.label && /poster\.jpg$/.test(f.poster ?? ''), `${name}: ${f.src} is muted, has controls, a poster and an accessible name`);
    for (const u of [f.src, f.poster]) { const r = await pg.request.get(base + u); ok(r.status() === 200 && +(r.headers()['content-length'] ?? 1) > 1000, `${name}: ${u} is served (${r.status()})`); }
  }
  const tx = pg.locator('.film .film-tx summary'); for (let i = 0; i < await tx.count(); i++) await tx.nth(i).click();
  const words = await pg.locator('.film .film-tx p').allInnerTexts();
  ok(/Rules that fire.*Evidence you can check.*book that keeps score.*Missing data stays missing/s.test(words[0] ?? '') && /Step 1, data.*rule test.*evidence.*paper book/s.test(words[1] ?? ''), `${name}: both transcripts carry every beat`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${name}: still no sideways scroll with the films open`);
  ok(errs.length === 0, `${name}: no page errors ${errs.join('|')}`);
  await ctx.close();
}
{ // reduced motion / Data Saver: nothing is fetched ahead and nothing autoplays
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' }); await mockApi(ctx);
  const pg = await ctx.newPage(); await pg.goto(base + '/'); await pg.waitForSelector('.how-video-el', { state: 'attached' }); await pg.waitForTimeout(600);
  const s = await pg.evaluate(() => { const e = document.querySelector('.how-video-el'); return { paused: e.paused, preload: e.preload }; });
  ok(s.paused && s.preload === 'none', `reduced motion: stays paused and preloads nothing (${JSON.stringify(s)})`);
  const fs_ = await pg.evaluate(() => [...document.querySelectorAll('.film-el')].map((e) => ({ paused: e.paused, preload: e.preload })));
  ok(fs_.length === 2 && fs_.every((x) => x.paused && x.preload === 'none'), `reduced motion: both portrait films stay paused and preload nothing (${JSON.stringify(fs_)})`); await ctx.close();
}
// 18 Nov 2026: reduced motion is followed live. Turning it on after the page is open stops the films from loading or playing (they used to read it once, at mount).
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'no-preference' }); await mockApi(ctx);
  const pg = await ctx.newPage(); await pg.goto(base + '/'); await pg.waitForSelector('.how-video-el', { state: 'attached' });
  const pre = () => pg.evaluate(() => [...document.querySelectorAll('.how-video-el, .film-el')].map((e) => e.getAttribute('preload')));
  const before = await pre(); ok(before.length === 3 && before.every((x) => x === 'metadata'), `motion allowed: all three films preload metadata (${before.join(', ')})`);
  await pg.emulateMedia({ reducedMotion: 'reduce' }); await pg.waitForFunction(() => [...document.querySelectorAll('.how-video-el, .film-el')].every((e) => e.getAttribute('preload') === 'none'), null, { timeout: 5000 }).catch(() => {});
  const after = await pre(); ok(after.every((x) => x === 'none') && await pg.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.paused)), `reduced motion turned on mid-session: all three stop preloading and are paused (${after.join(', ')})`);
  await pg.emulateMedia({ reducedMotion: 'no-preference' }); await pg.waitForFunction(() => [...document.querySelectorAll('.how-video-el, .film-el')].every((e) => e.getAttribute('preload') === 'metadata'), null, { timeout: 5000 }).catch(() => {});
  ok((await pre()).every((x) => x === 'metadata'), 'and turning it off again restores the normal behaviour'); await ctx.close();
}
await b.close(); if (fails) { console.log(`${fails} failed`); process.exit(1); } console.log('howvideo: ok');
