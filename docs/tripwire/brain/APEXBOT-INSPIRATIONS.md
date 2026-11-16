# What Tripwire took from apex-bot (retired 16 Nov 2026)

Apex-bot was a crypto paper bot on Render (`apex-bot-jnuc.onrender.com`). It is retired: it kept dying on the free tier (repeated 404 episodes and out-of-memory restarts), its trading state reset on every restart (`state_store.enabled` was false), and its `/kill`, `/reset` and `/trade` routes were open with no admin PIN set (`admin_pin_set: false`).

**Evidence base, stated plainly.** Its source code was never on this machine. Everything below comes from its public `/health` payload and its public OpenAPI route list, read on 16 Nov 2026. These are patterns, not copied code.

| Apex-bot idea | Where it showed | Tripwire version | Status |
|---|---|---|---|
| 1 One status payload with per-feed age | `/health` `feed_age_s` | Status page, "Each feed, and how old" (reuses `freshness.ts`, so status stays computed from the clock) | Built: `src/statusboard.ts`, `src/screens/status.tsx` |
| 2 Kill switch as a visible state with a reason | `kill_switch`, `kill_reason` | The signals gate, its checks and its holdout reason, on the Status page | Built (read-only; no engine change) |
| 3 Risk view | `GET /risk` | `bookRisk()`: slots, open risk at the first stop, largest name, sector counts against the limit of 4 | Built |
| 4 Alerts feed | `GET /alerts` | `alertsOf()`: stale feeds, missing nights, failed cross-checks, gate, voided picks. Derived on every read, never stored | Built |
| 5 Trade journal | `GET /journal` | The Glass Book timelines | Already shipped, skipped |
| 6 Analytics and back-test | `GET /analytics`, `/backtest` | The Scoreboard and the research pages | Already shipped, skipped |
| 7 Paper flag in every payload | `paper: true` | `data/status.json` carries `paper: true` and the as-of days; the Status page states it | Built for the new file. Existing API response shapes are unchanged on purpose (data contracts) |
| 8 Scanner health | `last_scan_age_s`, `ws_connected` | `nightlyHealth()`: nights recorded, latest night, last write, missing sessions | Built |
| 9 Cross-source detection | the arbitrage scanner (pattern only) | `crossChecks()`: ledger day against screen day, signals day against screen day, held names against the screen | Built |
| 10 Persisted state | `state_store` | Not needed: Tripwire's state is the ledger file | Skipped |

## Not copied, on purpose
Open admin routes. Any state that resets on a restart. Anything that trades.

## Retirement
The Render service `apex-bot-jnuc` is to be deleted by the owner in the Render dashboard. No archive copy of its code exists here because the code was never available to this repository. Environment variables, if any, were never read. Whether any other service runs on the same Render account is unknown to this repository; check the dashboard before closing the account.
