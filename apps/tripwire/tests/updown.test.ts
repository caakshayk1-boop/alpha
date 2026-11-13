// The opt-in colour-blind-safe up/down palette (13 Nov 2026, v5): the preference parses and falls back, the default pixels are unchanged, and the alternative pair is MEASURED, not eyeballed:
// OKLab dE (x100) between up and down under simulated protan, deutan and tritan vision (Machado 2009, severity 1.0: the matrices the bundled dataviz validator uses), and WCAG contrast where it is text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, UPDOWN_MODES, checkBackup, exportJson, updownOf } from '../src/store.ts';

test('updownOf: absent, unreadable or unknown values read as the default green and red', () => {
  assert.equal(updownOf(undefined), 'default'); assert.equal(updownOf(null), 'default'); assert.equal(updownOf({}), 'default');
  assert.equal(updownOf({ updown: 'cb' }), 'cb'); assert.equal(updownOf({ updown: 'default' }), 'default');
  for (const bad of ['CB', 'blue', '', 0, 1, true, null, {}, ['cb']]) assert.equal(updownOf({ updown: bad }), 'default', JSON.stringify(bad));
  assert.deepEqual([...UPDOWN_MODES], ['default', 'cb']); assert.equal(DEFAULTS.prefs.updown, 'default');
});
test('a saved backup keeps cb, and a payload from before the field (or with junk in it) loads as the default', () => {
  const cb = checkBackup(exportJson({ ...DEFAULTS, prefs: { ...DEFAULTS.prefs, updown: 'cb' } })); assert.ok(cb.ok); if (cb.ok) assert.equal(cb.state.prefs.updown, 'cb');
  const old = JSON.parse(exportJson(DEFAULTS)); delete old.prefs.updown; const a = checkBackup(JSON.stringify(old)); assert.ok(a.ok); if (a.ok) assert.equal(a.state.prefs.updown, 'default');
  const junk = JSON.parse(exportJson(DEFAULTS)); junk.prefs.updown = 'neon'; const j = checkBackup(JSON.stringify(junk)); assert.ok(j.ok, 'junk is repaired, never a reason to refuse a backup'); if (j.ok) assert.equal(j.state.prefs.updown, 'default');
});

// ---- the tokens ----
const CSS = readFileSync(fileURLToPath(new URL('../src/tokens.css', import.meta.url)), 'utf8');
const rule = (sel: string) => { const i = CSS.indexOf(sel); assert.ok(i >= 0, `${sel} is in tokens.css`); const a = CSS.indexOf('{', i), b = CSS.indexOf('}', a); return CSS.slice(a + 1, b); };
const tok = (block: string, name: string) => { const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`)); assert.ok(m, `${name} is a hex in its block`); return m![1].toUpperCase(); };
const DARK_SURFACE = '#10151D', DARK_SURFACE_3 = '#1C2531', PAPER = '#FFFFFF';
const root = CSS.slice(CSS.indexOf(':root{'), CSS.indexOf('}', CSS.indexOf(':root{')));
const cbBlock = rule('html[data-updown=cb]{');

test('the default pair is unchanged: the owner-approved green and red', () => {
  assert.equal(tok(root, '--up'), '#3DDC97'); assert.equal(tok(root, '--down'), '#FF7A7A');
  assert.match(root, /--halo-up:rgba\(61,220,151,\.26\)/); assert.match(root, /--halo-down:rgba\(255,122,122,\.26\)/);
  assert.match(root, /--rail-down:rgba\(255,107,94,\.55\)/); assert.match(root, /--rail-up:rgba\(61,220,151,\.5\)/); assert.match(root, /--tag-down-bg:rgba\(255,122,89,\.14\)/);
});
test('the alternative overrides the WHOLE up/down family, so no component needs an edit', () => {
  for (const t of ['--up', '--down', '--halo-up', '--halo-down', '--up-tint', '--down-tint', '--rail-down', '--rail-up', '--tag-down-bg']) assert.match(cbBlock, new RegExp(`${t}:`), `${t} is overridden`);
  assert.match(CSS, /@media print\{html\[data-updown=cb\]\{--up:var\(--print-up-cb\);--down:var\(--print-down-cb\)/, 'print has its own paper pair for the alternative');
  // the aliases still resolve from --down at the same element, so --peach follows
  assert.match(root, /--peach:var\(--down\)/);
});

const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h: string) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
const mul = (m: readonly (readonly number[])[], v: number[]) => m.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2])));
const oklab = ([r, g, b]: number[]) => { const L = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), Mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), S = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * L + 0.793617785 * Mm - 0.0040720468 * S, 1.9779984951 * L - 2.428592205 * Mm + 0.4505937099 * S, 0.0259040371 * L + 0.7827717662 * Mm - 0.808675766 * S]; };
const dE = (a: string, b: string, k?: keyof typeof M) => { const x = oklab(k ? mul(M[k], rgb(a)) : rgb(a)), y = oklab(k ? mul(M[k], rgb(b)) : rgb(b)); return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const lum = (h: string) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('the alternative pair stays apart under protan, deutan and tritan vision (dE >= 8), on the page surface and on paper', () => {
  const pairs = [['dark', tok(cbBlock, '--up'), tok(cbBlock, '--down')], ['paper', tok(CSS.slice(CSS.indexOf(':root{--print-up-cb')), '--print-up-cb'), tok(CSS.slice(CSS.indexOf(':root{--print-up-cb')), '--print-down-cb')]] as const;
  for (const [name, up, down] of pairs) for (const k of ['protan', 'deutan', 'tritan'] as const) assert.ok(dE(up, down, k) >= 8, `${name}: ${up} against ${down} under ${k} is ${dE(up, down, k).toFixed(1)}`);
});
test('the default pair is NOT safe under deutan vision (why the alternative exists): dE under 8 on the page', () => {
  assert.ok(dE(tok(root, '--up'), tok(root, '--down'), 'deutan') < 8);
});
test('where the colours are text they read at 4.5:1 or better: on the page surface, on the lightest surface, and on paper', () => {
  const up = tok(cbBlock, '--up'), down = tok(cbBlock, '--down'); const paperPair = CSS.slice(CSS.indexOf(':root{--print-up-cb'));
  for (const s of [DARK_SURFACE, DARK_SURFACE_3]) for (const c of [up, down]) assert.ok(contrast(c, s) >= 4.5, `${c} on ${s} is ${contrast(c, s).toFixed(2)}`);
  for (const c of [tok(paperPair, '--print-up-cb'), tok(paperPair, '--print-down-cb')]) assert.ok(contrast(c, PAPER) >= 4.5, `${c} on paper is ${contrast(c, PAPER).toFixed(2)}`);
});
