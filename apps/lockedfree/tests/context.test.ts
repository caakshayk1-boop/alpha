import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { GLOSSARY, KINDS, changeLog } from '../src/lib/glossary.ts';
import { bookRisk } from '../src/lib/risk.ts';
import { closedStats, holdDays, type TradeRow } from '../src/lib/view.ts';
import { emptyLedger } from '../src/lib/ledger.ts';

test('glossary: every term is unique, has a known kind and all three explanations', () => {
  assert.equal(new Set(GLOSSARY.map((g) => g.term)).size, GLOSSARY.length); for (const g of GLOSSARY) { assert.ok(g.kind in KINDS, g.term); assert.ok(g.what.length > 10 && g.how.length > 10 && g.wrongIf.length > 10, g.term); }
});
test('change log is read from the decision log, newest first, with its date note', () => {
  const log = changeLog(readFileSync(new URL('../DECISIONS.md', import.meta.url), 'utf8')); assert.ok(log.length >= 15); assert.ok(log[0].id > log[log.length - 1].id); assert.ok(log.some((l) => l.id === 'ADR-017' && /Exit rules/.test(l.title)));
});
test('book risk: lost if every stop is hit, deployed, largest position and sector, from fills and stops only', () => {
  const L = emptyLedger('signal-close', 330000); L.config.capital = 10000000;
  const pick = (sym: string, qty: number, price: number, stop: number) => ({ id: sym, screen_id: 'piotroski', symbol: sym, first_listed_run: 'd', status: 'open' as const, fills: [{ date: 'd', side: 'buy' as const, qty, price, charges: 0 }], stop, exit_after: null, exit_reason: null, voided: null });
  L.picks.push(pick('AAA', 100, 1000, 800), pick('BBB', 50, 2000, 1500), { ...pick('CCC', 10, 10, 8), status: 'closed' as const });
  const r = bookRisk(L, (s) => (s === 'AAA' ? 'Tech' : 'Tech'))!; assert.equal(r.open, 2); assert.equal(r.deployed, 200000); assert.equal(r.riskAtStops, 100 * 200 + 50 * 500); assert.equal(r.largest!.symbol, 'AAA' === r.largest!.symbol ? 'AAA' : 'BBB'); assert.equal(r.topSector!.n, 2); assert.ok(Math.abs(r.riskPct - 0.45) < 1e-9);
  assert.equal(bookRisk(emptyLedger(), () => 'x')!.riskAtStops, 0);
});
test('closed-call statistics: profit factor, averages, hold time; blanks where there is nothing to divide by', () => {
  const row = (pnl: number, a: string, b: string) => ({ status: 'closed', pnl, entry: a, exit: b }) as unknown as TradeRow;
  const s = closedStats([row(300, '2026-11-17', '2026-11-20'), row(-100, '2026-11-17', '2026-11-19'), row(-50, '2026-11-17', '2026-11-18')]); assert.equal(s.n, 3); assert.equal(s.profitFactor, 2); assert.equal(s.avgWin, 300); assert.equal(s.avgLoss, -75); assert.equal(s.avgHold, 2); assert.equal(s.best, 300); assert.equal(s.worst, -100);
  assert.equal(closedStats([row(10, '2026-11-17', '2026-11-18')]).profitFactor, null); assert.equal(closedStats([]).n, 0); assert.equal(holdDays('2026-11-17', '2026-12-17'), 30); assert.equal(holdDays(null, 'x'), null);
});
test('context files: missing, malformed or stale files become null, never a default', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ctx-')); process.env.RULEBOOK_FEED_DIR = dir; writeFileSync(join(dir, 'regime.json'), '{ not json'); writeFileSync(join(dir, 'barometer.json'), JSON.stringify({ today: { score: 50, parts: [], nifty_date: '2020-01-01' } })); writeFileSync(join(dir, 'pulse.json'), JSON.stringify({ built_on: new Date().toISOString().slice(0, 10), volume: [{ sym: 'A', name: 'A', sector: 'S', price: 1, r1w: 1, vol_spike: 3, turnover_cr: 10 }, { sym: 'B', name: 'B', sector: 'S', price: 1, r1w: 1, vol_spike: 1.2, turnover_cr: 10 }, { sym: 'C', name: 'C', sector: 'S', price: 1, r1w: 1, vol_spike: 5, turnover_cr: 1 }] }));
  const mod = await import('../src/lib/context.ts?x=' + Date.now()); const c = mod.loadContext(); assert.equal(c.regime, null); assert.equal(c.barometer, null); assert.equal(c.health, null); assert.deepEqual(c.volume!.rows.map((r: { sym: string }) => r.sym), ['A']);
  delete process.env.RULEBOOK_FEED_DIR;
});
