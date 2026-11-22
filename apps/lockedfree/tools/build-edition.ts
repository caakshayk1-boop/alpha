// Writes ONE edition: ledger/editions/<feed price date>.json, from the downloaded feed (feed/), the ledger and the earlier editions. An existing edition is never rewritten (exit 0, nothing changes);
// an out-of-order, malformed or non-session edition is refused (exit 1). Run after tools/fetch-feed.mjs. Usage: node --experimental-strip-types tools/build-edition.ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadFeed } from '../src/lib/feed.ts';
import { ledger, markFn } from '../src/lib/data.ts';
import { buildEdition, checkEdition, type Edition } from '../src/lib/edition.ts';
const dir = join(process.cwd(), 'ledger', 'editions'); mkdirSync(dir, { recursive: true });
const prior = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Edition);
const e = buildEdition({ feed: loadFeed(), ledger: ledger(), mark: markFn(), prior, now: new Date().toISOString() });
if (prior.some((p) => p.date === e.date)) { console.log(`edition for ${e.date} already exists; not rewritten`); process.exit(0); }
const bad = checkEdition(e, prior); if (bad.length) { console.error('EDITION NOT WRITTEN: ' + bad.join('; ')); process.exit(1); }
writeFileSync(join(dir, `${e.date}.json`), JSON.stringify(e) + '\n');
console.log(`edition ${e.date}: ${e.breakouts.listed.length} breakout observations (${e.breakouts.near_misses.length} near misses), ${e.earlier.length} earlier listings tracked, ${e.market.priced} stocks priced`);
