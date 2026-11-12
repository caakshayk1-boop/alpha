// The motion layer: OFF by default, on only when the person turns it on and the device allows it. With it off every state change is instant and nothing animates;
// with it on the tab content fades and rises, a press scales to .97, and a skeleton shimmers. Simulated both ways (the in-app switch, the device setting, and html.fx directly).
// Usage: node apps/tripwire/tests/motion.mjs [baseUrl]
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const mk = async (prefs, o = {}) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', bypassCSP: true, ...o }); const st = { ...STATE, prefs: { ...STATE.prefs, ...prefs } };
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('tripwire:v1')) localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, st); await mockApi(ctx); return ctx; };
const probe = () => { const v = document.querySelector('.view'); const cs = getComputedStyle(v); return { name: cs.animationName, op: parseFloat(cs.opacity), tf: cs.transform, fx: document.documentElement.classList.contains('fx') }; };

/* 1. motion OFF in the app: no animation, no transition on transform, a skeleton does not shimmer, a view is simply there */
{ const ctx = await mk({ motion: 'off' }); const pg = await ctx.newPage(); await pg.goto(base + '/#/today'); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(600);
  await pg.locator('nav.tabs a[href="#/discover"]').click(); const p = await pg.evaluate(probe);
  ok(!p.fx && p.name === 'none' && p.op === 1, `motion off: the new view is there at once (animation ${p.name}, opacity ${p.op})`);
  const m = await pg.evaluate(() => { const d = document.createElement('div'); d.className = 'ds-skel'; d.style.height = '20px'; document.body.appendChild(d); const runs = document.getAnimations().filter((a) => a.playState === 'running'); const run = runs.length; window.__r = runs.map((a) => (a.animationName || a.transitionProperty || '?') + ' on ' + (a.effect?.target?.className?.baseVal ?? a.effect?.target?.className)); const pill = getComputedStyle(document.querySelector('.tabs .pill')).transitionProperty; const btn = getComputedStyle(document.querySelector('.btn') ?? document.body).transitionProperty; return { run, pill, btn }; });
  ok(m.run === 0, `motion off: nothing is animating, a skeleton included (${m.run} running: ${(await pg.evaluate(() => window.__r)).join('; ')})`); ok(!/transform|all/.test(m.pill), `motion off: the tab indicator jumps (transition ${m.pill})`);
  ok(!/transform|all/.test(m.btn), `motion off: press feedback is not a transform (${m.btn})`);
  await ctx.close(); }

/* 2. device asks for reduced motion although the in-app switch is on: still nothing */
{ const ctx = await mk({ motion: 'auto' }, { reducedMotion: 'reduce' }); const pg = await ctx.newPage(); await pg.goto(base + '/#/today'); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(600);
  await pg.locator('nav.tabs a[href="#/discover"]').click(); const p = await pg.evaluate(probe);
  ok(!p.fx && p.name === 'none' && p.op === 1, `device reduced motion: no layer, no animation (fx ${p.fx})`); await ctx.close(); }

/* 3. motion ON: the tab content fades in and rises, a press scales, the skeleton shimmers */
{ const ctx = await mk({ motion: 'auto', effects: 'lively' }); const pg = await ctx.newPage(); await pg.goto(base + '/#/today'); await pg.waitForSelector('nav.tabs'); await pg.waitForTimeout(800);   // 12 Nov 2026: the shimmer, the rise and the .97 press are the LIVELY preset; Calm (the default) fades, does not shimmer and presses to .98 (tests/effects.mjs)
  const fx = await pg.evaluate(() => document.documentElement.classList.contains('fx')); ok(fx, 'motion on: the layer is on (html.fx)');
  await pg.evaluate(() => { window.__s = []; const v0 = performance.now(); const tick = () => { const v = document.querySelector('.view'); if (v) { const cs = getComputedStyle(v); window.__s.push([Math.round(performance.now() - v0), parseFloat(cs.opacity), cs.transform, document.documentElement.dataset.vt ?? '']); } if (performance.now() - v0 < 700) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await pg.locator('nav.tabs a[href="#/discover"]').click(); await pg.waitForTimeout(800);
  // 12 Nov 2026: where the browser has View Transitions, a tab switch is a short crossfade (html[data-vt] is set while it runs) and the .view rise stands down; elsewhere the rise is the arrival
  const vtSeen = await pg.evaluate(() => typeof document.startViewTransition === 'function'); const s = await pg.evaluate(() => window.__s); const lo = Math.min(...s.map((x) => x[1])); const risen = s.some((x) => /matrix/.test(x[2]) && x[2] !== 'matrix(1, 0, 0, 1, 0, 0)');
  if (vtSeen) ok(s.some((x) => x[3] === 'tab'), 'motion on: a tab switch runs as a view-transition crossfade (html[data-vt=tab])');
  else { ok(lo < 0.9, `motion on: the new view fades in (lowest opacity seen ${lo.toFixed(2)})`); ok(risen, 'motion on: the new view rises (a translate was applied while it arrived)'); }
  ok(await pg.evaluate(() => !document.documentElement.dataset.vt), 'motion on: the transition marker is gone once it has finished');
  const end = await pg.evaluate(probe); ok(end.op === 1 && (end.tf === 'none' || end.tf === 'matrix(1, 0, 0, 1, 0, 0)'), `motion on: it settles (opacity ${end.op}, transform ${end.tf})`);
  const name = await pg.evaluate(() => getComputedStyle(document.querySelector('.view')).animationDuration); if (!vtSeen) ok(name === '0.36s', `the view transition lasts 360 ms (${name})`);   // the fallback rise; a view transition is 200 ms or less and is set in motion3.css
  await pg.evaluate(() => { const d = document.createElement('div'); d.className = 'ds-skel'; d.id = 'skx'; d.style.height = '20px'; document.body.appendChild(d); });
  await pg.waitForTimeout(200); const shimmer = await pg.evaluate(() => document.getAnimations().some((a) => a.animationName === 'ds-shimmer' && a.playState === 'running')); ok(shimmer, 'motion on: a skeleton shimmers');
  await pg.evaluate(() => document.getElementById('skx')?.remove());
  const press = await pg.evaluate(() => { const bt = document.createElement('button'); bt.className = 'btn'; bt.id = 'pb'; bt.textContent = 'x'; document.body.prepend(bt); return true; });
  const box = await pg.locator('#pb').boundingBox(); await pg.mouse.move(box.x + 4, box.y + 4); await pg.mouse.down(); await pg.waitForTimeout(260);
  const tf = await pg.evaluate(() => getComputedStyle(document.getElementById('pb')).transform); await pg.mouse.up();
  ok(press && /matrix\(0\.97/.test(tf), `motion on: a press scales to .97 (${tf})`);
  await ctx.close(); }

await b.close(); console.log(fails ? `\nmotion: ${fails} failed` : '\nmotion: all passed'); process.exit(fails ? 1 : 0);
