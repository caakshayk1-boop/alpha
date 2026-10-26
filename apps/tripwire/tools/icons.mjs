// Draws the Tripwire app icon for each accent theme and exports it: an SVG, and PNGs at 180 (home screen), 192, 512 and 1024, all opaque and
// full-bleed (the phone applies its own corner mask), plus a maskable and a single-colour version for Android. Run: node apps/tripwire/tools/icons.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');
mkdirSync(join(OUT, 'icons'), { recursive: true });
const THEMES = {
  aurora: { bar: '#0b0d07', hi: '#c8f23c', lo: '#35e0d0', dot: '#ff6fa8', bg2: '#16200a' },
  ocean: { bar: '#070d0e', hi: '#35e0d0', lo: '#58a8ff', dot: '#a98bff', bg2: '#0a1c1f' },
  violet: { bar: '#0b0911', hi: '#b39bff', lo: '#ff6fa8', dot: '#58a8ff', bg2: '#1a1230' },
  sunset: { bar: '#0f0b07', hi: '#ffb02e', lo: '#ff6fa8', dot: '#a98bff', bg2: '#2a1706' },
  rose: { bar: '#100912', hi: '#ff7eb3', lo: '#b39bff', dot: '#35e0d0', bg2: '#2a0f1f' },
};
// scale 1 = glyph at full size; the maskable and single-colour versions shrink it into the safe zone
const svg = (t, { round = true, scale = 1, mono = false } = {}) => {
  const c = THEMES[t]; const g = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  const line = mono ? '#fff' : 'url(#ln)'; const dot = mono ? '#fff' : c.dot;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.bg2}"/><stop offset="1" stop-color="${c.bar}"/></linearGradient>
<linearGradient id="ln" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${c.lo}"/><stop offset="1" stop-color="${c.hi}"/></linearGradient>
<radialGradient id="gl"><stop offset="0" stop-color="${c.dot}" stop-opacity=".6"/><stop offset="1" stop-color="${c.dot}" stop-opacity="0"/></radialGradient></defs>
${mono ? '' : `<rect width="512" height="512" ${round ? 'rx="112"' : ''} fill="url(#bg)"/>`}
<g transform="${g}">${mono ? '' : '<circle cx="256" cy="150" r="104" fill="url(#gl)"/>'}
<path d="M96 330 L200 330 L256 150 L312 330 L416 330" fill="none" stroke="${line}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><circle cx="256" cy="150" r="26" fill="${dot}"/></g></svg>`;
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
