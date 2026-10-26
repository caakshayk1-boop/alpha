// Draws the Tripwire app icon for each accent theme and exports it: an SVG, and PNGs at 180 (home screen), 192, 512 and 1024, all opaque and
// full-bleed (the phone applies its own corner mask), plus a maskable and a single-colour version for Android. Run: node apps/tripwire/tools/icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');
mkdirSync(join(OUT, 'icons'), { recursive: true });
const THEMES = {
  aurora: { bar: '#0a0a0a', hi: '#b8ef43', dot: '#b8ef43' },   // one flat look: near-black ground, the lime of the Daily Signal mark
};
// scale 1 = glyph at full size; the maskable and single-colour versions shrink it into the safe zone
const svg = (t, { round = true, scale = 1, mono = false } = {}) => {
  const c = THEMES[t]; const g = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  const line = mono ? '#fff' : c.hi; const dot = mono ? '#fff' : c.dot;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
${mono ? '' : `<rect width="512" height="512" ${round ? 'rx="112"' : ''} fill="${c.bar}"/>`}
<g transform="${g}"><path d="M96 330 L200 330 L256 150 L312 330 L416 330" fill="none" stroke="${line}" stroke-width="30" stroke-linecap="square" stroke-linejoin="miter"/><rect x="232" y="126" width="48" height="48" fill="${dot}"/></g></svg>`;
};
const b = await chromium.launch(); const pg = await b.newPage();
const png = async (markup, size, file, transparent = false) => {
  await pg.setViewportSize({ width: size, height: size });
  await pg.setContent(`<style>html,body{margin:0;background:${transparent ? 'transparent' : '#000'}}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  await pg.screenshot({ path: join(OUT, file), omitBackground: transparent });
};
for (const t of Object.keys(THEMES)) {
  writeFileSync(join(OUT, 'icons', `${t}.svg`), svg(t));
  for (const n of [180, 192, 512, 1024]) await png(svg(t, { round: false }), n, `icons/${t}-${n}.png`);
}
// the default theme also keeps the names the manifest and old installs already use
writeFileSync(join(OUT, 'icon.svg'), svg('aurora'));
await png(svg('aurora', { round: false }), 192, 'icon-192.png'); await png(svg('aurora', { round: false }), 512, 'icon-512.png');
await png(svg('aurora', { round: false, scale: 0.78 }), 512, 'icon-maskable-512.png');
await png(svg('aurora', { mono: true, scale: 0.78 }), 512, 'icon-mono-512.png', true);
await b.close(); console.log('icons written');
