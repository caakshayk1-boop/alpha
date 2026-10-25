// Serves the built app on its own Worker config and runs the browser journeys and the accessibility gate against it.
// Usage: npm run tripwire:build && npm run tripwire:check
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const PORT = 8801; const base = `http://localhost:${PORT}`;
if (!existsSync('apps/tripwire/dist/index.html')) { console.error('Build first: npm run tripwire:build'); process.exit(2); }
const srv = spawn('npx', ['wrangler', 'dev', '--config', 'wrangler.tripwire.jsonc', '--local', '--port', String(PORT)], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-srv.pid); } catch { /* gone */ } };
process.on('exit', stop);
let up = false; for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(base + '/')).ok; } catch { /* starting */ } if (!up) await new Promise((r) => setTimeout(r, 1000)); }
if (!up) { console.error('FAIL  the app Worker did not start'); process.exit(1); }
const run = (f) => new Promise((res) => { const p = spawn('node', [f, base], { stdio: 'inherit' }); p.on('exit', (c) => res(c ?? 1)); });
const a = await run('apps/tripwire/tests/journey.mjs'); const b = await run('apps/tripwire/tests/a11y.mjs');
stop(); process.exit(a || b ? 1 : 0);
