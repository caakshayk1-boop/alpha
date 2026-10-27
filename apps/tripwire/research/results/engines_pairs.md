# Pairs: cointegration screen, out of sample

Run 2026-10-27 07:03 UTC on 660 symbols, 2015-10-27 to 2026-10-27. Survivorship applies: an upper bound.
Verdict: **not supported** (needs 30+ trades, mean net above zero, t of 2.0 or more).

| Rule | quarters | pairs | trades | mean net / trade | win rate | t (monthly) | converged / stopped / timeout / forced | still cointegrated after |
|---|---|---|---|---|---|---|---|---|
| ADF and half-life screen | 39 | 377 | 2039 | -0.00627 | 0.283 | -6.67 | 144 / 1691 / 70 / 134 | 0.536 |
| Control: correlation only | 39 | 390 | 1633 | -0.00564 | 0.267 | -2.91 | 80 / 1307 / 115 / 131 | n/a |

Costs 0.65 percent of gross notional per trade. A pair needs a short leg: single-stock futures only, not cash equities. Nothing here is a signal.