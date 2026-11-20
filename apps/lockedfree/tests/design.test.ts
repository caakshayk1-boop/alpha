import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const walk = (d: string, out: string[] = []) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
test('tokens.css matches the DESIGN.md front matter (colours, radius)', () => {
  const md = readFileSync(join(root, 'DESIGN.md'), 'utf8'), css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
  const colors = md.match(/colors:\n([\s\S]*?)\ntypography:/)![1].trim().split('\n').map((l) => l.trim().match(/^([a-z-]+): "(#[0-9A-Fa-f]{6})"/)!);
  for (const [, name, hex] of colors) { const v = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`, 'i')); assert.ok(v, `--${name} missing from tokens.css`); assert.equal(v![1].toUpperCase(), hex.toUpperCase(), name); }
  assert.match(css, /--r-card:\s*12px/); assert.match(css, /--r-control:\s*6px/);
});
test('no component or page defines a root token; tokens live only in tokens.css', () => {
  for (const p of walk(join(root, 'src')).filter((f) => /\.(css|astro|tsx?)$/.test(f) && !f.endsWith('tokens.css'))) assert.doesNotMatch(readFileSync(p, 'utf8'), /:root\s*\{[^}]*--(paper|ink|brand|up|down)\s*:/, p);
});
test('no inline style attributes anywhere in pages, components or layouts (strict CSP)', () => {
  for (const p of walk(join(root, 'src')).filter((f) => /\.(astro|tsx)$/.test(f))) assert.doesNotMatch(readFileSync(p, 'utf8'), /\sstyle=("|\{\{)/, p);
});
test('no dark theme, no theme toggle, no banned rails or gamification', () => {
  const all = walk(join(root, 'src')).filter((f) => /\.(css|astro|tsx?)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(all, /prefers-color-scheme:\s*dark/); assert.doesNotMatch(all, /data-theme/); assert.doesNotMatch(all, /top[- ]gainers|most[- ]active|leaderboard|confetti/i);
});
test('Lucide only: no second icon family, no emoji icons in markup', () => {
  const all = walk(join(root, 'src')).filter((f) => /\.(astro|tsx)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(all, /react-icons|@heroicons|fontawesome|material-icons/i); assert.doesNotMatch(all, /[\u{1F300}-\u{1FAFF}]/u);
});
test('direction is never colour alone: Delta always renders a sign and an arrow', () => {
  const d = readFileSync(join(root, 'src/components/Delta.astro'), 'utf8'); assert.match(d, /arrow-up-right/); assert.match(d, /arrow-down-right/); assert.match(d, /signed\(/);
});

test('type scale: every font size is a token, a display clamp or relative (em), and none is under 12px (20 Nov 2026)', () => {
  const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
  for (const t of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'fig', 'fig-xl']) assert.match(css, new RegExp(`--fs-${t}:\\s*[\\d.]+rem`), `--fs-${t} missing`);
  assert.match(css, /--fs-xs:\s*0\.75rem/);
  for (const p of walk(join(root, 'src')).filter((f) => /\.(css|astro)$/.test(f) && !f.endsWith('tokens.css'))) {
    const s = readFileSync(p, 'utf8');
    for (const m of s.matchAll(/font-size:\s*([^;}]+)/g)) assert.match(m[1].trim(), /^(var\(--fs-[a-z0-9-]+\)|clamp\(.+\)|[\d.]+em|inherit)$/, `${p}: font-size ${m[1]}`);
    for (const m of s.matchAll(/font:\s*(?:italic\s+)?(?:\d{3}\s+)?([\d.]+(?:rem|px))[\s/]/g)) assert.fail(`${p}: font shorthand uses a raw size ${m[1]}`);
  }
});
test('the stylesheet names no font family outside the two tokens', () => {
  for (const p of walk(join(root, 'src')).filter((f) => /\.(css|astro)$/.test(f))) for (const m of readFileSync(p, 'utf8').matchAll(/font-family:\s*([^;}]+)/g)) assert.match(m[1].trim(), /^var\(--font-(ui|display|mono)\)$|^[^]*var\(--font-/, `${p}: ${m[1]}`);
});
