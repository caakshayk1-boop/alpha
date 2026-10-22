# MANIFEST: Data, Tests and Reproduction

## Data manifest
| Dataset | Source | Date range | Rows | Point-in-time? | Survivorship limits | SHA-256 | Access date |
|---|---|---|---|---|---|---|---|
| Daily OHLCV | | | | | | | |
| Corporate actions | | | | | | | |
| Index constituents | | | | | | | |
| Nifty / sector indices | | | | | | | |
| India VIX | | | | | | | |
| Earnings timestamps (E6) | | | | | | | |
| Cost schedule | | | | | | | |

## Test manifest
| Suite | Path | Count | Status | Command |
|---|---|---|---|---|

## Environment
Language/runtime version, lockfile hash, random seeds.

## Reproduce from a clean checkout
```bash
# Fill in with exact, verified repo commands:
git clone <repo> && cd <repo> && git checkout <rc-sha>
# install:
# fetch/verify data:
# run tests:
# run validation:
# build report:
```

## Preview (dry-run)
```bash
# local preview command; publisher in --dry-run
```

## Rollback
1. Disable the feature flag `<flag name>`.
2. `git revert <merge-sha>`, or redeploy the prior tag `<tag>`.
3. Confirm the publisher is disabled and no alerts are queued.
