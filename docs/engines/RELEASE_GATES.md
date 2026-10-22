# RELEASE_GATES: Evidence Table

Status values: **PASS / FAIL / BLOCKED / NOT RUN**. Insufficient evidence is never PASS. No blank cells.
Updated 2026-10-22 at the v3 validation run of record (engines-v3 run 39710136503, commit 75bdfd7).

| # | Gate | Status | Evidence path | Command | Artifact hash |
|---|---|---|---|---|---|
| G01 | Legacy metrics reproduced | FAIL | docs/engines/LEGACY_AUDIT.md · engines/research/phase0/reproduction.json | `python engines/phase0.py` (engines-phase0 run 39705031021, commit f5704e5) | snapshot a513d759ca19c68d… (displayed figures exact; no-gate 163 vs 162, development 268 vs 267) |
| G02 | 0% gate diagnosed | PASS | engines/research/phase0/gate_funnel.csv · LEGACY_AUDIT.md §0% gate diagnosis | same run | bars ee2d01e79af3a009… (Nifty below its 200-day on 136 of 136 sessions; 136 of 136 agree with the published history) |
| G03 | Pre-registration committed before OOS | PASS | docs/engines/PREREGISTRATION.md · configs/engines/FROZEN.sha256 · DECISIONS #5 | `sha256sum -c configs/engines/FROZEN.sha256` | freeze commit af7c35ae02c9…, before any v3 code (8840e21 draft → af7c35a freeze → 75bdfd7 first run) |
| G04 | Point-in-time data + watermarks | BLOCKED | v3/run.py `complete_sessions` · v3/nightly.py watermark · MISSING rows 3, 6 | `python -m v3.run` | watermarks PASS (no intraday bar, watermark per run); point-in-time constituents and delisted names unavailable |
| G05 | Corporate actions verified | BLOCKED | MISSING row 4 · v3/engines.py `clean_mask` | `python tests/test_v3.py` | Yahoo-adjusted series only; >40% unexplained gaps excluded; no independent corporate-action file to verify against |
| G06 | Cost model verified from official sources | PASS | configs/engines/costs.yaml (NSE/FA/73061; NSE levies page, accessed 2026-10-22) | `python tests/test_v3.py` (cost sanity 0.22248%) | costs.yaml 395c16fd857a… (broker 0 by owner decision, stress case reported) |
| G07 | No-lookahead fixtures | PASS | engines/tests/test_v3.py | `python tests/test_v3.py` | 60 of 60 |
| G08 | Truncation invariance | PASS | test_v3.py (E1–E5, two cut dates) · tests/test_integrity.py (Swing) | same | 10 of 10 v3 checks; 6 of 6 Swing checks |
| G09 | Future-poison test | PASS | test_v3.py · test_integrity.py | same | 10 of 10 v3; found and fixed the Swing group-benchmark leak (DECISIONS #2) |
| G10 | Positive control detected | PASS | test_v3.py controls | same | planted 0.08%/day found inside its CI; one real edge among noise gives PBO < 0.2. Statistics layer only: no end-to-end planted setup |
| G11 | Negative control clean | PASS | test_v3.py controls; synthetic end-to-end run left every engine RESEARCH | same | 0 of 10 noise books pass CI and DSR; noise PBO near 0.5 |
| G12 | Determinism (byte-identical rerun) | PASS | test_v3.py determinism (book digest twice) | same | identical digests; full-run rerun from the snapshot not repeated |
| G13 | Cost sanity round trip | PASS | test_v3.py cost sanity | same | flat round trip loses exactly the modelled rupees |
| G14 | Stale data / split / regime / gap / same-bar / partial fixtures | PASS | test_v3.py | same | stale symbol, 50% jump, hysteresis, gap stop, ambiguous bar, partials against the original R, next-session trail |
| G15 | One position per symbol | PASS | test_v3.py portfolio | same | second engine becomes a supporting tag |
| G16 | Idempotent duplicate jobs | PASS | test_v3.py ledger; nightly watermark | same | duplicate id writes nothing; a second nightly on the same session records nothing |
| G17 | Publisher fails closed on version/hash mismatch | PASS | test_v3.py publisher | same | edited frozen rule refused; stale VALIDATED claim becomes RESEARCH; alerts off; dry run by default |
| G18 | Trial registry complete | PASS | engines/research/trials.jsonl | `wc -l engines/research/trials.jsonl` | 46 entries (Swing 6, E1–E5 40); DSR uses each engine's count |
| G19 | Walk-forward validation run | PASS | engines/research/v3/results.json · docs/engines/RESEARCH_REPORT.md | `python -m v3.run` (engines-v3 run 39710136503) | snapshot b926cc98c8a0660a8190110c5c47b09ec411a33bd4b59a34797d6961e0a92eab |
| G20 | Copy-lint (banned phrases) | PASS | tests/lib.test.ts "engines v3 copy-lint" | `npm test` | 141 of 141 |
| G21 | View snapshot tests incl. empty/stale | PASS | tests/lib.test.ts "engines v3 views" | `npm test` | view-model states: ok, stale, missing, validated-but-alerts-off |
| G22 | Paper ledger hash-chain verified | PASS | test_v3.py ledger; v3/nightly.py verifies the chain each night | `python tests/test_v3.py` | chain verifies; one edited line breaks it |
| G23 | Clean-checkout reproduction | PASS | fresh clone of engines-phase0 @ e0ef600 | `git clone … && sha256sum -c configs/engines/FROZEN.sha256 && python tests/test_*.py && npm ci && npm test` | 10 of 10 frozen hashes OK; 60, 17, 33, 19, 50 and 141 tests pass; re-running v3.run from the archived snapshot NOT RUN here (artifact host blocked from the dev container) |
| G24 | Owner authorisation for production/alerts | BLOCKED | Owner action | — | — |

## Engine qualification
| Engine | Rules version | State | Evidence hash | Reason |
|---|---|---|---|---|
| E1 | v1.0.0 | RESEARCH | 99db61b581b0a09c… | net CI includes 0; DSR 0.11; PBO 0.53; 64 of 891 trades |
| E2 | v1.0.0 | RESEARCH | same | ~0R; negative at 2× costs; below exposure-matched Nifty; recommend merge into E1 or retire |
| E3 | v1.0.0 | RESEARCH | same | negative in every period; recommend retire |
| E4 | v1.0.0 | RESEARCH | same | −0.128R over 881 trades, −28% drawdown; recommend retire |
| E5 | v1.0.0 | RESEARCH | same | ~0 to negative; 69 trades |
| E6 | v1.0.0 | BLOCKED_DATA | same | Point-in-time event timestamps and statements not available |
