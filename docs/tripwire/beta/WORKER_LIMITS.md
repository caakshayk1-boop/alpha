# Worker limits, caches and input caps

Applies to `apps/tripwire/worker.js`. Pinned by `apps/tripwire/tests/limits.test.ts` (plus `platform.test.ts` for the security headers).
Paper-only: nothing here touches an investment rule, threshold or formula; every `/api` shape is unchanged except the new 429 and 414 answers.

## What the Worker does and does not do

- **Limits are best-effort.** A counter per route class, client address (`cf-connecting-ip`) and window lives in the Cache API of the data centre that served the request, the same
  mechanism as the older "Refresh now" limit. Each data centre counts separately, a burst can slip a call or two through, and a counter that cannot be read fails open. It is a
  courtesy limit that stops a runaway tab or a careless script, not a security control. The real ceiling is the platform rule below, which is an owner action.
- **No new bindings.** No KV, no Durable Object, no D1, no paid Cloudflare product. `wrangler.tripwire.jsonc` is unchanged.
- **Local development is never limited** (no client address, or a `localhost` / `127.0.0.1` URL), so the browser suites against `wrangler dev` cannot trip it.
- A limited request is answered **before** any upstream call: HTTP **429**, `Retry-After: N`, `Cache-Control: no-store`, body
  `{"ok":false,"error":"too many requests","retryAfter":N}`, and the same HSTS / COOP / nosniff headers as every other response.
- The app turns a 429 into the plain words **"Slow down a moment"** (`src/slowdown.ts`): `getJson` (every one-shot read, charts included), `usePoll` and `useBars` keep the last good
  answer and wait at least Retry-After (clamped 5 to 120 s) before the next look; the 8-second price tick (`src/quotes.ts`) does the same. Nothing is drawn in place of missing data.
- Concurrent callers of the same upstream share one fetch inside an isolate (`coalesce`): chart, bars, spark batches, one-symbol intraday fallback, breadth, live news query and the
  news catch-up. A failure is not remembered. Sharing is per isolate, so it is a saving, not a guarantee.

## Per-client allowances

Per client address, per route class, per 60-second window. "Normal use" figures: the Today poll is one `/api/tick` every 8 s (about 8 a minute, so three tabs is 24); a compare of
three names is three chart reads; browsing companies is a chart read, a news read and a bars read each.

| Class | Routes | Allowance | Normal use |
|---|---|---|---|
| `quote` | `/api/tick`, `/api/intraday`, `/api/pulse`, `/api/macro`, `/api/breadth`, `/api/news/catchup` | 90 / min | about 8 to 24 |
| `history` | `/api/chart`, `/api/bars` | 40 / min | 3 to 10 |
| `news` | `/api/news` (snapshot and live per-name query) | 20 / min | 1 to 5 |
| `file` | `/api/news/version`, `/api/ledger`, `/api/factors`, `/api/rsi` | 60 / min | 1 to 3 (the news poll is once a minute) |
| `health` | `/api/health` | 20 / min | 0 to 1 |
| (older) | `/api/news/version?force=1`, `/api/news?force=1` ("Refresh now") | one per 30 s | unchanged, answers `retry_after` as before |

The allowances are the constant `LIMITS` in `worker.js`; the route table is `ROUTE_CLASS`. A new upstream route must be added to `ROUTE_CLASS` (a test lists every route).

## Route audit

TTL is the shared edge-cache lifetime (`s-maxage` or the Cache API entry); "browser" is `max-age`.

| Route | Upstream | Edge cache before | Edge cache now | Limit before | Limit now | Input cap |
|---|---|---|---|---|---|---|
| `/api/chart?s=` | Yahoo chart (daily, whole history) for the symbol and `^NSEI` | 6 h per symbol (browser 30 min); a 404 or 502 was never cached | 6 h per symbol; **an unknown symbol (404) cached 10 min**; concurrent reads share one fetch | none | `history` 40/min | one symbol, `^[A-Z0-9&-]{1,20}$` |
| `/api/bars?s=` | Yahoo chart (6 months daily, plus 5-minute rebuild of a missing session) per symbol | 5 min per symbol | unchanged; the list is sorted so `B,A` and `A,B` are one entry; concurrent reads share one fetch | none | `history` 40/min | 1 to 30 symbols, list at most 1,400 characters |
| `/api/intraday?s=` | Yahoo spark (20 symbols a call), one-symbol chart as fallback | 6 s per batch | 6 s per batch; pairs sorted before batching so the same set is one entry; batches and fallback coalesced | none | `quote` 90/min | 1 to 30 symbols, at most 1,400 characters |
| `/api/pulse`, `/api/macro` | Yahoo spark, fixed symbol sets | 6 s | unchanged (browser 4 s, edge 6 s) | none | `quote` 90/min | none (no input) |
| `/api/tick?s=&i=&m=` | Yahoo spark | 6 s per batch | same as intraday | none | `quote` 90/min | 0 to 60 symbols, at most 1,400 characters; `i`, `m` are flags |
| `/api/breadth` | Yahoo spark for about 20 to 400 near-line names, plus the published `/data/screen.json` | 60 s | 60 s; concurrent builds coalesced | none | `quote` 90/min | none |
| `/api/news` (snapshot) | raw.githubusercontent.com `tripwire-data` branch | 5 min | unchanged; a reader knowing a newer `v` skips an older copy | only `force=1`, one per 30 s | `news` 20/min, force as before | `v` read as a number |
| `/api/news?q=&sym=` | Google News RSS, then Bing News RSS | 5 min per query | 5 min; key now ignores case and repeated spaces; identical concurrent queries share one run | only `force=1` | `news` 20/min, force as before | `q` 2 to 110 characters from a fixed set, `sym` as a symbol |
| `/api/news/version` | raw.githubusercontent.com | 60 s | unchanged | only `force=1` | `file` 60/min, force as before | none |
| `/api/news/catchup` | Google/Bing News through the news pipeline, only when the snapshot is late and the session is on | 5 min (15 min on success) | unchanged; concurrent runs coalesced | none | `quote` 90/min | none |
| `/api/ledger` | raw.githubusercontent.com | 10 min | unchanged | none | `file` 60/min | none |
| `/api/factors`, `/api/rsi` | raw.githubusercontent.com | 30 min | unchanged | none | `file` 60/min | none |
| `/api/health` | Yahoo chart (`^NSEI`) and the published news status | 60 s | unchanged | none | `health` 20/min | none |
| `/data/*` | static assets (no upstream) | asset layer | unchanged | none | none | none |

For every `/api` route: a query string over 2,000 characters is HTTP 414 `{ok:false,error:'request too long'}`, a bad symbol list is HTTP 400 and never reaches Yahoo, and a non-GET is
HTTP 405 (not counted against the allowance). The limiter runs before validation, so a client sending only bad requests is counted too.

## Platform-level rule (owner action, not done by this change)

The Worker's counters are per data centre and best-effort. For a hard ceiling use Cloudflare's own rate limiting, which is evaluated before the Worker runs. Plan limits (number of rules, allowed periods, block duration) vary and change: check the dashboard for what your plan offers. It is available on the
free plan in a basic form; no code change and no binding is needed.

1. Sign in to the Cloudflare dashboard and choose the account, then the zone that serves the Tripwire hostname (the custom domain on the `tripwire` Worker route).
2. Open **Security**, then **Security rules** (older dashboards: **Security > WAF > Rate limiting rules**). Choose **Create rule**, then **Rate limiting rules**.
3. Name it `tripwire api per client`.
4. **If incoming requests match:** field **URI Path**, operator **starts with**, value `/api/`. (Optionally add `And` **Request Method** equals `GET`.)
5. **With the same characteristics:** choose **IP** (or **IP with NAT support** if offered).
6. **When rate exceeds:** **120** requests per **1 minute** (use the period your plan offers, and scale the count to match). This sits above the Worker's own per-class
   allowances (the busiest class is 90 a minute), so a person never meets it and a script does.
7. **Then take action:** **Block**, **for 1 minute**. Leave the custom response as the default, or choose **Custom response**,
   status `429`, content type `application/json`, body `{"ok":false,"error":"too many requests","retryAfter":60}` so the app shows "Slow down a moment" for a platform block as well.
   (A block that is not JSON still reads as an HTTP error; the app treats any 429 as "Slow down a moment" regardless of body.)
8. **Deploy**. Then check from a terminal: `for i in $(seq 1 140); do curl -s -o /dev/null -w "%{http_code}\n" https://<your-host>/api/health; done | sort | uniq -c`
   should show some `429` at the end, and normal browsing afterwards should work again within a minute.
9. Watch **Security > Events** for the first days; if a real user is ever blocked, raise the rate rather than disabling the rule.

If the plan allows more than one rule, add a second, stricter rule for `/api/chart` and `/api/bars` (for example 60 a minute), since those are the only routes that can fan out to
Yahoo for a symbol the cache has not seen.

## Not done, on purpose

- No shared counters across data centres (that needs KV or a Durable Object, which is excluded here).
- No authentication or API keys: the product has no accounts.
- Coalescing and the unknown-symbol cache do not change what any answer says; a symbol that failed at the source for any reason other than a 404 is still retried on the next request.
