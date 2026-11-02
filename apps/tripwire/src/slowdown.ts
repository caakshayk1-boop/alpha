/** What every reader of the Worker says when it answers HTTP 429 (docs/tripwire/beta/WORKER_LIMITS.md): plain words, no error code, and the screen keeps whatever it already shows. */
export const SLOW_DOWN = 'Slow down a moment';
/** Seconds the Worker asked us to wait (Retry-After, or `retryAfter` in the body), clamped to 5 to 120; null when it did not say. */
export const retryAfterOf = (r: { headers: { get(k: string): string | null } }, body?: { retryAfter?: unknown } | null): number | null => { const n = Number(r.headers.get('retry-after') ?? body?.retryAfter); return Number.isFinite(n) && n > 0 ? Math.min(120, Math.max(5, Math.round(n))) : null; };
