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
  assert.match(css, /--r-card:\s*10px/); assert.match(css, /--r-control:\s*6px/);
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
