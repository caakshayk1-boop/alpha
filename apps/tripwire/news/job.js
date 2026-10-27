// One run of the scheduled job, with every effect injected: `fetchImpl` (the network, or recorded fixtures), `nowMs`, `sleep`, `random`. Returns the files to publish and a one-line account.
// A source being down is a result, not an error: this function does not throw for it, and neither does the CLI.
import { FEEDS } from './config.js';
import { buildRegistry } from './entities.js';
import { parseFeed as feedFromText } from './feed.js';
import { breakerAllow, breakerRecord, breakerState, fetchPolicy, POLICY } from './fetcher.js';
import { buildNames, queryPlan } from './plan.js';
import { runPipeline } from './pipeline.js';
import { shouldRun } from './schedule.js';
import { assemble, forBrowser } from './snapshot.js';


export async function runJob({ nowMs, startedMs = nowMs, fetchImpl, prev = null, inputs, force = false, sleep, random, policy = POLICY, concurrency = 4 }) {
  const lastAttempt = prev?.checkedAt ? Date.parse(prev.checkedAt) : NaN;
  const go = shouldRun({ nowMs, lastAttemptMs: lastAttempt, force }); if (!go.run) return { skipped: true, why: go.why };
  const names = buildNames(inputs); const registry = buildRegistry(names.entities);
  const plan = queryPlan({ names, tick: Math.floor(nowMs / (15 * 60000)) });
  const prevBreak = Object.fromEntries((prev?.sources ?? []).map((s) => [s.id, s.breaker ?? {}])); const prevVal = prev?.sourceValidators ?? {};
  const stat = {}; const ensure = (f) => (stat[f.id] ??= { id: f.id, label: f.label, queries: 0, ok: 0, failed: 0, skipped: 0, notModified: 0, httpStatus: null, error: null, accepted: 0, validators: { ...(prevVal[f.id] ?? {}) }, breaker: prevBreak[f.id] ?? {} });
  const batches = []; const attempted = new Set();
  const doOne = async (step, feed, useUrl) => {
    const s = ensure(feed); s.queries++;
    if (!breakerAllow(s.breaker, nowMs)) { s.skipped++; s.error = s.error ?? `circuit open until ${new Date(s.breaker.openUntil).toISOString().slice(11, 16)} UTC`; return false; }
    attempted.add(feed.id);
    const url = useUrl; const r = await fetchPolicy({ url, fetchImpl, validators: s.validators[url] ?? {}, nowMs, sleep, random, policy });
    if (r.status === 'failed') { s.failed++; s.httpStatus = r.httpStatus; s.error = r.error; s.lastRetryAfterMs = r.retryAfterMs; return false; }
    s.ok += r.status === 'ok' ? 1 : 0; s.notModified += r.status === 'not_modified' ? 1 : 0; s.httpStatus = r.httpStatus;
    if (r.etag || r.lastModified) s.validators[url] = { etag: r.etag, lastModified: r.lastModified };
    if (r.status === 'ok') batches.push({ feed, rawItems: feedFromText(r.text), fetchedAt: new Date(nowMs).toISOString(), query: step.query, scope: step.scope });
    return true;
  };
  const queue = plan.slice(); const bingBackup = [];
  const worker = async () => { while (queue.length) { const step = queue.shift(); const feed = FEEDS[step.feed]; const ok = await doOne(step, feed, feed.url(step.query)); if (!ok && step.feed === 'google') bingBackup.push(step); } };
  await Promise.all(Array.from({ length: concurrency }, worker));
  for (const step of bingBackup) { const feed = FEEDS.bing; await doOne(step, feed, feed.url(step.query)); }   // Bing only for what Google would not give
  for (const s of Object.values(stat)) {
    const tried = s.ok + s.notModified + s.failed; const ok = s.ok + s.notModified > 0; if (tried) s.breaker = breakerRecord(s.breaker, ok, nowMs, { retryAfterMs: s.lastRetryAfterMs, error: s.error });
    s.status = s.skipped && !tried ? 'open' : !tried ? 'standby' : s.failed === 0 ? 'ok' : ok ? 'partial' : 'failed'; delete s.lastRetryAfterMs; s.breakerState = breakerState(s.breaker, nowMs);
  }
  for (const f of Object.values(FEEDS)) ensure(f);                                    // every configured feed appears, used or not
  const sources = Object.values(stat).map((s) => (s.queries === 0 ? { ...s, status: 'standby' } : s));
  const prevItems = (prev?.events ?? []).flatMap((e) => e.items ?? []);
  const result = batches.length ? runPipeline({ batches, registry, prevItems, nowMs, paperSyms: names.paper }) : (prevItems.length ? null : { events: [], items: [], rejections: {}, counts: { seen: 0, admitted: 0, events: 0, rejected: 0 } });
  const answered = sources.some((s) => s.ok + s.notModified > 0);
  const merged = answered && !batches.length ? runPipeline({ batches: [], registry, prevItems, nowMs, paperSyms: names.paper }) : result;   // every answer was "not modified": re-judge what we hold
  const completedMs = nowMs + 0;
  const { snapshot, status } = assemble({ prev, result: merged, sources, scheduledMs: Math.floor(nowMs / 60000) * 60000, startedMs, completedMs, names: names.names, covered: names.covered, paper: names.paper, unresolved: names.unresolved });
  return { skipped: false, snapshot, status, browser: forBrowser(snapshot), account: `${snapshot.status}: ${snapshot.events.length} events, ${Object.values(snapshot.rejections).reduce((a, b) => a + b, 0)} rejected, version ${snapshot.snapshotVersion}, ${plan.length} planned requests` };
}
