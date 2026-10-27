# Tripwire engines, back-tested as built

Run 2026-10-27 02:54 UTC, 660 symbols, 2015-10-26 to 2026-10-26. Survivorship bias applies. Quality at a fair price cannot be back-tested (no point-in-time accounts); it is judged on the forward ledger.

| Engine | period | trades | mean net | hit rate | mean R | excess vs universe (t) |
|---|---|---|---|---|---|---|
| MOM | train | 301 | 0.013 | 0.468 | 0.155 | 0.0049 (0.585) |
| MOM | validation | 117 | 0.0193 | 0.513 | 0.202 | 0.001 (0.109) |
| MOM | holdout | 164 | 0.0035 | 0.494 | 0.038 | -0.0022 (-0.184) |
| MOMR (challenger) | train | 277 | 0.0169 | 0.469 | 0.194 | 0.0104 (1.154) |
| MOMR (challenger) | validation | 112 | 0.0118 | 0.536 | 0.169 | -0.0085 (-0.744) |
| MOMR (challenger) | holdout | 155 | -0.0034 | 0.458 | -0.048 | -0.008 (-0.952) |
| LVT | train | 160 | -0.0008 | 0.362 | -0.018 | -0.0303 (-2.283) |
| LVT | validation | 60 | 0.0148 | 0.35 | 0.395 | -0.0237 (-1.278) |
| LVT | holdout | 85 | -0.0144 | 0.294 | -0.253 | -0.0326 (-1.686) |

| Engine | label |
|---|---|
| MOM | no historical support |
| MOMR | no historical support |
| LVT | no historical support |

The challenger is never promoted on this evidence: it enters the forward ledger and is judged there.