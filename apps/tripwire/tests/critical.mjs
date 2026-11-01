// 3.5 in a real browser: the first-viewport classes are all in static/critical-classes.json (so the inlined CSS covers them), the page paints with the full stylesheet still deferred, the
// full stylesheet is switched on by the app, and the strict CSP is not weakened. LCP is REPORTED (a goal of the owner's: < 2.0 s on mid-tier Android over 4G), never a gate.
// Usage: node apps/tripwire/tests/critical.mjs [baseUrl]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { renderedClasses } from '../tools/critical-classes.mjs';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801'; let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const listed = new Set(JSON.parse(readFileSync(new URL('../static/critical-classes.json', import.meta.url), 'utf8')));
const seen = await renderedClasses(base); const missing = seen.filter((c) => !listed.has(c));
ok(missing.length === 0, `every class rendered in the first viewport (phone and desktop) is in the critical list${missing.length ? ': missing ' + missing.slice(0, 12).join(', ') : ` (${seen.length} classes)`}; run tools/critical-classes.mjs after changing the first screen`);
const html = await (await fetch(base + '/')).text();
ok(/<style data-critical>[^<]{500,}/.test(html), 'the first-viewport CSS is inlined'); ok((html.match(/<link rel="stylesheet"[^>]*>/g) ?? []).every((l) => /media="print"/.test(l) || false) || !/<head>[\s\S]*<link rel="stylesheet" href="[^"]+"(?! media)[\s\S]*<\/head>/.test(html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '')), 'no render-blocking stylesheet in <head>');
ok(/<link rel="modulepreload" href="\/app\.[a-z0-9]+\.chunk-/.test(html), 'the main chunk is modulepreloaded');
const csp = (await fetch(base + '/')).headers.get('content-security-policy'); ok(/style-src 'self' 'unsafe-inline'/.test(csp) && /script-src 'self';/.test(csp), 'the CSP is the strict one: scripts from self only (inline CSS rides the existing style-src, nothing was added)');
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
await ctx.addInitScript((s) => { try { localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} }, { ...STATE, follows: [], entries: [], paper: [] }); await mockApi(ctx);
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 140))); pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
await pg.addInitScript(() => { window.__lcp = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); });
await pg.goto(base + '/#/today'); await pg.waitForSelector('[data-sec="brief"]', { timeout: 20000 }); await pg.waitForTimeout(800);
const media = await pg.$eval('link[data-full-css]', (l) => l.media); ok(media === 'all' || media === '', `the app switches the full stylesheet on (media="${media}")`);
const lcp = await pg.evaluate(() => window.__lcp); console.log(`INFO  largest contentful paint ${Math.round(lcp)} ms on this machine, unthrottled (goal < 2000 ms on mid-tier Android over 4G; not a gate)`);
ok(errs.filter((e) => !/api\/|Failed to load resource|502|404/.test(e)).length === 0, 'no script errors' + (errs[0] ? ': ' + errs[0] : '')); await b.close(); process.exit(fails ? 1 : 0);
