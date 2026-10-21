// Run with: node --test tests/   (the OKLCH token layer equals the hex palette it was generated from)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hexToOklch } from '../scripts/oklch.mjs';

const toSrgb = (L, C, H) => {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map((c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))));
};

test('every OKLCH token converts back to its hex within one 8-bit step', () => {
  const css = readFileSync('src/app/tokens-oklch.css', 'utf8');
  const pairs = [...css.matchAll(/oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\); \/\* (#[0-9a-fA-F]{3,6}) \*\//g)];
  assert.ok(pairs.length > 100, `only ${pairs.length} tokens found`);
  for (const [, L, C, H, hex] of pairs) {
    const h = hex.slice(1).length === 3 ? hex.slice(1).split('').map((x) => x + x).join('') : hex.slice(1);
    const want = h.match(/../g).map((x) => parseInt(x, 16));
    const got = toSrgb(Number(L) / 100, Number(C), Number(H));
    got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= 1, `${hex} became rgb(${got})`));
  }
});

test('the generated layer is current: regenerating from globals.css changes nothing', () => {
  assert.match(hexToOklch('#ffffff'), /^oklch\(100\.00% 0\.0000/);
  const css = readFileSync('src/app/globals.css', 'utf8');
  const layer = readFileSync('src/app/tokens-oklch.css', 'utf8');
  const hexes = new Set([...css.matchAll(/--[\w-]+\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*;/g)].map((m) => m[1].toLowerCase()));
  for (const h of hexes) assert.ok(layer.toLowerCase().includes(`/* ${h} */`), `${h} in globals.css is missing from tokens-oklch.css: run node scripts/oklch.mjs`);
});
