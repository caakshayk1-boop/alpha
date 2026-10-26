# Momentum, walk-forward

Run 2026-10-26 16:28 UTC, 660 symbols, 2015-10-26 to 2026-10-26. Test years 2019 to 2026, each out of sample for the rule that traded it. Survivorship bias applies.

| Rule | rebalances | active | mean excess | t | mean net per rebalance (cash = 0) | verdict |
|---|---|---|---|---|---|---|
| **walk-forward procedure** | 95 | 69 | 0.0057 | 0.663 | 0.0098 | not supported |
| L126-x-q80 | 95 | 94 | -0.0019 | -0.244 | 0.0088 | not supported |
| L126-x-q90 | 95 | 92 | 0.0002 | 0.019 | 0.0107 | not supported |
| L126-R-q80 | 95 | 71 | 0.0019 | 0.202 | 0.0072 | not supported |
| L126-R-q90 | 95 | 69 | 0.0017 | 0.169 | 0.007 | not supported |
| L252-x-q80 (as built) | 95 | 94 | 0.0038 | 0.558 | 0.0147 | not supported |
| L252-x-q90 | 95 | 94 | 0.0011 | 0.157 | 0.0122 | not supported |
| L252-R-q80 | 95 | 71 | 0.0094 | 1.144 | 0.0129 | not supported |
| L252-R-q90 | 95 | 71 | 0.0081 | 0.952 | 0.012 | not supported |

Chosen each year: 2019 L252-R-q80, 2020 L252-R-q80, 2021 L126-x-q90, 2022 L252-R-q80, 2023 L252-R-q80, 2024 L252-R-q90, 2025 L252-R-q90, 2026 L252-R-q90

The procedure needs t of at least 2.0; a fixed variant needs 2.7 (eight were tried).