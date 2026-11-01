// The design foundation's logic and its guarantees: the gate line, the tween maths, the token contrast floors, the hex lint, and the rule that nothing moves outside html.fx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gateLine, holdoutOf } from '../src/components/gate.ts';
import { easeOut, tweenAt } from '../src/components/tween.ts';
import { scan } from '../tools/lint-tokens.mjs';

const css = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const FEED = { alert_why: 'Alerts off: the holdout month-clustered t is -0.62, needs +2.0.', gate: { date: '2026-10-28', on: false, passed: 1, checks: [{ rule: 'a', ok: false }, { rule: 'b', ok: false }, { rule: 'c', ok: false }, { rule: 'd', ok: true }] } };

test('the holdout figure is read from the feed sentence, and only from it', () => {
  assert.deepEqual(holdoutOf(FEED.alert_why), { t: -0.62, needs: 2 });
  assert.deepEqual(holdoutOf('the holdout month-clustered t is 2.31, needs +2.0'), { t: 2.31, needs: 2 });
  assert.equal(holdoutOf('Alerts are off for another reason.'), null);
  assert.equal(holdoutOf(undefined), null);
});
test('the gate line is the sentence the owner asked for, and it hides when the data is absent', () => {
  const g = gateLine(FEED as never)!;
  assert.equal(g.text, 'Signals gate: OFF — 1/4 checks · holdout t −0.62 (needs +2.0)');
  assert.equal(g.short, 'Gate OFF · 1/4'); assert.equal(g.on, false);
  assert.equal(gateLine(null), null); assert.equal(gateLine({ alert_why: '', gate: undefined } as never), null);
  assert.equal(gateLine({ alert_why: '', gate: { date: 'x', on: true, passed: 4, checks: FEED.gate.checks } } as never)!.text, 'Signals gate: ON — 4/4 checks');   // no holdout sentence: nothing invented
  assert.equal(gateLine({ alert_why: '', gate: { date: 'x', on: false, passed: 0, checks: [] } } as never), null);
});
test('the tween starts at the start, ends at the end, never overshoots and never goes backwards', () => {
  assert.equal(tweenAt(10, 20, 0), 10); assert.equal(tweenAt(10, 20, 1), 20);
  let last = -1; for (let i = 0; i <= 100; i++) { const v = easeOut(i / 100); assert.ok(v >= last && v <= 1); last = v; }
  assert.ok(tweenAt(0, 100, 0.2) > 50, 'ease-out: most of the distance early');
  assert.equal(tweenAt(5, -5, 1), -5);
});

// ---- tokens ----
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const tok = (name: string) => { const m = new RegExp(`--${name}:(#[0-9A-Fa-f]{6})`).exec(css('tokens.css')); assert.ok(m, `token --${name} is a hex in tokens.css`); return m![1]; };
test('text tokens keep their contrast on every surface (floors: ink 14, ink-2 7.5, ink-3 4.5, accent 9, up 8, down 5.5, amber 9)', () => {
  const surfaces = ['bg', 'bg-2', 'surface', 'surface-2', 'surface-3'].map(tok);
  for (const [n, min] of [['ink', 14], ['ink-2', 7.5], ['ink-3', 4.5], ['accent', 9], ['up', 8], ['down', 5.5], ['amber', 9]] as const) for (const s of surfaces) assert.ok(ratio(tok(n), s) >= min, `${n} on ${s} is ${ratio(tok(n), s).toFixed(2)}, needs ${min}`);
  assert.ok(ratio(tok('on-accent'), tok('accent')) >= 9, 'dark text on the accent button');
});
test('the palette is the one the owner specified', () => {
  for (const [n, v] of [['bg', '#0A0A0B'], ['surface', '#131315'], ['surface-2', '#1B1B1E'], ['ink', '#F5F4EE'], ['ink-2', '#B9B9B4'], ['ink-3', '#8A8A85'], ['accent', '#CCFF43'], ['up', '#4ADE80'], ['down', '#F87171'], ['amber', '#FBBF24']]) assert.equal(tok(n).toUpperCase(), v, n);
});
test('every legacy variable is an alias of a token, never a second colour', () => {
  const t = strip(css('tokens.css')); const legacy = t.slice(t.indexOf('legacy aliases') > -1 ? 0 : 0);
  for (const n of ['bg2', 's1', 's2', 's3', 'tx', 'dim', 'mute', 'lime', 'peach']) assert.match(legacy, new RegExp(`--${n}:var\\(--`), `--${n} points at a token`);
  assert.doesNotMatch(strip(css('style.css')), /:root\{[^}]*--(bg|s1|s2|s3|tx|dim|mute|lime):#/, 'style.css no longer defines a palette');
});
test('no hex colour outside tokens.css in the css and tsx sources', () => { const r = scan(); assert.deepEqual([...r.css, ...r.tsx], []); });

// ---- motion ----
test('motion.css moves nothing outside html.fx, and only transform and opacity', () => {
  const m = strip(css('motion.css')).replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, (k) => { assert.doesNotMatch(k.replace(/@keyframes[^{]+/, ''), /(?<![-\w])(?!transform|opacity)(?:left|top|width|height|margin|padding|color|background|box-shadow)\s*:/, 'keyframes animate transform and opacity only'); return ''; });
  const body = m.replace(/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*\}\s*$/, '');
  for (const rule of body.split('}')) { const sel = rule.split('{')[0].trim(); if (!sel) continue; assert.ok(/^html\.fx/.test(sel) || /^html\.fx/.test(sel.replace(/^[^]*,\s*/, '')), `selector is under html.fx: ${sel.slice(0, 60)}`); }
  for (const t of body.matchAll(/transition:([^;}]+)/g)) for (const part of t[1].split(',')) assert.match(part.trim(), /^(transform|opacity)\b/, `a transition animates transform or opacity only: ${part.trim()}`);
  for (const d of ['--dur-1:160ms', '--dur-2:240ms', '--dur-3:360ms', '--ease:cubic-bezier(.22,1,.36,1)']) assert.ok(strip(css('tokens.css')).includes(d), d);
});
