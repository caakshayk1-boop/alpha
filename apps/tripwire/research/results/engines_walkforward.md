# Momentum, walk-forward

Run 2026-10-27 02:55 UTC, 660 symbols, 2015-10-26 to 2026-10-26. Test years 2019 to 2026, each out of sample for the rule that traded it. Survivorship bias applies.

| Rule | rebalances | active | mean excess | t | mean net per rebalance (cash = 0) | verdict |
|---|---|---|---|---|---|---|
| **walk-forward procedure** | 95 | 69 | 0.0054 | 0.629 | 0.0096 | not supported |
| L126-x-q80 | 95 | 94 | -0.0022 | -0.279 | 0.0085 | not supported |
| L126-x-q90 | 95 | 92 | 0.0004 | 0.045 | 0.0109 | not supported |
| L126-R-q80 | 95 | 71 | 0.0015 | 0.163 | 0.007 | not supported |
| L126-R-q90 | 95 | 69 | 0.002 | 0.197 | 0.0072 | not supported |
| L252-x-q80 (as built) | 95 | 94 | 0.0036 | 0.532 | 0.0145 | not supported |
| L252-x-q90 | 95 | 94 | 0.0011 | 0.155 | 0.0122 | not supported |
| L252-R-q80 | 95 | 71 | 0.0091 | 1.114 | 0.0127 | not supported |
| L252-R-q90 | 95 | 71 | 0.008 | 0.948 | 0.0119 | not supported |

Chosen each year: 2019 L252-R-q80, 2020 L252-R-q80, 2021 L126-x-q90, 2022 L252-R-q80, 2023 L252-R-q80, 2024 L252-R-q90, 2025 L252-R-q90, 2026 L252-R-q90

The procedure needs t of at least 2.0; a fixed variant needs 2.7 (eight were tried).