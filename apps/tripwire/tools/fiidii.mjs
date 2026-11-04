// Nightly: fetch NSE's provisional FII/FPI and DII figures and add them to ledger/fiidii.json (a rolling 60-day history, one row per date).
// The endpoint answers only for the newest day, so the history exists because this job runs every night. A fetch that fails, or whose figures do not validate,
// leaves the last good file untouched and exits non-zero so the step is visibly red; the Markets card hides itself once the newest day is too old.
// Usage: node --experimental-strip-types apps/tripwire/tools/fiidii.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mergeFlows, parseNse, validFile } from '../src/fiidii.ts';

const FILE = new URL('../ledger/fiidii.json', import.meta.url);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';
const HOME = 'https://www.nseindia.com/'; const API = 'https://www.nseindia.com/api/fiidiiTradeReact';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce() {
  const home = await fetch(HOME, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(25000) }).catch(() => null);
  const cookie = home?.headers.getSetCookie?.().map((c) => c.split(';')[0]).join('; ') ?? '';
  await wait(1500);
  const r = await fetch(API, { headers: { 'user-agent': UA, accept: 'application/json', referer: 'https://www.nseindia.com/reports/fii-dii', ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`NSE answered ${r.status}`);
  return r.json();
}

let day = null, lastErr = '';
for (let i = 1; i <= 3 && !day; i++) {
  try { day = parseNse(await fetchOnce()); if (!day) lastErr = 'the answer was not the expected FII/DII shape, or its figures did not add up'; }
  catch (e) { lastErr = String(e?.message ?? e); }
  if (!day && i < 3) await wait(4000 * i);
}
if (!day) { console.error(`fiidii: not updated (${lastErr}). The last good file is kept.`); process.exit(1); }
let old = null; if (existsSync(FILE)) { try { const j = JSON.parse(readFileSync(FILE, 'utf8')); old = validFile(j) ? j : null; } catch { old = null; } }
const out = mergeFlows(old, day, new Date().toISOString());
writeFileSync(FILE, JSON.stringify(out, null, 1));
console.log(`fiidii: ${day.date} FII ${day.fii.net} cr, DII ${day.dii.net} cr; ${out.rows.length} day(s) stored`);
