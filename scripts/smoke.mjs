// Smoke test against a deployed alpha. Usage: node scripts/smoke.mjs [base-url]
// Fails (exit 1) on the first thing a reader would notice: a dead page, a feed that is
// really an HTML error page, or a quotes endpoint with nothing live in it.
const base = (process.argv[2] ?? 'https://alpha.askakshay.com').replace(/\/$/, '');
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

async function get(path) {
  const r = await fetch(base + path, { redirect: 'manual', headers: { 'user-agent': 'alpha-smoke' } });
  return { r, text: await r.text() };
}

for (const p of ['/', '/brief/', '/markets/', '/screen/', '/company/', '/map/', '/rotation/', '/engines/', '/trades/', '/reads/', '/ipo/', '/funds/', '/news/', '/tools/', '/compare/', '/calendar/', '/watchlist/', '/journal/', '/about/']) {
  const { r, text } = await get(p);
  check(`page ${p}`, r.status === 200 && text.includes('<title>'), `HTTP ${r.status}`);
}

const feeds = {
  pulse: (j) => Array.isArray(j.sectors) && j.sectors.length > 0,
  screen: (j) => Array.isArray(j.rows) && j.rows.length > 500,
  barometer: (j) => typeof j.today?.score === 'number',
  ipo: (j) => Array.isArray(j.open),
  news: (j) => Array.isArray(j) && j.length > 0,
  funds: (j) => Array.isArray(j.categories) && j.categories.length > 0,
  weekly_reads: (j) => Array.isArray(j.editions) && j.editions.length > 0,
  swot: (j) => typeof j.swot === 'object',
  'screen-detail': (j) => typeof j.detail === 'object',
  seasonality: (j) => typeof j.stocks === 'object',
  institutional: (j) => typeof j.rows === 'object',
};
for (const [name, valid] of Object.entries(feeds)) {
  try {
    const { r, text } = await get(`/data/${name}.json`);
    const ok = r.status === 200 && valid(JSON.parse(text));
    check(`feed ${name}`, ok, `HTTP ${r.status}, ${(text.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    check(`feed ${name}`, false, e.message);
  }
}

try {
  const { r, text } = await get('/api/quotes');
  const j = JSON.parse(text);
  check('quotes live', r.status === 200 && j.live >= Math.ceil(j.total * 0.7), `${j.live}/${j.total}`);
} catch (e) {
  check('quotes live', false, e.message);
}

// the Swing v2 feed: the Signals, Trades and company pages read signals.json; Telegram and the brief read engines.json
try {
  const { r, text } = await get('/signals.json');
  const j = JSON.parse(text);
  check('signals.json answers with the Swing v2 schema', r.status === 200 && j.schema === 'alpha-signals/2', j.schema);
  const ageDays = (Date.now() - new Date(j.data_through).getTime()) / 864e5;
  check('signals.json is built on recent prices', ageDays < 6, `data through ${j.data_through}`);
  check('the market gate states all four checks', j.gate?.checks?.length === 4 && typeof j.gate.on === 'boolean');
  const bad = (j.signals ?? []).filter((s) => !(s.sl < s.ref_price && s.ref_price < s.t1_plan && s.t1_plan < s.t2_plan));
  check('every plan has stop < signal close < T1 < T2', bad.length === 0, bad.map((x) => x.id).join(','));
  const active = (j.signals ?? []).filter((s) => s.status === 'pending' || s.status === 'open');
  const dup = active.map((s) => s.sym).filter((x, i, a) => a.indexOf(x) !== i);
  check('no stock has two active trades', dup.length === 0, dup.join(','));
  check('the book limits hold (at most 10 open)', active.length <= 10, String(active.length));
  const lockBug = active.filter((s) => s.half && s.stop_now !== undefined && s.entry !== undefined && s.stop_now <= s.entry);
  check('after T1 the stop is above the entry (profit lock), never equal to it', lockBug.length === 0, lockBug.map((x) => x.id).join(','));
  const compat = JSON.parse((await get('/engines.json')).text);
  check('engines.json keeps the shape the alerts read', !!compat.engines?.swing && typeof compat.engines.swing.alertable === 'boolean' && Array.isArray(compat.signals));
  const syms = active.slice(0, 5).map((s) => s.sym);
  if (syms.length) {
    const px = JSON.parse((await get(`/api/px?s=${syms.join(',')}`)).text);
    check('live prices answer for the active signals', px.ok && Object.keys(px.quotes).length >= Math.ceil(syms.length / 2), `${Object.keys(px.quotes ?? {}).length}/${syms.length}`);
  }
} catch (e) {
  check('signals.json', false, e.message);
}
try {
  const { r, text } = await get('/c/TCS.json');
  const j = JSON.parse(text);
  check('per-company shard answers and is small', r.status === 200 && j.sym === 'TCS' && j.row?.price > 0 && text.length < 60000, `${text.length} bytes`);
} catch (e) {
  check('company shard', false, e.message);
}
try {
  const j = JSON.parse((await get('/api/chart?s=TCS&r=3mo')).text);
  check('chart history answers with candles and the Nifty', j.ok && j.c.length > 40 && j.h.every((h, i) => h >= j.l[i]) && j.nifty.filter((x) => x).length > 30, `${j.c?.length} bars`);
  const bad = await get('/api/chart?s=NOTASYMBOLXYZ&r=1y');
  check('an unknown symbol is a 404, not a flat chart', bad.r.status === 404, String(bad.r.status));
} catch (e) {
  check('chart', false, e.message);
}
try {
  const j = JSON.parse((await get('/api/ipo-live')).text);
  check('IPO live endpoint answers (ok or an honest ok:false)', typeof j.ok === 'boolean' && Array.isArray(j.issues));
} catch (e) {
  check('IPO live endpoint', false, e.message);
}

const unknown = await get('/data/not-a-feed.json');
check('unknown feed is a JSON 404, not a page', unknown.r.status === 404 && unknown.r.headers.get('content-type')?.includes('json'));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nall checks passed');
