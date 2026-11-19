import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { Notes } from '../worker.js';

function fakeNotes() {
  const mem = new Map();
  const obj = new Notes({ storage: { get: async (k) => mem.get(k), put: async (k, v) => { mem.set(k, v); } } });
  return { mem, binding: { idFromName: () => 'owner', get: () => ({ fetch: (u, init) => obj.fetch(new Request(u, init)) }) } };
}
const T = 'https://tripwire.askakshay.com/api/';
const FEEDS = {};
const resetFeeds = () => {
  for (const k of Object.keys(FEEDS)) delete FEEDS[k];
  Object.assign(FEEDS, {
    [T + 'ledger']: { ledger: { picks: [{ id: 'a', sym: 'TCS', engine: 'MOM', rank: 1, score: 90, asOf: '2026-11-10', stop: 100 }], outcomes: { a: { status: 'open', t1Hit: false, pct: 2, entry: 100, r: 0.2 } } } },
    'https://alpha.askakshay.com/signals.json': { gate: { on: false, checks: [] }, signals: [], record: {} },
    [T + 'tick?s=INFY']: { quotes: { INFY: { px: 96, prev: 100, live: true } } },
    [T + 'rsi']: { rows: { INFY: [50, 50, 50] } },
    [T + 'news']: { events: [] },
  });
};
const sent = [];
let telegramOk = true;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.telegram.org')) { if (!telegramOk) return new Response('{}', { status: 500 }); sent.push(JSON.parse(init.body)); return new Response('{}'); }
  const b = FEEDS[String(url)];
  return b ? Response.json(b) : new Response('{}', { status: 404 });
};
const mk = () => { const n = fakeNotes(); return { n, env: { BOT_TOKEN: 't', OWNER_CHAT_ID: '42', WEBHOOK_SECRET: 's', NOTES: n.binding } }; };
const tick = async (env, iso) => { const jobs = []; await worker.scheduled({ scheduledTime: Date.parse(iso) }, env, { waitUntil: (p) => jobs.push(p) }); await Promise.all(jobs); };
const cmd = (env, text) => worker.fetch(new Request('https://x/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 's' }, body: JSON.stringify({ message: { chat: { id: 42 }, text } }) }), env);
const hit = () => { FEEDS[T + 'ledger'].ledger.outcomes.a = { status: 'open', t1Hit: true, pct: 9, entry: 100, r: 1.2 }; };

test('first check records a baseline; a change then sends one alert; the same change never twice', async () => {
  resetFeeds(); sent.length = 0;
  const { env } = mk();
  await tick(env, '2026-11-19T05:05:00Z'); // Thu 13:05 MYT, not a brief slot
  assert.equal(sent.length, 0, 'baseline is silent');
  hit();
  await tick(env, '2026-11-19T05:10:00Z');
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Alerts \(1\)/);
  assert.match(sent[0].text, /target 1 hit: <b>TCS<\/b>/);
  await tick(env, '2026-11-19T05:15:00Z');
  assert.equal(sent.length, 1);
});
test('quiet hours hold alerts until 07:30 Malaysia time', async () => {
  resetFeeds(); sent.length = 0;
  const { env } = mk();
  await tick(env, '2026-11-19T14:00:00Z'); // 22:00 MYT baseline
  hit();
  await tick(env, '2026-11-19T16:00:00Z'); // 00:00 MYT quiet
  assert.equal(sent.length, 0);
  await tick(env, '2026-11-19T23:30:00Z'); // 07:30 MYT
  assert.equal(sent.length, 1);
});
test('a failed send keeps the change so the next check retries it', async () => {
  resetFeeds(); sent.length = 0;
  const { env } = mk();
  await tick(env, '2026-11-19T05:05:00Z');
  hit();
  telegramOk = false;
  await tick(env, '2026-11-19T05:10:00Z');
  telegramOk = true;
  assert.equal(sent.length, 0);
  await tick(env, '2026-11-19T05:15:00Z');
  assert.equal(sent.length, 1);
});
test('no more than 6 alert messages an hour', async () => {
  resetFeeds(); sent.length = 0;
  const { env, n } = mk();
  await tick(env, '2026-11-19T05:05:00Z');
  const now = Date.parse('2026-11-19T05:10:00Z');
  n.mem.set('kv:alog', Array.from({ length: 6 }, (_, i) => now - i * 6e4));
  hit();
  await tick(env, '2026-11-19T05:10:00Z');
  assert.equal(sent.length, 0);
  await tick(env, '2026-11-19T06:15:00Z');
  assert.equal(sent.length, 1, 'allowed again once the hour has passed, and the change was not lost');
});
test('/watch then a 4% drop inside market hours alerts; the same move is not repeated', async () => {
  resetFeeds(); sent.length = 0;
  const { env } = mk();
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-11-19T05:00:00Z');
  await cmd(env, '/watch infy');
  Date.now = realNow;
  assert.match(sent[0].text, /Watching: INFY/);
  await tick(env, '2026-11-19T05:05:00Z');
  const alerts = sent.filter((m) => /Alerts \(/.test(m.text));
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].text, /INFY<\/b> -4\.00% vs previous close \(96\)/);
  await tick(env, '2026-11-19T05:10:00Z');
  assert.equal(sent.filter((m) => /Alerts \(/.test(m.text)).length, 1);
});
test('a reminder is sent once at its time, and kept if Telegram refuses it', async () => {
  resetFeeds(); sent.length = 0;
  const { env, n } = mk();
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-11-19T04:00:00Z');
  await cmd(env, '/remind 14:00 check <INFY> stop');
  Date.now = realNow;
  assert.match(sent[0].text, /Reminder 1 set for Thu 19 Nov 14:00 MYT/);
  await tick(env, '2026-11-19T05:55:00Z');
  assert.equal(sent.length, 1, 'not yet due');
  telegramOk = false;
  await tick(env, '2026-11-19T06:00:00Z');
  telegramOk = true;
  assert.equal(n.mem.get('kv:remind').length, 1, 'kept');
  await tick(env, '2026-11-19T06:05:00Z');
  assert.match(sent[1].text, /<b>Reminder<\/b>\ncheck &lt;INFY&gt; stop/);
  assert.equal(n.mem.get('kv:remind').length, 0);
  await tick(env, '2026-11-19T06:10:00Z');
  assert.equal(sent.length, 2);
});
test('/weekly sends the weekly review on demand', async () => {
  resetFeeds(); sent.length = 0;
  const { env } = mk();
  await cmd(env, '/weekly');
  assert.match(sent[0].text, /^<b>Weekly review/);
});
