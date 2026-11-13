// 13 Nov 2026: the landing page's example card arrives with the company list and, on a phone, pushed the whole page down ~650 px (mobile CLS 0.197, measured with the list delayed 800 ms; 0 with the box reserved).
// The browser measurement lives in the session notes; this pins the two things that keep it fixed so a later edit cannot silently remove them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/landing.css', import.meta.url), 'utf8');
const tsx = readFileSync(new URL('../src/screens/welcome.tsx', import.meta.url), 'utf8');

test('the example card box is reserved while the company list loads (placeholder renders, and the real card is never shorter)', () => {
  assert.match(tsx, /!sample && !scr\.data && !scr\.err && <div className="lp-card lp-card-skel" aria-hidden="true" \/>/, 'a placeholder renders until the list or an error arrives');
  const rule = /\.lp-card,\.lp-card-skel\{min-height:clamp\((\d+)px,/.exec(css); assert.ok(rule, 'the real card and the placeholder share one min-height');
  assert.ok(+rule[1] >= 560, 'the phone minimum is close to the measured 598 to 738 px card');
  assert.match(css, /@media \(min-width:900px\)\{\.lp-card,\.lp-card-skel\{min-height:\d+px\}\}/, 'a side-by-side minimum exists too');
});
