# BRIEF_TRACE: the six-engine brief against the code (25 Oct 2026)

PASS / FAIL / BLOCKED / NOT RUN, each with evidence. The brief's engine definitions are the ones already transcribed into
`configs/engines/E1–E6.yaml` and frozen under the owner-approved pre-registration (v1.0.0, 22 Oct). They were built and validated;
**no engine qualified**. This pass added what the brief asks for beyond that and did not touch a frozen rule.

## Headline

| Question | Answer |
|---|---|
| Are the six engines built? | Yes, E1–E5 as code under frozen v1.0.0; E6 as an interface that stays BLOCKED_DATA; E7 as a forward-only variant |
| Did any qualify? | No. E1 +0.24R over 57 trades with a confidence interval that includes zero, and a matched random baseline did better (+0.45R). E2, E3, E4 retired. E5 equals its random baseline |
| Is anything live or alerting? | No. Alerts off, no sender, nothing validated |
| Can more engines fix that? | Not by count. Six were tested; each added to the multiple-testing burden. The diagnosis (RESEARCH_REPORT §8) is that the edge was exposure and exit, not selection |
| How long until the frozen bar can be met? | See "The sample-size problem" below |

## The sample-size problem (a finding, not a fix)

`promotion_policy.yaml` requires 891 independent observations, from a power analysis (effect 0.10R, sd 1.2R, one-sided 5%, power 80%).
The walk-forward book recorded 57 E1 trades over two years (about 28 a year) and 152 for all active engines (about 76 a year). At those rates a single engine needs about 30 years and the combined book about 12 to reach 891, even if trade frequency and independence hold, which they will not exactly: the rate depends on the market (2023–24 was rising) and overlapping trades are not independent. So the bar is unreachable on any horizon this product can use. The honest options are (a) keep every engine at RESEARCH/PAPER indefinitely, which is what the site says; (b) pre-register a different, weaker claim (for example, "paper record matches the backtest's cost model"), which is a new policy version and voids nothing but also qualifies nothing as an edge; or (c) widen the universe or horizon to raise the rate, which is a new engine. This is the owner's decision; it is not made here.

## Requirement matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Inspect the repo; reuse sound infrastructure | PASS | v3 package found complete for E1–E7 (this document) |
| 2 | Safe working branch, existing records preserved | PASS | branch `engines-ops`; the ledger is append-only and untouched |
| 3 | Six separately versioned engines, thresholds frozen before evaluation | PASS | `configs/engines/E1–E6.yaml`, `FROZEN.sha256`, 11 of 11 hashes OK; every tested variant in `engines/research/trials.jsonl` (86) |
| 4 | Engine 1 definition | PASS | `E1.yaml`, `setups.py::e1`; tests in `test_v3.py` (no-lookahead, truncation) |
| 5 | Engine 2 | PASS | `E2.yaml`, `setups.py::e2`; **RETIRED** on evidence |
| 6 | Engine 3 | PASS | `E3.yaml`; **RETIRED** on evidence |
| 7 | Engine 4 | PASS | `E4.yaml`; paper-only by definition; **RETIRED** on evidence |
| 8 | Engine 5 | PASS | `E5.yaml`, `setups.py::e5` |
| 9 | Engine 6: collector and interface; BLOCKED_DATA without trustworthy event history | PASS | `v3/e6.py`: `EventSource`, `NullSource` raises `BlockedData`; seasonal surprise with the eight-change, nonzero-denominator and adjustment refusals; first-full-session rule; stop rule. 20 tests in `test_ops.py`. State stays BLOCKED_DATA |
| 10 | Engine 6 live | BLOCKED | needs a point-in-time announcement and statement source (MISSING_DATA rows 1–2); no data was invented |
| 11 | Shared market context, five states, engine-specific compatibility, unknown on missing | PASS | `regime.yaml`, `regime.py`; tests: hysteresis, unknown, truncation invariance |
| 12 | Point-in-time historical universe | BLOCKED | MISSING row 3. Today's screened universe; survivorship stated on every result |
| 13 | Corporate actions and symbol changes verified | BLOCKED | MISSING row 4. Yahoo-adjusted series; >40% gaps excluded; no independent corporate-action file |
| 14 | Provenance on every input and output | PASS | `v3/provenance.py`; the publisher refuses a record without it (`MissingProvenance`); 8 tests |
| 15 | Holidays, IST session boundaries, incomplete sessions, stale/missing bars | PASS | `sessions.py`, `configs/nse_holidays.json`, `clean_mask`, 95% completeness check; `test_sessions.py` 10/10, `test_v3.py` |
| 16 | Provider outages and retries | PASS | `jobs.run_once` bounded retries with back-off; 4 tests |
| 17 | Execution: next session, costs, gap-through stops, stop-first, next-session trails, initial R | PASS | `execsim.py`; `test_v3.py` fixtures |
| 18 | Order intentions separate from paper fills | PASS | ledger `signal` records vs `outcome` records |
| 19 | Sizing and risk limits (0.25%, 1.5%, six, 25% sector, no leverage, one per symbol) | PASS | `portfolio.py`; `test_v3.py` portfolio checks |
| 20 | Share formula: floor(min(risk budget / stop distance, cash / entry, exposure cap / entry, liquidity cap)) | PASS | `portfolio.py` lines 84–90: risk budget over stop distance, then capped by cash (no leverage), a 20% position cap, 1% of the 20-day median traded value, the sector room left, and the open-risk room left; `test_v3.py` portfolio checks |
| 21 | Targets: challenger partials vs no-partial baseline; T3 N/A where undefended | PASS | `E*.yaml` exits; `RESEARCH_REPORT` §5 |
| 22 | Chronological validation: walk-forward, purge/embargo, registry, 2× cost, delay, neighbourhood, CIs, DSR/PBO, baselines | PASS (with limits) | run 39712264699; neighbourhood test is partial (DECISIONS #11); the 2010–2019 segment was exposed (DECISIONS #9) |
| 23 | Prospective immutable ledger | PASS | `paper_ledger.jsonl`, hash-chained, verified nightly |
| 24 | Lifecycle with a predeclared policy, bound to version and evidence hash | PASS | `promotion_policy.yaml`, `publish.bound_state`; tests |
| 25 | Idempotent job keys, locking, bounded retries, watermarks, structured logs, health, stale state | PASS | `jobs.py`; 11 tests; nightly watermark; `health()` |
| 26 | Atomic publication | PASS | `publish.publish` writes a temp file then replaces |
| 27 | Alert outbox with recipient/publication/channel deduplication; delivery disabled for unqualified engines | PASS | `outbox.py`; 9 tests: refused unless VALIDATED, bound and enabled; no sender exists |
| 28 | Never lower thresholds after a zero-signal run | PASS | no code path does; stated in OPERATIONS |
| 29 | App: forming, paper, validated, closed, engine health and exclusion diagnostics | PASS | `enginesV3.ts` (`viewModel`, `healthModel`), `EnginesV3.tsx`; `tests/lib.test.ts` |
| 30 | Setup shows engine/version, symbol, as-of, trigger, invalidation, objectives, expiry, sources, freshness, status, reasons, principal risk | PASS (partly) | Fields in the feed and cards. A condensed "principal risk" line is the stop distance (`initial_risk_pct`); no separate narrative |
| 31 | Exclusion funnel universe → clean → liquid → setup → context → executable → portfolio-selected | PASS (partly) | First five stages counted on the night; the last two are null by design (decided at the next open and by the book) |
| 32 | Links to company research, following, paper sizing, journal | PASS | `linksFor`; the calculator reads `?p=&sl=&rk=`; the journal reads `?s=&p=&sl=` |
| 33 | Honest empty/error/stale states; mobile design intact | PASS (partly) | view-model tests for every state; visual check NOT RUN on this branch (baselines render on CI) |
| 34 | Required test: lookahead, truncation, future-poison | PASS | `test_v3.py`, `test_integrity.py` |
| 35 | Required test: corporate actions, symbol changes | PASS (partly) | a 50% overnight jump and a suspension return are excluded; symbol-change handling has no data to test against (MISSING row 4) |
| 36 | Required test: stale/missing data fail closed | PASS | `test_v3.py`, `test_ops.py` |
| 37 | Required test: gap stops, unfillable orders, same-bar ambiguity, partials, rounding, trail timing | PASS | `test_v3.py` |
| 38 | Required test: cash/risk/sector limits, duplicate symbols | PASS | `test_v3.py` |
| 39 | Required test: duplicate jobs and notification deduplication | PASS | `test_ops.py` |
| 40 | Required test: engine-version/evidence mismatch | PASS | `test_v3.py` publisher |
| 41 | Required test: cross-user access to personal records | NOT RUN (not applicable) | no accounts and no server-side personal records exist; the watchlist, journal and cards are browser-local |
| 42 | Required test: end to end evaluation → plan → ledger → app | PASS (partly) | `test_ops.py` (planted signal → ledger → feed with funnel, health, provenance) and `lib.test.ts` (feed → view model). The two halves are joined by the feed's shape, not one process |
| 43 | Database migrations | NOT RUN (not applicable) | there is no database; state is git |
| 44 | Docs: ARCHITECTURE, DATA_CONTRACT, RESEARCH_REPORT, RELEASE_GATES, OPERATIONS | PASS | `docs/engines/` |
| 45 | Do not claim live, profitable or launch-ready; no external alerts without authorisation | PASS | none made; G24 BLOCKED |

## Test results (25 Oct 2026, this branch)

`test_v3` 79/79 · `test_ops` 46/46 · `test_swing` 33/33 · `test_integrity` 17/17 · `test_registry` 19/19 · `test_sessions` 10/10 · `test_ai` 50/50 · `FROZEN.sha256` 11/11 · `npm test` 192/192.
