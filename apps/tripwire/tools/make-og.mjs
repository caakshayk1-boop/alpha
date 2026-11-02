// Draws static/og.png: the 1200x630 link-preview image, in the app's dark palette. Deterministic: the colours are READ from src/tokens.css, the mark is READ from static/icon.svg,
// and the only typeface is the bundled JetBrains Mono (embedded as a data URI), so the same inputs give the same pixels on any machine with the same Chromium.
// Uses Playwright (already a dev dependency) to screenshot an HTML template; no new dependency.
// Usage: node apps/tripwire/tools/make-og.mjs   (re-run when tokens.css, icon.svg or the line below change, and commit the PNG)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)); const APP = join(HERE, '..');
export const LINE = 'Paper research workspace for Indian stocks';
export const OUT = join(APP, 'static', 'og.png');
export const MAX_BYTES = 120 * 1024;

const tokens = readFileSync(join(APP, 'src', 'tokens.css'), 'utf8');
const root = tokens.slice(tokens.indexOf(':root'), tokens.indexOf('}', tokens.indexOf(':root')));
const tok = (n) => { const m = new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{6})`).exec(root); if (!m) throw new Error(`token --${n} not found in tokens.css`); return m[1]; };
const C = { bg: tok('bg'), surface: tok('surface'), ink: tok('ink'), ink2: tok('ink-2'), ink3: tok('ink-3'), accent: tok('accent') };
const icon = readFileSync(join(APP, 'static', 'icon.svg'), 'utf8');
const markInner = icon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');   // the artwork exactly as the app icon draws it
const font = readFileSync(join(APP, 'static', 'fonts', 'jetbrains-mono-latin-wght-normal.woff2')).toString('base64');

export const html = () => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:TWMono;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 800}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;background:${C.bg};overflow:hidden}
body{font-family:TWMono,monospace;color:${C.ink};position:relative}
.frame{position:absolute;inset:36px;border:2px solid ${C.surface};border-radius:28px}
.wire{position:absolute;right:-40px;top:70px;width:620px;height:500px}
.copy{position:absolute;left:96px;top:96px;width:700px}
.brand{display:flex;align-items:center;gap:32px}
.brand svg{width:168px;height:112px;flex:none}
.name{font-size:92px;font-weight:700;letter-spacing:-4px;line-height:1}
.line{margin-top:56px;font-size:46px;font-weight:500;line-height:1.28;color:${C.ink2};letter-spacing:-1px}
.foot{position:absolute;left:96px;bottom:84px;font-size:26px;color:${C.ink3};letter-spacing:-.2px}
.foot b{color:${C.accent};font-weight:600}
</style></head><body>
<div class="frame"></div>
<svg class="wire" viewBox="0 0 620 500" fill="none"><path d="M0 420 L170 420 L330 70 L490 420 L640 420" stroke="${C.accent}" stroke-opacity=".85" stroke-width="16" stroke-linejoin="miter"/><rect x="298" y="38" width="64" height="64" fill="${C.accent}"/></svg>
<div class="copy"><div class="brand"><svg viewBox="76 108 360 240">${markInner}</svg><div class="name">Tripwire</div></div>
<div class="line">${LINE}</div></div>
<div class="foot"><b>Rules that fire.</b> Evidence you can check. Paper only. Not advice.</div>
</body></html>`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await pg.setContent(html()); await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: OUT, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 }, animations: 'disabled' });
  await b.close();
  const n = statSync(OUT).size; console.log(`og.png: ${n} bytes (${(n / 1024).toFixed(1)} KB), limit ${MAX_BYTES / 1024} KB`);
  if (n >= MAX_BYTES) { console.error('og.png is over the size limit'); process.exit(1); }
}
