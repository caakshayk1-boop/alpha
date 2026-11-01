// Build lint: no ad-hoc hex colours outside src/tokens.css.
// Fails (exit 1) on a hex colour in src/**/*.css (except tokens.css) or in src/**/*.tsx (inline styles and SVG attributes), unless the file is
// allow-listed below with the reason. .ts files are counted and reported but do not fail (chart code builds canvas/SVG strings; tracked as info).
// Usage: node apps/tripwire/tools/lint-tokens.mjs [--count]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
/** Files allowed to carry hex, each with the reason. Keep this list short: it is the whole set of exceptions. */
export const ALLOW = {
  'tokens.css': 'the one place colours are defined',
  'ui.tsx': 'Mark(): the brand artwork must equal static/icon.svg byte for byte; an SVG presentation attribute cannot read a custom property',
};
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
// a hex colour: 3, 4, 6 or 8 digits, after a quote, space, paren, comma or colon, not followed by another word character
const HEX = /(?:^|[\s'"`(,:=])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;
const strip = (t, css) => (css ? t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) : t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1'));
export function scan() {
  const out = { css: [], tsx: [], ts: [], allowed: [] };
  for (const f of walk(SRC)) {
    const ext = f.split('.').pop(); if (!['css', 'tsx', 'ts'].includes(ext)) continue;
    const rel = relative(SRC, f); const txt = strip(readFileSync(f, 'utf8'), ext === 'css');
    const hits = [...txt.matchAll(HEX)].map((m) => ({ file: rel, hex: m[0].trim().replace(/^[^#]*/, ''), line: txt.slice(0, m.index).split('\n').length }));
    if (!hits.length) continue;
    if (ALLOW[rel] || ALLOW[rel.split('/').pop()] && !rel.includes('/')) { out.allowed.push(...hits); continue; }
    out[ext].push(...hits);
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = scan(); const bad = [...r.css, ...r.tsx];
  console.log(`hex colours: css ${r.css.length}, tsx ${r.tsx.length}, ts (info only) ${r.ts.length}, allow-listed ${r.allowed.length}`);
  if (process.argv.includes('--count')) process.exit(0);
  for (const h of bad.slice(0, 40)) console.log(`  ${h.file}:${h.line} ${h.hex}`);
  if (bad.length) { console.error(`lint-tokens: ${bad.length} hex colour(s) outside tokens.css. Use a token (var(--...)) or add the file to ALLOW with a reason.`); process.exit(1); }
  console.log('lint-tokens: ok');
}
