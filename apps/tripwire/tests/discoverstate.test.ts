import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, PAGE, canonConds, cellOf, clearFilters, displayRow, filtersOf, lastDiscoverQuery, loadPlace, nextSort, parseDiscover, predicateMetrics, rememberDiscover, revealed, runScreen, savePlace, serialiseDiscover, setFigure, sortWords, withFilters, type DiscoverState } from '../src/discoverstate.ts';
import { applyConds, checkRange, coverage, describeCond, parseNumber, sortRowsBy, valueOf, type Cond, type MetricKey } from '../src/screener.ts';
import { sortRows, type Row } from '../src/screen.ts';
import { plural, pluralWord } from '../src/plural.ts';

// A deterministic screen: 120 names, a few of them financial, some with holes in their figures, with ties and names that sort differently from their symbols.
const SECTORS = ['Industrials', 'Financial Services', 'Technology', 'Energy'];
const NAMES = ['Apollo Hospitals', '63 Moons Technologies', 'Antelopus Selan', 'Petronet LNG', 'Tips Music', 'Zydus Lifesciences', 'Lotus Developers', 'Shringar House'];
function screen(n = 120): Row[] {
  return Array.from({ length: n }, (_, i) => {
    const up = i % 3 === 0; const base = 100 + (i * 37) % 900; const sym = i < NAMES.length ? NAMES[i].replace(/[^A-Za-z0-9]/g, '').slice(0, 9).toUpperCase() + i : `S${String(i).padStart(3, '0')}`;
    const r: Row = { sym, name: i < NAMES.length ? NAMES[i] : `Company ${String.fromCharCode(65 + (i * 7) % 26)}${i}`, sector: SECTORS[i % 4], tier: ['large', 'mid', 'small', 'micro'][i % 4], price: base, last_date: '2026-10-23',
      sma20: up ? base * 0.97 : base * 1.03, sma50: up ? base * 0.93 : base * 1.07, sma200: up ? base * 0.8 : base * 1.2, r3m: up ? 8 : -6, high52: base * (1 + (i % 7) / 20), low52: base * 0.6,
      from_high: -((i % 7) * 100) / (20 + (i % 7) * 5), rs3m: (i % 11) - 5, pe: i % 9 === 0 ? null : 8 + (i % 13) * 3, roce_med: 5 + (i % 8) * 4, rsi: i % 10 === 0 ? null : 25 + (i * 3) % 60, turnover_cr: 1 + (i % 6) * 10, de: (i % 5) / 4, net_margin: 4 + (i % 6) * 3, r1d: ((i % 9) - 4) / 2, pb: 1 + (i % 4) };
    if (i % 17 === 0) r.rsi_w = 50; return r;
  });
}
const rows = screen();
const st = (p: Partial<DiscoverState> = {}): DiscoverState => ({ ...DEFAULT_STATE, cond: [], pick: [], ...p });
const syms = (xs: readonly Row[]) => xs.map((r) => r.sym);

test('the default screen has no query at all, and an empty query is the default screen', () => {
  assert.equal(serialiseDiscover(DEFAULT_STATE), '');
  assert.deepEqual(parseDiscover('').state, DEFAULT_STATE); assert.deepEqual(parseDiscover('').ignored, []);
});
test('state round-trips through the URL, in a fixed key order, and a second trip changes nothing', () => {
  const s = st({ q: 'petro net', sector: 'Energy', tier: 'mid', trend: 'up', momentum: 'near-high', value: 'cheap', quality: 'high', view: 'table', sort: { key: 'rsi', dir: 'desc' }, cols: 'value', show: 72, pick: ['TCS', 'M&M'],
    cond: [{ m: 'rsi', op: 'gte', v: 30 }, { m: 'rsi', op: 'lte', v: 56, unk: true }, { m: 'from_high', op: 'gte', v: -12.5 }] });
  const a = serialiseDiscover(s); const back = parseDiscover(a);
  assert.deepEqual(back.ignored, []); assert.equal(serialiseDiscover(back.state), a);
  assert.deepEqual(back.state, { ...s, cond: canonConds(s.cond) });
  assert.equal(a, 'q=petro%20net&sector=Energy&tier=mid&trend=up&momentum=near-high&value=cheap&quality=high&c=from_high:ge:-12.5&c=rsi:ge:30&c=rsi:le:56!&view=table&sort=rsi.desc&cols=value&n=72&cmp=TCS,M%26M', 'the exact link is stable');
});
test('the order of the parameters in a link does not matter, the order written is always the same', () => {
  const a = serialiseDiscover(parseDiscover('view=table&trend=up&q=abc&rsi=30-56&sector=Energy').state); const b = serialiseDiscover(parseDiscover('sector=Energy&rsi=30-56&q=abc&trend=up&view=table').state);
  assert.equal(a, b); assert.equal(a, 'q=abc&sector=Energy&trend=up&c=rsi:ge:30&c=rsi:le:56&view=table');
});
test('every existing link still means what it meant: sector, tier, trend, momentum, value, quality, view=table, rsi, rsi_w, rsi_m', () => {
  const { state: s, ignored } = parseDiscover('sector=Technology&tier=small&trend=down&momentum=strong&value=rich&quality=high&view=table&rsi=35-50&rsi_w=40-60&rsi_m=10-20');
  assert.deepEqual(ignored, []);
  assert.deepEqual([s.sector, s.tier, s.trend, s.momentum, s.value, s.quality, s.view], ['Technology', 'small', 'down', 'strong', 'rich', 'high', 'table']);
  assert.deepEqual(s.cond.map((c) => `${c.m}${c.op === 'gte' ? '>=' : '<='}${c.v}`), ['rsi>=35', 'rsi<=50', 'rsi_w>=40', 'rsi_w<=60', 'rsi_m>=10', 'rsi_m<=20']);
  assert.equal(parseDiscover('trend=up&momentum=near-high').state.momentum, 'near-high');
  assert.equal(parseDiscover('rsi=0-30').state.cond.length, 2, 'the Trend map\'s washed-out link');
});
test('anything not understood is dropped and reported; the rest of the link still applies', () => {
  const { state: s, ignored } = parseDiscover('trend=sideways&tier=giant&rsi=50-30&rsi_w=abc&c=rsi:ge:130&c=nonsense:ge:1&c=rsi:ge:abc&c=pe:le:15&sort=bogus&cols=none&n=abc&view=grid&cmp=OK,bad%20sym,TCS,INFY,HDFC,ZZZ&utm_source=x&value=cheap&sector=Technology');
  assert.equal(s.trend, ''); assert.equal(s.tier, ''); assert.deepEqual(s.cond, [{ m: 'pe', op: 'lte', v: 15 }]); assert.deepEqual(s.sort, { key: 'name', dir: 'asc' }); assert.equal(s.cols, 'momentum'); assert.equal(s.show, PAGE); assert.equal(s.view, 'list');
  assert.deepEqual(s.pick, ['OK', 'TCS', 'INFY'], 'three at most, only well-formed symbols'); assert.equal(s.value, 'cheap'); assert.equal(s.sector, 'Technology');
  for (const k of ['trend=sideways', 'tier=giant', 'rsi=50-30', 'rsi_w=abc', 'c=rsi:ge:130', 'c=nonsense:ge:1', 'c=rsi:ge:abc', 'sort=bogus', 'cols=none', 'n=abc', 'view=grid']) assert.ok(ignored.includes(k), `${k} is reported`);
  assert.ok(!ignored.some((x) => x.startsWith('utm_')), 'an unrelated parameter is not an error, and is not kept');
});
test('a sector the screen does not have is dropped when the sectors are known, and kept when they are not yet', () => {
  assert.equal(parseDiscover('sector=Basket%20Weaving', { sectors: SECTORS }).state.sector, ''); assert.deepEqual(parseDiscover('sector=Basket%20Weaving', { sectors: SECTORS }).ignored, ['sector=Basket Weaving']);
  assert.equal(parseDiscover('sector=Energy', { sectors: SECTORS }).state.sector, 'Energy'); assert.equal(parseDiscover('sector=Anything').state.sector, 'Anything');
});
test('text in a link is capped and cleaned, and a huge page count is clamped', () => {
  const s = parseDiscover(`q=${'x'.repeat(200)}%0Aabc&n=999999`).state; assert.ok(s.q.length <= 60 && !/[\n]/.test(s.q)); assert.equal(parseDiscover('n=9999').state.show, 5000); assert.equal(parseDiscover('n=0').state.show, PAGE);
  assert.equal(parseDiscover(Array.from({ length: 30 }, (_, i) => `c=pe:le:${10 + i}`).join('&')).state.cond.length, 12, 'conditions are capped');
});
test('conditions: canonical order, no duplicates, and the "include names with no figure" flag survives a round trip as its own condition', () => {
  const cs: Cond[] = [{ m: 'pe', op: 'lte', v: 20 }, { m: 'rsi', op: 'lte', v: 60 }, { m: 'rsi', op: 'gte', v: 40 }, { m: 'rsi', op: 'gte', v: 40 }, { m: 'rsi', op: 'gte', v: 40, unk: true }];
  assert.deepEqual(canonConds(cs).map((c) => `${c.m}${c.op}${c.v}${c.unk ? '!' : ''}`), ['rsigte40', 'rsigte40!', 'rsilte60', 'pelte20'].map((x) => x));
  const back = parseDiscover(serialiseDiscover(st({ cond: cs }))).state.cond; assert.deepEqual(back, canonConds(cs));
  assert.equal(describeCond({ m: 'rsi', op: 'gte', v: 30, unk: true }), 'RSI ≥ 30 or no figure');
});
test('clearing filters keeps how the person reads (view, sort, columns, picks); setFigure replaces both ends of one figure', () => {
  const s = st({ q: 'a', trend: 'up', cond: [{ m: 'rsi', op: 'gte', v: 30 }], view: 'table', sort: { key: 'pe', dir: 'asc' }, cols: 'value', pick: ['TCS'], show: 96 });
  const c = clearFilters(s); assert.deepEqual([c.q, c.trend, c.cond.length, c.show], ['', '', 0, PAGE]); assert.deepEqual([c.view, c.sort.key, c.cols, c.pick], ['table', 'pe', 'value', ['TCS']]);
  const t = setFigure(s, 'rsi', [{ m: 'rsi', op: 'gte', v: 40 }, { m: 'rsi', op: 'lte', v: 55 }]); assert.deepEqual(t.cond.map((x) => x.v), [40, 55]); assert.equal(setFigure(t, 'rsi', []).cond.length, 0);
  const w = withFilters(s, { q: '', sector: 'Energy', tier: '', value: '', quality: '', momentum: '', trend: '', cond: [] }); assert.equal(w.sector, 'Energy'); assert.equal(w.view, 'table'); assert.equal(w.show, PAGE);
});

/* ---- one pipeline, two views ---- */
const SORTS: DiscoverState['sort'][] = [{ key: 'name', dir: 'asc' }, { key: 'name', dir: 'desc' }, { key: 'sym', dir: 'asc' }, { key: 'pe', dir: 'asc' }, { key: 'pe', dir: 'desc' }, { key: 'rsi', dir: 'desc' }, { key: 'roce_med', dir: 'desc' }, { key: 'from_high', dir: 'desc' }, { key: 'rs3m', dir: 'desc' }, { key: 'turnover_cr', dir: 'desc' }, { key: 'de', dir: 'asc' }];
const FILTERS: Partial<DiscoverState>[] = [{}, { trend: 'up' }, { trend: 'up', cond: [{ m: 'rsi', op: 'gte', v: 30 }, { m: 'rsi', op: 'lte', v: 56 }] }, { sector: 'Financial Services' }, { quality: 'high' }, { value: 'cheap', momentum: 'strong' }, { q: 'company' }, { cond: [{ m: 'pe', op: 'lte', v: 20, unk: true }] }, { trend: 'down', tier: 'mid' }];
test('list and table draw from one run: for every filter and every sort the count and the ordered symbols are identical whichever view is on', () => {
  for (const f of FILTERS) for (const sort of SORTS) {
    const list = runScreen(rows, st({ ...f, sort, view: 'list' })), table = runScreen(rows, st({ ...f, sort, view: 'table' }));
    assert.equal(list.ordered.length, table.ordered.length); assert.deepEqual(syms(list.ordered), syms(table.ordered), `${JSON.stringify(f)} ${sort.key}.${sort.dir}`);
    assert.deepEqual(syms(revealed(list, st({ show: 48 }))), syms(list.ordered.slice(0, 48)));
  }
});
test('the pipeline runs over the whole screen, not the rendered page: a filter finds a name that sits beyond the first page', () => {
  const all = runScreen(rows, st({ sort: { key: 'sym', dir: 'asc' } })).ordered; const late = all[100];
  const hit = runScreen(rows, st({ q: late.sym })); assert.deepEqual(syms(hit.ordered), [late.sym]); assert.ok(all.findIndex((r) => r.sym === late.sym) >= PAGE * 4);
  assert.equal(revealed(runScreen(rows, st()), st()).length, PAGE); assert.equal(runScreen(rows, st()).ordered.length, rows.length);
});
test('Name A to Z with Uptrend starts in the same order in both views, and by name, not by symbol', () => {
  const s = st({ trend: 'up', sort: { key: 'name', dir: 'asc' } }); const a = syms(runScreen(rows, { ...s, view: 'list' }).ordered), b = syms(runScreen(rows, { ...s, view: 'table' }).ordered);
  assert.deepEqual(a, b); const names = runScreen(rows, s).ordered.map((r) => r.name); assert.deepEqual(names, [...names].sort((x, y) => new Intl.Collator('en', { sensitivity: 'base' }).compare(x, y)));
  assert.ok(runScreen(rows, st()).ordered[0].name.startsWith('63 Moons'), 'a digit sorts before a letter'); assert.ok(names[0].startsWith('Apollo'), 'and the first uptrend by name is not the first by symbol');
  const pool: Row[] = [{ sym: 'AAA', name: 'Zeta Ltd' }, { sym: 'ZED', name: 'Alpha Ltd' }]; assert.deepEqual(syms(runScreen(pool, st()).ordered), ['ZED', 'AAA'], 'the default sort is by name'); assert.deepEqual(syms(runScreen(pool, st({ sort: { key: 'sym', dir: 'asc' } })).ordered), ['AAA', 'ZED']);
  assert.deepEqual(syms(sortRows(rows, 'name', 'asc')), syms(sortRowsBy(rows, 'name', 'asc')), 'the list\'s own sortRows is the shared one');
});
test('sorting: missing figures last in either direction, ties by symbol A to Z in both, a lender\'s undefined ratio counts as missing', () => {
  const pool: Row[] = [{ sym: 'B', name: 'B', pe: 10 }, { sym: 'A', name: 'A', pe: 10 }, { sym: 'C', name: 'C', pe: null }, { sym: 'D', name: 'D', pe: 5 }, { sym: 'E', name: 'E' }];
  assert.deepEqual(syms(sortRowsBy(pool, 'pe', 'asc')), ['D', 'A', 'B', 'C', 'E']); assert.deepEqual(syms(sortRowsBy(pool, 'pe', 'desc')), ['A', 'B', 'D', 'C', 'E']);
  const bank: Row = { sym: 'BANK', name: 'Bank', sector: 'Financial Services', roce_med: 90 }; const co: Row = { sym: 'CO', name: 'Co', sector: 'Industrials', roce_med: 10 };
  assert.deepEqual(syms(sortRowsBy([bank, co], 'roce_med', 'desc')), ['CO', 'BANK'], 'a bank\'s ROCE is not defined, so it does not top the table');
  assert.deepEqual(syms(sortRowsBy([bank, co], 'sym', 'desc')), ['CO', 'BANK']);
  assert.deepEqual(syms(sortRowsBy(rows, 'rsi', 'desc')), syms(sortRowsBy([...rows].reverse(), 'rsi', 'desc')), 'input order never changes the result');
  const lastN = (d: 'asc' | 'desc') => sortRowsBy(rows, 'rsi', d).slice(-rows.filter((r) => r.rsi == null).length).every((r) => r.rsi == null); assert.ok(lastN('asc') && lastN('desc'));
  assert.equal(sortWords({ key: 'name', dir: 'asc' }), 'Name, A to Z'); assert.equal(sortWords({ key: 'pe', dir: 'asc' }), 'PE (trailing), lowest first');
  assert.deepEqual(nextSort({ key: 'pe', dir: 'asc' }, 'pe'), { key: 'pe', dir: 'desc' }); assert.deepEqual(nextSort({ key: 'pe', dir: 'asc' }, 'roce_med'), { key: 'roce_med', dir: 'desc' }); assert.deepEqual(nextSort({ key: 'pe', dir: 'desc' }, 'de'), { key: 'de', dir: 'asc' });
});

/* ---- unknown figures ---- */
test('a name with no figure is excluded by default and counted; "include names with no figure" lets in missing ones only, never a figure that is not defined', () => {
  const pool: Row[] = [{ sym: 'A', name: 'A', sector: 'Industrials', rsi: 40, roce_med: 25 }, { sym: 'B', name: 'B', sector: 'Industrials', roce_med: 25 }, { sym: 'BANK', name: 'Bank', sector: 'Financial Services', rsi: 45 }, { sym: 'C', name: 'C', sector: 'Industrials', rsi: 80, roce_med: 5 }];
  const off = applyConds(pool, [{ m: 'rsi', op: 'lte', v: 60 }]); assert.deepEqual(syms(off.rows), ['A', 'BANK']); assert.equal(off.noFigure, 1); assert.equal(off.unknownIncluded, 0);
  const on = applyConds(pool, [{ m: 'rsi', op: 'lte', v: 60, unk: true }]); assert.deepEqual(syms(on.rows), ['A', 'B', 'BANK']); assert.equal(on.unknownIncluded, 1);
  const roce = applyConds(pool, [{ m: 'roce_med', op: 'gte', v: 20, unk: true }]); assert.deepEqual(syms(roce.rows), ['A', 'B'], 'the bank\'s ROCE is undefined, not unknown: it stays out'); assert.equal(roce.notApplicable, 1);
  assert.equal(valueOf(pool[1], 'rsi'), null); assert.equal(coverage(pool, 'roce_med').na, 1); assert.deepEqual(coverage(pool, 'rsi'), { have: 3, missing: 1, na: 0, total: 4 });
  const z: Row[] = [{ sym: 'Z', name: 'Z', pe: 0 }, { sym: 'Y', name: 'Y' }]; assert.deepEqual(syms(applyConds(z, [{ m: 'pe', op: 'lte', v: 0 }]).rows), ['Z'], 'a measured zero is a figure; an absent one is not');
});

/* ---- basis: the screen is decided at the close ---- */
test('a live quote changes what a cell shows and never which names are listed or in what order', () => {
  const s = st({ trend: 'up', sort: { key: 'from_high', dir: 'desc' }, cond: [{ m: 'from_high', op: 'gte', v: -20 }] }); const before = runScreen(rows, s); const order = syms(before.ordered);
  const live = before.ordered.map((r) => displayRow(r, { px: r.price! * 0.8, ch: -20, fromQuote: true }));
  assert.ok(live.every((d) => d.live)); assert.deepEqual(syms(runScreen(rows, s).ordered), order, 'the run takes no quotes');
  assert.deepEqual(syms(before.ordered), order, 'and the run it already gave is not touched by displaying live rows');
  const r = before.ordered[0]; const d = displayRow(r, { px: r.price! * 0.8, ch: -20, fromQuote: true });
  const c = cellOf(r, d, 'from_high'); assert.ok(c.live && c.differs && c.v! < c.close!, 'the cell says live, and keeps the close the filter used'); assert.equal(c.close, r.from_high);
  const rs = cellOf(r, d, 'rs3m'); assert.ok(!rs.live && !rs.differs && rs.v === r.rs3m, 'a figure the price cannot redo stays at the close');
  assert.equal(displayRow(r, { px: null, ch: null, fromQuote: false }).live, false); assert.equal(displayRow(r, { px: r.price! * 0.8, ch: -20, fromQuote: false }).row, r);
});
test('the figures a filter or a sort was decided on are named, so a live cell for one of them can show its close', () => {
  assert.deepEqual([...predicateMetrics(st({ sort: { key: 'pe', dir: 'asc' }, cond: [{ m: 'from_high', op: 'gte', v: -5 }], quality: 'high', momentum: 'strong' }))].sort(), ['from_high', 'pe', 'roce_med', 'rs3m']);
  assert.equal(predicateMetrics(st()).size, 0);
  const bank: Row = { sym: 'BANK', name: 'Bank', sector: 'Financial Services', roce_med: 90, price: 10 }; assert.equal(cellOf(bank, { row: bank, live: false }, 'roce_med').state, 'na'); assert.equal(cellOf({ sym: 'X', name: 'X' }, { row: { sym: 'X', name: 'X' }, live: false }, 'pe').state, 'missing');
});

/* ---- the sheet's inline checks ---- */
test('numbers are read strictly: an empty box is not a zero', () => {
  assert.equal(parseNumber(''), null); assert.equal(parseNumber('  '), null); assert.equal(parseNumber('12abc'), null); assert.equal(parseNumber('1e5'), null); assert.equal(parseNumber('-'), null); assert.equal(parseNumber('1,250.5'), 1250.5);
  assert.equal(parseNumber('−5'), -5); assert.equal(parseNumber('12%'), 12); assert.equal(parseNumber('₹ 500'), 500); assert.equal(parseNumber('.5'), 0.5); assert.equal(parseNumber('0'), 0); assert.equal(parseNumber('9999999999'), null);
});
test('range checks block the nonsense and say why, inline', () => {
  const ok = checkRange('rsi', 'between', '30', '56'); assert.ok(ok.ok && ok.a === 30 && ok.b === 56);
  assert.match(checkRange('rsi', 'between', '', '56').errors.a!, /Enter a number/); assert.match(checkRange('rsi', 'gte', 'abc', '').errors.a!, /not a number/);
  assert.match(checkRange('rsi', 'gte', '130', '').errors.a!, /0 to 100/); assert.match(checkRange('rsi', 'between', '60', '40').errors.range!, /above To/);
  assert.match(checkRange('from_high', 'gte', '5', '').errors.a!, /zero or below/); assert.ok(checkRange('from_high', 'gte', '-5', '').ok);
  assert.match(checkRange('price', 'gte', '-1', '').errors.a!, /negative/); assert.match(checkRange('pe', 'lte', '-3', '').errors.a!, /negative PE/); assert.ok(checkRange('de', 'lte', '-1', '').ok, 'negative debt to equity is a real reading (negative equity)');
  assert.match(checkRange('rsi', 'around', '47', '-1').errors.b!, /zero or more/); assert.ok(checkRange('rsi', 'around', '47', '2').ok); assert.ok(checkRange('rs3m', 'between', '-10', '25').ok);
});

/* ---- plurals ---- */
test('plurals: one is singular, everything else is not', () => {
  assert.equal(plural(1, 'company', 'companies'), '1 company'); assert.equal(plural(0, 'company', 'companies'), '0 companies'); assert.equal(plural(2, 'company', 'companies'), '2 companies'); assert.equal(plural(1, 'name'), '1 name'); assert.equal(plural(988, 'name'), '988 names');
  assert.equal(plural(12345, 'line'), '12,345 lines'); assert.equal(pluralWord(1, 'line'), 'line'); assert.equal(pluralWord(6, 'line'), 'lines'); assert.equal(plural(Number.NaN, 'name'), '0 names');
});

/* ---- session memory ---- */
const fake = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
test('session memory: the last screen and the place on it come back; a broken or missing store is silence, never an error', () => {
  const s = fake(); assert.equal(lastDiscoverQuery(s), ''); rememberDiscover('trend=up&view=table', s); assert.equal(lastDiscoverQuery(s), 'trend=up&view=table');
  savePlace('trend=up', { y: 1840, at: 'PETRONET', ty: 300 }, s); assert.deepEqual(loadPlace('trend=up', s), { y: 1840, at: 'PETRONET', tx: undefined, ty: 300 }); assert.equal(loadPlace('other', s), null);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } }; assert.equal(lastDiscoverQuery(broken), ''); rememberDiscover('x', broken); savePlace('x', { y: 1, at: '' }, broken); assert.equal(loadPlace('x', broken), null);
  assert.equal(lastDiscoverQuery(null), ''); assert.equal(loadPlace('x', null), null);
  s.setItem('tripwire:discover:places', '{"a":{"y":-4,"at":"x"},"b":{"y":"no"},"c":7}'); assert.equal(loadPlace('a', s), null); assert.equal(loadPlace('b', s), null); assert.equal(loadPlace('c', s), null); s.setItem('tripwire:discover:places', '[1]'); assert.equal(loadPlace('a', s), null);
  const t = fake(); for (let i = 0; i < 40; i++) savePlace(`k${i}`, { y: i, at: '' }, t); assert.equal(loadPlace('k0', t), null); assert.equal(loadPlace('k39', t)!.y, 39, 'only the recent places are kept');
});
test('filtersOf carries exactly what the saved screens store', () => {
  const f = filtersOf(st({ q: 'a', sector: 'Energy', cond: [{ m: 'pe' as MetricKey, op: 'lte', v: 15 }] })); assert.deepEqual(Object.keys(f).sort(), ['cond', 'momentum', 'q', 'quality', 'sector', 'tier', 'trend', 'value']);
});
