// Serves the built app on its own Worker config and runs the browser journeys and the accessibility gate against it.
// Usage: npm run tripwire:build && npm run tripwire:check
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const PORT = Number(process.env.TW_PORT ?? 8801); const base = `http://localhost:${PORT}`;
if (!existsSync('apps/tripwire/dist/index.html')) { console.error('Build first: npm run tripwire:build'); process.exit(2); }
const srv = spawn('npx', ['wrangler', 'dev', '--config', 'wrangler.tripwire.jsonc', '--local', '--port', String(PORT)], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-srv.pid); } catch { /* gone */ } };
process.on('exit', stop);
let up = false; for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(base + '/')).ok; } catch { /* starting */ } if (!up) await new Promise((r) => setTimeout(r, 1000)); }
if (!up) { console.error('FAIL  the app Worker did not start'); process.exit(1); }
const run = (f) => new Promise((res) => { const p = spawn('node', [f, base], { stdio: 'inherit' }); p.on('exit', (c) => res(c ?? 1)); });
const a = await run('apps/tripwire/tests/journey.mjs'); const b = await run('apps/tripwire/tests/a11y.mjs'); const c = await run('apps/tripwire/tests/beta.mjs'); const d = await run('apps/tripwire/tests/comfort.mjs'); const e = await run('apps/tripwire/tests/r3.mjs'); const f = await run('apps/tripwire/tests/news.mjs'); const g = await run('apps/tripwire/tests/discover.mjs'); const h = await run('apps/tripwire/tests/today.mjs'); const i = await run('apps/tripwire/tests/ui.mjs');
stop(); process.exit(a || b || c || d || e || f || g || h || i ? 1 : 0);
