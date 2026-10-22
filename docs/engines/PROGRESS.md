# PROGRESS: Live Checklist

Updated by Claude after every phase. Status values: TODO / IN PROGRESS / DONE / BLOCKED / STOPPED.

| Phase | Item | Status | Evidence / commit | Blocker | Next |
|---|---|---|---|---|---|
| 0 | Locate legacy five engines + Swing V2 | DONE | LEGACY_AUDIT.md inventory · a9526e5 | — | — |
| 0 | Reproduce screenshot metrics | STOPPED | Displayed figures exact; no-gate 163 vs 162 and development 268 vs 267 (941 vs 940 symbols, no original snapshot) · run 39705031021 | Original run kept no data snapshot | New engines only on hashed snapshots |
| 0 | Diagnose 0% market gate | DONE | Real market state: Nifty below its 200-day on 136 of 136 sessions · gate_funnel.csv | — | — |
| 1 | PREREGISTRATION.md + promotion_policy.yaml committed | IN PROGRESS | DRAFT committed (8840e21) | Owner approval | Owner reviews thresholds; then freeze with SHA + hash |
| 2 | Point-in-time data + watermarks + health checks | TODO | | | |
| 2 | Corporate actions + tradability | TODO | | | |
| 2 | Cost model (verified sources) | IN PROGRESS | configs/engines/costs.yaml, statutory items from NSE sources accessed 2026-10-22 | Broker brokerage and DP (MISSING row 5) | Owner confirms broker |
| 2 | Execution simulator | TODO | | | |
| 2 | Portfolio layer + funnel | TODO | | | |
| 3 | Fixture suite | TODO | | | |
| 3 | Truncation / future-poison tests | DONE | tests/test_integrity.py 17/17 on swing-2.0.1; future-poison caught a lookahead in 2.0.0 (DECISIONS #2) | — | Extend to E1–E5 when built |
| 3 | Positive / negative controls | TODO | | | |
| 3 | Determinism + cost sanity | DONE (Swing v2) | tests/test_integrity.py | — | Itemised-cost sanity with costs-1.0.0 once the execution simulator exists |
| 4 | E1–E5 implemented | TODO | | | |
| 4 | E6 interface + collector | TODO | | | |
| 4 | Overlap + incremental value | TODO | | | |
| 5 | Walk-forward validation + baselines | TODO | | | |
| 6 | Four views + copy-lint + snapshots | TODO | | | |
| 6 | Nightly job + publisher (dry-run) + paper ledger | TODO | | | |
| 7 | Adversarial review | TODO | | | |
| — | Clean-checkout reproduction verified | TODO | | | |

## Session log
<!-- Append-only: date, what changed, what is next -->
- 2026-10-22: Phase 0 run on Actions twice (today's screen; the screen as of the original run). Displayed figures reproduce exactly; the no-gate and development books are one trade off, so reproduction FAILS the exact-count rule and the unpinned data path is STOPPED. The 0% gate is the market (trend check failed on all 136 sessions). Future-poison test found a lookahead in `Ctx` group benchmarks, fixed as swing-2.0.1 (DECISIONS #2), research re-run registered. Cost statutory items verified. Pre-registration DRAFT awaits the owner. Next: owner approval of PREREGISTRATION and the broker; then E1–E5 configs on a hashed snapshot.
