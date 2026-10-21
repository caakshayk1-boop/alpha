// audit.mjs — every link and endpoint the built site refers to must exist and must be alpha's own.
// Run after `npm run build`:  node scripts/audit.mjs
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out';
const problems = [];
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(OUT);
const pages = files.filter((f) => f.endsWith('.html'));

// 1. internal links: /path/ must resolve to a page or a file
const known = (p) => {
  const clean = p.split('#')[0].split('?')[0];
  if (clean === '/' || clean === '') return true;
  return existsSync(join(OUT, clean)) || existsSync(join(OUT, clean, 'index.html')) || existsSync(join(OUT, `${clean}.html`));
};
// the API routes are read from the Worker's own router, never kept by hand (the hand-kept list had missed two)
const live = new Set([...readFileSync('worker/index.js', 'utf8').matchAll(/url\.pathname === '(\/api\/[a-z-]+)'/g)].map((m) => m[1]));
if (live.size < 8) problems.push(`only ${live.size} API routes found in worker/index.js: the router pattern changed`);
const feeds = new Set(readFileSync('worker/index.js', 'utf8').match(/^\s{2}'?([a-z0-9_-]+)'?:\s*`\$\{(?:SIGNAL_)?RAW\}/gm)?.map((l) => l.trim().replace(/^'?([a-z0-9_-]+)'?:.*/, '$1')) ?? []);
let checked = 0;
for (const f of pages) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/href="(\/[^"#]*)[^"]*"/g)) {
    checked++;
    const p = m[1];
    if (p.startsWith('/_next/') || p.startsWith('/data/') || live.has(p.replace(/\/$/, ''))) continue;
    if (!known(p)) problems.push(`${f}: link to ${p} has no page`);
  }
  // 2. nothing in a page may name a retired site or a staging host
  for (const bad of ['signal.askakshay', 'vision.askakshay', 'gems.askakshay', 'terminal.askakshay', 'news.askakshay', 'workers.dev', 'localhost']) {
    if (html.includes(bad)) problems.push(`${f}: mentions ${bad}`);
  }
}

// 3. every /data/<feed>.json and /api/ call in the source must be one the Worker serves
const src = walk('src').filter((f) => /\.(tsx?|ts)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')]);
for (const [f, t] of src) {
  for (const m of t.matchAll(/['"`]\/data\/([a-z0-9_-]+)\.json/g)) if (!feeds.has(m[1])) problems.push(`${f}: reads /data/${m[1]}.json, which the Worker does not serve`);
  for (const m of t.matchAll(/(?:['"`]|\$\{BASE\})\/api\/([a-z-]+)/g)) if (!live.has(`/api/${m[1]}`)) problems.push(`${f}: calls /api/${m[1]}, which does not exist`);
  for (const m of t.matchAll(/feed\('([a-z0-9_-]+)'\)|useFeed\('([a-z0-9_-]+)'\)/g)) { const n = m[1] || m[2]; if (!feeds.has(n)) problems.push(`${f}: feed('${n}') is not in the Worker's allow-list`); }
}
// 4. the static files the site loads exist
for (const need of ['engines.json', 'signals.json', '_headers', 'robots.txt', 'sitemap.xml', 'build.json']) if (!existsSync(join(OUT, need))) problems.push(`out/${need} is missing`);
// 5. the sitemap lists real pages
for (const m of readFileSync(join(OUT, 'sitemap.xml'), 'utf8').matchAll(/<loc>https:\/\/alpha\.askakshay\.com(\/[^<]*)<\/loc>/g)) if (!known(m[1])) problems.push(`sitemap lists ${m[1]}, which has no page`);

// 6. company-universe parity (A11): every shard has its page, and the sitemap lists exactly those pages
if (existsSync(join(OUT, 'c'))) {
  const shards = readdirSync(join(OUT, 'c')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5).replace(/&/g, '_')).sort();
  const pagesCo = existsSync(join(OUT, 'company')) ? readdirSync(join(OUT, 'company')).filter((d) => existsSync(join(OUT, 'company', d, 'index.html'))).sort() : [];
  const missing = shards.filter((s) => !pagesCo.includes(s));
  if (missing.length) problems.push(`${missing.length} companies have data but no page (${missing.slice(0, 5).join(', ')})`);
  const sm = existsSync(join(OUT, 'sitemap-companies.xml')) ? [...readFileSync(join(OUT, 'sitemap-companies.xml'), 'utf8').matchAll(/\/company\/([^/<]+)\//g)].map((m) => m[1]) : [];
  if (sm.length !== shards.length) problems.push(`sitemap-companies lists ${sm.length} pages for ${shards.length} companies`);
  const id = existsSync(join(OUT, 'build.json')) ? JSON.parse(readFileSync(join(OUT, 'build.json'), 'utf8')) : null;
  if (id && id.companies !== shards.length) problems.push(`build.json says ${id.companies} companies, the build has ${shards.length}`);
  if (process.env.CI === 'true' && shards.length < 500) problems.push(`only ${shards.length} company pages: a release must carry the whole universe`);
  console.log(`${shards.length} company pages, sitemap ${sm.length}`);
}

console.log(`${pages.length} pages, ${checked} internal links, ${feeds.size} feeds known to the Worker`);
if (problems.length) { console.error(problems.map((p) => `FAIL  ${p}`).join('\n')); process.exit(1); }
console.log('audit passed');
