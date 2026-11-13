// The first-visit line, the footer trust line and the alarm ordering on Today. Offline; nothing here reads the clock or a real browser store.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HERO_KEY, HERO_LINE, HERO_NOTE, dismissHero, heroDue, resetHeroSession } from '../src/hero.ts';
import { FORBIDDEN } from '../src/brief.ts';
import { SUPPORT_EMAIL } from '../src/contact.ts';

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
const denied = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('SecurityError'); } };
beforeEach(() => resetHeroSession());

test('first visit: the line is due; dismissing writes the flag and it stays gone for a returning visitor', () => {
  const s = mem();
  assert.equal(heroDue(s), true);
  assert.equal(dismissHero(s), true); assert.equal(s.m.get(HERO_KEY), '1');
  assert.equal(heroDue(s), false);
  resetHeroSession();   // a new page load: only storage remembers
  assert.equal(heroDue(s), false, 'a returning visitor who dismissed it does not see it again');
});
test('storage denied: shown each visit, but a dismissal still hides it for the session', () => {
  assert.equal(heroDue(denied), true); assert.equal(heroDue(null), true);
  assert.equal(dismissHero(denied), false, 'nothing could be written, and it says so');
  assert.equal(heroDue(denied), false, 'hidden for the rest of the session');
  resetHeroSession();
  assert.equal(heroDue(denied), true, 'a new visit shows it again, since nothing was remembered');
  assert.equal(dismissHero(null), false); assert.equal(heroDue(null), false);
});
test('a flag that is anything but "1" is not a dismissal', () => {
  const s = mem(); s.setItem(HERO_KEY, '0'); assert.equal(heroDue(s), true);
});
test('the copy: the owner\'s line, a paper-only note, and no prediction word', () => {
  assert.equal(HERO_LINE, 'Rules that fire, evidence you can check — by Akshay, CA.');
  assert.match(HERO_NOTE, /paper-only research, not advice/i);
  for (const t of [HERO_LINE, HERO_NOTE]) assert.ok(!FORBIDDEN.test(t), t);
});
test('the footer says research not advice, claims no SEBI registration, and reads the address from contact.ts', () => {
  const c = src('screens/capture.tsx'); const f = c.slice(c.indexOf('export function IdentityFooter'));
  assert.match(f, /paper-only research, not investment advice/); assert.match(f, /No SEBI registration is claimed/);
  assert.match(f, /contactView\(\)/); assert.ok(!f.includes(SUPPORT_EMAIL) && !/@[a-z]+\.[a-z]/i.test(f), 'no second copy of the address');
  assert.ok(!FORBIDDEN.test(f.replace(/<[^>]+>/g, ' ')), 'no prediction word');
  assert.ok(!/margin ?notes/i.test(f), 'no Margin Notes link: no real URL exists in the repo');
});
test('Today: the hero leads, the stale-data banner slot is one place under the top bar for every page (Today passes none)', () => {
  const t = src('screens/today.tsx');
  const hero = t.indexOf('<HeroLine />'), brief = t.indexOf('data-sec="brief"'), ban = t.indexOf('{banner}'), setup = t.indexOf('data-sec="setup"');
  assert.ok(hero > 0 && hero < brief && brief < ban && ban < setup, `order hero(${hero}) < brief(${brief}) < banner(${ban}) < setup(${setup})`);
  const a = src('app.tsx');
  // v6 (13 Nov 2026): ONE banner slot, directly under the top bar, on every page; Today no longer draws its own (the prop stays optional, nothing passes it)
  assert.match(a, /<StatusBar asOf=\{screen\.data\?\.as_of\} \/>\s*\{staleBanner\}/); assert.match(a, /<Today \/>/); assert.ok(!/\{!onToday && staleBanner\}/.test(a), 'not repeated lower down');
  assert.match(a, /The data stops \{f!\.behind\} sessions before the last finished one\. Treat everything as old\./, 'the wording is unchanged');
});
test('the sample walkthrough opens only when the caller says it is a first visit', () => {
  const w = src('screens/samplewalk.tsx'); assert.match(w, /defaultOpen = false/); assert.match(w, /open=\{defaultOpen \|\| undefined\}/);
  assert.match(src('screens/today.tsx'), /<SampleWalkthrough defaultOpen=\{firstVisit\} \/>/);
});
