# CLAUDE_TASK: Alpha Signal Engines Release Candidate

## ROLE
Act as quant research engineer, adversarial backtest reviewer and product engineer. Source spec: docs/engines/Alpha_Signal_Engines_Claude.md (including Section 8), plus all repository instructions (CLAUDE.md, README, CONTRIBUTING, existing configs). Use the repo's existing stack, modules, test runner and scripts. Do not add a new framework, database or UI library unless the repo has none, and justify any addition in writing first. Templates for every document already exist in docs/engines/. Fill them in; do not replace their structure.

## OPERATING RULES (non-negotiable)
- Work on the current branch only, in small scoped commits. Never force-push, touch production, send alerts or call live broker or notification endpoints. Publishers default to --dry-run.
- Never change a test, threshold, fixture or gate to make something pass. Log the reason in DECISIONS.md first, then make the change in a separate commit.
- Never fabricate data, timestamps, events, trades, metrics or citations. Anything unknown is UNKNOWN / BLOCKED / NOT RUN.
- Every backtest goes through one wrapper that appends to the trial registry (engine, rules version, params, data hash, period, metrics, git SHA, timestamp). No unregistered runs. The registry's trial count N feeds DSR and PBO (Probability of Backtest Overfitting).
- Update PROGRESS.md after each phase.
- When a STOP condition is hit, stop that track, record the evidence, continue other unblocked tracks and report.

## PHASE 0: INSPECT AND REPRODUCE (no behaviour changes)
1. Locate the five retired engines and Swing V2 (files, configs, data sources, git history). Fill in LEGACY_AUDIT.md.
2. Reproduce: gate 1/4, 0% of 136 sessions; holdout 49 trades, −0.06R, PF 0.90, t −0.91; no-gate 162 trades, −0.26R, PF 0.60. The trade count must match exactly; metrics must match within rounding.
3. Diagnose the 0% gate: index mapping, date alignment, adjustment, point-in-time breadth denominator, 200-day warm-up, nulls, timezone and calendar. Produce a per-session gate funnel.
STOP if reproduction fails: build no new engines on that data path.

## PHASE 1: PRE-REGISTRATION (before any new OOS result)
Fill in PREREGISTRATION.md and create configs/engines/promotion_policy.yaml. Record the commit SHA and file hash. Any later change is a new version, and prior qualification becomes void.

## PHASE 2: SHARED INFRASTRUCTURE
- Point-in-time data with watermarks, health checks and the NSE calendar.
- Corporate actions (split, bonus, rights, dividend), with price-level and total-return series kept separate.
- Tradability: suspensions, circuit locks, surveillance flags where data exist.
- Itemised Indian cost model: brokerage, STT, exchange charges, SEBI fee, stamp duty, GST, DP charges, spread and slippage. Verify current rates from official sources and record the URL and access date. Do not use remembered rates.
- Execution simulator: next-open fill, chase limit, gap-through stops at the open, same-bar stop-first with an ambiguity flag, partial exits against the original R, completed-bar trailing effective next session.
- Portfolio layer: one position per symbol, primary engine plus supporting tags, risk/sector/position/ADV caps.
- Funnel persisted per engine per day.

## PHASE 3: FIXTURES AND INTEGRITY TESTS (must pass before any evaluation)
Fixtures: no lookahead, stale data, split/bonus, regime transitions/hysteresis, gap stops, same-bar ambiguity, partial exits and R aggregation, one position per symbol, idempotent duplicate jobs, alert eligibility and version/hash mismatch (fail closed). Also required:
- Truncation invariance: signals at t computed on data truncated at t must equal signals at t computed on the full history.
- Future-poison: garbage after t leaves signals at t unchanged.
- Positive control: a planted edge is detected at roughly its planted size.
- Negative control: noise shows no significant edge after DSR/PBO. If it does, STOP.
- Determinism: reruns are byte-identical, with pinned seeds and dependencies.
- Cost sanity: a round trip loses exactly the modelled costs.

## PHASE 4: ENGINES
- Build E1–E5 per spec with independent context rules and versioned configs (configs/engines/E*.yaml).
- For E6, build the interface and collector only. It stays BLOCKED_DATA without verified point-in-time timestamps and statements.
- For each engine produce: funnel, counts by regime, overlap matrix, and an incremental OOS value test. Recommend merge or retire where an engine adds no value.

## PHASE 5: VALIDATION
- Nested walk-forward with purging and embargo.
- Gross and net results, 2× cost stress, one-session delay sensitivity.
- Baselines: cash, exposure-matched index, matched random entry.
- Full metric set (spec Section 5.6) per engine and for the combined book.
- Meta-labelling is an optional challenger. Show probabilities only when calibrated.

## PHASE 6: PRODUCT
- Four views with mobile-first cards and truthful empty and stale states.
- Copy-lint test that fails on: uncalibrated win probability, "guaranteed", "safe", "loss-protected", "sure-shot".
- Snapshot tests for every view.
- State machine bound to rules version + data hash + evidence hash.
- Nightly job: calendar-aware; Asia/Kolkata timezone for market data, with the display timezone documented; runs after the EOD completeness check; idempotent; atomic publish; no resend of unchanged signals; monitoring in place.
- Prospective paper ledger: append-only and hash-chained.

## PHASE 7: ADVERSARIAL SELF-REVIEW
Review the diff as a hostile reviewer, using an independent subagent if one is available. Add the top 10 ways the results could still be wrong, with mitigations, to RESEARCH_REPORT.md.

## DELIVERABLES
Code, configs, fixtures and tests, plus completed RESEARCH_REPORT.md, RELEASE_GATES.md, MANIFEST.md and MISSING_DATA_AND_ACCESS.md. Include preview (dry-run) and rollback (feature flag + git revert) instructions and a PR description. Unqualified engines stay RESEARCH/PAPER. Production deployment and outgoing alerts need owner authorisation; do not perform them.

## DEFINITION OF DONE
- Phase 3 tests pass.
- Reproduction is documented.
- Pre-registration was committed before any OOS result.
- Every run is in the registry.
- The gate table has no blank cells.
- The clean-checkout reproduction command was actually run.
- PROGRESS.md has no unexplained open items.
