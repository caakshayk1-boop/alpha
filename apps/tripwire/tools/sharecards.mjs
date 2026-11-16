/** Ladder Share Cards (4.0, F8), build step. Reads the committed ledger, writes /share/<SYM>/{index.html,card.png} for every open paper pick and /share/book/ for the book, plus /share/manifest.json.
 *  The colours come from src/tokens.css (the one place a colour is defined). The page carries Open Graph and Twitter tags so a shared link unfurls as the card, then sends a person on to the app (the app is hash-routed,
 *  so a crawler cannot read a pick from the app's own address). PNG needs `sharp`; without it the build still writes the SVG and the page, says so, and the card is left out of the manifest rather than shipped without an image. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAutoBook } from '../src/autobook.ts';
import { pickCards, bookCard, pickSvg, bookSvg, PAPER } from '../src/sharecard.ts';
import { dayWord } from '../src/fmt.ts';

const HERE = dirname(fileURLToPath(import.meta.url)); const SITE = 'https://tripwire.askakshay.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function paletteFromTokens(css) {
  const root = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')));
  const get = (n) => { const m = new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{3,8})`).exec(root); if (!m) throw new Error(`share cards: token --${n} is not a hex colour in tokens.css`); return m[1]; };
  return { bg: get('bg'), surface: get('surface'), ink: get('ink'), ink2: get('ink-2'), ink3: get('ink-3'), accent: get('accent'), up: get('up'), down: get('down'), line: get('surface-3') };
}
let sharp = null; try { sharp = (await import('sharp')).default; } catch { sharp = null; }

export async function writeShareCards(dist, ledgerPath = join(HERE, '..', 'ledger', 'ledger.json')) {
  if (!existsSync(ledgerPath)) return { cards: 0, png: false, skipped: 'no ledger file' };
  const l = JSON.parse(readFileSync(ledgerPath, 'utf8')); const plan = planAutoBook(l);
  const pal = paletteFromTokens(readFileSync(join(HERE, '..', 'src', 'tokens.css'), 'utf8'));
  const items = [...pickCards(l, plan).map((c) => ({ key: encodeURIComponent(c.sym), sym: c.sym, svg: pickSvg(c, pal), title: `${c.sym}: a paper pick on Tripwire`, desc: `${c.stateLine}. Ladder: ${c.rungs.map((r) => `${r.label} ₹${r.v.toFixed(2)}`).join(', ')}. As of ${dayWord(c.asOf)}. ${PAPER}.`, to: `/#/c/${encodeURIComponent(c.sym)}` })),
    (() => { const b = bookCard(l, plan); return { key: 'book', sym: null, svg: bookSvg(b, pal), title: 'The Tripwire Glass Book', desc: `${b.open} open, ${b.closed} closed. ${b.sampleLine} Ledger through ${dayWord(b.asOf)}. ${PAPER}.`, to: '/#/glass' }; })()];
  const manifest = { schema: 'tripwire-share/1', built: new Date().toISOString(), cards: [] };
  for (const it of items) {
    const dir = join(dist, 'share', it.key); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'card.svg'), it.svg);
    let png = false; if (sharp) { try { await sharp(Buffer.from(it.svg)).png().toFile(join(dir, 'card.png')); png = true; } catch { png = false; } }
    const url = `${SITE}/share/${it.key}/`; const img = png ? `${url}card.png` : null;
    writeFileSync(join(dir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(it.title)}</title>
<meta name="robots" content="noindex"><link rel="canonical" href="${url}"><meta http-equiv="refresh" content="0;url=${esc(it.to)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Tripwire"><meta property="og:title" content="${esc(it.title)}"><meta property="og:description" content="${esc(it.desc)}"><meta property="og:url" content="${url}">${img ? `<meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${img}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${esc(it.title)}"><meta name="twitter:description" content="${esc(it.desc)}"></head><body><p>${esc(it.desc)}</p><p><a href="${esc(it.to)}">Open it in Tripwire</a></p></body></html>\n`);
    if (png) manifest.cards.push({ key: it.key, sym: it.sym });
  }
  writeFileSync(join(dist, 'share', 'manifest.json'), JSON.stringify(manifest));
  return { cards: items.length, png: !!sharp, listed: manifest.cards.length };
}
