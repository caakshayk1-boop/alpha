// Assemble the published files from a run. The rules that keep the page honest live here:
//   * lastSuccessfulAt moves ONLY when at least one source answered (ok or partial). A total failure keeps the previous snapshot's events and its lastSuccessfulAt and says so (status 'failed').
//   * snapshotVersion moves only when the events changed, so a reader's "N new updates" is not triggered by a clock tick.
//   * nothing is cleared: a failed run publishes the last good events again, labelled.
import { PIPELINE_VERSION, QUERY_SCHEMA, RANKING_VERSION, SCHEMA, STATUS_SCHEMA } from './config.js';
import { hash } from './urls.js';
import { cadenceMin, nextCheckMs } from './schedule.js';

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
/** Everything a reader can see of an event, minus what changes with the clock (the time-decayed score, rank factors and rank reason) or with the fetch (fetchedAt, a summary's retrieval time). A change to any of the rest advances the version. */
const visible = ({ relevanceScore: _s, factors: _f, rank: _r, fetchedAt: _t, items: _i, members: _m, summary, ...e }) => ({ ...e, summary: summary?.text ?? summary ?? null });
export const contentHash = (events) => hash(JSON.stringify(events.map(visible).sort((a, b) => (a.eventClusterId < b.eventClusterId ? -1 : 1))));

/** `sources`: [{ id, label, queries, ok, failed, skipped, notModified, httpStatus, error, breaker, validators, accepted }]. `result`: the pipeline's output or null when nothing was fetched. */
export function assemble({ prev = null, result, sources, scheduledMs, startedMs, completedMs, names = {}, covered = [], paper = [], unresolved = [], note = null }) {
  const answered = sources.reduce((n, s) => n + (s.ok ?? 0) + (s.notModified ?? 0), 0); const total = sources.reduce((n, s) => n + (s.queries ?? 0), 0);
  const failedFeeds = sources.reduce((n, s) => n + (s.failed ?? 0) + (s.skipped ?? 0), 0);
  const status = answered === 0 ? 'failed' : failedFeeds > 0 ? 'partial' : 'ok';
  const kept = status === 'failed';
  const events = kept ? prev?.events ?? [] : result.events;
  const version = kept ? prev?.snapshotVersion ?? 0 : (prev && prev.contentHash === contentHash(events) ? prev.snapshotVersion : (prev?.snapshotVersion ?? 0) + 1);
  const lastSuccessfulAt = kept ? prev?.lastSuccessfulAt ?? null : iso(completedMs);
  const firstError = sources.map((s) => s.error).find(Boolean) ?? null;
  const snapshot = {
    schema: SCHEMA, snapshotVersion: version, contentHash: kept ? prev?.contentHash ?? contentHash(events) : contentHash(events), pipelineVersion: PIPELINE_VERSION, rankingVersion: RANKING_VERSION,
    scheduledAt: iso(scheduledMs), startedAt: iso(startedMs), completedAt: iso(completedMs), checkedAt: iso(completedMs), lastSuccessfulAt, nextScheduledAt: iso(nextCheckMs(completedMs)), cadenceMin: cadenceMin(completedMs),
    status, lastError: kept ? firstError ?? 'no source answered' : status === 'partial' ? firstError : null,
    sources: sources.map(({ validators, ...s }) => ({ ...s, validatorCount: Object.keys(validators ?? {}).length })), sourceValidators: Object.fromEntries(sources.map((s) => [s.id, s.validators ?? {}])),
    coverage: { feeds: total, answered, failed: failedFeeds, unresolvedNames: unresolved, note },
    rejections: kept ? prev?.rejections ?? {} : result.rejections, counts: kept ? prev?.counts ?? null : result.counts,
    scopes: { market: 'India-wide events with no single company', paper, covered }, names, events,
  };
  return { snapshot, status: statusOf(snapshot) };
}
/** The tiny file the browser polls. Everything the health model needs and nothing else. */
export function statusOf(s) {
  return { schema: STATUS_SCHEMA, snapshotVersion: s.snapshotVersion, status: s.status, checkedAt: s.checkedAt, lastSuccessfulAt: s.lastSuccessfulAt, nextScheduledAt: s.nextScheduledAt, cadenceMin: s.cadenceMin,
    sourcesTotal: s.sources.length, sourcesFailed: s.sources.filter((x) => x.status === 'failed' || x.status === 'open' || x.status === 'partial').length, lastError: s.lastError, eventCount: s.events.length, rankingVersion: s.rankingVersion, pipelineVersion: s.pipelineVersion };
}
/** The browser's copy: events without their member items, no validators, no raw counts it never reads. */
export function forBrowser(s) {
  const { sourceValidators: _v, contentHash: _h, ...rest } = s;
  return { ...rest, events: s.events.map(({ items: _i, ...e }) => e) };
}
export { QUERY_SCHEMA };
