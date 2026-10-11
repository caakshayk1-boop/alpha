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

for (const p of ['/', '/markets/', '/screen/', '/company/', '/map/', '/magic/', '/reads/', '/ipo/', '/funds/', '/news/', '/about/']) {
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

const unknown = await get('/data/not-a-feed.json');
check('unknown feed is a JSON 404, not a page', unknown.r.status === 404 && unknown.r.headers.get('content-type')?.includes('json'));

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nall checks passed');
