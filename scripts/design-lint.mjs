// design-lint.mjs — the design rules that can be checked mechanically (Pro §29, §32.1, DESIGN.md §2 and §3).
//   1. Forbidden words never appear in copy a reader sees: the site's pages and components, and the engine's published
//      rules. A line may opt out only with "lint-allow-copy" and a reason (e.g. a validator that must NAME the words).
//   2. Raw colour literals and ad-hoc toFixed() in components: a RATCHET. The counts per file may only fall; a new file
//      may not add any. `node scripts/design-lint.mjs --update` rewrites the baseline after a deliberate reduction.
// Usage: node scripts/design-lint.mjs   (exits 1 on a violation)
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = /\b(guaranteed|sure[- ]shot|multibagger|can'?t lose|cannot lose|risk[- ]free|profit lock|locked profit|best stock|buy now|target price|price target)\b/i;
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const problems = [];

// 1. copy
const copy = [...walk('src').filter((f) => /\.(tsx|ts)$/.test(f)), 'engines/swing.py', 'public/signals.json'].filter(existsSync);
for (const f of copy) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('lint-allow-copy')) return;
    const code = f.endsWith('.json') ? line : line.replace(/^\s*(\/\/|\*|#).*$/, '');      // comments are not copy
    const m = FORBIDDEN.exec(code);
    if (m) problems.push(`${f}:${i + 1}: "${m[0]}" is on the forbidden-words list (Pro §29)`);
  });
}

// 2. ratchets
const BASE = 'scripts/design-baseline.json';
const comps = walk('src').filter((f) => f.endsWith('.tsx'));
const count = (re) => Object.fromEntries(comps.map((f) => [f, (readFileSync(f, 'utf8').match(re) || []).length]).filter(([, n]) => n > 0));
// toFixed is allowed where the output is geometry or machine input, never read as a figure: SVG path data, canvas axis labels
// and a form field's own value. Everything a reader sees goes through src/lib/format.ts.
const GEOMETRY = /'M'\}|\? 'L' : 'M'|`L\$\{|fillText|\bset\(\w+\.toFixed|translate\(/;
const countFixed = () => Object.fromEntries(comps.map((f) => [f, readFileSync(f, 'utf8').split('\n').filter((l) => !GEOMETRY.test(l)).reduce((a, l) => a + (l.match(/\.toFixed\(/g) || []).length, 0)]).filter(([, n]) => n > 0));
const now = { colours: count(/['"`]#[0-9a-fA-F]{3,8}\b/g), toFixed: countFixed() };
if (process.argv.includes('--update')) {
  writeFileSync(BASE, `${JSON.stringify(now, null, 1)}\n`);
  console.log(`baseline written: ${Object.values(now.colours).reduce((a, b) => a + b, 0)} raw colours, ${Object.values(now.toFixed).reduce((a, b) => a + b, 0)} toFixed`);
  process.exit(0);
}
const base = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : { colours: {}, toFixed: {} };
for (const kind of ['colours', 'toFixed']) {
  for (const [f, n] of Object.entries(now[kind])) {
    const was = base[kind][f] ?? 0;
    if (n > was) problems.push(`${f}: ${n} ${kind === 'colours' ? 'raw colour literals' : 'ad-hoc toFixed() calls'}, baseline ${was}. ${kind === 'colours' ? 'Use a semantic token (var(--…))' : 'Format through src/lib/format.ts'} (DESIGN.md).`);
  }
}
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
console.log(`design lint: ${copy.length} files checked for copy; raw colours ${total(now.colours)} (baseline ${total(base.colours)}), toFixed ${total(now.toFixed)} (baseline ${total(base.toFixed)})`);
if (problems.length) { console.error(problems.map((p) => `FAIL  ${p}`).join('\n')); process.exit(1); }
console.log('design lint passed');
