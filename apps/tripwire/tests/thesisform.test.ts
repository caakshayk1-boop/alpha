// The thesis form (28 Nov 2026, build brief phase 2): three questions first, the screen's own case and countercase beside them,
// every earlier field kept, and a save message that never claims a write that failed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/sheets.tsx', import.meta.url), 'utf8');
const sheet = src.slice(src.indexOf('export function ThesisSheet('), src.indexOf('export function ExplainSheet('));

test('the three questions come first, in order: what I think, what would prove me wrong, when I review', () => {
  const at = (s: string) => { const i = sheet.indexOf(s); assert.ok(i > 0, `${s} missing`); return i; };
  const think = at("F('thesis', 'What do I think?"), wrong = at("F('invalidation', 'What would prove me wrong?"), when = at('When will I review it?');
  assert.ok(think < wrong && wrong < when, 'order');
  assert.ok(when < at('<OnFile sym={sym}'), 'the facts on file follow the three questions');
  assert.ok(at('<OnFile sym={sym}') < at('<summary>More detail'), 'everything else is under More detail');
});

test('no field of the earlier form is dropped, so older notes load and save as before', () => {
  for (const k of ['question', 'decisionReason', 'thesis', 'support', 'counter', 'decision', 'invalidation', 'trigger']) assert.match(sheet, new RegExp(`F\\('${k}',`), k);
  assert.match(sheet, /id="t-review-state"/); assert.match(sheet, /id="t-evidence-change"/); assert.match(sheet, /id="t-date"/);
});

test('the facts beside the form are the company page\'s own list, dated, and an empty side is labelled, not filled', () => {
  const onfile = src.slice(src.indexOf('function OnFile('), src.indexOf('export function ThesisSheet('));
  assert.match(onfile, /curateCase\(/); assert.match(onfile, /counterCoverage\(/);
  assert.match(onfile, /screen close \$\{row\.last_date\}/);
  assert.match(onfile, /That is not a negative finding/);
  assert.match(onfile, /\$\{cov\.title\} \$\{cov\.line\}|\{cov\.title\} \{cov\.line\}/);
});

test('"saved" is said only when the write reached this device', () => {
  assert.match(sheet, /!lastSaveOk\(\) \? 'Not saved on this device/);
  assert.match(readFileSync(new URL('../src/app.tsx', import.meta.url), 'utf8'), /export const lastSaveOk = \(\): boolean => health\.persisted;/);
});
