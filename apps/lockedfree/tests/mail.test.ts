// 24 Nov 2026: the edition email. It renders, it carries the disclaimer and an unsubscribe placeholder, and nothing is sent unless every switch is on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dailyCampaign, weeklyCampaign, sendPlan } from '../src/lib/mail.ts';
import { DISCLAIMER, type Edition } from '../src/lib/edition.ts';
const dir = new URL('../ledger/editions/', import.meta.url).pathname;
const eds = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(dir + f, 'utf8')) as Edition);

test('the daily email has a subject, the disclaimer, an unsubscribe placeholder and no link to anything but the site', () => {
  assert.ok(eds.length > 0, 'a committed edition exists');
  const c = dailyCampaign(eds.at(-1)!);
  assert.match(c.subject, /^Rulebook edition, /); assert.ok(c.html.includes(DISCLAIMER) && c.text.includes('Educational and paper-only'));
  assert.ok(c.html.includes('{{ unsubscribe }}'), 'Brevo needs the placeholder'); assert.ok(c.html.trimEnd().endsWith('</html>'));
  assert.ok(!/\b(buy now|guaranteed|sure[- ]shot|target price)\b/i.test(c.html + c.text));
});
test('the weekly note renders from the same editions', () => {
  const c = weeklyCampaign(eds)!; assert.equal(c.kind, 'weekly'); assert.match(c.subject, /^Rulebook weekly note, week to /); assert.ok(c.html.includes('{{ unsubscribe }}')); assert.equal(weeklyCampaign([]), null);
});
test('sending is off unless every switch is on, and a dry run names what is missing', () => {
  const full = { EDITION_SEND: '1', BREVO_API_KEY: 'k', BREVO_LIST_ID: '7', BREVO_SENDER_EMAIL: 'a@b.c', BREVO_SENDER_NAME: 'Rulebook' };
  assert.equal(sendPlan(full).live, true);
  assert.deepEqual(sendPlan({}).missing.sort(), ['BREVO_API_KEY', 'BREVO_LIST_ID', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME', 'EDITION_SEND']);
  for (const k of Object.keys(full)) assert.equal(sendPlan({ ...full, [k]: undefined }).live, false, `${k} missing`);
  assert.equal(sendPlan({ ...full, EDITION_SEND: '0' }).live, false, 'the flag must be exactly 1');
  assert.equal(sendPlan({ ...full, BREVO_LIST_ID: 'abc' }).live, false, 'the list id must be a positive number');
});
