// Performance budget, enforced after the build: `npm run tripwire:budget` (wired into tripwire.yml before the deploy). Exit 1 with one FAIL line per broken budget.
// What it measures, from the built index.html and the files it names (nothing is guessed from the source):
//   INITIAL JS      the entry module plus every chunk it imports STATICALLY, transitively (a dynamic import() is a lazy chunk and is not counted), gzip level 9.
//   RENDER-BLOCKING a <link rel=stylesheet> without media="print" in <head> blocks first paint. The first-viewport CSS is inlined in a <style> block (the CSP already allows inline
//                   styles: style-src 'self' 'unsafe-inline'), and the full stylesheet is loaded without blocking. Budget: zero blocking stylesheets, inline critical CSS within a gzip cap.
//   MODULEPRELOAD   the entry's static chunks are named in <link rel=modulepreload> so the browser fetches them in parallel with the entry instead of discovering them one level down.
//   LAZY VIEWS      Company, sheets, Methodology (and the Lab, Data, Help ...) must be separate chunks that the initial closure does NOT contain.
// The owner's LCP goal (< 2.0 s on a mid-tier Android over 4G) is REPORTED by the browser tests, never gated here.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUDGET = { initialJsGzKB: 250, blockingCss: 0, inlineCriticalCssGzKB: 14, lazyViews: ['company', 'sheets', 'Methodology', 'Lab', 'Data', 'Help'] };
const kb = (n) => n / 1024; const gz = (buf) => gzipSync(buf, { level: 9 }).length;

/** The entry module and every chunk it imports statically, transitively (a dynamic import() is a lazy chunk and is not followed). Shared with build.mjs, which names them in modulepreload. */
export function staticClosure(dist, entry) {
  const statics = (src) => [...src.matchAll(/(?:^|[;}\s,])(?:import|export)\s*(?:[^"'()]*?from\s*)?"\.\/([^"]+\.js)"/g)].map((m) => m[1]);
  const closure = new Set(); const walk = (f) => { if (closure.has(f) || !existsSync(join(dist, f))) return; closure.add(f); for (const d of statics(readFileSync(join(dist, f), 'utf8'))) walk(d); }; walk(entry);
  return [...closure];
}
export function measure(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8').replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  const entry = /<script[^>]*type="module"[^>]*src="\/([^"]+)"/.exec(html)?.[1]; if (!entry) throw new Error('index.html names no module entry');
  const files = readdirSync(dist).filter((f) => f.endsWith('.js'));
  const closure = new Set(staticClosure(dist, entry));
  const sizes = [...closure].map((f) => { const b = readFileSync(join(dist, f)); return { file: f, raw: b.length, gz: gz(b) }; });
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  const sheets = links.filter((l) => /rel="stylesheet"/.test(l)); const blocking = sheets.filter((l) => !/media="print"/.test(l));
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  const preloaded = new Set(links.filter((l) => /rel="modulepreload"/.test(l)).map((l) => /href="\/([^"]+)"/.exec(l)?.[1]).filter(Boolean));
  const cssFile = sheets.map((l) => /href="\/([^"]+\.css)"/.exec(l)?.[1]).find(Boolean) ?? files.find((f) => f.endsWith('.css'));
  const fullCss = cssFile && existsSync(join(dist, cssFile)) ? readFileSync(join(dist, cssFile)) : Buffer.alloc(0);
  const lazy = files.filter((f) => !closure.has(f));
  return { entry, closure: sizes, initialRaw: sizes.reduce((a, b) => a + b.raw, 0), initialGz: sizes.reduce((a, b) => a + b.gz, 0), blocking, preloaded, missingPreload: [...closure].filter((f) => f !== entry && !preloaded.has(f)),
    inlineCssRaw: inline.reduce((a, b) => a + b.length, 0), inlineCssGz: inline.reduce((a, b) => a + gz(Buffer.from(b)), 0), fullCssRaw: fullCss.length, fullCssGz: fullCss.length ? gz(fullCss) : 0, lazy };
}
export function verdict(m, B = BUDGET) {
  const fails = [];
  if (kb(m.initialGz) > B.initialJsGzKB) fails.push(`initial JS is ${kb(m.initialGz).toFixed(1)} KB gzip across ${m.closure.length} files; the budget is ${B.initialJsGzKB} KB`);
  if (m.blocking.length > B.blockingCss) fails.push(`${m.blocking.length} render-blocking stylesheet(s) in <head> (${m.blocking.join(' ').slice(0, 120)}); the first-viewport CSS must be inlined and the rest loaded without blocking`);
  if (kb(m.inlineCssGz) > B.inlineCriticalCssGzKB) fails.push(`inline critical CSS is ${kb(m.inlineCssGz).toFixed(1)} KB gzip; the cap is ${B.inlineCriticalCssGzKB} KB (about one TCP initial window, so it rides the first round trip with the HTML)`);
  if (m.missingPreload.length) fails.push(`the entry's static chunks are not modulepreloaded: ${m.missingPreload.join(', ')}`);
  for (const v of B.lazyViews) if (!m.lazy.some((f) => f.toLowerCase().includes(`.${v.toLowerCase()}-`))) fails.push(`view "${v}" is not a lazy chunk of its own (or is in the initial closure)`);
  return fails;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'dist'); const m = measure(dist); const fails = verdict(m);
  console.log(`budget: initial JS ${kb(m.initialRaw).toFixed(1)} KB raw / ${kb(m.initialGz).toFixed(1)} KB gzip in ${m.closure.length} files (${m.closure.map((c) => `${c.file.replace(/^app\.[a-z0-9]+\.?/, '') || 'entry'} ${kb(c.gz).toFixed(1)}`).join(', ')})`);
  console.log(`budget: render-blocking stylesheets ${m.blocking.length}; inline critical CSS ${kb(m.inlineCssRaw).toFixed(1)} KB raw / ${kb(m.inlineCssGz).toFixed(1)} KB gzip; full stylesheet ${kb(m.fullCssRaw).toFixed(1)} KB raw / ${kb(m.fullCssGz).toFixed(1)} KB gzip`);
  console.log(`budget: modulepreload ${m.preloaded.size} chunk(s); ${m.lazy.length} lazy chunks outside the initial load`);
  for (const f of fails) console.error(`FAIL  ${f}`);
  if (fails.length) { console.error(`tripwire budget: ${fails.length} budget(s) broken`); process.exit(1); }
  console.log('tripwire budget: ok');
}
