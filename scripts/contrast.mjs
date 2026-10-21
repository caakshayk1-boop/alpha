// contrast.mjs — every text colour token against every surface it sits on, in every theme and mode (Pro §24, WCAG 1.4.3).
// Loads the built stylesheet into Chromium, sets the <html> attributes each mode uses, reads the computed custom properties
// and computes the WCAG contrast ratio. Body text tokens need 4.5:1; large-only or decorative tokens are not listed.
// Usage: npm run build && node scripts/contrast.mjs   (CHROMIUM_PATH to use a preinstalled browser)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = 'out/_next/static/css';
const css = readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const TEXT = ['--text', '--muted', '--dim', '--up', '--down', '--warn', '--accent-2'];
const SURFACES = ['--bg', '--bg-2', '--panel', '--panel-2'];
const PAIRS = [['--accent-ink', '--accent'], ['--sel-fg', '--sel-bg'], ['--ink-text', '--ink'], ['--ink-dim', '--ink']];
const MODES = [];
for (const theme of ['light', 'dark']) for (const extra of [{}, { contrast: 'high' }, { market: 'cb' }, { accent: 'cyan' }, { accent: 'lime' }, { accent: 'coral' }]) MODES.push({ theme, ...extra });
const MIN = 4.5;

const exe = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body></body></html>`);
const fails = [];
let checked = 0;
for (const mode of MODES) {
  const res = await page.evaluate(({ mode, TEXT, SURFACES, PAIRS }) => {
    const h = document.documentElement;
    for (const k of Object.keys(h.dataset)) delete h.dataset[k];
    Object.assign(h.dataset, mode);
    const cs = getComputedStyle(h);
    // resolve any CSS colour to [r,g,b,a] through a probe element
    const probe = document.body.appendChild(document.createElement('i'));
    const rgba = (v) => { probe.style.color = ''; probe.style.color = v; const m = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]; return [m[0], m[1], m[2], m[3] ?? 1]; };
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
    const ratio = (fgv, bgv) => { const bg = rgba(bgv); const fg = over(rgba(fgv), bg); const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };
    const v = (k) => cs.getPropertyValue(k).trim();
    const out = [];
    for (const t of TEXT) for (const s of SURFACES) if (v(t) && v(s)) out.push([t, s, ratio(v(t), v(s))]);
    for (const [t, s] of PAIRS) if (v(t) && v(s)) out.push([t, s, ratio(v(t), v(s))]);
    return out;
  }, { mode, TEXT, SURFACES, PAIRS });
  for (const [t, s, r] of res) { checked++; if (r < MIN) fails.push(`${JSON.stringify(mode)} ${t} on ${s}: ${r.toFixed(2)}:1`); }
}
await browser.close();
console.log(`contrast: ${checked} token pairs across ${MODES.length} modes, minimum ${MIN}:1`);
if (fails.length) { console.error(fails.map((x) => `FAIL  ${x}`).join('\n')); process.exit(1); }
console.log('contrast passed');
