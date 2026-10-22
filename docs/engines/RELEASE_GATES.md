# RELEASE_GATES: Evidence Table

Status values: **PASS / FAIL / BLOCKED / NOT RUN**. Insufficient evidence is never PASS. No blank cells.

| # | Gate | Status | Evidence path | Command | Artifact hash |
|---|---|---|---|---|---|
| G01 | Legacy metrics reproduced | NOT RUN | | | |
| G02 | 0% gate diagnosed | NOT RUN | | | |
| G03 | Pre-registration committed before OOS | NOT RUN | | | |
| G04 | Point-in-time data + watermarks | NOT RUN | | | |
| G05 | Corporate actions verified | NOT RUN | | | |
| G06 | Cost model verified from official sources | NOT RUN | | | |
| G07 | No-lookahead fixtures | NOT RUN | | | |
| G08 | Truncation invariance | NOT RUN | | | |
| G09 | Future-poison test | NOT RUN | | | |
| G10 | Positive control detected | NOT RUN | | | |
| G11 | Negative control clean | NOT RUN | | | |
| G12 | Determinism (byte-identical rerun) | NOT RUN | | | |
| G13 | Cost sanity round trip | NOT RUN | | | |
| G14 | Stale data / split / regime / gap / same-bar / partial fixtures | NOT RUN | | | |
| G15 | One position per symbol | NOT RUN | | | |
| G16 | Idempotent duplicate jobs | NOT RUN | | | |
| G17 | Publisher fails closed on version/hash mismatch | NOT RUN | | | |
| G18 | Trial registry complete | NOT RUN | | | |
| G19 | Walk-forward validation run | NOT RUN | | | |
| G20 | Copy-lint (banned phrases) | NOT RUN | | | |
| G21 | View snapshot tests incl. empty/stale | NOT RUN | | | |
| G22 | Paper ledger hash-chain verified | NOT RUN | | | |
| G23 | Clean-checkout reproduction | NOT RUN | | | |
| G24 | Owner authorisation for production/alerts | BLOCKED | Owner action | — | — |

## Engine qualification
| Engine | Rules version | State | Evidence hash | Reason |
|---|---|---|---|---|
| E1 | v1.0.0 | RESEARCH | | |
| E2 | v1.0.0 | RESEARCH | | |
| E3 | v1.0.0 | RESEARCH | | |
| E4 | v1.0.0 | RESEARCH | | |
| E5 | v1.0.0 | RESEARCH | | |
| E6 | v1.0.0 | BLOCKED_DATA | | Point-in-time event data not verified |
