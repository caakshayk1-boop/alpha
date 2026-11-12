// Privacy, Terms, the Not found view, the share image and the contact line, offline. Logic (route resolution, the contact link, the date) is tested directly; the privacy text is checked
// against the CODE it describes (every host the Worker calls is named on the page; no cookie or IndexedDB use; the security policy), so the page cannot drift from what the app does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_HEADS, resolveRoute, askedPath } from '../src/route.ts';
import { SUPPORT_EMAIL, contactView } from '../src/contact.ts';
import { LEGAL_UPDATED, legalDate } from '../src/legal.ts';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(APP, p), 'utf8');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test('route resolution: every address the app routes is ok, anything else is not found with what was asked', () => {
  for (const h of ['today', 'discover', 'desk', 'more', 'signals', 'settings', 'profile', 'data', 'methodology', 'help', 'ops', 'live', 'news', 'markets', 'lab', 'compare', 'privacy', 'terms']) {
    assert.deepEqual(resolveRoute([h]), { kind: 'ok', head: h }, h);
  }
  // heads that need an argument are not routes without one, and heads that take none are not routes with one (they used to fall through to another screen)
  for (const h of ['c', 'm', 'report']) { assert.equal(resolveRoute([h]).kind, 'notfound', `#/${h} alone`); assert.equal(resolveRoute([h, '']).kind, 'notfound', `#/${h}/ with nothing after it`); assert.equal(resolveRoute([h, 'X', 'extra']).kind, 'notfound', `#/${h}/X/extra`); assert.deepEqual(resolveRoute([h, 'X']), { kind: 'ok', head: h }, `#/${h}/X`); }
  for (const h of ['today', 'desk', 'more', 'privacy']) assert.equal(resolveRoute([h, 'extra']).kind, 'notfound', `#/${h}/extra`);
  assert.deepEqual(resolveRoute(['today', '']), { kind: 'ok', head: 'today' }, 'a trailing slash is the same address');
  assert.deepEqual(resolveRoute([]), { kind: 'ok', head: '' }, '#/ is Today');
  assert.deepEqual(resolveRoute(['c', 'TCS']), { kind: 'ok', head: 'c' });
  assert.deepEqual(resolveRoute(['nope']), { kind: 'notfound', asked: '/nope' });
  assert.deepEqual(resolveRoute(['nope', 'deeper']), { kind: 'notfound', asked: '/nope/deeper' });
  assert.equal(resolveRoute(['Today']).kind, 'notfound', 'addresses are lower case');
  assert.equal(resolveRoute(['privacy.html']).kind, 'notfound');
  assert.equal(resolveRoute(['c-']).kind, 'notfound');
});
test('the address shown is decoded, shortened, and plain text', () => {
  assert.equal(askedPath(['a%20b']), '/a b');
  assert.equal(askedPath(['%E0%A4%A']), '/%E0%A4%A', 'a malformed escape is shown as typed, not thrown');
  const long = askedPath(['x'.repeat(300)]); assert.ok(long.length <= 80 && long.endsWith('…'));
  assert.equal(askedPath(['<img src=x onerror=alert(1)>']), '/<img src=x onerror=alert(1)>', 'returned as text: the view renders it as a React text node, never as markup');
});
test('KNOWN_HEADS and app.tsx agree in both directions', () => {
  const src = read('src/app.tsx');
  const handled = new Set([...src.matchAll(/head === '([a-z]+)'/g)].map((m) => m[1]));
  for (const h of handled) assert.ok(KNOWN_HEADS.includes(h), `app.tsx routes '${h}' but KNOWN_HEADS does not list it: it would show Not found`);
  for (const h of KNOWN_HEADS) if (h && !['today', 'discover', 'desk'].includes(h)) assert.ok(handled.has(h), `KNOWN_HEADS lists '${h}' but app.tsx has no view for it`);
  assert.match(src, /route\.kind === 'notfound'\) view = <NotFound/, 'an unknown route renders the Not found view');
  assert.match(src, /tabLast\[tab\] = loc\.raw/, 'tab memory exists');
  assert.match(src, /resolveRoute\(loc\.path\)\.kind === 'ok' && \(tab ===/, 'a Not found address is never remembered as the tab\'s last place');
});

test('contact: blank or malformed is "not set up yet"; the owner\'s address is a mailto link', () => {
  /* 12 Nov 2026 (Tripwire 2.0): the owner's file says to set hello@askakshay.com; it is the one address, and a blank or malformed one still reads "not set up yet" (checked with the explicit arguments below) */
  assert.equal(SUPPORT_EMAIL, 'hello@askakshay.com', 'the owner supplied this address; none is invented');
  assert.deepEqual(contactView(''), { line: 'Contact: not set up yet', email: null, href: null });
  assert.deepEqual(contactView(SUPPORT_EMAIL), { line: 'Contact: hello@askakshay.com', email: 'hello@askakshay.com', href: 'mailto:hello@askakshay.com' });
  for (const bad of ['   ', 'nobody', 'a@b', 'a b@c.com', 'a@b@c.com', '<x@y.com>', 'x@y.com,z@y.com', 'javascript:alert(1)//@x.com'.replace('//', ' ')]) assert.equal(contactView(bad).href, null, bad);
  assert.deepEqual(contactView(' help@example.com '), { line: 'Contact: help@example.com', email: 'help@example.com', href: 'mailto:help@example.com' });
  assert.equal(contactView('x'.repeat(250) + '@example.com').href, null, 'over 254 characters is not an address');
});
test('contact: security.txt is generated only for a real address, never a static file', () => {
  assert.equal(existsSync(join(APP, 'static', '.well-known', 'security.txt')), false, 'no hand-written security.txt that could name nobody');
  const b = read('build.mjs'); assert.match(b, /if \(contact\.email\)/); assert.match(b, /security\.txt/);
});

test('the last-updated date is a constant, a real day, and read in words', () => {
  assert.match(LEGAL_UPDATED, /^\d{4}-\d{2}-\d{2}$/); assert.ok(!Number.isNaN(Date.parse(LEGAL_UPDATED)));
  assert.equal(legalDate('2026-11-02'), '2 November 2026'); assert.equal(legalDate('2027-01-31'), '31 January 2027');
  assert.equal(legalDate('not a date'), 'not a date'); assert.equal(legalDate('2026-13-01'), '2026-13-01');
  assert.ok(!/Date\.now|new Date\(\)/.test(read('src/legal.ts')), 'the date never comes from the clock');
});

test('the privacy page names every host the code calls, and the claims it makes are true of the source', () => {
  const page = read('src/screens/legal.tsx');
  const sources = [read('worker.js'), read('news/config.js'), read('news/nudge.js')].join('\n');
  const hosts = new Set([...sources.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/g)].map((m) => m[1]).filter((h) => h !== 'tripwire.internal'));
  const NAMED: Record<string, RegExp> = {
    'query1.finance.yahoo.com': /Yahoo Finance/, 'raw.githubusercontent.com': /raw\.githubusercontent\.com/, 'news.google.com': /Google News/, 'www.bing.com': /Bing News/,
    'rbi.org.in': /Reserve Bank of India/, 'www.sebi.gov.in': /SEBI/, 'api.github.com': /ask GitHub to run the news job/,
  };
  assert.ok(hosts.size >= 6, `found ${hosts.size} hosts: the pattern still matches`);
  for (const h of hosts) { assert.ok(NAMED[h], `the code calls ${h}: name it on the privacy page and in this test`); assert.match(page, NAMED[h], `${h} is not named on the privacy page`); }
  // claims
  const code = walk(join(APP, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !/legal\.tsx$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.ok(!/document\.cookie/.test(code), 'the page says the app sets no cookies');
  assert.ok(!/indexedDB/.test(code), 'the page says IndexedDB is not used');
  assert.ok(!/gtag\(|analytics\.js|plausible\.io|mixpanel|segment\.com|fbq\(|sendBeacon/i.test(code + read('static/index.html')), 'the page says there is no analytics');
  assert.match(read('static/_headers'), /connect-src 'self'/, 'the page says the browser talks only to Tripwire\'s own address');
  assert.match(read('static/_headers'), /Referrer-Policy: no-referrer/);
  assert.match(read('static/_headers'), /script-src 'self'/);
  assert.match(read('../../wrangler.tripwire.jsonc'), /"observability": \{ "enabled": true \}/, 'the page says request observability is on, and that its retention was not verified');
  assert.match(page, /not verified/i);
  assert.match(page, /Contact/); assert.match(read('src/screens/legal.tsx'), /contactView\(\)/);
  // the places the Worker keys anything to a visitor are the Refresh-now marker and the per-minute abuse counters, and the page says so (2 Nov 2026: the limiter added the second)
  const ipUses = [...read('worker.js').matchAll(/cf-connecting-ip/g)].length; assert.ok(ipUses >= 1 && ipUses <= 2, `the Worker reads the client address in ${ipUses} places; the privacy page names two uses, so a third needs the page updated`); assert.match(page, /keyed by your IP address/); assert.match(page, /short-lived counter keyed by your IP address/);
  // the backup and the erase button say what they do
  assert.match(read('src/screens/settings.tsx'), /Delete all my data/); assert.match(page, /Delete all my data/);
  assert.match(page, /Settings, Erase data, Delete all my data/);
});
test('the terms say the things the brief requires, and cite the 30-trade rule from the ledger constant', () => {
  const page = read('src/screens/legal.tsx');
  for (const re of [/paper trading only/i, /not investment advice/i, /No order is placed/, /late, incomplete or wrong/, /No warranty/, /Rules and data can change/, /not liable/, /responsible for your own decisions|responsible for your decisions/, /NSE/, /Indian Standard Time/, /MIN_TRADES/]) assert.match(page, re, String(re));
  assert.match(read('src/ledger.ts'), /export const MIN_TRADES = 30/);
  assert.ok(!/guarantee|will profit|returns of|risk-free|safe investment/i.test(page.replace(/does not|no guarantee|not a promise/gi, '')), 'no promise is made anywhere on the page');
});
test('both pages are linked from More, Settings, the footer and the first-use screen', () => {
  assert.match(read('src/screens/More.tsx'), /href: '#\/privacy'/); assert.match(read('src/screens/More.tsx'), /href: '#\/terms'/);
  assert.match(read('src/screens/settings.tsx'), /href="#\/privacy"/); assert.match(read('src/screens/settings.tsx'), /href="#\/terms"/);
  assert.match(read('src/screens/capture.tsx'), /href="#\/privacy"/);   // IdentityFooter: Today, Help and Methodology
  for (const f of ['today.tsx', 'Help.tsx']) assert.match(read(`src/screens/${f}`), /<IdentityFooter \/>/, f);
  assert.match(read('src/screens/welcome.tsx'), /href="#\/privacy"/);
});

test('the share image tags: absolute https URLs, 1200x630, large card, and the image is a PNG under 120 KB', () => {
  const h = read('static/index.html');
  const meta = (k: string, v: string) => { const m = new RegExp(`<meta ${k}="${v}" content="([^"]*)"`).exec(h); return m ? m[1] : null; };
  assert.equal(meta('property', 'og:image'), 'https://tripwire.askakshay.com/og.png');
  assert.equal(meta('name', 'twitter:image'), 'https://tripwire.askakshay.com/og.png');
  assert.equal(meta('property', 'og:image:width'), '1200'); assert.equal(meta('property', 'og:image:height'), '630'); assert.equal(meta('property', 'og:image:type'), 'image/png');
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
  for (const [k, v] of [['property', 'og:title'], ['property', 'og:description'], ['name', 'twitter:title'], ['name', 'twitter:description'], ['property', 'og:image:alt'], ['name', 'twitter:image:alt']]) assert.ok((meta(k, v) ?? '').length > 10, `${v} is present`);
  const png = readFileSync(join(APP, 'static', 'og.png'));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG signature');
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
  assert.ok(png.length < 120 * 1024, `og.png is ${png.length} bytes`);
  assert.match(read('build.mjs'), /og\.png/, 'the build refuses to ship without it');
  assert.match(read('tools/make-og.mjs'), /Paper research workspace for Indian stocks/);
});
test('the sitemap stays valid and lists the site root only (hash addresses cannot be indexed); robots does not block the page', () => {
  const sm = read('static/sitemap.xml');
  assert.match(sm, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ['https://tripwire.askakshay.com/'], 'a fragment (#/privacy) is not a separate URL to a crawler, so only the root is listed');
  assert.ok(!/#/.test(sm));
  const b = read('build.mjs'); assert.match(b, /Allow: \/\$/); assert.match(b, /Disallow: \/api\//);
});
