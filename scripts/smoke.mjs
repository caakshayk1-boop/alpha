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

for (const p of ['/', '/brief/', '/markets/', '/screen/', '/company/', '/map/', '/rotation/', '/engines/', '/magic/', '/reads/', '/ipo/', '/funds/', '/news/', '/tools/', '/compare/', '/calendar/', '/watchlist/', '/about/']) {
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

// the engines file: the one the Engines page, the brief and the Telegram alerts all read
try {
  const { r, text } = await get('/engines.json');
  const j = JSON.parse(text);
  const eng = Object.keys(j.engines ?? {});
  check('engines.json has the five AI engines', r.status === 200 && eng.length === 5, eng.join(','));
  const ageDays = (Date.now() - new Date(j.data_through).getTime()) / 864e5;
  check('engines.json is built on recent prices', ageDays < 6, `data through ${j.data_through}`);
  const bad = (j.signals ?? []).filter((s) => !(s.sl < s.ref_price && s.ref_price < s.targets[0] && s.targets[0] <= s.targets[1] && s.targets[1] <= s.targets[2]));
  check('every plan has stop < price < T1 <= T2 <= T3', bad.length === 0, bad.map((x) => x.id).join(','));
  const active = (j.signals ?? []).filter((s) => s.status === 'pending' || s.status === 'open');
  const dup = active.map((s) => s.sym).filter((x, i, a) => a.indexOf(x) !== i);
  check('no stock has two active trades', dup.length === 0, dup.join(','));
  check('every engine states its record', eng.every((k) => j.engines[k].status && j.engines[k].metrics && j.engines[k].trades?.holdout && j.engines[k].importance?.length));
  check('every engine separates ranking, trading and alert verdicts', eng.every((k) => j.engines[k].ranking_status && j.engines[k].trading_status && typeof j.engines[k].alertable === 'boolean' && j.engines[k].alert_why));
  check('exit outcomes reconcile to the trade count', eng.every((k) => { const e = j.engines[k]; return Object.values(e.exits).reduce((a, b) => a + b, 0) === e.exits_n; }));
  const syms = active.slice(0, 5).map((s) => s.sym);
  if (syms.length) {
    const px = JSON.parse((await get(`/api/px?s=${syms.join(',')}`)).text);
    check('live prices answer for the active signals', px.ok && Object.keys(px.quotes).length >= Math.ceil(syms.length / 2), `${Object.keys(px.quotes ?? {}).length}/${syms.length}`);
  }
} catch (e) {
  check('engines.json', false, e.message);
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
