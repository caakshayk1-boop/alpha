import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const env = { BOT_TOKEN: 't', OWNER_CHAT_ID: '42', WEBHOOK_SECRET: 'sekret', NOTES: null };
const sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(init.body)); return new Response('{}'); }
  return new Response('{}', { status: 404 });
};
const req = (secret, chat, text) => new Request('https://x/telegram', {
  method: 'POST',
  headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {},
  body: JSON.stringify({ message: { chat: { id: chat }, text } }),
});

test('wrong or missing secret is refused', async () => {
  assert.equal((await worker.fetch(req('nope', 42, '/help'), env)).status, 403);
  assert.equal((await worker.fetch(req(null, 42, '/help'), env)).status, 403);
  assert.equal(sent.length, 0);
});
test('a stranger gets no reply', async () => {
  const r = await worker.fetch(req('sekret', 999, '/help'), env);
  assert.equal(r.status, 200);
  assert.equal(sent.length, 0);
});
test('the owner gets a reply', async () => {
  await worker.fetch(req('sekret', 42, '/help'), env);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chat_id, 42);
  assert.match(sent[0].text, /Commands/);
});
test('other paths and methods are 404', async () => {
  assert.equal((await worker.fetch(new Request('https://x/other', { method: 'POST' }), env)).status, 404);
});
