# PROGRESS: Live Checklist

Updated by Claude after every phase. Status values: TODO / IN PROGRESS / DONE / BLOCKED / STOPPED.

| Phase | Item | Status | Evidence / commit | Blocker | Next |
|---|---|---|---|---|---|
| 0 | Locate legacy five engines + Swing V2 | DONE | LEGACY_AUDIT.md inventory · a9526e5 | — | — |
| 0 | Reproduce screenshot metrics | STOPPED | Displayed figures exact; no-gate 163 vs 162 and development 268 vs 267 (941 vs 940 symbols, no original snapshot) · run 39705031021 | Original run kept no data snapshot | New engines only on hashed snapshots |
| 0 | Diagnose 0% market gate | DONE | Real market state: Nifty below its 200-day on 136 of 136 sessions · gate_funnel.csv | — | — |
| 1 | PREREGISTRATION.md + promotion_policy.yaml committed | DONE | Owner-approved freeze af7c35a; FROZEN.sha256; DECISIONS #5 | — | — |
| 2 | Point-in-time data + watermarks + health checks | BLOCKED | Watermarks, completed-session cut, completeness check (nightly) DONE; point-in-time constituents unavailable | MISSING row 3 | Owner sources constituents |
| 2 | Corporate actions + tradability | BLOCKED | Yahoo adjustment + >40% gap exclusion; liquidity floors; gap/chase cancels | MISSING rows 4, 6 | Owner sources corporate actions and circuit history |
| 2 | Cost model (verified sources) | DONE | costs-1.0.0; broker 0 + stress by owner decision (DECISIONS #6) | — | — |
| 2 | Execution simulator | DONE | engines/v3/execsim.py; fixtures in test_v3.py | — | — |
| 2 | Portfolio layer + funnel | DONE | engines/v3/portfolio.py, engines.py; funnel_E*.csv | — | — |
| 3 | Fixture suite | DONE | engines/tests/test_v3.py 60/60 | — | — |
| 3 | Truncation / future-poison tests | DONE | test_integrity.py (Swing) and test_v3.py (E1–E5) | — | — |
| 3 | Positive / negative controls | DONE | test_v3.py (statistics layer); no end-to-end planted setup yet | — | Add an end-to-end planted-setup control |
| 3 | Determinism + cost sanity | DONE | test_integrity.py and test_v3.py (0.22248% statutory) | — | — |
| 4 | E1–E5 implemented | DONE | engines/v3/setups.py to configs/engines/E1–E5.yaml | — | — |
| 4 | E6 interface + collector | BLOCKED | E6.yaml state BLOCKED_DATA; publisher and views carry it; no collector without a point-in-time source | MISSING rows 1–2 | Owner approves an announcement-data source |
| 4 | Overlap + incremental value | DONE | results.json overlap_jaccard, incremental_sharpe_wf; RESEARCH_REPORT §8 | — | Retire E3/E4; merge or retire E2 (owner decision) |
| 5 | Walk-forward validation + baselines | DONE | engines-v3 run 39712264699 (impl 1.0.1; supersedes 39710136503); RESEARCH_REPORT §4–7 | — | No engine qualified |
| 6 | Four views + copy-lint + snapshots | DONE | src/lib/enginesV3.ts, components/EnginesV3.tsx; tests/lib.test.ts | — | Publishing needs owner authorisation (G24) |
| 6 | Nightly job + publisher (dry-run) + paper ledger | DONE | engines/v3/nightly.py, publish.py, ledger.py; engines_v3.yml schedule 19:15 IST weekdays | — | Runs on main once merged |
| 7 | Adversarial review | DONE | RESEARCH_REPORT §10 (independent read-only reviewer) | — | Fix the confirmed items in v1.0.1 |
| — | Clean-checkout reproduction verified | DONE | G23: clone @ e0ef600, hashes and all suites pass | Results re-run from the artifact not repeated locally (MISSING row 8) | — |

## Session log
<!-- Append-only: date, what changed, what is next -->
- 2026-10-22: Phase 0 run on Actions twice (today's screen; the screen as of the original run). Displayed figures reproduce exactly; the no-gate and development books are one trade off, so reproduction FAILS the exact-count rule and the unpinned data path is STOPPED. The 0% gate is the market (trend check failed on all 136 sessions). Future-poison test found a lookahead in `Ctx` group benchmarks, fixed as swing-2.0.1 (DECISIONS #2), research re-run registered. Cost statutory items verified. Pre-registration DRAFT awaits the owner. Next: owner approval of PREREGISTRATION and the broker; then E1–E5 configs on a hashed snapshot.
- 2026-10-22: Owner approved the pre-registration; v1.0.0 frozen (af7c35a) before any v3 code. Built engines/v3 (regime, costs, execution simulator, book, E1–E5, ledger, publisher, nightly) with 60 Phase 3 tests, then ran the validation once (run 39710136503). No engine qualified: E1 is the only promising one (+0.30R, 64 WF trades, CI includes 0, DSR 0.11); E3 and E4 are negative everywhere; PBO 0.53. Four views on the Signals page say "not published" until the owner authorises it. Next: owner decisions on retiring E3/E4 and on publishing; v1.0.1 for the review's confirmed items.
- 2026-10-22: Independent review found 10 issues (4 high); implementation 1.0.1 fixed eight in full, and partly fixed the neighbourhood test and the protocol breach (DECISIONS #8–11). Corrected run 39712264699: no engine qualified. E1's edge does not survive a matched random baseline (+0.24R vs +0.45R): the exit plan in a rising market, not the selection. E4 is paper-only by definition (−0.11R, 870). Next: owner decisions on retirements and publishing; v1.1 for the full parameter neighbourhood.
