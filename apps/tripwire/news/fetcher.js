// Polite fetching for the scheduled job: a timeout, conditional requests (ETag / If-Modified-Since), bounded exponential backoff with jitter, Retry-After honoured, and a per-source circuit breaker
// whose state is carried in the published snapshot. `fetchImpl`, `sleep` and `random` are injected so the tests run it without a network or a clock.

export const POLICY = { timeoutMs: 10000, retries: 2, baseDelayMs: 800, maxWaitMs: 15000, breakerAfter: 3, breakerOpenMin: 30 };

/** A Retry-After header (seconds or an HTTP date) in milliseconds, or null. */
export function retryAfterMs(h, nowMs) {
  if (h == null || h === '') return null; const n = Number(h); if (Number.isFinite(n)) return Math.max(0, n * 1000);
  const d = Date.parse(h); return Number.isFinite(d) ? Math.max(0, d - nowMs) : null;
}
/** The wait before retry number `attempt` (0-based): base x 2^attempt, scaled by 0.5 to 1.5 of jitter, never above maxWaitMs. */
export const backoffMs = (attempt, random, p = POLICY) => Math.min(p.maxWaitMs, Math.round(p.baseDelayMs * 2 ** attempt * (0.5 + random())));

/** One URL under the policy. `validators` is `{ etag, lastModified }` from the last success. Result: { status: 'ok' | 'not_modified' | 'failed', httpStatus, text, etag, lastModified, attempts, error, retryAfterMs }. Never throws. */
export async function fetchPolicy({ url, fetchImpl, validators = {}, nowMs, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), random = Math.random, policy = POLICY, headers = {} }) {
  let last = { status: 'failed', httpStatus: null, error: 'not attempted', retryAfterMs: null }; let attempts = 0;
  for (let i = 0; i <= policy.retries; i++) {
    attempts++;
    try {
      const h = { 'User-Agent': 'TripwireNewsJob/1 (+https://tripwire.askakshay.com; paper-only research)', Accept: 'application/rss+xml,application/atom+xml,text/xml,*/*;q=0.5', ...headers };
      if (validators.etag) h['If-None-Match'] = validators.etag; if (validators.lastModified) h['If-Modified-Since'] = validators.lastModified;
      const r = await fetchImpl(url, { headers: h, signal: AbortSignal.timeout(policy.timeoutMs) });
      if (r.status === 304) return { status: 'not_modified', httpStatus: 304, text: '', etag: validators.etag ?? null, lastModified: validators.lastModified ?? null, attempts, error: null, retryAfterMs: null };
      if (r.ok) return { status: 'ok', httpStatus: r.status, text: await r.text(), etag: r.headers.get('etag'), lastModified: r.headers.get('last-modified'), attempts, error: null, retryAfterMs: null };
      const ra = retryAfterMs(r.headers.get('retry-after'), nowMs); last = { status: 'failed', httpStatus: r.status, error: `HTTP ${r.status}`, retryAfterMs: ra };
      if (![408, 425, 429, 500, 502, 503, 504].includes(r.status)) break;                 // a 404 or 403 will not change on retry
      if (ra != null && ra > policy.maxWaitMs) break;                                       // told to wait longer than this run may: stop, and let the breaker carry it
      if (i < policy.retries) await sleep(ra != null ? ra : backoffMs(i, random, policy));
    } catch (e) {
      last = { status: 'failed', httpStatus: null, error: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : String(e?.message ?? e).slice(0, 80), retryAfterMs: null };
      if (i < policy.retries) await sleep(backoffMs(i, random, policy));
    }
  }
  return { ...last, text: '', etag: null, lastModified: null, attempts };
}

/** Circuit breaker state per source: { failures, openUntil (ms or null), lastError }. `allow` says whether to try; an open breaker lets one probe through once its time has passed (half-open). */
export const breakerAllow = (b, nowMs) => !b?.openUntil || nowMs >= b.openUntil;
export function breakerRecord(b = {}, ok, nowMs, { retryAfterMs: ra = null, error = null, policy = POLICY } = {}) {
  if (ok) return { failures: 0, openUntil: null, lastError: null };
  const failures = (b.failures ?? 0) + 1; let openUntil = failures >= policy.breakerAfter ? nowMs + policy.breakerOpenMin * 60000 : null;
  if (ra != null && ra > 0) openUntil = Math.max(openUntil ?? 0, nowMs + ra);
  return { failures, openUntil, lastError: error };
}
export const breakerState = (b, nowMs) => (!b?.openUntil ? 'closed' : nowMs >= b.openUntil ? 'half-open' : 'open');
