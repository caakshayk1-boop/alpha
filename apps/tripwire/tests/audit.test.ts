// The 10 Nov 2026 audit fixes, as pure logic: the countercase coverage states, the one "Data as of" block, provenance on every research claim, and no off-site identity link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COVERAGE_LIMIT, counterCoverage } from '../src/eligibility.ts';
import { asOfRows, asOfWhy, dayWordY } from '../src/asof.ts';
import { companyRead, evidenceDate } from '../src/research.ts';
import type { Company } from '../src/data.ts';

const noNotes = { notes: [] as string[] };
test('countercase: no flag, not assessed, unavailable and stale are four different findings, and each carries the limit first-class', () => {
  const none = counterCoverage({ stale: false, has_stmts: true }, noNotes, 0, true);
  assert.equal(none.state, 'none'); assert.equal(none.title, 'No screen counterflags detected.'); assert.ok(none.line.startsWith(COVERAGE_LIMIT));
  assert.equal(counterCoverage({ stale: false, has_stmts: true }, { notes: ['margins withheld'] }, 0, true).state, 'not-assessed');
  assert.equal(counterCoverage({ stale: false, has_stmts: false }, noNotes, 0, true).state, 'unavailable');
  assert.equal(counterCoverage({ stale: false, has_stmts: true }, noNotes, 0, false).state, 'unavailable', 'no risk record at all is unavailable, not clean');
  assert.equal(counterCoverage({ stale: true, has_stmts: true }, noNotes, 0, true).state, 'stale');
  assert.equal(counterCoverage({ stale: true, has_stmts: false }, noNotes, 0, true).state, 'unavailable', 'no statements outranks stale');
  const two = counterCoverage({ stale: false, has_stmts: true }, noNotes, 2, true); assert.equal(two.state, 'flagged'); assert.match(two.title, /^2 screen counterflags/);
  const titles = new Set(['none', 'not-assessed', 'unavailable', 'stale'].map((s) => s)); assert.equal(titles.size, 4);
  for (const c of [none, two]) assert.ok(!/no risk|safe|clean bill/i.test(c.title + c.line), 'never reassuring');
});

test('data as of: five rows in a fixed order, each labelled, missing dates said as unavailable', () => {
  const now = Date.parse('2026-11-10T06:00:00Z');
  const rows = asOfRows({ quote: { word: 'Last traded', t: Date.parse('2026-11-09T09:55:00Z') / 1000 }, screenClose: '2026-11-06', chartThrough: Date.parse('2026-11-09T10:00:00Z') / 1000, fy: 'FY26', nowMs: now });
  assert.deepEqual(rows.map((r) => r.k), ['Quote', 'Screen metrics', 'Chart', 'Accounts', 'Filing']);
  assert.equal(rows[0].v, 'Last traded · Mon 9 Nov 15:25 IST');
  assert.equal(rows[1].v, 'Close of Fri 6 Nov'); assert.equal(rows[2].v, 'Through Mon 9 Nov'); assert.equal(rows[3].v, 'Financial year FY26');
  assert.equal(rows[4].v, 'Publication date unavailable'); assert.equal(rows[4].missing, true);
  const bare = asOfRows({ quote: null, screenClose: null, chartThrough: null, fy: null, nowMs: now });
  assert.ok(bare.every((r) => r.missing)); assert.match(bare[2].v, /unavailable/); assert.match(bare[3].v, /unavailable/);
  assert.equal(asOfRows({ quote: null, screenClose: '2026-11-06', chartThrough: undefined, fy: 'FY26', nowMs: now })[2].v, 'Loading');
  assert.match(asOfWhy({ quote: null, screenClose: '2026-11-06', chartThrough: null, fy: 'FY26' }), /shown as unavailable rather than guessed/);
});

test('data as of: a date from another year names the year (Fri 6 Nov is recent; 20 Mar 2022 is not)', () => {
  const now = Date.parse('2026-11-10T06:00:00Z');
  assert.equal(dayWordY('2026-11-06', now), 'Fri 6 Nov'); assert.equal(dayWordY('2022-03-20', now), 'Sun 20 Mar 2022');
});

test('provenance: every statement-based research claim says its publication date is not held, and keeps its snapshot build date without claiming a retrieval time', () => {
  const c = { sym: 'TCS', built_on: '2026-11-07', row: { sym: 'TCS', name: 'TCS', rev_cagr: 5.8, roce_med: 66.6, pe: 17.5, pe_pctile: 72.2, fy: 'FY26', last_date: '2026-11-06', sector: 'Technology', tier: 'large' }, years: [], swot: null, risk: null, inst: null } as unknown as Company;
  const facts = companyRead(c); assert.ok(facts.length >= 2);
  for (const f of facts) { assert.equal(f.published, null); assert.equal(f.snapshotBuilt, '2026-11-07'); }
  assert.ok(facts.filter((f) => f.statement).every((f) => /Filing publication date: unavailable/.test(f.period)));
  assert.equal(facts.find((f) => f.id === 'pe')!.statement, false, 'a price figure is not a filing claim');
  assert.match(evidenceDate(c.row, 'roce'), /Accounts: FY26\. Snapshot close: 2026-11-06\. Filing publication date: unavailable\./);
});

test('no link to askakshay.com: the footer and the legal page link nowhere outside Tripwire', () => {
  for (const f of ['../src/capture.ts', '../src/screens/capture.tsx', '../src/screens/legal.tsx', '../static/index.html']) {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8'); assert.ok(!/https?:\/\/(www\.)?askakshay\.com/.test(t), `${f} links askakshay.com`);
  }
});
