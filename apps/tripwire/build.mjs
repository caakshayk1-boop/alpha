// Builds Tripwire into apps/tripwire/dist: one esbuild bundle, the static shell, and a compact copy of the published data.
// Data is read from ../../public (the same feeds the website publishes); nothing here fetches from the network.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, '..', '..', 'public');
const DIST = join(HERE, 'dist');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'data', 'c'), { recursive: true });

const stamp = Date.now().toString(36);
await build({ entryPoints: [join(HERE, 'src/main.tsx')], bundle: true, minify: true, sourcemap: false, target: 'es2020', format: 'iife', jsx: 'automatic',
  outfile: join(DIST, `app.${stamp}.js`), loader: { '.css': 'css' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' });
await build({ entryPoints: [join(HERE, 'src/style.css')], bundle: true, minify: true, external: ['/fonts/*'], outfile: join(DIST, `app.${stamp}.css`), logLevel: 'warning' });

// The screen rows: one compact file for Discover, the rules and Today. Fields not listed here are not shipped.
const KEEP = ['sym', 'name', 'sector', 'tier', 'price', 'r1d', 'r1w', 'r1m', 'r3m', 'rs3m', 'from_high', 'high52', 'low52', 'sma20', 'sma50', 'sma200', 'rsi', 'vol_spike', 'liquid', 'turnover_cr', 'pe', 'pb', 'roce_med', 'rev_cagr', 'eps_cagr', 'de', 'net_margin', 'ebit_margin', 'div_yield', 'risk_lvl', 'next_earnings', 'last_date', 'fy', 'has_stmts', 'r6m', 'r1y', 'sd1y', 'atr_pct', 'piotroski', 'comp', 'q', 'g', 'v', 'tech', 'pe_pctile', 'roe', 'icover', 'cfo_pat', 'fcf_margin', 'margin_delta', 'em_label', 'rank_move', 'insiders', 'instis', 'shares_changed'];
const files = readdirSync(join(PUB, 'c')).filter((f) => f.endsWith('.json'));
const rows = []; let built = null;
for (const f of files) {
  const d = JSON.parse(readFileSync(join(PUB, 'c', f), 'utf8'));
  built = built ?? d.built_on;
  const r = d.row ?? {}; const o = {};
  for (const k of KEEP) if (r[k] !== undefined) o[k] = r[k];
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
const uni = JSON.parse(readFileSync(join(PUB, 'universe.json'), 'utf8'));
writeFileSync(join(DIST, 'data', 'screen.json'), JSON.stringify({ built_on: built, as_of: uni.as_of, count: rows.length, rows }));
for (const f of ['signals.json', 'engines_v3.json']) if (existsSync(join(PUB, f))) cpSync(join(PUB, f), join(DIST, 'data', f));

// the study results (apps/tripwire/research/results), so every screen can say what the history says
mkdirSync(join(DIST, 'data', 'research'), { recursive: true });
for (const f of ['factor_study.json', 'engines_backtest.json', 'engines_walkforward.json']) { const src = join(HERE, 'research', 'results', f); if (existsSync(src)) cpSync(src, join(DIST, 'data', 'research', f)); }

// static shell
const html = readFileSync(join(HERE, 'static/index.html'), 'utf8').replaceAll('__STAMP__', stamp);
writeFileSync(join(DIST, 'index.html'), html);
writeFileSync(join(DIST, '404.html'), html);
for (const f of ['manifest.webmanifest', 'icon.svg', '_headers']) cpSync(join(HERE, 'static', f), join(DIST, f));
for (const f of readdirSync(join(HERE, 'static')).filter((x) => x.endsWith('.png'))) cpSync(join(HERE, 'static', f), join(DIST, f));
cpSync(join(HERE, 'static', 'icons'), join(DIST, 'icons'), { recursive: true });
cpSync(join(HERE, 'static', 'fonts'), join(DIST, 'fonts'), { recursive: true });
const sw = readFileSync(join(HERE, 'static/sw.js'), 'utf8').replaceAll('__STAMP__', stamp);
writeFileSync(join(DIST, 'sw.js'), sw);
writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
const size = (p) => statSync(p).size;
console.log(`tripwire: ${rows.length} companies, data through ${uni.as_of}, js ${(size(join(DIST, `app.${stamp}.js`)) / 1024).toFixed(0)} kB, css ${(size(join(DIST, `app.${stamp}.css`)) / 1024).toFixed(0)} kB`);
writeFileSync(join(DIST, 'build.json'), JSON.stringify({ stamp, built: new Date().toISOString(), data_built_on: built, data_as_of: uni.as_of, companies: rows.length }));
