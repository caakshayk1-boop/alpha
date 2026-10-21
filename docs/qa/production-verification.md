# Production verification (Pro §16)

Checked 21 Oct 2026, against production running commit `6024d45` (before this branch). Method: public, read-only
requests through a fetch service (this container cannot reach the site directly; its proxy refuses the connection), and
the GitHub Actions history. No secret was read or printed. Statuses: PASS / FAIL / BLOCKED / NOT RUN.

| Area | Check | Status | Evidence / remediation |
|---|---|---|---|
| Deployment identity | Production traceable to a tested artifact | PARTIAL | CI run 39553512267 green on `6024d45`, deploy run 39553690775 green (workflow_run path). `/build.json` (commit, run, data hashes) ships with this branch; check it after the first deploy |
| CI authorisation | Each deploy path validates the exact artifact | PASS (source) | `deploy.yml` on this branch: workflow_run deploys the CI head SHA; schedule and dispatch require code identical to a green-CI commit; rollback refused unless `allow_rollback`. Not yet run in production |
| Domain and TLS | Valid certificate, canonical host | PASS | `https://alpha.askakshay.com/` served; canonical meta `https://alpha.askakshay.com/` |
| Legacy domains | signal / vision / gems redirect | PARTIAL | `signal.askakshay.com/` → `alpha.askakshay.com/` observed. vision. and gems. NOT RUN |
| Static routes | Home, a company, encoded symbol, unknown path | PASS | `/company/?s=TCS` → `/company/TCS/` (canonical, title and description present); `/nope-not-a-page/` answered 404 |
| Security headers | CSP, HSTS, framing, nosniff on HTML, JSON, errors, redirects | NOT RUN | The fetch service returns bodies, not headers. Owner: `curl -sI https://alpha.askakshay.com/ /api/quotes /nope/ /company/?s=TCS` and compare with `public/_headers` and `withHeaders()` |
| Cache behaviour | Immutable only for versioned assets; live data short | PARTIAL (source) | `_headers`: `/_next/static/*` immutable; API responses 60–900 s by endpoint. Live headers NOT RUN (as above) |
| Data schemas | Required keys, finite numbers, coverage | PASS | `/api/quotes`: `ok: true`, 33 of 33 live, each with price, previous close, day high/low, 52-week range. Build validates the screen (988 rows) before sharding |
| Dependencies | Lockfile, advisories | NOT RUN | `npm audit --omit=dev` to be run in CI with network; not run here |
| Secrets and access | Names only, no values in source or bundle | PASS (source) | Secrets referenced by name only (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`); no key in `src/`, `worker/`, `out/` |
| AI operation | Readiness, kill switch, quota | PARTIAL | `/api/explain` GET → `{ok: true, configured: false}` (off, as intended). Kill switch, global quota and model check ship with this branch; exercised only when the key is set |
| Scheduled jobs | Recent runs, idempotence | PASS | engines and deploy runs green on 21 Oct; registry makes reruns idempotent (`test_registry.py` 19/19) |
| Monitoring | Errors, feed age, AI spend | PARTIAL | `smoke.yml` every 6 h; Cloudflare observability on. No alerting to a person, no AI spend dashboard (off) |
| Recovery | Rollback rehearsed | NOT RUN | Procedure in `docs/operations/rollback-runbook.md`; rehearsal needs the Cloudflare account |

## Smallest actions to close the open rows

1. Run the `curl -sI` line above from any machine and paste the output into this file.
2. After the merge deploy: open `/build.json` and confirm `commit` and `companies`.
3. Rehearse one rollback (runbook step 1) on a quiet evening.
