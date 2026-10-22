// T06/T07: "Export everything" is one round trip. Run by `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { BACKUP_SCHEMA, BACKUP_VERSION, COLLECTIONS, backupReminder, emptyDesk, mergeDesk, parseBackup, reportLines, serializeBackup, type DeskState } from '../src/lib/backup.ts';
import { buildCard, serializeLibrary } from '../src/lib/card.ts';
import { serializeJournal, type JournalEntry } from '../src/lib/journal.ts';

const card = buildCard({ question: 'Can TCS hold margins?', companies: [{ sym: 'TCS', name: 'Tata Consultancy Services', price: 3100, priceAsOf: '2026-10-21' }], nextResults: { TCS: '2027-01-10' }, decision: { thesis: null, against: 'Margins under 22%', unknowns: null, reviewOn: '2026-11-15', reviewWhen: null } }, new Date('2026-10-21T06:00:00Z'));
const entry: JournalEntry = { id: 'j1', date: '2026-10-20', sym: 'INFY', action: 'watching', why: 'Waiting for the deal pipeline to show up in revenue', price: 1500, stop: 1400, target: null };
const full = (): DeskState => ({
  watchlist: ['TCS', 'INFY', 'M&M'],
  cards: [card],
  journal: [entry],
  conditions: ['TCS: rsi < 30', 'roce < 15'],
  screens: [{ name: 'Quality IT', conds: [{ f: 'roce', op: '>=', v: '20' }], flags: [], sector: 'IT', tier: 'large', nl: { text: 'large cap IT', off: [] } }],
  reviews: { TCS: { v: 1, at: '2026-10-20T10:00:00.000Z', data: '2026-10-20', price: 3050, q: 80, g: 55, val: 40, tech: 61, risk: 'LOW', next: '2027-01-10', elig: 'pass' } },
});

test('backup: one export restores every collection into an empty browser', () => {
  const text = serializeBackup(full(), new Date('2026-10-22T00:00:00Z'));
  const head = JSON.parse(text);
  assert.equal(head.schema, BACKUP_SCHEMA);
  assert.equal(head.version, BACKUP_VERSION);
  for (const c of COLLECTIONS) assert.ok(c in head, `the file carries ${c}`);
  const p = parseBackup(text);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.deepEqual(p.warnings, []);
  const m = mergeDesk(emptyDesk(), p.data);
  assert.deepEqual(m.next, full());
  assert.deepEqual(m.changed, [...COLLECTIONS]);
});

test('backup: importing the same file twice creates no duplicates and changes nothing the second time', () => {
  const p = parseBackup(serializeBackup(full()));
  assert.ok(p.ok);
  if (!p.ok) return;
  const once = mergeDesk(full(), p.data);
  assert.deepEqual(once.next, full());
  assert.deepEqual(once.changed, []);
  for (const c of COLLECTIONS) assert.equal(once.report[c]?.added, 0, c);
  const twice = mergeDesk(mergeDesk(emptyDesk(), p.data).next, p.data);
  assert.deepEqual(twice.next, full());
  assert.ok(reportLines(twice).every((l) => /skipped/.test(l)));
});

test('backup: merge is a union; the later edit of the same record wins, nothing is lost', () => {
  const mine = full();
  const edited = { ...card, question: 'Edited later', updatedAt: '2026-10-22T09:00:00.000Z' };
  const older = { ...entry, why: 'An older copy of the same entry', updatedAt: undefined };
  const theirs: Partial<DeskState> = { watchlist: ['TCS', 'HDFCBANK'], cards: [edited], journal: [older, { ...entry, id: 'j2' }], conditions: ['tcs:  RSI < 30', 'pe < 20'] };
  const m = mergeDesk(mine, theirs);
  assert.deepEqual(m.next.watchlist, ['TCS', 'INFY', 'M&M', 'HDFCBANK']);
  assert.equal(m.next.cards.length, 1);
  assert.equal(m.next.cards[0].question, 'Edited later');
  assert.equal(m.report.cards?.updated, 1);
  assert.equal(m.next.journal.find((e) => e.id === 'j1')?.why, entry.why, 'an undated copy never overwrites this browser');
  assert.equal(m.next.journal.length, 2);
  assert.deepEqual(m.next.conditions, ['TCS: rsi < 30', 'roce < 15', 'pe < 20'], 'the same condition with other spacing or case is one condition');
  assert.equal(m.next.screens.length, 1, 'a collection the file does not carry is left alone');
  const back = mergeDesk(m.next, { cards: [card] });
  assert.equal(back.next.cards[0].question, 'Edited later', 'an older copy does not undo a later edit');
});

test('backup: malformed JSON, a foreign file and an empty file are refused with a reason', () => {
  for (const bad of ['{not json', '', '[1,2,3]', 'null', JSON.stringify({ schema: 'someone.else', version: 1 })]) {
    const p = parseBackup(bad);
    assert.ok(!p.ok, bad);
    if (!p.ok) assert.ok(p.error.length > 20);
  }
  const v0 = parseBackup(JSON.stringify({ schema: BACKUP_SCHEMA, version: 'one' }));
  assert.ok(!v0.ok && /version/.test(v0.error));
});

test('backup: a file from a newer version is refused, not half-read', () => {
  const p = parseBackup(JSON.stringify({ ...JSON.parse(serializeBackup(full())), version: BACKUP_VERSION + 1 }));
  assert.ok(!p.ok && /newer version/.test(p.error));
  const j = parseBackup(JSON.stringify({ kind: 'alpha-journal', version: 2, entries: [] }));
  assert.ok(!j.ok && /newer version/.test(j.error));
});

test('backup: a file missing collections reads what it has, says what it lacks, and leaves the rest alone', () => {
  const partial = JSON.stringify({ schema: BACKUP_SCHEMA, version: 1, exportedAt: '2026-10-22T00:00:00Z', watchlist: ['RELIANCE'], journal: 'oops' });
  const p = parseBackup(partial);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.deepEqual(Object.keys(p.data), ['watchlist']);
  assert.ok(p.warnings.some((w) => /no research cards, conditions, saved screens, review snapshots/.test(w)), p.warnings.join(' | '));
  assert.ok(p.warnings.some((w) => /Journal entries .* not in the expected shape/.test(w)));
  const m = mergeDesk(full(), p.data);
  assert.deepEqual(m.next, { ...full(), watchlist: [...full().watchlist, 'RELIANCE'] });
});

test('backup: older Alpha exports still import (library, single card, journal file)', () => {
  const lib = parseBackup(serializeLibrary(['TCS'], [card]));
  assert.ok(lib.ok && lib.kind === 'library' && lib.data.cards?.length === 1 && lib.data.watchlist?.[0] === 'TCS' && !('journal' in lib.data));
  const j = parseBackup(serializeJournal([entry, { ...entry, id: '' }]));
  assert.ok(j.ok && j.kind === 'journal' && j.data.journal?.length === 1 && j.warnings.some((w) => /Skipped 1 journal entry/.test(w)));
});

test('backup: imported text is data, never markup', () => {
  const evil = '<img src=x onerror="alert(1)">';
  const text = serializeBackup({ ...emptyDesk(), cards: [{ ...card, question: evil, note: `<script>alert(1)</script>` }], screens: [{ name: evil, conds: [], flags: [], sector: '', tier: '' }], watchlist: ['<b>X</b>', 'TCS'] });
  const p = parseBackup(text);
  assert.ok(p.ok);
  if (!p.ok) return;
  assert.equal(p.data.cards?.[0].question, evil, 'kept as the literal string it was; React renders it as text');
  assert.deepEqual(p.data.watchlist, ['TCS'], 'a symbol that is not a symbol is dropped');
  assert.ok(p.warnings.some((w) => /no valid symbol/.test(w)));
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
  const desk = [...walk('src/components/desk'), 'src/components/CardPanel.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(desk, /dangerouslySetInnerHTML|innerHTML|eval\(|new Function/);
});

test('backup: the reminder appears when nothing was exported or the last export is over 14 days old', () => {
  const now = new Date('2026-10-22T00:00:00Z');
  assert.equal(backupReminder(emptyDesk(), null, now), null, 'nothing saved, nothing to remind');
  assert.equal(backupReminder(full(), null, now), 'never');
  assert.equal(backupReminder(full(), '2026-10-01T00:00:00Z', now), 'stale');
  assert.equal(backupReminder(full(), '2026-10-15T00:00:00Z', now), null);
});
