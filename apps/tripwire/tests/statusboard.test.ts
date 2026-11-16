// 16 Nov 2026: the status board. Every figure is worked by hand here, not by the module under test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, pickId, type Ledger, type LedgerPick, type Outcome } from '../src/ledger.ts';
import { planAutoBook } from '../src/autobook.ts';
import { bookRisk, nightlyHealth, crossChecks, alertsOf, statusFacts, PAPER } from '../src/statusboard.ts';
import type { FileVerdict } from '../src/freshness.ts';

const pick = (asOf: string, sym: string, ref: number, stop: number): LedgerPick => ({ id: pickId(asOf, 'QLT', sym), engine: 'QLT', sym, asOf, ref, stop, horizon: 60, score: 80, rank: 1 });
const open = (entry: number, entryDay: string): Outcome => ({ status: 'open', final: false, entry, entryDay, mark: entry, sessions: 2 });
const led = (picks: LedgerPick[], outcomes: Record<string, Outcome>, days: string[]): Ledger => ({ ...emptyLedger('2026-11-06T00:00:00Z'), days: days.map((asOf) => ({ asOf, recorded: `${asOf}T20:00:00Z`, engines: {} })), picks, outcomes });

const A = pick('2026-11-03', 'ALPHA', 100, 90), B = pick('2026-11-03', 'BETA', 200, 190), W = pick('2026-11-04', 'WAITCO', 50, 45);
const L = led([A, B, W], { [A.id]: open(100, '2026-11-04'), [B.id]: open(200, '2026-11-04') }, ['2026-11-03', '2026-11-04']);
const sector = (s: string) => ({ ALPHA: 'Tech', BETA: 'Tech', WAITCO: 'Metals' } as Record<string, string>)[s] ?? null;

test('book risk: Quality takes half the 100,000 ticket: ALPHA 500 sh x (100-90) = 5,000 and BETA 250 sh x (200-190) = 2,500; total 7,500; ALPHA is 66.7% of it', () => {
  const plan = planAutoBook(L); assert.equal(plan.taken.find((t) => t.pick.sym === 'ALPHA')!.qty, 500, 'half ticket 50000 / ref 100'); assert.equal(plan.taken.find((t) => t.pick.sym === 'BETA')!.qty, 250, 'half ticket 50000 / ref 200');
  const r = bookRisk(L, plan, sector);
  assert.equal(r.initialRisk, 7500); assert.equal(r.measured, 2); assert.equal(r.unmeasured, 0); assert.equal(r.largest!.sym, 'ALPHA'); assert.equal(r.largest!.share, 66.7);
  assert.equal(r.open, 2); assert.equal(r.awaiting, 1, 'WAITCO has no fill yet'); assert.equal(r.slotsUsed, 3, 'an awaiting position still holds a slot'); assert.equal(r.slotsMax, 50);
  assert.deepEqual(r.bySector.map((s) => [s.sector, s.n, s.atCap]), [['Tech', 2, false], ['Metals', 1, false]]);
});
test('book risk: no open position gives no figure, not zero; an unknown sector is said so', () => {
  const l = led([W], {}, ['2026-11-04']); const r = bookRisk(l, planAutoBook(l), () => null);
  assert.equal(r.initialRisk, null); assert.equal(r.largest, null); assert.equal(r.open, 0); assert.equal(r.bySector[0].sector, 'Sector not published');
});
test('a sector holding the per-sector limit (4) is flagged', () => {
  const ps = ['P1', 'P2', 'P3', 'P4'].map((s) => pick('2026-11-03', s, 100, 90)); const o = Object.fromEntries(ps.map((p) => [p.id, open(100, '2026-11-04')]));
  const l = led(ps, o, ['2026-11-03']); const r = bookRisk(l, planAutoBook(l), () => 'Tech');
  assert.equal(r.bySector[0].n, 4); assert.equal(r.bySector[0].atCap, true, '4 held in one sector is the limit');
});

test('nightly health: nights 3 and 6 Nov leave 4 and 5 Nov missing; on Mon 9 Nov 10:30 IST the market is at 6 Nov so it is up to date', () => {
  const l = led([], {}, ['2026-11-03', '2026-11-06']); const h = nightlyHealth(l, Date.parse('2026-11-09T05:00:00Z'));
  assert.equal(h.nights, 2); assert.equal(h.last, '2026-11-06'); assert.deepEqual(h.gaps, ['2026-11-04', '2026-11-05']); assert.equal(h.behind, 0); assert.match(h.gapLine!, /not recorded/); assert.match(h.line, /up to date/);
});
test('nightly health: an empty ledger says so and has no gaps', () => { const h = nightlyHealth(led([], {}, []), Date.parse('2026-11-09T05:00:00Z')); assert.equal(h.nights, 0); assert.equal(h.last, null); assert.deepEqual(h.gaps, []); assert.match(h.line, /not recorded a night yet/); });

test('cross-checks: equal days pass; 4 Nov against 6 Nov is 2 sessions apart (5 and 6 Nov); a missing date is "cannot be compared", not a pass', () => {
  const c = crossChecks({ screenAsOf: '2026-11-06', ledgerAsOf: '2026-11-04', signalsThrough: '2026-11-06', screenSyms: new Set(['ALPHA', 'BETA']), bookSyms: ['ALPHA', 'GAMMA', 'GAMMA'] });
  assert.equal(c[0].ok, false); assert.match(c[0].line, /2 sessions apart/); assert.equal(c[1].ok, true);
  assert.equal(c[2].ok, false); assert.match(c[2].line, /GAMMA/); assert.doesNotMatch(c[2].line, /GAMMA, GAMMA/);
  const m = crossChecks({ screenAsOf: null, ledgerAsOf: '2026-11-04', signalsThrough: null, screenSyms: null, bookSyms: [] }); assert.deepEqual(m.map((x) => x.ok), [null, null, null]);
});

const fv = (id: string, status: FileVerdict['status'], behind: number | null, asOf: string | null): FileVerdict => ({ id: id as FileVerdict['id'], label: id, asOf, built: null, rows: null, status, behind, note: null });
test('alerts: stale and missing feeds, gaps and failed checks come before notes; a current feed raises nothing', () => {
  const nightly = nightlyHealth(led([], {}, ['2026-11-03', '2026-11-06']), Date.parse('2026-11-09T05:00:00Z'));
  const a = alertsOf({ files: [fv('screen', 'current', 0, '2026-11-06'), fv('rsi', 'stale', 2, '2026-11-04'), fv('factors', 'missing', null, null)], gate: { on: false, passed: 1, total: 4, text: 'Signals gate: OFF — 1/4 checks', short: '', holdout: null, checks: [], pill: 'Market cautious', plain: '' }, voided: 2, nightly, checks: [{ id: 'x', ok: false, line: 'drift' }, { id: 'y', ok: null, line: 'unknown' }], risk: null });
  assert.deepEqual(a.map((x) => x.id), ['feed-rsi', 'feed-factors', 'nights-missing', 'check-x', 'gate', 'voided']);
  assert.equal(a[0].level, 'attention'); assert.equal(a.at(-1)!.level, 'note'); assert.match(a[0].text, /2 sessions behind/); assert.match(a[5].text, /2 picks are voided/);
});
test('the facts file carries paper:true, the as-of days and nulls for what it was not given', () => {
  const f = statusFacts({ as_of: '2026-11-13', built_at: 'x', rows: [1, 2, 3] }, { data_through: '2026-11-13', gate: { on: false, passed: 1, checks: [1, 2, 3, 4] } }, '2026-11-16T00:00:00Z');
  assert.equal(f.paper, true); assert.equal(PAPER, true); assert.equal(f.screen.rows, 3); assert.equal(f.signals.gateOn, false); assert.equal(f.signals.checksTotal, 4);
  const n = statusFacts(null, null, null); assert.equal(n.screen.asOf, null); assert.equal(n.signals.gateOn, null); assert.equal(n.paper, true);
});
test('sectors at the limit are one note, not one per sector', () => {
  const risk = { slotsUsed: 8, slotsMax: 50, open: 8, awaiting: 0, initialRisk: 1, measured: 8, unmeasured: 0, largest: null, basis: '', bySector: [{ sector: 'Tech', n: 4, atCap: true }, { sector: 'Energy', n: 4, atCap: true }, { sector: 'Metals', n: 1, atCap: false }] };
  const a = alertsOf({ files: [], gate: null, voided: 0, nightly: nightlyHealth(led([], {}, ['2026-11-03']), Date.parse('2026-11-04T05:00:00Z')), checks: [], risk });
  assert.deepEqual(a.map((x) => x.id), ['sector-cap']); assert.match(a[0].text, /2 sectors hold the book's per-sector limit of 4 positions: Tech, Energy\./);
});
