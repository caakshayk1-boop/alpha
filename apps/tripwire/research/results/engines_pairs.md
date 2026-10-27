# Pairs: cointegration screen, out of sample

Run 2026-10-27 02:56 UTC on 660 symbols, 2015-10-26 to 2026-10-26. Survivorship applies: an upper bound.
Verdict: **not supported** (needs 30+ trades, mean net above zero, t of 2.0 or more).

| Rule | quarters | pairs | trades | mean net / trade | win rate | t (monthly) | converged / stopped / timeout / forced | still cointegrated after |
|---|---|---|---|---|---|---|---|---|
| ADF and half-life screen | 39 | 376 | 2204 | -0.00627 | 0.281 | -6.45 | 138 / 1874 / 66 / 126 | 0.508 |
| Control: correlation only | 39 | 390 | 1649 | -0.00523 | 0.277 | -1.95 | 86 / 1307 / 121 / 135 | n/a |

Costs 0.65 percent of gross notional per trade. A pair needs a short leg: single-stock futures only, not cash equities. Nothing here is a signal.