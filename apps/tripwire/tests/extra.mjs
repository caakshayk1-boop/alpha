// The four browser suites that tests/check.mjs does not run: chart-workbench, trust-browser, selfbook-browser, watch-browser.
// They live apart from check.mjs on purpose: three of them drive WebKit as well as Chromium, and the nightly data deploy must not wait on (or be failed by) an engine it does not need.
// CI runs this on pull requests and manual runs (see .github/workflows/tripwire.yml), after `npx playwright install --with-deps chromium webkit`.
// Usage: npm run tripwire:build && npm run tripwire:check:extra
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const PORT = Number(process.env.TW_PORT ?? 8802); const base = `http://localhost:${PORT}`;
if (!existsSync('apps/tripwire/dist/index.html')) { console.error('Build first: npm run tripwire:build'); process.exit(2); }
const srv = spawn('npx', ['wrangler', 'dev', '--config', 'wrangler.tripwire.jsonc', '--local', '--port', String(PORT)], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-srv.pid); } catch { /* gone */ } };
process.on('exit', stop);
let up = false; for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(base + '/')).ok; } catch { /* starting */ } if (!up) await new Promise((r) => setTimeout(r, 1000)); }
if (!up) { console.error('FAIL  the app Worker did not start'); process.exit(1); }
// the suites read their address from the argument (check.mjs style) or from TRIPWIRE_BASE / TW_BASE; give them all three
const run = (f) => new Promise((res) => { const p = spawn('node', [f, base], { stdio: 'inherit', env: { ...process.env, TRIPWIRE_BASE: base, TW_BASE: base } }); p.on('exit', (c) => res(c ?? 1)); });
const SUITES = ['chart-workbench', 'trust-browser', 'selfbook-browser', 'watch-browser'];
let bad = 0; for (const n of SUITES) { const code = await run(`apps/tripwire/tests/${n}.mjs`); console.log(`${code ? 'FAIL' : 'PASS'}  ${n}`); if (code) bad++; }
stop(); process.exit(bad ? 1 : 0);
