import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMMON } from '../src/lib/methodology.ts';
import { MIN_MCAP, MAGIC_MIN_MCAP, MIN_TURNOVER } from '../src/lib/feedscreens.ts';
import { RULES } from '../src/lib/exitrules.ts';
import { METHOD } from '../src/lib/methodology.ts';
const src = (f: string) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const cr = (n: number) => '₹' + n.toLocaleString('en-IN');

test('the method text quotes the same universe and liquidity numbers the screens run on (audit: stale text)', () => {
  assert.ok(COMMON.sources.includes(`${cr(MIN_MCAP)} crore`), COMMON.sources.slice(0, 400));
  assert.ok(METHOD['magic-formula'].rules.some((r) => r.includes(`${cr(MAGIC_MIN_MCAP)} crore`) && r.includes(`${cr(MIN_TURNOVER)} crore`)));
  assert.ok(!/1,000 crore/.test(JSON.stringify(COMMON)));    // the feed's own Magic Formula table does exclude under ₹1,000 crore; that sentence in METHOD describes the feed, and the ₹5,000 crore floor is ours
});
test('the method text states the one-month cap and the engines\' own exits', () => {
  assert.match(COMMON.mechanics, /no call is held longer than a month/); for (const r of Object.values(RULES)) assert.equal(r.max_months, 1);
});
test('the disclaimer sits on every decision page, not only the footer', () => {
  for (const f of ['src/pages/calls.astro', 'src/pages/terminal/index.astro', 'src/pages/screener.astro', 'src/pages/stock/[symbol].astro']) assert.match(src(f), /<Disclaimer( compact)? \/>/, f);
  assert.match(src('src/components/Footer.astro'), /SEBI/); assert.match(src('src/components/Disclaimer.astro'), /SEBI/);
});
test('contact details are published, and the charting credit is text without a link', () => {
  assert.match(src('src/lib/site.ts'), /ca\.akkothari@askakshay\.com/); assert.match(src('src/components/Footer.astro'), /askakshay\.com/);
  assert.ok(!/href="https:\/\/www\.tradingview\.com/.test(src('src/components/Footer.astro')));
});
