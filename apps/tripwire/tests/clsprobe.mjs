// Diagnostic: which element moved, from where to where, during a throttled first load of Today. Not part of the gate.
import { chromium } from 'playwright';
import { STATE, mockApi } from './fixtures.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
await ctx.addInitScript((s) => localStorage.setItem('tripwire:v1', JSON.stringify(s)), STATE); await mockApi(ctx);
const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await pg.addInitScript(() => { window.__s = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__s.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((x) => ({ n: (x.node?.nodeName ?? '') + '.' + (x.node?.className ?? ''), a: [x.previousRect.x, x.previousRect.y, x.previousRect.width, x.previousRect.height].map(Math.round), b: [x.currentRect.x, x.currentRect.y, x.currentRect.width, x.currentRect.height].map(Math.round) })) }); }).observe({ type: 'layout-shift', buffered: true }); });
await pg.goto(base + '/#/today', { waitUntil: 'load' }); await pg.waitForSelector('[data-brief]'); await pg.waitForTimeout(4000);
console.log(JSON.stringify(await pg.evaluate(() => window.__s), null, 1)); await b.close();
