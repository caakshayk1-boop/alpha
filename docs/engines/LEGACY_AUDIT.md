# LEGACY_AUDIT: Retired Engines and Swing V2

Rule: describe the rules **as implemented in code**, not as documented. Cite file paths, commits and data sources.

## Engine inventory
| Engine | Code path | Config | First / last commit | Data source | Status |
|---|---|---|---|---|---|
| Legacy 1 | | | | | RETIRED |
| Legacy 2 | | | | | RETIRED |
| Legacy 3 | | | | | RETIRED |
| Legacy 4 | | | | | RETIRED |
| Legacy 5 | | | | | RETIRED |
| Swing V2 | | | | | CURRENT |

## Per-engine findings
For each engine: implemented rules · documented rules · discrepancies · failure cause (DATA / LOGIC / REGIME / NO EDGE / UNKNOWN) with evidence.

## Reproduction of displayed metrics
| Metric | Displayed | Reproduced | Match? | Command | Data hash |
|---|---|---|---|---|---|
| Market gate conditions met | 1/4 | NOT RUN | | | |
| Gate on, last 136 sessions | 0% | NOT RUN | | | |
| Holdout trades | 49 | NOT RUN | | | |
| Holdout expectancy | −0.06R | NOT RUN | | | |
| Holdout PF | 0.90 | NOT RUN | | | |
| Month-clustered t | −0.91 | NOT RUN | | | |
| No-gate trades | 162 | NOT RUN | | | |
| No-gate expectancy | −0.26R | NOT RUN | | | |
| No-gate PF | 0.60 | NOT RUN | | | |

## 0% gate diagnosis
| Check | Result | Evidence |
|---|---|---|
| Index symbol mapping | NOT RUN | |
| Date/timezone alignment | NOT RUN | |
| Adjustment policy | NOT RUN | |
| Breadth denominator (point-in-time) | NOT RUN | |
| 200-day warm-up | NOT RUN | |
| Null handling | NOT RUN | |
| Exchange calendar | NOT RUN | |

The holdout above has been **INSPECTED**. It is historical evidence only and must never be called untouched.
