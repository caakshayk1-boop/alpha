# Tripwire factor study

Run 2026-10-26 16:27 UTC on 660 symbols, 2015-10-26 to 2026-10-26. Survivorship bias applies (today's constituents only): results are an upper bound.

| Feature | kind | train IC (t) | validation IC | holdout IC | holdout Q5 net | adopt |
|---|---|---|---|---|---|---|
| mom12_1 | common baseline | 0.047 (2.443) | 0.041 | 0.034 | 0.0026 | no |
| near_high | common baseline | 0.024 (1.092) | 0.033 | 0.038 | -0.0003 | no |
| rev21 | common baseline | 0.021 (1.602) | -0.006 | -0.006 | -0.0053 | no |
| smooth_fip | candidate | 0.031 (2.405) | 0.001 | 0.027 | -0.0045 | no |
| eff_ratio60 | candidate | 0.035 (2.742) | 0.008 | 0.046 | 0.0034 | no |
| resid_mom | candidate | 0.052 (2.69) | 0.037 | 0.037 | -0.0005 | no |
| max5 | candidate | 0.027 (2.24) | -0.029 | 0.001 | -0.0092 | no |
| overnight60 | candidate | -0.02 (-1.669) | 0.019 | -0.012 | 0.0008 | no |
| vol_shock | candidate | -0.002 (-0.148) | 0.027 | 0.009 | 0.0002 | no |
| ud_vol | candidate | -0.012 (-1.326) | 0.002 | -0.008 | -0.0026 | no |
| clv20 | candidate | 0.014 (1.182) | -0.004 | 0.027 | -0.0048 | no |
| coil | candidate | 0.01 (0.714) | -0.023 | 0.003 | -0.0044 | no |
| skew60 | candidate | -0.002 (-0.213) | -0.021 | -0.005 | -0.0063 | no |
| amihud | control | 0.007 (0.56) | 0.027 | 0.004 | 0.0016 | no |
| noise | control | -0.005 (-1.12) | 0.002 | 0.008 | -0.0037 | no |

## Modifiers on top-quintile momentum (higher half minus lower half, mean 20-session return)

| Modifier | train diff (t) | validation | holdout | adopt |
|---|---|---|---|---|
| smooth_fip | 0.0048 (1.275) | -0.0107 | -0.01 | no |
| eff_ratio60 | 0.0082 (2.451) | -0.0041 | 0.0089 | no |
| resid_mom | 0.0042 (0.971) | 0.0015 | -0.0065 | no |
| max5 | -0.0102 (-2.979) | -0.0069 | -0.0076 | no |
| overnight60 | 0.0087 (1.99) | 0.0089 | -0.0001 | no |
| clv20 | 0.0008 (0.25) | -0.0076 | 0.0029 | no |

## What the winners looked like (mean percentile of winners minus losers, top 5 percent against bottom 5 percent of 20-session returns)

| Feature | train | validation | holdout |
|---|---|---|---|
| mom12_1 | 0.063 | 0.039 | 0.016 |
| near_high | 0.019 | 0.039 | 0.016 |
| rev21 | 0.027 | -0.011 | 0.005 |
| smooth_fip | 0.034 | -0.033 | -0.006 |
| eff_ratio60 | 0.031 | 0.023 | 0.02 |
| resid_mom | 0.062 | 0.028 | 0.016 |
| max5 | 0.014 | -0.054 | -0.014 |
| overnight60 | -0.014 | 0.071 | 0.008 |
| vol_shock | -0.001 | 0.062 | 0.022 |
| ud_vol | -0.02 | 0.016 | -0.006 |
| clv20 | -0.006 | -0.048 | -0.014 |
| coil | 0.002 | -0.051 | -0.004 |
| skew60 | 0.0 | -0.032 | -0.027 |
| amihud | 0.046 | 0.079 | 0.041 |
| noise | -0.002 | -0.01 | 0.003 |

Adoption rule and every threshold are in the PREREGISTRATION block of study.py. A feature that fails stays failed.