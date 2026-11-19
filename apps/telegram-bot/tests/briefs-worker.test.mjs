import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { Notes } from '../worker.js';
import { SOURCES } from '../commands.js';
import { NEWS_URL } from '../news.js';

// A real Notes Durable Object over an in-memory store, so claims, snapshots and the "already sent" list behave as in production.
function fakeNotes() {
  const mem = new Map();
  const obj = new Notes({ storage: { get: async (k) => mem.get(k), put: async (k, v) => { mem.set(k, v); } } });
  return { mem, binding: { idFromName: () => 'owner', get: () => ({ fetch: (u, init) => obj.fetch(new Request(u, init)) }) } };
}
const NOW = Date.parse('2026-11-19T04:00:00Z'); // Thu 12:00 MYT
const FEEDS = {
  [SOURCES.pulse]: { quotes: { NIFTY: { px: 25200, prev: 25000, pt: NOW / 1000, live: true }, VIX: { px: 14, prev: 15 } } },
  [SOURCES.signals]: { gate: { on: false, passed: 2, checks: [1, 2, 3, 4] }, data_through: '2026-11-18', signals: [], record: {} },
  [SOURCES.ledger]: { ledger: { days: [{ asOf: '2026-11-18', engines: { MOM: { picked: 5 } } }], outcomes: {} } },
  [SOURCES.rulebook]: { as_of: '2026-11-17', aggregates: [{ n_open: 1, n_closed: 0 }], book_days: [] },
  [SOURCES.hubPulse]: { built_on: '2026-11-19', sectors_day: [{ name: 'IT', median: 1 }, { name: 'Banks', median: -1 }], breadth: { up: 1, down: 2, counted: 3 } },
  [NEWS_URL]: { events: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ eventClusterId: 'e' + n, headline: 'Headline ' + n, significance: 1 - n / 10, publishedAt: '2026-11-19T02:00:00Z', canonicalUrl: 'https://n.example/' + n, sourceTitle: 'S' })) },
};
const sent = [];
let telegramOk = true;
const realNow = Date.now;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.telegram.org')) { if (!telegramOk) return new Response('{}', { status: 500 }); sent.push(JSON.parse(init.body)); return new Response('{}'); }
  const body = FEEDS[String(url)];
  return body ? Response.json(body) : new Response('{}', { status: 404 });
};
const mk = () => { const n = fakeNotes(); return { n, env: { BOT_TOKEN: 't', OWNER_CHAT_ID: '42', WEBHOOK_SECRET: 's', NOTES: n.binding } }; };
const tick = async (env, iso) => { const jobs = []; await worker.scheduled({ scheduledTime: Date.parse(iso) }, env, { waitUntil: (p) => jobs.push(p) }); await Promise.all(jobs); };

test('a scheduled tick at 12:00 Malaysia time sends one brief with buttons and 5 stories; a repeat tick sends nothing', async () => {
  sent.length = 0;
  const { env } = mk();
  Date.now = () => NOW;
  await tick(env, '2026-11-19T04:00:00Z');
  await tick(env, '2026-11-19T04:30:00Z'); // the retry tick must not send a second copy
  Date.now = realNow;
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /Open check/);
  assert.equal((sent[0].text.match(/^\d\. /gm) || []).length, 5);
  assert.equal(sent[0].reply_markup.inline_keyboard[0].length, 4);
});
test('off-slot ticks and weekends send nothing', async () => {
  sent.length = 0;
  const { env } = mk();
  await tick(env, '2026-11-19T05:00:00Z');
  await tick(env, '2026-11-21T04:00:00Z');
  await tick(env, '2026-11-19T07:00:00Z');
  assert.equal(sent.length, 0);
});
test('the next brief shows only what changed, and news never repeats', async () => {
  sent.length = 0;
  const { env } = mk();
  Date.now = () => NOW;
  await tick(env, '2026-11-19T04:00:00Z');
  FEEDS[SOURCES.signals] = { ...FEEDS[SOURCES.signals], gate: { on: true, passed: 4, checks: [1, 2, 3, 4] } };
  await tick(env, '2026-11-19T10:30:00Z');
  Date.now = realNow;
  FEEDS[SOURCES.signals].gate = { on: false, passed: 2, checks: [1, 2, 3, 4] };
  assert.match(sent[1].text, /Gate flipped OFF → ON/);
  assert.match(sent[1].text, /No change: Tripwire, Rulebook, ApexPro/);
  const first = sent[0].text.match(/Headline \d/g);
  const second = sent[1].text.match(/Headline \d/g) || [];
  assert.equal(first.length, 5);
  assert.deepEqual(second, ['Headline 6', 'Headline 7'], 'only the two unseen stories');
});
test('a failed send releases the slot so a retry can send, and saves no snapshot', async () => {
  sent.length = 0;
  const { env, n } = mk();
  Date.now = () => NOW;
  telegramOk = false;
  await tick(env, '2026-11-19T04:00:00Z');
  telegramOk = true;
  assert.equal(sent.length, 0);
  assert.equal(n.mem.get('snap'), undefined);
  await tick(env, '2026-11-19T04:30:00Z');
  Date.now = realNow;
  assert.equal(sent.length, 1);
});
const cmd = (text) => new Request('https://x/telegram', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 's' }, body: JSON.stringify({ message: { chat: { id: 42 }, text } }) });
test('/morning, /open and /close work on demand without touching the schedule', async () => {
  sent.length = 0;
  const { env, n } = mk();
  Date.now = () => NOW;
  for (const c of ['/morning', '/open', '/close@mybot']) await worker.fetch(cmd(c), env);
  Date.now = realNow;
  assert.deepEqual(sent.map((m) => m.text.split(' · ')[0].replace(/<[^>]+>/g, '')), ['Morning plan', 'Open check', 'Close scorecard']);
  assert.equal(n.mem.get('snap'), undefined, 'on-demand does not move the comparison point');
  assert.equal(n.mem.get('slots'), undefined);
});
