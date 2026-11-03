// The target ladder's geometry and words (ladder.ts), driven from the real tracker so a level drawn is checked against the level booked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inr } from '../src/fmt.ts';
import { ladderInputFor, ladderModel, shortDay, MIN_LABEL_GAP, type LadderInput } from '../src/ladder.ts';
import { evaluatePaper, type Bar, type Paper } from '../src/tracker.ts';
import { takenAtFor, type Outcome } from '../src/ledger.ts';
import { ladderPrices, REFERENCE_ONLY } from '../src/exits.ts';

const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 1000 - 19800 + 9 * 3600 + 15 * 60;
const bar = (iso: string, o: number, h: number, l: number, c: number): Bar => ({ t: day(iso), o, h, l, c, forming: false });
// signal close 100, stop 95, 10 shares, swing ladder 1.5R / 3R: fill 100.1, risk 5.1, T1 107.75, T2 115.4 (same worked example as exits.test.ts)
const P = (o: Partial<Paper> = {}): Paper => ({ id: 'p', sym: 'X', engine: 'MOM', asOf: '2026-10-28', ref: 100, stop: 95, horizon: 20, qty: 10, takenAt: takenAtFor('2026-10-28'), targets: { t1R: 1.5, t2R: 3 }, ...o });
const view = (p: Paper, bars: Bar[], live: { px: number; t: number } | null = null) => evaluatePaper(p, bars, live, 0.25);
const SIG = bar('2026-10-28', 99, 101, 98, 100);

test('the levels drawn are the levels booked, to the paisa (entry-based R)', () => {
  const p = P(); const v = view(p, [SIG, bar('2026-10-29', 100, 101, 99, 100.5)]);
  const i = ladderInputFor(p, v)!; const want = ladderPrices(v.entry!, p.stop, 1.5, 3);
  assert.equal(i.basis, 'entry'); assert.equal(i.entry, v.entry); assert.equal(i.t1, want.t1); assert.equal(i.t2, want.t2); assert.equal(i.t1, v.ladder!.t1); assert.equal(i.t2, v.ladder!.t2);
  assert.equal(i.t1, 107.75); assert.equal(i.t2, 115.4);
});

test('a position with T1 hit: tick filled and dated, half booked in words, stop ratcheted to the fill and the stretch drawn', () => {
  const p = P(); const v = view(p, [SIG, bar('2026-10-29', 100, 101, 99, 100.5), bar('2026-10-30', 101, 108.5, 100.8, 108)]);
  const i = ladderInputFor(p, v)!; assert.equal(i.t1Hit, true); assert.equal(i.t2Hit, false);
  const m = ladderModel(i); const t1 = m.ticks.find((t) => t.id === 't1')!;
  assert.ok(t1.hit && t1.day === '2026-10-30'); assert.ok(!m.ticks.find((t) => t.id === 't2')!.hit);
  assert.ok(m.notes.some((n) => /^½ booked at T1 · 30 Oct/.test(n)), m.notes.join('|'));
  assert.ok(m.ratchet && m.ratchet.toPx === v.entry && m.ratchet.fromPx === 95 && m.ratchet.to > m.ratchet.from);
  assert.ok(m.ticks.find((t) => t.id === 'stop')!.moved); assert.ok(m.notes.some((n) => /Stop raised to the fill/.test(n)));
  assert.equal(m.fill!.tone, 'up'); assert.equal(m.marker!.kind, 'now');
});

test('before T1 there is no ratchet and nothing is claimed as booked', () => {
  const p = P(); const m = ladderModel(ladderInputFor(p, view(p, [SIG, bar('2026-10-29', 100, 102, 99, 101)]))!);
  assert.equal(m.ratchet, null); assert.deepEqual(m.notes, []); assert.ok(m.ticks.every((t) => !t.hit && !t.moved));
});

test('T1 then T2: the rest sold, both dated; a closed position is drawn completed with the marker at its exit', () => {
  const p = P(); const bars = [SIG, bar('2026-10-29', 100, 101, 99, 100.5), bar('2026-10-30', 101, 108.5, 100.8, 108), bar('2026-11-02', 109, 116, 108, 115)];
  const v = view(p, bars); assert.equal(v.status, 'closed');
  const m = ladderModel(ladderInputFor(p, v)!); assert.equal(m.marker!.kind, 'exit'); assert.equal(m.marker!.px, v.exit);
  assert.ok(m.notes.some((n) => /^Rest sold at T2 · 2 Nov/.test(n)), m.notes.join('|'));
  assert.ok(m.notes.some((n) => /^½ booked at T1 · 30 Oct/.test(n)));
  assert.match(m.summary, /exited at/);
});

test('stopped out before any target: marker below the entry, fill is the loss tone, nothing booked', () => {
  const p = P(); const v = view(p, [SIG, bar('2026-10-29', 100, 101, 99, 100.5), bar('2026-10-30', 99, 99.5, 94, 95)]);
  assert.equal(v.status, 'closed'); const m = ladderModel(ladderInputFor(p, v)!);
  assert.equal(m.fill!.tone, 'down'); assert.ok(m.marker!.pos < m.ticks.find((t) => t.id === 'entry')!.pos); assert.deepEqual(m.notes, []);
});

test('before the fill the levels are the signal close\'s and the card says so; no price is drawn on the journey', () => {
  const p = P(); const v = view(p, [SIG]); assert.ok(v.status === 'pending' || v.status === 'waiting');
  const i = ladderInputFor(p, v)!; assert.equal(i.basis, 'signal'); assert.equal(i.entry, 100);
  const m = ladderModel(i); assert.equal(m.marker, null); assert.equal(m.fill, null);
  assert.equal(m.ticks.find((t) => t.id === 'entry')!.label, 'Signal'); assert.ok(m.notes.some((n) => /signal close/.test(n)));
});

test('a pick that finished before the ladder existed is REFERENCE ONLY, in words, with no booking claimed', () => {
  const p = P({ asOf: '2026-10-20', takenAt: takenAtFor('2026-10-20'), targets: null }); const bars = [bar('2026-10-20', 99, 101, 98, 100), bar('2026-10-21', 100, 101, 99, 100.5), bar('2026-10-22', 99, 99.5, 94, 95)];
  const v = view(p, bars); assert.equal(v.status, 'closed');
  // the ledger may carry hit fields for it; a reference ladder must ignore them
  const o: Outcome = { status: 'closed', final: true, t1Hit: true, t1Day: '2026-10-21', t1Px: 107 } as Outcome;
  const i = ladderInputFor(p, v, o)!; assert.equal(i.reference, true); assert.equal(i.t1Hit, false);
  const m = ladderModel(i); assert.ok(m.reference); assert.ok(m.notes[0].toLowerCase().includes(REFERENCE_ONLY), m.notes[0]);
  assert.ok(m.ticks.filter((t) => t.id === 't1' || t.id === 't2').every((t) => t.ref && !t.hit && /ref$/.test(t.label)));
  assert.match(m.summary, /\(reference\)/);
});

test('a finished position of the ledger gets its hit days from the outcome that closed it', () => {
  const p = P(); const o: Outcome = { status: 'closed', final: true, entry: 100.1, t1Hit: true, t2Hit: false, t1Day: '2026-10-30', t1Px: 107.75 } as Outcome;
  const v = { id: 'p', status: 'closed' as const, entry: 100.1, exit: 100.1, sessions: 4, left: 0, mark: 100.1, markKind: 'close' as const, pnl: 38, r: 0.37, pct: 0.4 };
  const i = ladderInputFor(p, v, o)!; assert.equal(i.reference, false); assert.equal(i.t1Hit, true); assert.equal(i.t1Day, '2026-10-30'); assert.equal(i.curStop, 100.1);
  const m = ladderModel(i); assert.ok(m.ratchet); assert.ok(m.notes.some((n) => /^½ booked at T1 · 30 Oct · filled at ₹107\.75/.test(n)), m.notes.join('|'));
});

test('skipped positions have no ladder', () => {
  const p = P(); assert.equal(ladderInputFor(p, { id: 'p', status: 'skipped', sessions: 0, left: null, mark: null, markKind: null, pnl: null, r: null, pct: null, skipReason: 'Opened more than 2% above' }), null);
});

const base: LadderInput = { basis: 'entry', entry: 100, stop: 95, t1: 107.5, t2: 115, t1Hit: false, t2Hit: false, mark: 103, status: 'open', reference: false };
test('positions are percentages inside the rule, ordered by price, whatever the price does', () => {
  for (const mark of [50, 94, 100, 110, 130, 300]) {
    const m = ladderModel({ ...base, mark }); const by = (id: string) => m.ticks.find((t) => t.id === id)!;
    for (const t of m.ticks) assert.ok(t.pos >= 0 && t.pos <= 100, `${t.id} ${t.pos} for mark ${mark}`);
    assert.ok(by('stop').pos < by('entry').pos && by('entry').pos < by('t1').pos && by('t1').pos < by('t2').pos);
    assert.ok(m.marker!.pos >= 0 && m.marker!.pos <= 100);
  }
});
test('the marker sits where its price sits relative to the levels', () => {
  const m = ladderModel({ ...base, mark: 111.25 }); const t1 = m.ticks.find((t) => t.id === 't1')!, t2 = m.ticks.find((t) => t.id === 't2')!;
  assert.ok(m.marker!.pos > t1.pos && m.marker!.pos < t2.pos); assert.ok(Math.abs(m.marker!.pos - (t1.pos + t2.pos) / 2) < 0.2);
});
test('neighbouring labels that would touch drop to a second row; spaced ones stay on one', () => {
  const tight = ladderModel({ ...base, stop: 99.5, entry: 100, t1: 100.4, t2: 200, mark: 100 });
  const rows = tight.ticks.map((t) => t.row); assert.ok(rows.includes(1), rows.join());
  const sorted = [...tight.ticks].sort((a, b) => a.pos - b.pos);
  for (let k = 1; k < sorted.length; k++) if (sorted[k].pos - sorted[k - 1].pos < MIN_LABEL_GAP) assert.notEqual(sorted[k].row, sorted[k - 1].row);
  const even = ladderModel({ ...base, stop: 80, entry: 100, t1: 120, t2: 140, mark: 110 }); assert.ok(even.ticks.every((t) => t.row === 0), even.ticks.map((t) => `${t.id}:${t.pos}`).join());
});
test('no price, no journey: a missing mark draws no marker and no fill, never a zero', () => {
  const m = ladderModel({ ...base, mark: null }); assert.equal(m.marker, null); assert.equal(m.fill, null);
});
test('the accessible sentence names every level and what happened', () => {
  const m = ladderModel({ ...base, t1Hit: true, t1Day: '2026-10-30', curStop: 100, mark: 110 });
  for (const w of ['Stop ₹95.00 raised to ₹100.00', 'entry ₹100.00', 'T1 ₹107.50 hit 30 Oct', 'T2 ₹115.00 not reached', 'price now ₹110.00']) assert.ok(m.summary.includes(w), `${w} in ${m.summary}`);
});
test('shortDay drops the weekday', () => { assert.equal(shortDay('2026-10-28'), '28 Oct'); assert.equal(shortDay(null), 'an unknown date'); });

test('labels near the right edge do not overprint their neighbour (the 3 Nov Ather Energy pick: T1 and T2 printed on top of each other)', () => {
  const m = ladderModel({ ...base, stop: 1585.16, entry: 1774.6, t1: 2058.72, t2: 2342.92, mark: 1774.6 });
  const byId = Object.fromEntries(m.ticks.map((t) => [t.id, t])); assert.notEqual(byId.t1.row, byId.t2.row, m.ticks.map((t) => `${t.id}:${t.pos}:r${t.row}`).join(' '));
  // no two labels on the same line may touch: a label is 2.5 percent per character wide, centred except at the edges (ladder.ts)
  const ext = (tk: { pos: number; label: string; px: number }) => { const w = Math.max(tk.label.length, inr(tk.px).length) * 2.5; return tk.pos < 16 ? [tk.pos, tk.pos + w] : tk.pos > 84 ? [tk.pos - w, tk.pos] : [tk.pos - w / 2, tk.pos + w / 2]; };
  for (const row of [0, 1]) { const on = m.ticks.filter((t) => t.row === row).sort((a, b) => a.pos - b.pos); for (let k = 1; k < on.length; k++) assert.ok(ext(on[k])[0] >= ext(on[k - 1])[1], `${on[k - 1].id} and ${on[k].id} touch on line ${row}`); }
});
