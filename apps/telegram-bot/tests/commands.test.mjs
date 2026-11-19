import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, SOURCES } from '../commands.js';

const feeds = {
  [SOURCES.pulse]: { fetched_at: 'T', quotes: { NIFTY: { px: 25136.8, prev: 25227.95, live: true }, VIX: { px: 15.74, prev: 15.52, live: true } } },
  [SOURCES.signals]: { gate: { on: false, date: '2026-11-13' }, data_through: '2026-11-13', signals: [], record: { closed: 3, wins: 2, total_r: 1.5 } },
  [SOURCES.ledger]: { ledger: { started: '2026-10-25', updated: 'U', days: [{ asOf: '2026-10-23', engines: { MOM: { passed: 91, picked: 5 } } }] } },
  [SOURCES.company('TCS')]: { row: { name: 'Tata <Consultancy>', sector: 'Technology', tier: 'large', price: 2379.5, fy: 'FY26', roce: 62.2, roe: 45.9, de: 0.11, rev_cagr: null } },
};
const mem = [];
const deps = {
  getJSON: async (u) => { if (!(u in feeds)) throw new Error('404'); return feeds[u]; },
  notes: {
    add: async (t) => (mem.push({ text: t, at: '2026-11-19T00:00:00Z' }), mem.length),
    list: async () => mem,
    del: async (n) => (n <= mem.length ? (mem.splice(n - 1, 1), true) : false),
  },
};

test('non-commands are ignored', async () => assert.equal(await handle('hello', deps), null));
test('pulse shows price and change, missing is n/a not zero', async () => {
  const r = await handle('/pulse', deps);
  assert.match(r, /Nifty: 25,136\.8 \(-0\.36%\)/);
  assert.match(r, /Bank Nifty: n\/a/);
});
test('signals reports gate off and no signals', async () => {
  const r = await handle('/signals@mybot', deps);
  assert.match(r, /Gate: OFF/);
  assert.match(r, /Open signals: none/);
});
test('tripwire summarises the last day', async () => assert.match(await handle('/tripwire', deps), /MOM: picked 5 of 91 passed/));
test('rulebook before the ledger is published says so', async () => assert.match(await handle('/rulebook', deps), /not published yet/));
test('stock escapes HTML and shows n/a for null', async () => {
  const r = await handle('/stock tcs', deps);
  assert.match(r, /Tata &lt;Consultancy&gt;/);
  assert.match(r, /Rev CAGR n\/a%/);
});
test('stock rejects a bad symbol and reports unknown ones', async () => {
  assert.match(await handle('/stock ../x', deps), /Usage/);
  assert.match(await handle('/stock ZZZZ', deps), /No data for ZZZZ/);
});
test('notes add, list, delete', async () => {
  assert.match(await handle('/note buy milk <b>', deps), /note 1/);
  assert.match(await handle('/notes', deps), /1\. buy milk &lt;b&gt;/);
  assert.match(await handle('/del 1', deps), /Deleted note 1/);
  assert.match(await handle('/del 1', deps), /No note 1/);
  assert.match(await handle('/notes', deps), /No notes yet/);
});
test('digest survives one source failing', async () => {
  const r = await handle('/digest', deps);
  assert.match(r, /Market pulse/);
  assert.match(r, /Rulebook/);
});
test('a failing source gives a calm message', async () => {
  const r = await handle('/pulse', { ...deps, getJSON: async () => { throw new Error('x'); } });
  assert.match(r, /unavailable/);
});
