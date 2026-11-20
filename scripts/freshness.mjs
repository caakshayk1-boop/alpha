// freshness.mjs: is the data the hub serves current? Fails (exit 1) when a feed is behind the newest finished NSE session.
// Why it exists (20 Nov 2026): the jobs in trading-dashboard that build the hub's feeds were switched off on 19 Nov and nothing noticed for two days; the uptime probe only checks that a feed
// EXISTS. This one checks its date against the exchange calendar (apps/tripwire/src/calendar.ts: holidays are known, so a market holiday is not a false alarm).
// Usage: node --experimental-strip-types scripts/freshness.mjs [hub-url]
import { lastFinishedSession, sessionsBetween } from '../apps/tripwire/src/calendar.ts';

const day = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
/** file: the hub path; read: the session date inside it; allow: sessions it may trail the newest finished session before it counts as stale.
 *  The screen must be current. Barometer and regime are built from the previous session's bars (observed 18 Nov 2026: generated that evening, dated 17 Nov), so they get one session of allowance. */
export const CHECKS = [
  { name: 'screen', file: 'screen.json', read: (j) => day(j?.price_date), allow: 0, job: 'Stock Screen (trading-dashboard/.github/workflows/stock_screen.yml)' },
  { name: 'regime', file: 'regime.json', read: (j) => day(j?.today?.date), allow: 1, job: 'Regime (regime.yml)' },
  { name: 'barometer', file: 'barometer.json', read: (j) => day(j?.today?.nifty_date), allow: 1, job: 'Barometer (barometer.yml)' },
];
/** feeds: { name: parsed JSON | null }. Returns one row per check; a feed that is missing or carries no readable date is stale, never assumed fine. */
export function evaluate(feeds, nowMs = Date.now()) {
  const newest = lastFinishedSession(nowMs);
  return CHECKS.map((c) => {
    const date = feeds[c.name] ? c.read(feeds[c.name]) : null;
    const behind = date == null ? null : date >= newest ? 0 : sessionsBetween(date, newest);
    return { name: c.name, job: c.job, date, newest, behind, allow: c.allow, ok: behind != null && behind <= c.allow };
  });
}
export const describe = (r) => `${r.ok ? 'OK   ' : 'STALE'} ${r.name}: ${r.date ?? 'no readable date'}; newest finished session ${r.newest}${r.behind == null ? '' : `; ${r.behind} session${r.behind === 1 ? '' : 's'} behind (allowed ${r.allow})`}${r.ok ? '' : `. Produced by: ${r.job}`}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = (process.argv[2] ?? process.env.HUB ?? 'https://alpha.askakshay.com').replace(/\/$/, '');
  const feeds = {};
  for (const c of CHECKS) {
    try { const r = await fetch(`${base}/data/${c.file}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(60000) }); feeds[c.name] = r.ok ? await r.json() : null; } catch { feeds[c.name] = null; }
  }
  const rows = evaluate(feeds);
  console.log(rows.map(describe).join('\n'));
  if (rows.some((r) => !r.ok)) { console.error('\nFAIL: the hub is serving data that is behind the newest finished session.'); process.exit(1); }
  console.log('\nfreshness ok');
}
