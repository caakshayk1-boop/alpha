// Before/after screenshots of Settings (#/profile) and Operations (#/ops) at 390 and 1280, with the shared mocks.
// Usage: node apps/tripwire/tests/reliabilityshots.mjs <baseUrl> <outDir> <prefix>
import { chromium, newCtx } from './uimock.mjs';
import { mkdirSync } from 'node:fs';
const [base = 'http://localhost:8813', out = 'docs/tripwire/launch/reliability', prefix = 'after'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const w of [390, 1280]) {
  const ctx = await newCtx(b, w, null); const pg = await ctx.newPage();
  const wait = async () => { await pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1500); };
  for (const [name, hash] of [['settings', '#/profile'], ['operations', '#/ops']]) {
    await pg.goto(base + '/' + hash); await pg.reload(); await wait();
    await pg.screenshot({ path: `${out}/${prefix}-${name}-${w}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close(); console.log('shots in', out);
