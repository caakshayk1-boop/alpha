// budget.mjs — JavaScript each route really loads, gzipped, against a recorded baseline (Pro §31).
// Reads the static export: every <script src> in out/<route>/index.html, gzipped and summed. A route may grow by at most
// 10% over its baseline; a new route is recorded. `--update` rewrites scripts/budget-baseline.json after a deliberate change.
// Lab numbers only: this is not field performance and is never reported as such.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const ROUTES = ['/', '/brief/', '/markets/', '/screen/', '/map/', '/rotation/', '/engines/', '/trades/', '/research/', '/desk/', '/reads/', '/compare/', '/tools/', '/watchlist/', '/journal/', '/about/', '/company/TCS/'];
const BASE = 'scripts/budget-baseline.json';
const LIMIT = 1.10;
const size = (route) => {
  const html = readFileSync(join('out', route, 'index.html'), 'utf8');
  // modern browsers skip noModule scripts (the polyfills), so they are not counted
  const srcs = [...new Set([...html.matchAll(/<script([^>]*)src="(\/_next\/[^"]+)"([^>]*)>/g)].filter((m) => !/nomodule/i.test(m[1] + m[3])).map((m) => m[2]))];
  return Math.round(srcs.reduce((a, s) => a + gzipSync(readFileSync(join('out', decodeURIComponent(s)))).length, 0) / 1024 * 10) / 10;
};
const now = Object.fromEntries(ROUTES.filter((r) => existsSync(join('out', r, 'index.html'))).map((r) => [r, size(r)]));
if (process.argv.includes('--update')) { writeFileSync(BASE, `${JSON.stringify(now, null, 1)}\n`); console.log('budget baseline written'); process.exit(0); }
const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : {};
const over = Object.entries(now).filter(([r, kb]) => base[r] && kb > base[r] * LIMIT);
for (const [r, kb] of Object.entries(now)) console.log(`${r.padEnd(16)} ${String(kb).padStart(6)} kB gz  (baseline ${base[r] ?? 'new'})`);
if (over.length) { console.error(over.map(([r, kb]) => `FAIL  ${r}: ${kb} kB, over ${base[r]} kB + 10%`).join('\n')); process.exit(1); }
console.log('budget passed');
