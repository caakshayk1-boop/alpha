# Tripwire engines, back-tested as built

Run 2026-10-27 07:01 UTC, 660 symbols, 2015-10-27 to 2026-10-27. Survivorship bias applies. Quality at a fair price cannot be back-tested (no point-in-time accounts); it is judged on the forward ledger.

| Engine | period | trades | mean net | hit rate | mean R | excess vs universe (t) |
|---|---|---|---|---|---|---|
| MOM | train | 293 | 0.011 | 0.451 | 0.112 | 0.0075 (0.819) |
| MOM | validation | 121 | 0.0078 | 0.488 | 0.085 | -0.0069 (-0.818) |
| MOM | holdout | 166 | -0.0072 | 0.422 | -0.107 | -0.013 (-1.224) |
| MOMR (challenger) | train | 269 | 0.0226 | 0.498 | 0.235 | 0.0251 (1.857) |
| MOMR (challenger) | validation | 117 | 0.0084 | 0.504 | 0.12 | -0.0064 (-0.713) |
| MOMR (challenger) | holdout | 157 | -0.0032 | 0.452 | -0.036 | -0.006 (-0.656) |
| LVT | train | 159 | -0.0025 | 0.346 | -0.051 | -0.0316 (-2.385) |
| LVT | validation | 60 | 0.0212 | 0.417 | 0.42 | -0.018 (-1.253) |
| LVT | holdout | 85 | -0.0085 | 0.341 | -0.105 | -0.0274 (-1.543) |

| Engine | label |
|---|---|
| MOM | no historical support |
| MOMR | no historical support |
| LVT | no historical support |

The challenger is never promoted on this evidence: it enters the forward ledger and is judged there.