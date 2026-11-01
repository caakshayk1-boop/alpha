// 3.5: the critical-CSS extractor and the performance budget. Offline; the last test reads the real build when one exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
// @ts-ignore (plain JS build tools)
import { criticalCss, pieces } from '../tools/critical.mjs';
// @ts-ignore
import { measure, verdict, BUDGET } from '../tools/budget.mjs';

const CSS = ':root{--a:1}*{box-sizing:border-box}.card{color:red}.card .big{color:blue}.below{color:green}a:hover,.below:hover{x:y}@media(min-width:800px){.card{width:1px}.below{width:2px}}@font-face{font-family:F;src:url("a{b}.woff2")}@keyframes spin{to{opacity:0}}@keyframes unused{to{opacity:1}}.spin{animation:spin 1s}.card.tag{k:v}';
test('critical CSS keeps rules whose classes the first viewport renders, in the original order, and drops the rest', () => {
  const c = criticalCss(CSS, ['card', 'big', 'spin', 'tag']);
  assert.ok(c.startsWith(':root{--a:1}*{box-sizing:border-box}.card{color:red}.card .big{color:blue}'), c);
  assert.ok(!c.includes('.below{color:green}') && !c.includes('width:2px'), 'a rule naming a class that is not rendered is dropped');
  assert.ok(c.includes('a:hover,.below:hover{x:y}'), 'a rule is kept when ANY of its selectors qualifies (element-only a:hover)');
  assert.ok(c.includes('@media(min-width:800px){.card{width:1px}}'), 'media rules are filtered inside, not dropped or kept whole');
  assert.ok(c.includes('@font-face{font-family:F;src:url("a{b}.woff2")}'), 'braces inside a string do not break the parser');
  assert.ok(c.includes('@keyframes spin{') && !c.includes('@keyframes unused'), 'only the keyframes a kept rule uses');
  assert.ok(c.indexOf('.card{color:red}') < c.indexOf('.card.tag{k:v}'), 'order preserved');
  assert.equal(pieces('a{b:c}@import "x";d{e:f}').length, 3);
});
const page = (opts: { blocking?: boolean; preload?: boolean; kb?: number }) => {
  const dir = mkdtempSync(join(tmpdir(), 'tw-budget-')); const w = (f: string, s: string | Buffer) => writeFileSync(join(dir, f), s);
  w('app.x.js', 'import"./app.x.chunk-A.js";import{a}from"./app.x.chunk-A.js";const l=()=>import("./app.x.Lab-1.js");'); w('app.x.chunk-A.js', randomBytes((opts.kb ?? 10) * 1024)); w('app.x.css', 'a{b:c}');
  for (const v of ['company-1', 'sheets-1', 'Methodology-1', 'Lab-1', 'Data-1', 'Help-1']) w(`app.x.${v}.js`, 'x');
  w('index.html', `<html><head><style>.boot{}</style>${opts.preload === false ? '' : '<link rel="modulepreload" href="/app.x.chunk-A.js">'}<link rel="stylesheet" href="/app.x.css"${opts.blocking ? '' : ' media="print"'}><noscript><link rel="stylesheet" href="/app.x.css"></noscript></head><body><script type="module" src="/app.x.js"></script></body></html>`);
  return dir;
};
test('budget: a well-formed page passes; a blocking stylesheet, a missing modulepreload and an over-budget entry each fail with their own line', () => {
  assert.deepEqual(verdict(measure(page({}))), []);
  assert.match(verdict(measure(page({ blocking: true }))).join('|'), /1 render-blocking stylesheet/);
  assert.match(verdict(measure(page({ preload: false }))).join('|'), /not modulepreloaded: app\.x\.chunk-A\.js/);
  const big = verdict(measure(page({ kb: 300 }))); assert.match(big.join('|'), /initial JS is \d+\.\d KB gzip .* budget is 250 KB/);
  assert.equal(BUDGET.initialJsGzKB, 250);
});
test('budget: the dynamic import is a lazy chunk, not part of the initial closure; a heavy view that is not its own chunk fails', () => {
  const m = measure(page({})); assert.deepEqual(m.closure.map((c: any) => c.file).sort(), ['app.x.chunk-A.js', 'app.x.js']); assert.ok(m.lazy.includes('app.x.Lab-1.js'));
  const dir = page({}); mkdirSync(join(dir, 'z')); writeFileSync(join(dir, 'app.x.js'), 'import"./app.x.chunk-A.js";import"./app.x.company-1.js";'); assert.match(verdict(measure(dir)).join('|'), /view "company" is not a lazy chunk/);
});
test('budget on the real build, when one exists: every budget holds', { skip: !existsSync(new URL('../dist/index.html', import.meta.url)) }, () => {
  assert.deepEqual(verdict(measure(new URL('../dist', import.meta.url).pathname)), []);
});
