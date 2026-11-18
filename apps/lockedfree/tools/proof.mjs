// The 12 proof checks, run in a real browser against a running Worker. Usage: node tools/proof.mjs <prodBase> <demoBase>
// prodBase serves the production build (no ledger data yet); demoBase serves the synthetic demo build for the states that need data.
import { chromium, devices } from 'playwright'; import { readFileSync, readdirSync, statSync } from 'node:fs'; import { join } from 'node:path'; import { execFileSync } from 'node:child_process';
const [PROD, DEMO] = [process.argv[2] || 'http://localhost:8811', process.argv[3] || 'http://localhost:8812']; const root = new URL('..', import.meta.url).pathname;
const results = []; const rec = (n, ok, ev) => { results.push({ n, ok, ev }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${ev}`); };
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); const ctx = async (o = {}) => { const c = await browser.newContext(o); const p = await c.newPage(); const errs = []; const reqs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('request', (r) => reqs.push(r.url())); return { c, p, errs, reqs }; };
const ledgerDemo = JSON.parse(readFileSync(join(root, 'demo/ledger.json'), 'utf8'));

// 1 fixture
try { const out = execFileSync('node', ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--test', '--test-name-pattern=ACCEPTANCE', join(root, 'tests/accounting.test.ts')], { encoding: 'utf8' }); rec('1 accounting fixture', /# pass 1/.test(out) && /# fail 0/.test(out), 'realised 1000 / unrealised 500 / total 1500 / risk 1000 / 1.5R: test passes'); } catch (e) { rec('1 accounting fixture', false, String(e.stdout || e).slice(0, 200)); }

// 2 traceability: static (no page imports the accounting module) + dynamic (page figures equal the ledger's aggregates)
{ const bad = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(astro|ts|tsx)$/.test(f)) { const t = readFileSync(p, 'utf8'); if (/lib\/accounting/.test(t) && !/lib\/(view|gate|ledger)\.ts$/.test(p) && !p.includes('/app/')) bad.push(p); } } }; walk(join(root, 'src/pages')); walk(join(root, 'src/components'));
  const { p } = await ctx(); await p.goto(DEMO + '/', { waitUntil: 'networkidle' }); const all = ledgerDemo.aggregates.find((a) => a.screen_id === 'all'); const txt = await p.locator('.stat').first().innerText();
  rec('2 every number traces to the ledger', bad.length === 0 && txt.includes(String(all.n_closed)), `pages importing accounting directly: ${bad.length}; home "closed trades" shows ${txt.split('\n')[1]} vs ledger ${all.n_closed}`); }

// 3 n + as-of + small-n label (production build has n = 0)
{ const { p } = await ctx(); await p.goto(PROD + '/ledger/', { waitUntil: 'networkidle' }); const t = await p.innerText('main'); const home = await (async () => { await p.goto(PROD + '/', { waitUntil: 'networkidle' }); return p.innerText('main'); })();
  const stats = await p.$$eval('.stat', (els) => els.map((e) => ({ n: !!e.querySelector('.n'), asof: !!e.querySelector('.stamp'), sim: !!e.querySelector('.sim') })));
  const ok = /too few to conclude anything/.test(home + t) && stats.every((s) => s.n && s.asof) && /Simulated — not real returns/.test(home); rec('3 n, as-of and small-n label', ok, `${stats.length} stat blocks on home all carry n and as-of; honesty label present: ${/too few to conclude anything/.test(home + t)}`); }

// 4 sit-out
{ const { p } = await ctx(); const empty = ledgerDemo.screens.map((s) => s.id).filter((id) => ledgerDemo.runs.filter((r) => r.screen_id === id).pop()?.passed.length === 0); let ok = false, ev = 'no empty run in demo';
  for (const id of empty) { await p.goto(`${DEMO}/screens/${id}/`, { waitUntil: 'networkidle' }); const t = await p.innerText('main'); ok = /0 stocks pass all rules this week\. Cash is a position\./.test(t) && /one criterion away/.test(t); ev = `${id}: sit-out headline + near-miss table present`; if (ok) break; }
  rec('4 sit-out state', ok, ev); }

// 5 Gate refuses each violation
const bookRules = { schema: 'rulebook-book/1', rules: { accountSize: 500000, riskPct: 1, dailyLossLimit: 3000, maxTradesPerDay: 3, ruleText: 'Two losses and I walk away.', strictUntil: null, setOn: '2026-11-16' }, trades: [] };
{ const { c, p, errs } = await ctx(); await c.addInitScript((b) => { try { if (!localStorage.getItem('rulebook-book/1')) localStorage.setItem('rulebook-book/1', JSON.stringify(b)); } catch {} }, bookRules); await p.goto(PROD + '/gate/', { waitUntil: 'networkidle' });
  const fill = async (o) => { const v = { sym: 'TCS', setup: 'Breakout from a base', trigger: 'Close above 3100', stop: '90', target: '130', risk: '1', entry: '100', ...o }; await p.fill('#sym', v.sym); await p.selectOption('#setup', v.setup); await p.fill('#trigger', v.trigger); await p.fill('#stop', v.stop); await p.fill('#target', v.target); await p.fill('#risk', v.risk); await p.fill('#entry', v.entry); };
  const btn = p.getByRole('button', { name: /Enter paper trade/ }); const tried = []; await fill({}); const okEnabled = await btn.isEnabled();
  const cases = [['stock', { sym: '' }], ['setup', { setup: '' }], ['trigger', { trigger: '' }], ['stop', { stop: '' }], ['target', { target: '' }], ['risk', { risk: '' }], ['entry', { entry: '' }]];
  for (const [n, o] of cases) { await fill(o).catch(async () => { await fill({}); if (o.setup === '') await p.selectOption('#setup', ''); }); if (o.setup === '') await p.selectOption('#setup', ''); tried.push(`${n}:${await btn.isDisabled()}`); }
  await fill({}); const qtyReadonly = await p.locator('#qty').getAttribute('readonly') !== null; const qty = await p.inputValue('#qty');
  await p.getByRole('switch').click(); await p.fill('#oq', '800'); const noReason = await btn.isDisabled(); await p.fill('#or', 'conviction'); const withReason = await btn.isEnabled();
  rec('5 Gate cannot submit with a missing item, size or stop', okEnabled && tried.every((t) => t.endsWith('true')) && qtyReadonly && qty === '500' && noReason && withReason, `valid entry enabled=${okEnabled}; each empty item disables submit [${tried.join(' ')}]; qty read-only=${qtyReadonly} value ${qty}; override without reason disabled=${noReason}, with reason enabled=${withReason}; page errors ${errs.length}`); await c.close(); }

// 6 lock
{ const { c, p } = await ctx(); const b = JSON.parse(JSON.stringify(bookRules)); b.rules.dailyLossLimit = 100; await c.addInitScript((b) => { try { if (!localStorage.getItem('rulebook-book/1')) localStorage.setItem('rulebook-book/1', JSON.stringify(b)); } catch {} }, b); await p.goto(PROD + '/gate/', { waitUntil: 'networkidle' });
  await p.fill('#sym', 'TCS'); await p.selectOption('#setup', 'Breakout from a base'); await p.fill('#trigger', 'Close above 3100'); await p.fill('#stop', '90'); await p.fill('#target', '130'); await p.fill('#entry', '100'); await p.getByRole('button', { name: /Enter paper trade/ }).click();
  await p.fill('input[aria-label^="Exit price"]', '85'); await p.getByRole('button', { name: 'Close', exact: true }).click(); await p.getByRole('button', { name: /Skip/ }).click(); await p.waitForTimeout(400);
  const lock = await p.locator('.lock').innerText().catch(() => ''); const formGone = (await p.locator('#sym').count()) === 0; const tag = await p.locator('text=rule break').count();
  rec('6 daily loss limit locks the terminal and quotes the rule', /locked until/i.test(lock) && lock.includes('Two losses and I walk away.') && formGone && tag > 0, `lock screen: "${lock.replace(/\s+/g, ' ').slice(0, 120)}"; entry form removed=${formGone}; exit below stop tagged rule break=${tag > 0}`); await c.close(); }

// 7 journal order + dual curves
{ const { c, p } = await ctx(); const mk = (id, sym, ex, plan) => ({ id, symbol: sym, setup: 'x', trigger: 'y', stop: 90, target: 130, riskPct: 1, qty: 100, qtyOverrideReason: null, entry: { date: '2026-11-17', price: 100 }, exit: { date: '2026-11-18', price: ex }, ruleBreak: ex < 90, review: { setupQuality: 4, emotion: 2, followedPlan: plan }, reviewSkipped: false });
  const b = { ...bookRules, trades: [mk('a', 'A', 110, true), mk('b', 'B', 112, true), mk('c', 'C', 85, false), mk('d', 'D', 88, false), mk('e', 'E', 120, true)] }; await c.addInitScript((b) => { try { localStorage.setItem('rulebook-book/1', JSON.stringify(b)); } catch {} }, b); await p.goto(PROD + '/gate/journal/', { waitUntil: 'networkidle' });
  const html = await p.innerText('main'); const lc = html.toLowerCase(), iPlan = lc.indexOf('followed the plan'), iPnl = lc.indexOf('profit and loss'); const canv = await p.locator('.uplot canvas').count(); const pct = await p.locator('[data-track="plan-pct"]').innerText();
  rec('7 plan adherence above P&L; dual curves render', iPlan > -1 && iPnl > iPlan && canv >= 2 && pct === '60%', `plan % "${pct}" appears before profit and loss (${iPlan} < ${iPnl}); uPlot canvases: ${canv}`); await c.close(); }

// 8 voids and losers visible; nothing deletable
{ const { p } = await ctx(); await p.goto(DEMO + '/ledger/voids/', { waitUntil: 'networkidle' }); const v = await p.innerText('main'); await p.goto(DEMO + '/ledger/', { waitUntil: 'networkidle' }); const l = await p.innerText('main'); const del = await p.getByRole('button', { name: /delete|remove/i }).count();
  const src = ['src/app/gate.tsx', 'src/app/plan.tsx'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n'); const apiDel = /removeItem|\.remove\(|trades\.splice|trades\.filter\(\(t\) => t\.id !== /.test(src);
  const losers = ledgerDemo.picks.some((x) => x.status === 'closed') && /−/.test(l); rec('8 voids and losers visible; no delete path', /before the entry fill/.test(v) && losers && del === 0 && !apiDel, `void with reason listed; loss figures shown; delete/remove buttons on Ledger: ${del}; delete code paths in Gate/Plan: ${apiDel}`); }

// 9 fonts self-hosted, no font CDN, CLS
{ const { c, p, reqs } = await ctx(); await c.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); }); await p.goto(PROD + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const external = reqs.filter((u) => !u.startsWith(PROD) && !u.startsWith('data:')); const fonts = reqs.filter((u) => /\.woff2?$/.test(u)); const cls = await p.evaluate(() => window.__cls); const ok = external.length === 0 && fonts.length > 0 && fonts.every((u) => u.startsWith(PROD)) && cls < 0.02;
  rec('9 self-hosted fonts, no CDN, no layout shift', ok, `font files ${fonts.length}, all same-origin; external requests ${external.length}; home CLS ${cls.toFixed(4)}`); await c.close(); }

// 10 view-transition morph + reduced motion
{ const probe = () => { window.__vt = []; window.addEventListener('pagereveal', (e) => window.__vt.push(!!e.viewTransition)); window.addEventListener('pageswap', (e) => window.__vt.push('swap:' + !!e.viewTransition)); };
  const run = async (reduced) => { const { c, p } = await ctx({ reducedMotion: reduced ? 'reduce' : 'no-preference' }); await c.addInitScript(probe); await p.goto(DEMO + '/screens/', { waitUntil: 'networkidle' }); await p.locator('a[href="/screens/magic-formula/"]').first().click(); await p.waitForURL('**/magic-formula/'); await p.waitForTimeout(600);
    const names = await p.evaluate(() => [...document.querySelectorAll('[data-vt]')].map((e) => getComputedStyle(e).viewTransitionName)); const vt = await p.evaluate(() => window.__vt); await c.close(); return { names, vt }; };
  const a = await run(false), b = await run(true); rec('10 view-transition morph; reduced motion disables it', a.vt.includes(true) && a.names.includes('screen-magic-formula') && !b.vt.includes(true), `default: transition objects ${JSON.stringify(a.vt)}, header name ${a.names.filter((n) => n !== 'none')[0]}; reduced-motion: ${JSON.stringify(b.vt)}`); }

// 11 copy audit
try { const o1 = execFileSync('node', [join(root, 'tools/copy-audit.mjs'), join(root, 'dist')], { encoding: 'utf8' }); rec('11 copy audit', true, o1.trim()); } catch (e) { rec('11 copy audit', false, String(e.stdout).slice(0, 300)); }

// 12 mobile: touch + keyboard + tables to cards
{ const { c, p } = await ctx({ ...devices['Pixel 7'] }); await c.addInitScript((b) => { try { localStorage.setItem('rulebook-book/1', JSON.stringify(b)); } catch {} }, bookRules); await p.goto(PROD + '/gate/', { waitUntil: 'networkidle' });
  await p.fill('#sym', 'TCS'); await p.selectOption('#setup', 'Breakout from a base'); await p.fill('#trigger', 'Close above 3100'); await p.fill('#stop', '90'); await p.fill('#target', '130'); await p.fill('#entry', '100'); await p.getByRole('button', { name: /Enter paper trade/ }).tap(); const open1 = await p.locator('text=Stop ₹90 attached').count();
  const noOverflow = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); await c.close();
  const k = await ctx({ viewport: { width: 390, height: 844 } }); await k.c.addInitScript((b) => { try { localStorage.setItem('rulebook-book/1', JSON.stringify(b)); } catch {} }, bookRules); await k.p.goto(PROD + '/gate/', { waitUntil: 'networkidle' }); const kb = k.p.keyboard; await k.p.focus('#sym'); await kb.type('INFY'); await kb.press('Tab'); await kb.press('ArrowDown'); await kb.press('ArrowDown');
  const setupVal = await k.p.inputValue('#setup'); await kb.press('Tab'); await kb.type('Close above 1500'); await kb.press('Tab'); await kb.type('90'); await kb.press('Tab'); await kb.type('130'); await kb.press('Tab'); await kb.press('Tab'); await kb.type('100'); await kb.press('Tab'); await kb.press('Tab'); await kb.press('Tab');
  const focused = await k.p.evaluate(() => document.activeElement?.textContent || ''); const enabled = await k.p.getByRole('button', { name: /Enter paper trade/ }).isEnabled(); await k.c.close();
  const m = await ctx({ viewport: { width: 390, height: 844 } }); await m.p.goto(DEMO + '/ledger/', { waitUntil: 'networkidle' }); const display = await m.p.$eval('table.cards tbody tr', (r) => getComputedStyle(r).display); const stampOk = (await m.p.innerText('main')).includes('as of 18 Nov 2026'); await m.c.close();
  rec('12 mobile: touch and keyboard Gate flow; tables become cards with stamps', open1 === 1 && noOverflow && !!setupVal && enabled && display === 'block' && stampOk, `touch entry placed trade=${open1 === 1}; no horizontal overflow=${noOverflow}; keyboard-only fill reached an enabled submit=${enabled} (setup "${setupVal}"); ledger rows display:${display}; as-of stamp kept=${stampOk}. Emulated Pixel 7 + 390px viewport; a real-device pass is still owed`); }

await browser.close(); console.log(`\n${results.filter((r) => r.ok).length}/12 passed`); process.exit(results.every((r) => r.ok) && results.length === 12 ? 0 : 1);
