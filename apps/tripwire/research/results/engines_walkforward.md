# Momentum, walk-forward

Run 2026-10-27 07:01 UTC, 660 symbols, 2015-10-27 to 2026-10-27. Test years 2019 to 2026, each out of sample for the rule that traded it. Survivorship bias applies.

| Rule | rebalances | active | mean excess | t | mean net per rebalance (cash = 0) | verdict |
|---|---|---|---|---|---|---|
| **walk-forward procedure** | 95 | 71 | 0.0019 | 0.25 | 0.0052 | not supported |
| L126-x-q80 | 95 | 94 | 0.0031 | 0.43 | 0.0138 | not supported |
| L126-x-q90 | 95 | 90 | 0.0035 | 0.462 | 0.014 | not supported |
| L126-R-q80 | 95 | 72 | 0.0064 | 0.793 | 0.009 | not supported |
| L126-R-q90 | 95 | 69 | 0.0086 | 0.994 | 0.0097 | not supported |
| L252-x-q80 (as built) | 95 | 94 | 0.0021 | 0.304 | 0.012 | not supported |
| L252-x-q90 | 95 | 93 | 0.0007 | 0.095 | 0.009 | not supported |
| L252-R-q80 | 95 | 72 | 0.0041 | 0.497 | 0.0069 | not supported |
| L252-R-q90 | 95 | 71 | 0.0041 | 0.453 | 0.0063 | not supported |

Chosen each year: 2019 L252-R-q80, 2020 L252-R-q80, 2021 L126-x-q80, 2022 L252-R-q80, 2023 L252-R-q80, 2024 L126-R-q90, 2025 L126-R-q90, 2026 L126-R-q90

The procedure needs t of at least 2.0; a fixed variant needs 2.7 (eight were tried).