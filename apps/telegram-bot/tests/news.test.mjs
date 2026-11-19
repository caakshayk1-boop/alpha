import test from 'node:test';
import assert from 'node:assert/strict';
import { rank, format, slotKey } from '../news.js';
import worker, { runNews } from '../worker.js';

const NOW = Date.parse('2026-11-19T04:00:00Z');
const ev = (id, h, sig, ageH = 2, url = `https://e.com/${id}`) => ({ eventClusterId: id, headline: h, significance: sig, publishedAt: new Date(NOW - ageH * 3600e3).toISOString(), canonicalUrl: url, sourceTitle: 'S' });

test('rank: most significant first, stale and untitled dropped, duplicates dropped', () => {
  const r = rank([ev('a', 'Low', 0.2), ev('b', 'High', 0.9), ev('c', 'Old', 0.99, 60), ev('d', 'high!', 0.5), ev('e', '', 1), ev('f', 'Other', 0.4, 2, 'https://e.com/b')], NOW);
  assert.deepEqual(r.map((e) => e.eventClusterId), ['b', 'a']);
});
test('format: escapes HTML, links only http(s), says so when empty', () => {
  const t = format([ev('a', 'A <b> & B', 1), { ...ev('b', 'No link', 1), canonicalUrl: 'javascript:x' }], '08:00');
  assert.match(t, /A &lt;b&gt; &amp; B/);
  assert.match(t, /href="https:\/\/e\.com\/a"/);
  assert.doesNotMatch(t, /javascript:/);
  assert.match(format([], '08:00'), /No new stories/);
});
test('slotKey: IST sends at 08:00, 12:00, 16:00, 20:00, 00:00 only, once per half hour', () => {
  const k = (iso) => slotKey(Date.parse(iso), 'Asia/Kolkata');
  assert.equal(k('2026-11-19T02:30:00Z'), '2026-11-19T08');   // 08:00 IST
  assert.equal(k('2026-11-19T03:00:00Z'), null);               // 08:30 IST
  assert.equal(k('2026-11-19T06:30:00Z'), '2026-11-19T12');
  assert.equal(k('2026-11-19T10:30:00Z'), '2026-11-19T16');
  assert.equal(k('2026-11-19T14:30:00Z'), '2026-11-19T20');
  assert.equal(k('2026-11-19T18:30:00Z'), '2026-11-20T00');   // midnight IST
  assert.equal(k('2026-11-19T04:30:00Z'), null);               // 10:00 IST
});
test('slotKey: a whole-hour zone works too', () => assert.equal(slotKey(Date.parse('2026-11-19T04:00:00Z'), 'Asia/Dubai'), '2026-11-19T08'));

// End to end through the Worker with an in-memory Durable Object: 12 stories, two runs, no repeats.
function fakeEnv() {
  const store = new Map();
  const state = { storage: { get: async (k) => store.get(k), put: async (k, v) => void store.set(k, v) } };
  const DO = new (worker.Notes ?? (await_import()))(state);
  return { BOT_TOKEN: 't', OWNER_CHAT_ID: '42', NEWS_TZ: 'Asia/Kolkata', NOTES: { idFromName: () => 'x', get: () => ({ fetch: (u, i) => DO.fetch(new Request(u, i)) }) } };
}
let NotesClass;
import('../worker.js').then((m) => { NotesClass = m.Notes; });
function await_import() { return NotesClass; }

test('runNews sends 10, then the next 2, then nothing new; slot claimed once', async () => {
  const { Notes } = await import('../worker.js');
  NotesClass = Notes;
  const env = fakeEnv();
  const events = Array.from({ length: 12 }, (_, i) => ev('id' + i, 'Story ' + i, 1 - i / 100, 1, 'https://e.com/s' + i));
  const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(init.body).text); return new Response('{}'); }
    return Response.json({ events });
  };
  // events are timestamped relative to NOW; use the real clock
  events.forEach((e) => { e.publishedAt = new Date(Date.now() - 3600e3).toISOString(); });
  assert.equal(await runNews(env, 'slot1'), 'sent 10');
  assert.equal(await runNews(env, 'slot1'), 'already sent');
  assert.equal(await runNews(env, 'slot2'), 'sent 2');
  assert.equal(await runNews(env, 'slot3'), 'sent 0');
  assert.equal(sent.length, 3);
  const titles = (t) => [...t.matchAll(/Story \d+/g)].map((m) => m[0]);
  const all = [...titles(sent[0]), ...titles(sent[1])];
  assert.equal(new Set(all).size, 12);
  assert.match(sent[2], /No new stories/);
});
