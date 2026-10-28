// The scheduler nudge: a Cloudflare cron trigger asks GitHub to start the news workflow, because GitHub's own cron starts hours late (docs/tripwire/launch/RELIABILITY.md).
//
// INERT until the owner sets the Worker secret GITHUB_DISPATCH_TOKEN (a fine-grained token limited to this repository with "Actions: read and write"). With no token this does nothing and says so; it never
// pretends. With a token it sends a workflow_dispatch with force=false, so the job's own cadence guard (schedule.js shouldRun) still decides whether to do any work, and a nudge that arrives early is a no-op.
// Pure apart from the injected `fetchImpl`.
import { shouldRun } from './schedule.js';

export const DISPATCH_URL = 'https://api.github.com/repos/caakshayk1-boop/alpha/actions/workflows/tripwire_news.yml/dispatches';
/** One tick. `status` is the published status document (or null). Returns { sent, why }. */
export async function nudge({ env, nowMs, fetchImpl, status = null }) {
  if (!env?.GITHUB_DISPATCH_TOKEN) return { sent: false, why: 'no token is configured, so nothing is sent' };
  const last = status?.checkedAt ? Date.parse(status.checkedAt) : NaN;
  const go = shouldRun({ nowMs, lastAttemptMs: last, force: false }); if (!go.run) return { sent: false, why: go.why };
  try {
    const r = await fetchImpl(DISPATCH_URL, { method: 'POST', headers: { Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'tripwire-worker' },
      body: JSON.stringify({ ref: 'main', inputs: { force: 'false' } }), signal: AbortSignal.timeout(8000) });
    return r.status === 204 ? { sent: true, why: 'dispatched' } : { sent: false, why: `GitHub answered ${r.status}` };
  } catch { return { sent: false, why: 'GitHub did not answer' }; }
}
