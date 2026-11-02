// Last-backup status (recorded when an export is created, guarded against blocked storage), the Operations health summary, and the "Settings" naming.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BACKUP_KEY, backupStatus, readBackup, recordBackup } from '../src/backupstatus.ts';
import { SERVICES, serviceSummary, type Evidence } from '../src/services.ts';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); } };
const NOW = Date.parse('2026-11-01T10:00:00Z');

test('backup status: nothing recorded says so, in the words the page uses', () => {
  const s = backupStatus(readBackup(mem()), NOW); assert.equal(s.recorded, false); assert.equal(s.headline, 'No backup recorded on this device');
  assert.match(s.note, /another device|before this note/);
});
test('backup status: a recorded export reads back with its file name and time, and the note does not claim the file was kept', () => {
  const m = mem(); assert.equal(recordBackup(m, 'tripwire-backup-2026-11-01.json', new Date(NOW - 3 * 86400e3)), true);
  const rec = readBackup(m)!; assert.equal(rec.file, 'tripwire-backup-2026-11-01.json'); const s = backupStatus(rec, NOW);
  assert.equal(s.recorded, true); assert.equal(s.headline, 'Last backup file created 3 days ago'); assert.match(s.note, /does not report whether you kept the file/); assert.match(s.note, /2026-10-29 15:30 IST/);
  assert.equal(backupStatus(rec, NOW - 3 * 86400e3 + 30e3).headline, 'Last backup file created just now');
  assert.equal(backupStatus(readBackup(m), NOW - 3 * 86400e3 + 5 * 3600e3).headline, 'Last backup file created 5 hours ago');
});
test('backup status: blocked or full storage records nothing and never throws; the page then says no backup is recorded', () => {
  assert.equal(recordBackup(blocked, 'x.json'), false); assert.equal(readBackup(blocked), null); assert.equal(recordBackup(null, 'x.json'), false); assert.equal(readBackup(undefined), null);
  assert.equal(backupStatus(readBackup(blocked), NOW).headline, 'No backup recorded on this device');
  const silent = { getItem: () => null, setItem: () => {} }; assert.equal(recordBackup(silent, 'x.json'), false, 'a write that does not read back is not a record');
});
test('backup status: a damaged or foreign value is ignored, not trusted', () => {
  for (const bad of ['', 'null', '{', '{"at":"yesterday","file":"x"}', '{"at":"2026-11-01T00:00:00Z"}', '[]', '{"at":5,"file":"x"}']) { const m = mem(); m.m.set(BACKUP_KEY, bad); assert.equal(readBackup(m), null, bad); }
});
test('backup status: the record is outside the saved state, so it is not in a backup file and an import cannot change it', () => {
  assert.notEqual(BACKUP_KEY, 'tripwire:v1'); assert.ok(BACKUP_KEY.startsWith('tripwire:v1:'));
  const store = readFileSync(new URL('../src/store.ts', import.meta.url), 'utf8'); assert.ok(!store.includes('lastbackup'), 'store.ts (the backup format) does not know about the record');
});

const ev = (o: Partial<Evidence> = {}): Evidence => ({ nowMs: NOW, health: null, healthErr: false, news: null, screenAsOf: null, ledgerUpdated: null, storageOk: null, lockSupported: null, ...o });
test('service summary: counts only the checked services; unverified is its own number; not built is not a fault', () => {
  const none = serviceSummary(SERVICES, ev()); assert.equal(none.fine, 0); assert.equal(none.attention.length, 0); assert.equal(none.unverified, none.checked); assert.match(none.headline, /0 of \d+ checked services are fine; \d+ not verified yet/);
  assert.ok(none.notBuilt >= 1 && none.notSetUp >= 1); assert.match(none.detail, /not counted as faults/);
  const bad = serviceSummary(SERVICES, ev({ storageOk: false })); assert.deepEqual(bad.attention, ['Saving on this device']); assert.match(bad.headline, /1 of \d+ checked services need attention: Saving on this device\./);
  const good = serviceSummary(SERVICES, ev({ storageOk: true })); assert.equal(good.fine, 1); assert.equal(good.attention.length, 0);
  assert.ok(!SERVICES.filter((v) => v.id === 'lock').length || !serviceSummary(SERVICES, ev({ lockSupported: false })).attention.includes('Screen lock'), 'a phone without device unlock is not a service fault');
});

test('naming: Settings is the word on the settings screen; #/profile stays as an alias; no screen text calls it Profile', () => {
  const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const app = src('app.tsx'); assert.match(app, /head === 'settings' \|\| head === 'profile'/); assert.match(app, /settings: 'Settings', profile: 'Settings'/);
  assert.match(src('screens/More.tsx'), /href: '#\/settings', title: 'Settings'/);
  const words = /(^|[^a-zA-Z/#.'])Profile( and| in| page| screen|\b)/;   // user-visible prose only
  for (const f of ['screens/settings.tsx', 'screens/ops.tsx', 'screens/Help.tsx', 'screens/More.tsx', 'sheets.tsx', 'screens/Methodology.tsx', 'screens/Data.tsx']) {
    const lines = src(f).split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.includes('#/profile') && !l.includes('Profile()')); assert.ok(!lines.some((l) => words.test(l.replace(/\/\*.*?\*\//g, ''))), `${f} says Profile`);
  }
  assert.ok(readdirSync(new URL('../src/screens/', import.meta.url)).includes('settings.tsx')); assert.ok(!readdirSync(new URL('../src/screens/', import.meta.url)).includes('profile.tsx'));
});
