// One-time (ADR-017): give calls entered before the per-engine exit rules their screen's rule. Fills are untouched; only the stop (and so R) is restated, before any call had closed.
import { readFileSync, writeFileSync } from 'node:fs';
import { validate, assertAppendOnly, type Ledger } from '../src/lib/ledger.ts';
import { ruleFor } from '../src/lib/exitrules.ts';
const f = new URL('../ledger/ledger.json', import.meta.url); const L = JSON.parse(readFileSync(f, 'utf8')) as Ledger; const prev = JSON.parse(JSON.stringify(L)) as Ledger;
if (L.picks.some((p) => p.status === 'closed')) { console.error('refusing: a call has already closed, so the rules cannot be restated'); process.exit(1); }
let n = 0; for (const p of L.picks) if ((p.status === 'open') && !p.rule) { p.rule = ruleFor(p.screen_id); p.stop = Math.round(p.fills[0].price * (1 - p.rule.stop_pct / 100) * 100) / 100; n++; }
const bad = [...validate(L), ...assertAppendOnly(prev, L)]; if (bad.length) { console.error(bad); process.exit(1); }
writeFileSync(f, JSON.stringify(L, null, 1) + '\n'); console.log('migrated', n, 'open calls');
