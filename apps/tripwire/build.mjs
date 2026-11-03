// Builds Tripwire into apps/tripwire/dist: one esbuild bundle, the static shell, and a compact copy of the published data.
// Data is read from ../../public (the same feeds the website publishes); nothing here fetches from the network.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessionsBetween } from './src/calendar.ts';
import { FILE_IDS } from './src/freshness.ts';
import { criticalCss } from './tools/critical.mjs';
import { staticClosure } from './tools/budget.mjs';
import { SUPPORT_EMAIL, contactView } from './src/contact.ts';
const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, '..', '..', 'public');
const DIST = join(HERE, 'dist');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'data', 'c'), { recursive: true });

// the design tokens are the only place a hex colour may live: fail the build otherwise (tools/lint-tokens.mjs)
execFileSync(process.execPath, [join(HERE, 'tools/lint-tokens.mjs')], { stdio: 'inherit' });

const stamp = Date.now().toString(36);
await build({ entryPoints: [join(HERE, 'src/main.tsx')], bundle: true, minify: true, sourcemap: false, target: 'es2020', format: 'esm', splitting: true, chunkNames: `app.${stamp}.[name]-[hash]`, entryNames: `app.${stamp}`, jsx: 'automatic',
  outdir: DIST, loader: { '.css': 'css' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' });
await build({ entryPoints: [join(HERE, 'src/app.css')], bundle: true, minify: true, external: ['/fonts/*'], outfile: join(DIST, `app.${stamp}.css`), logLevel: 'warning' });

// The screen rows: one compact file for Discover, the rules and Today. Fields not listed here are not shipped.
const KEEP = ['sym', 'name', 'sector', 'tier', 'price', 'r1d', 'r1w', 'r1m', 'r3m', 'rs3m', 'from_high', 'high52', 'low52', 'sma20', 'sma50', 'sma200', 'rsi', 'vol_spike', 'liquid', 'turnover_cr', 'pe', 'pb', 'roce_med', 'rev_cagr', 'eps_cagr', 'de', 'net_margin', 'ebit_margin', 'div_yield', 'risk_lvl', 'next_earnings', 'last_date', 'stale', 'fy', 'has_stmts', 'r6m', 'r1y', 'sd1y', 'atr_pct', 'piotroski', 'comp', 'q', 'g', 'v', 'tech', 'pe_pctile', 'roe', 'icover', 'cfo_pat', 'fcf_margin', 'margin_delta', 'em_label', 'rank_move', 'insiders', 'instis', 'shares_changed'];
// Sector the feed does not publish for a name, mapped here (dated, one line each; assertScreen allows exactly these and fails on any other null sector).
// ARTEMISMED (Artemis Medicare Services, a hospital operator) has had no sector or size class upstream since it entered the universe; its peers APOLLOHOSP, MAXHEALTH, FORTIS and KIMS are 'Healthcare'.
export const SECTOR_FIX = { ARTEMISMED: 'Healthcare' };
const uni0 = JSON.parse(readFileSync(join(PUB, 'universe.json'), 'utf8'));
const files = readdirSync(join(PUB, 'c')).filter((f) => f.endsWith('.json'));
const rows = []; let built = null;
for (const f of files) {
  const d = JSON.parse(readFileSync(join(PUB, 'c', f), 'utf8'));
  built = built ?? d.built_on;
  const r = d.row ?? {}; const o = {};
  for (const k of KEEP) if (r[k] !== undefined) o[k] = r[k];
  if (!o.sector && SECTOR_FIX[d.sym]) { o.sector = SECTOR_FIX[d.sym]; }
  // a row whose last close is more than one session older than the file's data day is marked, so every surface can say so (checked by tools/check-data.mjs)
  if (o.last_date && uni0.as_of && sessionsBetween(o.last_date, uni0.as_of) > 1) o.stale = true;
  const flag = (r.risk?.flags ?? []).find((x) => x.s === 'high') ?? (r.risk?.flags ?? [])[0];
  // the published grade is a number (0 low, 1 medium, 2 high) beside a word in risk.level: carry the word, and refuse anything else, because code
  // that compares the grade to 'HIGH' silently gets it backwards when handed a number
  const WORD = ['LOW', 'MEDIUM', 'HIGH'];
  if (r.risk_lvl !== undefined && r.risk_lvl !== null) { o.risk_lvl = typeof r.risk_lvl === 'number' ? WORD[r.risk_lvl] : String(r.risk_lvl).toUpperCase(); if (!WORD.includes(o.risk_lvl)) throw new Error(`${d.sym}: risk grade ${JSON.stringify(r.risk_lvl)} is not LOW, MEDIUM or HIGH`); }
  if (flag) o.risk_top = flag.t;
  if (r.mf && Number.isFinite(r.mf.rank)) o.mf = { rank: r.mf.rank, of: r.mf.of };
  rows.push(o);
  // per-company file: statements, case/countercase, risk flags and nothing else
  const inst = d.inst && d.inst.quality !== undefined ? { ...d.inst, series: (d.inst.series ?? []).slice(-8) } : null;
  const keep = { sym: d.sym, built_on: d.built_on, row: o, years: d.years ?? [], swot: d.swot ?? null, risk: r.risk ?? null, inst, season: d.season ?? null };
  writeFileSync(join(DIST, 'data', 'c', f), JSON.stringify(keep));
}
rows.sort((a, b) => a.sym.localeCompare(b.sym));
const uni = uni0;
writeFileSync(join(DIST, 'data', 'screen.json'), JSON.stringify({ built_on: built, built_at: uni.built_at ?? null, as_of: uni.as_of, count: rows.length, rows }));
for (const f of ['signals.json', 'engines_v3.json']) if (existsSync(join(PUB, f))) cpSync(join(PUB, f), join(DIST, 'data', f));
// The static half of the freshness table (the Data screen and the pill add the API files). One fact per file, read from the file's own date; the status is NEVER stored here,
// it is computed from the clock by src/freshness.ts in the browser and in tools/check-data.mjs, so a file cannot keep saying "current" after the day has moved on.
const lastDates = rows.map((r) => r.last_date).filter(Boolean).sort();
const sig = existsSync(join(PUB, 'signals.json')) ? JSON.parse(readFileSync(join(PUB, 'signals.json'), 'utf8')) : null;
writeFileSync(join(DIST, 'data', 'freshness.json'), JSON.stringify({ schema: 'tripwire-freshness/1', files: [
  { id: 'screen', asOf: uni.as_of, built: uni.built_at ?? built, rows: rows.length },
  { id: 'companies', asOf: lastDates.length ? lastDates[lastDates.length - 1] : null, oldest: lastDates[0] ?? null, built: uni.built_at ?? built, rows: files.length },
  { id: 'signals', asOf: sig?.data_through ?? null, built: sig?.generated ?? null, rows: Array.isArray(sig?.signals) ? sig.signals.length : null },
], ids: FILE_IDS }));

// the study results (apps/tripwire/research/results), so every screen can say what the history says
mkdirSync(join(DIST, 'data', 'research'), { recursive: true });
for (const f of ['factor_study.json', 'engines_backtest.json', 'engines_walkforward.json', 'engines_pairs.json', 'lab_panel.json', 'lab_panel.bin.gz']) { const src = join(HERE, 'research', 'results', f); if (existsSync(src)) cpSync(src, join(DIST, 'data', 'research', f)); }

// static shell
let html = readFileSync(join(HERE, 'static/index.html'), 'utf8').replaceAll('__STAMP__', stamp);
// Performance: (1) the rules the first viewport needs go inline (the CSP already allows inline style: style-src 'self' 'unsafe-inline'; nothing is weakened) and the full stylesheet loads
// WITHOUT blocking first paint (media="print" until src/main.tsx switches it on; a <noscript> copy for no-JS); (2) the entry's static chunks are named in modulepreload so they download
// in parallel with the entry instead of one level down. tools/budget.mjs fails the build above the owner's budgets.
const critical = criticalCss(readFileSync(join(DIST, `app.${stamp}.css`), 'utf8'), JSON.parse(readFileSync(join(HERE, 'static/critical-classes.json'), 'utf8')));
const link = `<link rel="stylesheet" href="/app.${stamp}.css">`; if (!html.includes(link)) throw new Error('static/index.html lost its stylesheet link');
html = html.replace(link, `<style data-critical>${critical}</style>\n<link rel="preload" href="/app.${stamp}.css" as="style">\n<link rel="stylesheet" href="/app.${stamp}.css" media="print" data-full-css>\n<noscript>${link}</noscript>`);
const preload = staticClosure(DIST, `app.${stamp}.js`).filter((f) => f !== `app.${stamp}.js`).map((f) => `<link rel="modulepreload" href="/${f}">`).join('\n');
html = html.replace('</head>', `${preload}\n</head>`);
writeFileSync(join(DIST, 'index.html'), html);
writeFileSync(join(DIST, '404.html'), html);
for (const f of ['manifest.webmanifest', 'icon.svg', '_headers']) cpSync(join(HERE, 'static', f), join(DIST, f));
for (const f of readdirSync(join(HERE, 'static')).filter((x) => x.endsWith('.png'))) cpSync(join(HERE, 'static', f), join(DIST, f));
// The link-preview image is copied by the .png loop above; the build refuses to ship without it, or with one over the 120 KB the share previews allow (tools/make-og.mjs draws it).
if (!existsSync(join(DIST, 'og.png'))) throw new Error('static/og.png is missing: run node apps/tripwire/tools/make-og.mjs');
if (statSync(join(DIST, 'og.png')).size >= 120 * 1024) throw new Error('static/og.png is 120 KB or more');
// security.txt (RFC 9116) is published ONLY once the owner has set SUPPORT_EMAIL in src/contact.ts: a security contact that does not exist is worse than none. Expires is a year from the build.
const contact = contactView(SUPPORT_EMAIL);
if (contact.email) {
  mkdirSync(join(DIST, '.well-known'), { recursive: true });
  const expires = new Date(Date.now() + 365 * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  writeFileSync(join(DIST, '.well-known', 'security.txt'), `Contact: mailto:${contact.email}\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: https://tripwire.askakshay.com/.well-known/security.txt\n`);
}
// The discovery manifest for AI agents (Agentic Resource Discovery) and the one skill it lists. They are served as real files: without it the SPA fallback answers /.well-known/ard.json with the app's HTML, which is not a manifest.
mkdirSync(join(DIST, '.well-known'), { recursive: true }); cpSync(join(HERE, 'static', 'ard.json'), join(DIST, '.well-known', 'ard.json')); cpSync(join(HERE, 'static', 'agent-skills'), join(DIST, '.well-known', 'agent-skills'), { recursive: true });
cpSync(join(HERE, 'static', 'icons'), join(DIST, 'icons'), { recursive: true });
cpSync(join(HERE, 'static', 'fonts'), join(DIST, 'fonts'), { recursive: true });
// every hashed script and style (the lazy screens are separate chunks) and the fonts go into the worker's precache list, so the shell opens offline
const precache = [...readdirSync(DIST).filter((f) => /^app\..+\.(js|css)$/.test(f)).map((f) => `/${f}`), ...readdirSync(join(DIST, 'fonts')).filter((f) => f.endsWith('.woff2')).map((f) => `/fonts/${f}`)].sort();
const sw = readFileSync(join(HERE, 'static/sw.js'), 'utf8').replaceAll('__STAMP__', stamp).replace('__ASSETS__', JSON.stringify(precache));
writeFileSync(join(DIST, 'sw.js'), sw);
// The page itself may be indexed; the data and the live-price routes are not pages and are not crawled.
// The app is hash-routed (#/c/TCS, #/data ...): a crawler sees one page, so the sitemap lists the canonical root only. Its lastmod is the data day, not the build clock.
writeFileSync(join(DIST, 'sitemap.xml'), readFileSync(join(HERE, 'static/sitemap.xml'), 'utf8').replaceAll('__LASTMOD__', uni.as_of ?? new Date().toISOString().slice(0, 10)));
writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /$\nAllow: /sitemap.xml\nDisallow: /api/\nDisallow: /data/\n\nSitemap: https://tripwire.askakshay.com/sitemap.xml\n');
writeFileSync(join(DIST, 'llms.txt'), readFileSync(join(HERE, 'static/llms.txt'), 'utf8'));
const size = (p) => statSync(p).size;
console.log(`tripwire: ${rows.length} companies, data through ${uni.as_of}, js ${(size(join(DIST, `app.${stamp}.js`)) / 1024).toFixed(0)} kB, css ${(size(join(DIST, `app.${stamp}.css`)) / 1024).toFixed(0)} kB`);
writeFileSync(join(DIST, 'build.json'), JSON.stringify({ stamp, built: new Date().toISOString(), data_built_on: built, data_as_of: uni.as_of, data_built_at: uni.built_at ?? null, companies: rows.length }));
