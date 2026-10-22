# MANIFEST: Data, Tests and Reproduction

## Data manifest
| Dataset | Source | Date range | Rows | Point-in-time? | Survivorship limits | SHA-256 | Access date |
|---|---|---|---|---|---|---|---|
| Daily OHLCV | Yahoo Finance via yfinance (`data.download`, period=max; exchange prices split-adjusted, dividend-adjusted closes separately) | 2010-01-01 (first segment) to 2026-10-21 | 890 symbols with ≥ 260 bars; 2,537,234 symbol-sessions in the funnel | Bars are as Yahoo serves them today; revisions are not versioned | Universe = today's screened companies (trading-dashboard docs/screen.json): delisted and dropped names absent | snapshot b926cc98c8a0660a8190110c5c47b09ec411a33bd4b59a34797d6961e0a92eab; bars hash cfa0e433e76dd3ebdbaaa49bca6e0be5184187c28d2791037830569f25e70e7b | 2026-10-22 |
| Corporate actions | Not held. Yahoo's adjustment is used as given; unexplained >40% gaps excluded | — | — | No | — | — | MISSING row 4 |
| Index constituents | Not held | — | — | No | Breadth and universe are survivorship-biased | — | MISSING row 3 |
| Nifty / sector indices | Yahoo `^NSEI` (sector returns built leave-one-out from the universe) | period=max to 2026-10-21 | in the snapshot | Price index as served | Sector groups inherit the universe's survivorship | in the bars hash | 2026-10-22 |
| India VIX | Yahoo `^INDIAVIX` | period=max to 2026-10-21 | in the snapshot | As served; missing days fail closed in the regime model | — | in the bars hash | 2026-10-22 |
| Earnings timestamps (E6) | Not held | — | — | — | — | — | BLOCKED (MISSING rows 1–2) |
| Cost schedule | NSE/FA/73061 (27 Feb 2026); NSE "SEBI Turnover Fees, STT and Other levies" (updated 17 Apr 2026) | effective 2026-03-01 / 2026-04-01 | — | n/a | Applied to all history at today's rates (earlier rates differed slightly) | costs.yaml 395c16fd857a… | 2026-10-22 |

## Test manifest
| Suite | Path | Count | Status | Command |
|---|---|---|---|---|
| Engines v3 Phase 3 | engines/tests/test_v3.py | 60 | PASS | `cd engines && python tests/test_v3.py` |
| Swing integrity | engines/tests/test_integrity.py | 17 | PASS | `cd engines && python tests/test_integrity.py` |
| Swing rules | engines/tests/test_swing.py | 33 | PASS | `cd engines && python tests/test_swing.py` |
| Registry | engines/tests/test_registry.py | 19 | PASS | `cd engines && python tests/test_registry.py` |
| ML engines (retired) | engines/tests/test_ai.py | 50 | PASS | `cd engines && python tests/test_ai.py` |
| Site units incl. v3 views and copy-lint | tests/*.test.ts | 141 | PASS | `npm test` |

## Environment
- Python 3.11 on Actions (3.13 locally); `engines/requirements.txt` (pandas ≥ 2.2, numpy ≥ 1.26, yfinance ≥ 0.2.40, scikit-learn ≥ 1.4, pyyaml ≥ 6.0).
- Node 22; `package-lock.json`.
- Seeds:
  - bootstrap 20261022;
  - random baseline 20261022;
  - test fixtures 5, 7, 9, 11, 100–109 and 200–205.

## Reproduce from a clean checkout
```bash
git clone https://github.com/caakshayk1-boop/alpha.git && cd alpha && git checkout engines-phase0   # e0ef600 or later
# install:
pip install -r engines/requirements.txt && npm ci
# verify the frozen rules:
sha256sum -c configs/engines/FROZEN.sha256
# run tests:
(cd engines && python tests/test_v3.py && python tests/test_integrity.py && python tests/test_swing.py && python tests/test_registry.py && python tests/test_ai.py) && npm test
# fetch/verify data: download artifact "v3-snapshot" from engines-v3 run 39710136503, then
sha256sum v3_bars.pkl   # expect b926cc98c8a0660a8190110c5c47b09ec411a33bd4b59a34797d6961e0a92eab
# run validation (writes engines/research/v3/, appends to trials.jsonl):
(cd engines && python -m v3.run ../v3_bars.pkl)
# build report: docs/engines/RESEARCH_REPORT.md tables are rendered from engines/research/v3/results.json
```
Verified on 2026-10-22: clone, frozen hashes and every test suite (G23). Re-running v3.run from the artifact was not repeated from
the dev container, whose proxy blocks the artifact host.

## Preview (dry-run)
```bash
cd engines && python -m v3.nightly          # downloads ~3y of bars; ledger + dry-run feed in research/v3/; publishes nothing
npm run build && npx wrangler dev --local   # /engines/ shows the four views as "Not published"
```

## Rollback
1. The feature flag is the publisher's `dry_run=True` default plus `alerts_enabled: false` in every feed. Nothing is published or
   sent, so there is nothing to switch off. To stop the nightly paper record, disable the `engines-v3` workflow.
2. `git revert <merge-sha>` of the engines PR. Swing v2.0.1 returns to 2.0.0 with that revert, and its research file with it.
3. Confirm the publisher is disabled and no alerts are queued: `alerts_enabled` is false, and no alert code exists in engines/v3.
