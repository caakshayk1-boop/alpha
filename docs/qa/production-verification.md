# Production verification (Pro §16)

Checked 21 Oct 2026, first against production running `6024d45`, then after each release that day. Headers are now checked from a GitHub runner by `smoke.yml` (`scripts/headers.mjs`), because this repository's build containers cannot reach the site. Method: public, read-only
requests through a fetch service (this container cannot reach the site directly; its proxy refuses the connection), and
the GitHub Actions history. No secret was read or printed. Statuses: PASS / FAIL / BLOCKED / NOT RUN.

| Area | Check | Status | Evidence / remediation |
|---|---|---|---|
| Deployment identity | Production traceable to a tested artifact | PASS | `/build.json` read after each deploy on 21 Oct: `50fd872` (run 39577819612), `f9113bd` (run 39613336066), `7771c32` (run 39615189945), each the merge commit CI passed, 988 companies |
| CI authorisation | Each deploy path validates the exact artifact | PASS (source) | `deploy.yml` on this branch: workflow_run deploys the CI head SHA; schedule and dispatch require code identical to a green-CI commit; rollback refused unless `allow_rollback`. Not yet run in production |
| Domain and TLS | Valid certificate, canonical host | PASS | `https://alpha.askakshay.com/` served; canonical meta `https://alpha.askakshay.com/` |
| Legacy domains | signal / vision / gems redirect | PARTIAL | From a GitHub runner (smoke run 39618131466): signal. and gems. answer 301 to alpha. **vision. answers 200**: it is not routed to this Worker. Owner decision: point it at the Worker (it already redirects `vision.*`) or keep it as its own site. Reported by the smoke check as a warning |
| Static routes | Home, a company, encoded symbol, unknown path | PASS | `/company/?s=TCS` → `/company/TCS/` (canonical, title and description present); `/nope-not-a-page/` answered 404 |
| Security headers | CSP, HSTS, framing, nosniff on HTML, JSON, errors, redirects | PASS after fix | `scripts/headers.mjs`, run from a runner every 6 h by `smoke.yml`. HTML and the 404 page: CSP, HSTS (2 years), X-Frame-Options DENY, nosniff, Referrer-Policy all present. **JSON had no CSP**: fixed (data responses now `default-src 'none'; frame-ancestors 'none'`), confirmed by the next smoke run after deploy |
| Cache behaviour | Immutable only for versioned assets; live data short | PASS in the app, zone setting open | Hashed assets `max-age=31536000, immutable`; HTML `max-age=0, must-revalidate`. **Found: `/api/quotes` reached browsers as `max-age=14400`** although the Worker sends 120: the Cloudflare zone's Browser Cache TTL overrides it. The app now revalidates every data request (`cache: 'no-cache'`), so no reader sees a 4-hour-old copy. Owner: Caching → Configuration → Browser Cache TTL → "Respect existing headers" |
| Data schemas | Required keys, finite numbers, coverage | PASS | `/api/quotes`: `ok: true`, 33 of 33 live, each with price, previous close, day high/low, 52-week range. Build validates the screen (988 rows) before sharding |
| Dependencies | Lockfile, advisories | PARTIAL | `npm audit --omit=dev`, 21 Oct: next 14.2.35 (critical, 20+ advisories) and its postcss 8.4.31 (high). None reaches production: the site is a static export (`output: 'export'`, unoptimised images, no server actions, middleware, rewrites or image optimiser), so every Next.js advisory targets code that is not deployed, and postcss runs only at build time on this repository's own CSS. The fix is Next 16 (breaking): planned as its own PR |
| Secrets and access | Names only, no values in source or bundle | PASS (source) | Secrets referenced by name only (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`); no key in `src/`, `worker/`, `out/` |
| AI operation | Readiness, kill switch, quota | PARTIAL | `/api/explain` GET → `{ok: true, configured: false}` (off, as intended). Kill switch, global quota and model check ship with this branch; exercised only when the key is set |
| Scheduled jobs | Recent runs, idempotence | PASS | engines and deploy runs green on 21 Oct; registry makes reruns idempotent (`test_registry.py` 19/19) |
| Monitoring | Errors, feed age, AI spend | PARTIAL | `smoke.yml` every 6 h; Cloudflare observability on. No alerting to a person, no AI spend dashboard (off) |
| Recovery | Rollback rehearsed | NOT RUN | Procedure in `docs/operations/rollback-runbook.md`; rehearsal needs the Cloudflare account |

## Smallest actions to close the open rows

1. Run the `curl -sI` line above from any machine and paste the output into this file.
2. After the merge deploy: open `/build.json` and confirm `commit` and `companies`.
3. Rehearse one rollback (runbook step 1) on a quiet evening.
