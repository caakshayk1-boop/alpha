// shard.mjs — runs before every build. Splits the big company feeds into one small file per company, public/c/<SYM>.json,
// so a company page downloads about 6 KB instead of 1.5 MB and parses none of the other 988.
//
// A11 (21 Oct 2026): the company universe is never published empty or silently shrunk.
//   - Shards are written to public/c.next/, validated, and only then swapped in for public/c/ (atomic for the build).
//   - Validation: at least 500 rows, every symbol well formed and unique, every shard parses, and against the universe that
//     is live now, no more than 5% of symbols removed (ALLOW_UNIVERSE_CHANGE=1 for a deliberate change).
//   - In CI (CI=true) a failure stops the build, so a deploy cannot ship a site without company pages. Locally, with no
//     network, SHARD_OPTIONAL=1 lets the build carry on without company pages.
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const RAW = 'https://raw.githubusercontent.com/caakshayk1-boop/trading-dashboard/main/docs';
const SIG = 'https://raw.githubusercontent.com/caakshayk1-boop/signal/main/public';
const LIVE = 'https://alpha.askakshay.com/universe.json';
const SYM = /^[A-Za-z0-9&-]{1,20}$/;
const get = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`${u} answered ${r.status}`); const t = await r.text(); return JSON.parse(t.replace(/\bNaN\b/g, 'null')); };
const strict = process.env.CI === 'true' && process.env.SHARD_OPTIONAL !== '1';

/** The checks a snapshot must pass before it replaces the last one. Returns the reasons it fails; empty means valid. */
export function validateUniverse(rows, live) {
  const bad = [];
  if (!Array.isArray(rows) || rows.length < 500) bad.push(`screen has ${Array.isArray(rows) ? rows.length : 0} rows, fewer than 500`);
  const syms = (rows || []).map((r) => r?.sym);
  const malformed = syms.filter((s) => typeof s !== 'string' || !SYM.test(s));
  if (malformed.length > (rows?.length ?? 0) * 0.01) bad.push(`${malformed.length} malformed symbols`);
  const dup = syms.length - new Set(syms).size;
  if (dup) bad.push(`${dup} duplicate symbols`);
  if (live && live.size && process.env.ALLOW_UNIVERSE_CHANGE !== '1') {
    const now = new Set(syms);
    const gone = [...live].filter((s) => !now.has(s));
    if (gone.length > live.size * 0.05) bad.push(`${gone.length} of ${live.size} live symbols would disappear (${gone.slice(0, 8).join(', ')}…); set ALLOW_UNIVERSE_CHANGE=1 if deliberate`);
  }
  return bad;
}

async function main() {
  const [screen, detail, swot, season, inst] = await Promise.all([get(`${RAW}/screen.json`), get(`${RAW}/screen-detail.json`), get(`${RAW}/swot.json`), get(`${RAW}/seasonality.json`), get(`${SIG}/institutional.json`).catch(() => ({ rows: {} }))]);
  const live = await get(LIVE).then((u) => new Set((u.rows || []).map((r) => r[0])), () => null);      // first deploy, or offline: no comparison
  const bad = validateUniverse(screen.rows, live);
  if (bad.length) throw new Error(`snapshot refused: ${bad.join('; ')}`);
  rmSync('public/c.next', { recursive: true, force: true });
  mkdirSync('public/c.next', { recursive: true });
  let n = 0;
  for (const row of screen.rows) {
    const s = row.sym;
    if (!SYM.test(s)) continue;
    const body = JSON.stringify({ sym: s, built_on: screen.built_on, count: screen.count, row, years: detail.detail?.[s]?.years ?? null, swot: swot.swot?.[s] ?? null, inst: inst.rows?.[s] ?? null, season: season.stocks?.[s] ?? null });
    JSON.parse(body);
    writeFileSync(`public/c.next/${s}.json`, body);
    n++;
  }
  if (n !== readdirSync('public/c.next').length) throw new Error('shard count does not match the files written');
  rmSync('public/c', { recursive: true, force: true });
  renameSync('public/c.next', 'public/c');
  console.log(`shard: ${n} companies, screen built ${screen.built_on}`);
  // The live-price universe: every screened symbol with its sector, name, 200-day average and 52-week high (the live Barometer's
  // breadth inputs, as of the screen build), read by /api/live (worker) and lib/live.ts. Sorted, so the Worker's two halves
  // are stable between requests.
  const uni = screen.rows.filter((r) => SYM.test(r.sym)).map((r) => [r.sym, r.sector ?? '', r.name ?? r.sym, Number.isFinite(r.sma200) ? r.sma200 : null, Number.isFinite(r.high52) ? r.high52 : null]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  writeFileSync('public/universe.json', JSON.stringify({ built_on: screen.built_on, as_of: screen.breadth?.as_of ?? null, count: uni.length, rows: uni }));
  console.log(`shard: universe.json with ${uni.length} symbols`);
  // One URL per company page (app/company/[slug]), dated with the screen build those pages were rendered from.
  const slug = (sym) => sym.replace(/&/g, '_');
  const urls = readdirSync('public/c').filter((f) => f.endsWith('.json')).map((f) => `<url><loc>https://alpha.askakshay.com/company/${slug(f.slice(0, -5))}/</loc><lastmod>${screen.built_on}</lastmod></url>`);
  writeFileSync('public/sitemap-companies.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  console.log(`shard: sitemap-companies.xml with ${urls.length} pages`);
  return { built_on: screen.built_on, count: n };
}

/** The release identity (A10): which code and which data this build is. Served as /build.json; the deploy's rollback guard
 *  reads it from production. No secrets: a commit id, dates, counts and content hashes. */
function identity(snap) {
  const hash = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16) : null);
  // the commit actually checked out, never GITHUB_SHA: on a workflow_run deploy that is the newest main commit, not the
  // CI head this job checked out, and the rollback guard reads this value
  let commit = null;
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || null; } catch { commit = process.env.GITHUB_SHA || null; }
  const id = { commit, built_at: new Date().toISOString(), run: process.env.GITHUB_RUN_ID ?? null, screen_built_on: snap?.built_on ?? null, companies: snap?.count ?? 0, data: { universe: hash('public/universe.json'), signals: hash('public/signals.json'), engines: hash('public/engines.json'), rotation: hash('public/rotation.json') } };
  writeFileSync('public/build.json', JSON.stringify(id, null, 1));
  console.log(`identity: ${id.commit?.slice(0, 7) ?? 'unknown commit'}, ${id.companies} companies`);
}

if (process.argv[1]?.endsWith('shard.mjs')) {
  try {
    identity(await main());
  } catch (e) {
    rmSync('public/c.next', { recursive: true, force: true });
    if (strict) { console.error(`shard: ${e.message}. The build stops so that no release ships without its company pages.`); process.exit(1); }
    console.warn(`shard: skipped (${e.message}). Company pages are not built in this local build.`);
    if (!existsSync('public/c')) mkdirSync('public/c', { recursive: true });
    if (!readdirSync('public/c').some((f) => f.endsWith('.json'))) writeFileSync('public/sitemap-companies.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
    identity({ built_on: null, count: readdirSync('public/c').filter((f) => f.endsWith('.json')).length });
  }
}
