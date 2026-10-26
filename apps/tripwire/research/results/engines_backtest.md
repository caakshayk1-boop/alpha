# Tripwire engines, back-tested as built

Run 2026-10-26 03:12 UTC, 660 symbols, 2015-10-23 to 2026-10-23. Survivorship bias applies. Quality at a fair price cannot be back-tested (no point-in-time accounts); it is judged on the forward ledger.

| Engine | period | trades | mean net | hit rate | mean R | excess vs universe (t) |
|---|---|---|---|---|---|---|
| MOM | train | 303 | 0.0155 | 0.488 | 0.157 | 0.006 (0.634) |
| MOM | validation | 111 | 0.0193 | 0.495 | 0.21 | 0.0006 (0.067) |
| MOM | holdout | 162 | -0.0093 | 0.426 | -0.092 | -0.011 (-0.954) |
| MOMR (challenger) | train | 279 | 0.0204 | 0.484 | 0.219 | 0.0137 (1.5) |
| MOMR (challenger) | validation | 106 | 0.0153 | 0.538 | 0.201 | -0.0012 (-0.116) |
| MOMR (challenger) | holdout | 153 | -0.0046 | 0.451 | -0.028 | -0.0104 (-1.08) |
| LVT | train | 158 | -0.0003 | 0.367 | -0.017 | -0.031 (-2.206) |
| LVT | validation | 60 | 0.0203 | 0.4 | 0.375 | -0.0182 (-0.943) |
| LVT | holdout | 85 | -0.0142 | 0.271 | -0.265 | -0.0312 (-1.823) |

| Engine | label |
|---|---|
| MOM | no historical support |
| MOMR | no historical support |
| LVT | no historical support |

The challenger is never promoted on this evidence: it enters the forward ledger and is judged there.