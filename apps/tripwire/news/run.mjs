// The scheduled news job. Usage:
//   node --experimental-strip-types apps/tripwire/news/run.mjs --out <dir> [--prev <dir>] [--force] [--now <iso>] [--universe <universe.json>] [--fixtures <dir>]
// Live mode reads the network. `--fixtures <dir>` runs the same code against recorded responses (dir/routes.json: [{ match, status, file, headers }]) and is how the tests and the offline demo run it.
// Exit code is 0 whenever the job ran to the end, including when every source was down: that is a status in the snapshot, not a failed build. A crash in this script is the only non-zero exit.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runJob } from './job.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] ?? true : d; };
const has = (k) => process.argv.includes(k);
const out = resolve(arg('--out', 'news-out')); const prevDir = arg('--prev'); const fixtures = arg('--fixtures'); mkdirSync(out, { recursive: true });
const readJson = (p, d = null) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const nowMs = arg('--now') ? Date.parse(arg('--now')) : Date.now();

let fetchImpl = fetch;
if (fixtures) {
  const routes = readJson(join(fixtures, 'routes.json'), []);
  fetchImpl = async (url) => {
    const r = routes.find((x) => new RegExp(x.match).test(decodeURIComponent(url)));
    if (!r) return new Response('', { status: 404 });
    if (r.throw) throw Object.assign(new Error(r.throw), { name: r.throw === 'timeout' ? 'TimeoutError' : 'Error' });
    const body = r.file ? readFileSync(join(fixtures, r.file), 'utf8') : '';
    return new Response(r.status === 304 ? null : body, { status: r.status ?? 200, headers: r.headers ?? {} });
  };
}
const prev = prevDir ? readJson(join(prevDir, 'news.json')) : null;
let universe = [];
if (arg('--universe')) universe = readJson(arg('--universe'), { rows: [] }).rows ?? [];
else if (!fixtures && process.env.NEWS_UNIVERSE_URL) { try { const r = await fetch(process.env.NEWS_UNIVERSE_URL, { signal: AbortSignal.timeout(15000) }); if (r.ok) universe = (await r.json()).rows ?? []; } catch { /* the covered list and the aliases carry the names; unresolved ones are reported */ } }
const ledger = readJson(join(HERE, '..', 'ledger', 'ledger.json'), { picks: [] }); if (arg('--paper')) ledger.picks = [...ledger.picks, ...String(arg('--paper')).split(',').map((sym) => ({ sym }))];   // extra paper-book names, for the offline demo
const inputs = { ledger, covered: readJson(join(HERE, 'covered.json'), { names: [] }), aliases: readJson(join(HERE, 'aliases.json'), { aliases: {} }), universe };

let res;
try { res = await runJob({ nowMs, fetchImpl, prev, inputs, force: has('--force') || !!fixtures, sleep: fixtures ? async () => {} : undefined, random: fixtures ? () => 0.5 : undefined }); }
catch (e) { console.error('news job crashed:', e); process.exit(1); }
const gh = process.env.GITHUB_OUTPUT;
if (res.skipped) { console.log(`skipped: ${res.why}`); if (gh) appendFileSync(gh, 'publish=false\n'); process.exit(0); }
writeFileSync(join(out, 'news.json'), JSON.stringify(res.snapshot));
writeFileSync(join(out, 'news-browser.json'), JSON.stringify(res.browser));
writeFileSync(join(out, 'news-status.json'), JSON.stringify(res.status));
console.log(res.account); if (gh) appendFileSync(gh, 'publish=true\n');
