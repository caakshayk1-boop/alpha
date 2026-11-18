// The 18 Nov 2026 site audit, as checks: each one fails on the old behaviour. (Header behaviour on the live edge is checked after deploy; see the BUILD-LOG.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicPages, dayLong } from '../tools/public-pages.mjs';

const T = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const block = (headers: string, path: string) => { const m = headers.split(/\n(?=\S)/).find((b) => b.startsWith(path + '\n')); return m ?? ''; };

test('headers: data may be compressed, fonts are cached for a year, pages still refuse Cloudflare rewriting', () => {
  const h = T('static/_headers');
  assert.match(h.split(/\n(?=\/)/)[0], /Cache-Control: no-cache, no-transform/, 'the page default keeps no-transform (it stops the analytics beacon the CSP blocks)');
  const data = block(h, '/data/*'); assert.ok(/Cache-Control: no-cache\s*$/m.test(data) && !/no-transform/.test(data), '/data/* drops no-transform so the edge can compress the 862 KB screen');
  assert.match(block(h, '/fonts/*'), /max-age=31536000, immutable/);
});
test('the asset layer answers an unknown path with a real 404 (the shell is shipped as 404.html)', () => {
  assert.match(readFileSync(new URL('../../../wrangler.tripwire.jsonc', import.meta.url), 'utf8'), /"not_found_handling": "404-page"/);
  assert.match(T('build.mjs'), /writeFileSync\(join\(DIST, '404\.html'\), html\)/);
  assert.ok(existsSync(new URL('../static/favicon.ico', import.meta.url)) && T('build.mjs').includes("'favicon.ico'"), 'favicon.ico is a real file that the build copies');
});
test('one colour for the installed app and the page; no leftover periwinkle', () => {
  const m = T('static/manifest.webmanifest'), i = T('static/index.html');
  const theme = /name="theme-color" content="(#[0-9A-Fa-f]{6})"/.exec(i)![1].toUpperCase();
  const j = JSON.parse(m); assert.equal(j.theme_color.toUpperCase(), theme); assert.equal(j.background_color.toUpperCase(), theme);
  assert.ok(!/07090D/i.test(m + i) && !/A5B4FF/i.test(i)); assert.deepEqual(j.display_override, ['standalone', 'minimal-ui']);
});
test('manifest screenshots exist, are real PNGs of the stated size, and stay small', () => {
  const j = JSON.parse(T('static/manifest.webmanifest')); assert.deepEqual(j.screenshots.map((x: { form_factor: string }) => x.form_factor).sort(), ['narrow', 'wide']);
  for (const x of j.screenshots) { const f = new URL(`../static${x.src}`, import.meta.url); const b = readFileSync(f); const [w, h] = x.sizes.split('x').map(Number);
    assert.equal(b.subarray(1, 4).toString(), 'PNG'); assert.equal(b.readUInt32BE(16), w); assert.equal(b.readUInt32BE(20), h); assert.ok(b.length < 120 * 1024, `${x.src} is ${b.length} bytes`); }
});
test('service worker: one missing file does not cancel the install; the page and entry script are required; navigation preload; slow data falls back to the last copy', () => {
  const s = T('static/sw.js');
  assert.ok(!/addAll\(SHELL\)/.test(s) && /allSettled\(SHELL\.map/.test(s), 'no all-or-nothing addAll');
  assert.match(s, /need = new Set\(\['\/', `\/app\.__STAMP__\.js`\]\)/); assert.match(s, /navigationPreload\.enable\(\)/); assert.match(s, /e\.preloadResponse/); assert.match(s, /setTimeout\(\(\) => caches\.match\(r\)[^;]*, 4000\)/);
});
test('public pages: a readable date, share tags, legal redirects, a nightly feed, a sitemap of the real pages only', () => {
  const dist = mkdtempSync(join(tmpdir(), 'tw-pp-')); mkdirSync(join(dist, 'data'), { recursive: true });
  writeFileSync(join(dist, 'data/screen.json'), JSON.stringify({ as_of: '2026-11-17', count: 999, rows: [] }));
  const led = JSON.parse(readFileSync(new URL('../ledger/ledger.json', import.meta.url), 'utf8')); const f = join(dist, 'ledger.json'); writeFileSync(f, JSON.stringify(led));
  publicPages(dist, f);
  const rec = readFileSync(join(dist, 'record/index.html'), 'utf8');
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(rec), 'no raw ISO timestamp'); assert.match(rec, /Ledger updated \d{1,2} [A-Z][a-z]{2} 20\d\d\./);
  for (const t of ['og:title', 'og:description', 'og:image', 'twitter:card', 'theme-color', 'rel="icon"', 'application/atom+xml']) assert.ok(rec.includes(t), t);
  for (const p of ['privacy', 'terms']) { const h = readFileSync(join(dist, p, 'index.html'), 'utf8'); assert.ok(h.includes(`http-equiv="refresh" content="0;url=/#/${p}"`) && h.includes('noindex')); }
  const feed = readFileSync(join(dist, 'feed.xml'), 'utf8'); const entries = feed.match(/<entry>/g)!.length;
  assert.equal(entries, Math.min(30, led.days.length)); assert.equal((feed.match(/<\/entry>/g) ?? []).length, entries); assert.ok(feed.startsWith('<?xml') && feed.includes('<feed xmlns="http://www.w3.org/2005/Atom">') && !/LVT/.test(feed), 'retired engines are not in the feed');
  const newest = [...led.days].sort((a, b) => b.asOf.localeCompare(a.asOf))[0]; const n = ['MOM', 'QLT', 'ST'].reduce((a, e) => a + (newest.engines[e]?.picked ?? 0), 0);
  assert.ok(feed.includes(`Night of ${dayLong(newest.asOf)}: ${n} observation${n === 1 ? '' : 's'} recorded`), 'the newest entry states the count the ledger holds');
  const sm = readFileSync(join(dist, 'sitemap.xml'), 'utf8'); assert.ok(sm.includes('/record/') && !sm.includes('privacy') && !sm.includes('feed'));
});
test('dayLong reads an ISO instant as a date and refuses nonsense', () => { assert.equal(dayLong('2026-11-18T00:19:53.125Z'), '18 Nov 2026'); assert.equal(dayLong('nope'), 'an unknown date'); });
