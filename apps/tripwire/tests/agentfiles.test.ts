// The files an AI agent or a crawler reads: llms.txt and the ARD manifest. Lighthouse's "Agentic browsing" audits read both; this holds the same rules without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f: string) => readFileSync(new URL(`../static/${f}`, import.meta.url), 'utf8');
const ORIGIN = 'https://tripwire.askakshay.com';
const ROUTES = new Set(['today', 'markets', 'discover', 'desk', 'news', 'signals', 'data', 'methodology', 'help', 'privacy', 'terms', 'settings', 'more']);

test('llms.txt follows the llms.txt layout: a title, a summary quote, and markdown links', () => {
  const t = read('llms.txt');
  assert.match(t, /^# Tripwire\n/);
  assert.match(t, /\n> .{40,}/);
  const links = [...t.matchAll(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g)].map((m) => ({ name: m[1], url: m[2] }));
  assert.ok(links.length >= 8, `at least eight links, found ${links.length}`);
  assert.ok(/^## /m.test(t), 'sections are headed with ##');
});

test('every llms.txt link is on this site, and every page link is a route the app has', () => {
  for (const m of read('llms.txt').matchAll(/\]\((https?:[^)\s]+)\)/g)) {
    const u = new URL(m[1]); assert.equal(u.origin, ORIGIN, m[1]);
    assert.ok(!/^\/(api|data)\//.test(u.pathname), `${m[1]} points into a path robots.txt disallows`);
    if (u.hash.startsWith('#/')) assert.ok(ROUTES.has(u.hash.slice(2).split(/[/?]/)[0]), `${m[1]} is not a route`);
  }
});

test('the ARD manifest is valid against the ARD entry rules and consistent with robots.txt', () => {
  const m = JSON.parse(read('ard.json'));
  assert.ok(Array.isArray(m.entries) && m.entries.length >= 1);
  const ids = new Set<string>();
  for (const e of m.entries) {
    assert.match(e.identifier, /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/);
    assert.ok(e.identifier.startsWith('urn:air:tripwire.askakshay.com:'), 'the publisher segment is this domain');
    assert.ok(typeof e.displayName === 'string' && e.displayName.length > 0);
    assert.match(e.type, /^[a-z]+\/[a-z0-9.+-]+$/, 'type is a media type');
    assert.ok(('url' in e) !== ('data' in e), 'exactly one of url or data');
    assert.equal(new URL(e.url).origin, ORIGIN);
    const f = new URL(e.url).pathname.replace(/^\/\.well-known\//, ''); assert.ok(readFileSync(new URL(`../static/${f}`, import.meta.url), 'utf8').length > 200, `${e.url} is a file the build ships`);
    assert.ok(!/^\/(api|data)\//.test(new URL(e.url).pathname), 'does not advertise a path robots.txt disallows');
    if (e.representativeQueries) assert.ok(e.representativeQueries.length >= 2 && e.representativeQueries.length <= 5, 'two to five representative queries');
    assert.ok(!ids.has(e.identifier), 'identifiers are unique'); ids.add(e.identifier);
  }
});

test('the skill the manifest lists has the frontmatter an agent skill needs and keeps the site\'s limits', () => {
  const t = read('agent-skills/tripwire/SKILL.md');
  assert.match(t, /^---\nname: tripwire\ndescription: .{40,}\n---\n/);
  assert.match(t, /not investment advice|no recommendations|Do not describe any pick/i);
  assert.match(t, /Yahoo Finance and can lag/);
});
