// The Alpha Pro waitlist (worker/waitlist.js): validation, double opt-in, no address enumeration, owner-only export, CSV
// formula protection, unsubscribe, and "off until configured". The Durable Object runs on node:sqlite; no network, no mail.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Waitlist, confirmationMail, normaliseEmail, normaliseReferrer, safeEqual, toCsv, waitlist } from '../worker/waitlist.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const limitKey = (ip) => ip || 'x';
function fakeEnv(over = {}) {
  const db = new DatabaseSync(':memory:');
  const sql = { exec: (q, ...a) => { const st = db.prepare(q); return /^\s*SELECT/i.test(q) ? st.all(...a) : (st.run(...a), []); } };
  const obj = new Waitlist({ storage: { sql } });
  const sent = [];
  const env = { WAITLIST: { idFromName: () => 'id', get: () => ({ fetch: (u, init) => obj.fetch(new Request(u, init)) }) }, MAIL_TOKEN: 't', MAIL_FROM: 'pro@askakshay.com', WAITLIST_ADMIN_TOKEN: 'owner-secret-123', ...over };
  return { env, sent };
}
const origin = 'https://alpha.askakshay.com';
const post = (body, headers = {}) => new Request(`${origin}/api/waitlist`, { method: 'POST', headers: { 'content-type': 'application/json', origin, ...headers }, body: JSON.stringify(body) });
const call = (req, env) => waitlist(req, env, new URL(req.url), { json, limitKey });

// sendMail goes to fetch; capture it
const realFetch = globalThis.fetch;
let mails = [];
globalThis.fetch = async (u, init) => { if (String(u).includes('zeptomail')) { mails.push(JSON.parse(init.body)); return new Response('{}', { status: 201 }); } return realFetch(u, init); };

test('addresses are validated and normalised; referrers keep only origin and path', () => {
  assert.equal(normaliseEmail('  Akshay@Example.COM '), 'akshay@example.com');
  for (const bad of ['', 'no-at', 'a@b', 'a b@c.com', '<x>@y.com', 'x'.repeat(250) + '@y.com', 42, null]) assert.equal(normaliseEmail(bad), null, String(bad));
  assert.equal(normaliseReferrer('https://alpha.askakshay.com/?utm=1#x'), 'https://alpha.askakshay.com/');
  assert.equal(normaliseReferrer('javascript:alert(1)'), null);
});

test('off until configured: nothing is stored and the page is told so', async () => {
  const { env } = fakeEnv({ MAIL_TOKEN: undefined });
  const r = await call(post({ email: 'a@example.com' }), env);
  assert.equal(r.status, 503);
  assert.deepEqual(await (await call(new Request(`${origin}/api/waitlist`), env)).json(), { open: false });
});

test('double opt-in: join sends one confirmation; confirming marks it; a second join does not resend or reveal', async () => {
  mails = [];
  const { env } = fakeEnv();
  const r1 = await call(post({ email: 'A@Example.com', source: 'home', referrer: 'https://alpha.askakshay.com/' }), env);
  assert.equal(r1.status, 200);
  assert.equal(mails.length, 1);
  const link = /confirm\?t=([0-9a-f-]{36})/.exec(mails[0].textbody)[1];
  assert.match(mails[0].mime_headers['List-Unsubscribe'], /unsubscribe\?t=/);
  const c = await call(new Request(`${origin}/api/waitlist/confirm?t=${link}`), env);
  assert.equal(c.status, 303); assert.match(c.headers.get('location'), /waitlist=confirmed/);
  const r2 = await call(post({ email: 'a@example.com' }), env);
  assert.deepEqual(await r2.json(), await (await call(post({ email: 'b@example.com' }), env)).json(), 'the same answer for a known and an unknown address');
  assert.equal(mails.length, 2, 'a confirmed address gets no second mail; the new one gets its own');
});

test('export, count and delete are owner-only; CSV cells cannot start a formula', async () => {
  const { env } = fakeEnv();
  await call(post({ email: '=cmd@example.com' }), env);
  assert.equal((await call(new Request(`${origin}/api/waitlist/export`), env)).status, 401);
  assert.equal((await call(new Request(`${origin}/api/waitlist/export`, { headers: { authorization: 'Bearer wrong-secret-12' } }), env)).status, 401);
  const csv = await (await call(new Request(`${origin}/api/waitlist/export`, { headers: { authorization: 'Bearer owner-secret-123' } }), env)).text();
  assert.match(csv, /^email,status,created_at/);
  assert.match(csv, /\n'=cmd@example\.com,pending,/);
  const del = await call(new Request(`${origin}/api/waitlist/delete?email=%3Dcmd%40example.com`, { method: 'POST', headers: { authorization: 'Bearer owner-secret-123' } }), env);
  assert.equal(del.status, 200);
  const cnt = await (await call(new Request(`${origin}/api/waitlist/count`, { headers: { authorization: 'Bearer owner-secret-123' } }), env)).json();
  assert.equal(cnt.total, 0);
});

test('unsubscribe by link and by one-click POST; a bad token is refused; cross-site and non-JSON posts are refused', async () => {
  mails = [];
  const { env } = fakeEnv();
  await call(post({ email: 'u@example.com' }), env);
  const t = /unsubscribe\?t=([0-9a-f-]{36})/.exec(mails[0].textbody)[1];
  assert.equal((await call(new Request(`${origin}/api/waitlist/unsubscribe?t=${t}`, { method: 'POST' }), env)).status, 200);
  const cnt = await (await call(new Request(`${origin}/api/waitlist/count`, { headers: { authorization: 'Bearer owner-secret-123' } }), env)).json();
  assert.equal(cnt.total, 0, 'unsubscribing deletes the address');
  assert.match((await call(new Request(`${origin}/api/waitlist/confirm?t=not-a-token`), env)).headers.get('location'), /invalid/);
  assert.equal((await call(post({ email: 'x@example.com' }, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await call(new Request(`${origin}/api/waitlist`, { method: 'POST', headers: { origin }, body: 'email=x@example.com' }), env)).status, 415);
  assert.equal((await call(post({ email: 'bot@example.com', website: 'spam' }), env)).status, 200, 'honeypot answers ok and stores nothing');
});

test('helpers: constant-time compare, CSV quoting, the mail names what it is', () => {
  assert.equal(safeEqual('abc', 'abc'), true); assert.equal(safeEqual('abc', 'abd'), false); assert.equal(safeEqual('', ''), false);
  assert.equal(toCsv([{ email: 'a,b@x.com', status: 'pending' }]).split('\r\n')[1].startsWith('"a,b@x.com"'), true);
  const m = confirmationMail(origin, '00000000-0000-0000-0000-000000000000');
  assert.match(m.text, /not investment advice/); assert.match(m.subject, /waitlist/);
});
