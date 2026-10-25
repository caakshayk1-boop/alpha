# ARCHITECTURE: Alpha signal engines

Status as of 25 Oct 2026. Rules v1.0.0 (E7 v1.1.0) are frozen; this document describes the implementation, `engines-v3` impl 1.0.2.
Nothing here is live in the sense of delivering alerts: **alerts are off and there is no sender**. The records are research and paper only.

## The pipeline, and where each stage lives

```
provider adapter ─► raw observations ─► quality checks ─► normalised data ─► market context ─► engines ─► portfolio ─► paper ledger ─► publication gate ─► site
 nightly.fetch      run.complete_sessions   engines.clean_mask   data.py          regime.py      setups.py     portfolio.py  ledger.py       publish.py        enginesV3.ts
 (yfinance)         (completed bars only)   (jumps, suspensions) (adjustment)     (regime-1.0.0)  engines.py    (limits)      (hash chain)    (fail closed)     EnginesV3.tsx
```

| Stage | Module | What it guarantees |
|---|---|---|
| Provider adapter | `v3/nightly.py::fetch`, `data.py`, `sessions.py` | Daily bars from Yahoo via yfinance; a finished session Yahoo's daily series lacks is rebuilt from hourly bars only when the 15:15 IST bar exists |
| Completed sessions | `v3/run.py::complete_sessions` | No bar dated today in IST before 18:00 is read as a close |
| Quality | `v3/engines.py::clean_mask`, nightly completeness check | A symbol with a missing price, High < Low, an unexplained overnight move beyond 40% (and the 3 bars after) or a return from a gap over 8 days is not traded. The run records nothing unless at least 95% of the universe has the newest session's bar |
| Provenance | `v3/provenance.py` | Every record carries source, exchange, currency, session, observation and ingestion time, adjustment policy, dataset version |
| Market context | `v3/regime.py`, `configs/engines/regime.yaml` | `trend_up / trend_down / range / stress / unknown`; completed sessions only; any missing input is `unknown` |
| Engines | `v3/setups.py`, `v3/engines.py`, `configs/engines/E1–E7.yaml` | Separately versioned, frozen. Each decides its own regime compatibility (no universal bullish gate) |
| Execution | `v3/execsim.py`, `v3/costs.py` | Next-session open; gap-through stops fill at the open; stop-first on an ambiguous bar; trails take effect next session; initial R kept through partials; itemised costs |
| Portfolio | `v3/portfolio.py` | 0.25% risk per position, 1.5% total open risk, six positions, 25% per sector, no leverage, one position per symbol |
| Ledger | `v3/ledger.py` | Append-only, each line carries the hash of the one before; a duplicate id is a no-op |
| Publication gate | `v3/publish.py` | Frozen-rule hashes must verify; a state is bound to (rules version, evidence hash) or it is RESEARCH; a record without complete provenance is refused; alerts off |
| Jobs | `v3/jobs.py` | Key = exchange / session / engine versions / dataset version; lock with a stale-lock timeout; bounded retries with back-off; health check; JSON logs |
| Outbox | `v3/outbox.py` | Refuses unless VALIDATED, bound to the current evidence, and alerts enabled by the owner; one message per recipient, publication and channel; no sender exists |
| E6 | `v3/e6.py` | Collector interface and seasonal-surprise arithmetic; `NullSource` raises `BlockedData`; stays BLOCKED_DATA |
| App | `src/lib/enginesV3.ts`, `src/components/EnginesV3.tsx` | Pure view-model over the feed: forming setups, paper signals, validated alerts, closed record, engine health and exclusion funnel; honest missing and stale states |

## The six engines (plus E7)

| Engine | Rules | State | Why |
|---|---|---|---|
| E1 Relative-strength continuation | v1.0.0 | RESEARCH | +0.24R over 57 walk-forward trades; a matched random entry with the same exit earned +0.45R, so the edge is the exit plan in a rising market, not the selection |
| E2 Volatility-compression breakout | v1.0.0 | RETIRED | +0.04R; negative at 2× costs; below the exposure-matched Nifty |
| E3 Orderly trend pullback | v1.0.0 | RETIRED | −0.23R, negative in every period but one |
| E4 Residual mean reversion | v1.0.0 | RETIRED | Paper-only by definition (no event coverage); −0.11R over 870 paper trades |
| E5 Failed breakdown / range reclaim | v1.0.0 | RESEARCH | −0.002R, equal to its random baseline |
| E6 Earnings surprise drift | v1.0.0 | BLOCKED_DATA | No point-in-time announcement timestamps or statements |
| E7 E1 without the trailing exit | v1.1.0 | RESEARCH, forward-only | Judged only on the prospective ledger from its freeze (DECISIONS #15) |

Lifecycle: `BLOCKED_DATA → RESEARCH → PAPER → VALIDATED → PAUSED / RETIRED`. Promotion needs the frozen `promotion_policy.yaml`, an independent review, prospective agreement and capacity limits; it is bound to the engine version and the evidence hash, and any rule change voids it.

## Server-side and public

All calculation runs in Python on GitHub Actions. The browser receives only the published feed (`public/engines_v3.json`); it recomputes nothing. This repository is public, and so are the frozen rules: that is deliberate. The pre-registration is only worth anything if it can be read. Nothing proprietary is claimed.

## What does not exist, and why

- **No database and no accounts.** State is a hash-chained file in git plus a static feed. A database migration, per-user access control and cross-user isolation have nothing to attach to until accounts exist (Lane A decision: none in Phase 0). The personal records (watchlist, journal, cards) are browser-local, so there is no cross-user path to test.
- **No alert sender.** `outbox.drain` takes a `send` callable and does nothing while `enabled` is false; no code in the repository supplies one.
- **No point-in-time universe, corporate-action file, circuit history or announcement timestamps** (MISSING_DATA_AND_ACCESS rows 1–6). Results carry survivorship and adjustment limits.
