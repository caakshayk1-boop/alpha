# Tripwire factor study

Run 2026-10-26 03:12 UTC on 660 symbols, 2015-10-23 to 2026-10-23. Survivorship bias applies (today's constituents only): results are an upper bound.

| Feature | kind | train IC (t) | validation IC | holdout IC | holdout Q5 net | adopt |
|---|---|---|---|---|---|---|
| mom12_1 | common baseline | 0.045 (2.369) | 0.042 | 0.033 | 0.0023 | no |
| near_high | common baseline | 0.028 (1.248) | 0.034 | 0.038 | -0.0006 | no |
| rev21 | common baseline | 0.02 (1.497) | -0.002 | -0.005 | -0.0058 | no |
| smooth_fip | candidate | 0.029 (2.34) | 0.003 | 0.028 | -0.0045 | no |
| eff_ratio60 | candidate | 0.027 (2.211) | 0.006 | 0.04 | 0.0026 | no |
| resid_mom | candidate | 0.05 (2.581) | 0.038 | 0.036 | -0.0006 | no |
| max5 | candidate | 0.029 (2.452) | -0.027 | 0.005 | -0.0083 | no |
| overnight60 | candidate | -0.022 (-1.688) | 0.016 | -0.012 | 0.001 | no |
| vol_shock | candidate | -0.004 (-0.388) | 0.033 | 0.006 | -0.0003 | no |
| ud_vol | candidate | -0.012 (-1.222) | -0.006 | -0.01 | -0.0024 | no |
| clv20 | candidate | 0.015 (1.222) | -0.009 | 0.03 | -0.0045 | no |
| coil | candidate | 0.011 (0.772) | -0.024 | 0.003 | -0.0037 | no |
| skew60 | candidate | -0.001 (-0.051) | -0.024 | -0.003 | -0.0069 | no |
| amihud | control | 0.007 (0.603) | 0.027 | -0.001 | 0.0016 | no |
| noise | control | -0.003 (-0.731) | 0.002 | 0.007 | -0.0038 | no |

## Modifiers on top-quintile momentum (higher half minus lower half, mean 20-session return)

| Modifier | train diff (t) | validation | holdout | adopt |
|---|---|---|---|---|
| smooth_fip | 0.0041 (1.021) | -0.0096 | -0.0093 | no |
| eff_ratio60 | 0.0069 (2.096) | -0.0031 | 0.0073 | no |
| resid_mom | 0.0012 (0.288) | 0.0008 | -0.0075 | no |
| max5 | -0.0097 (-2.866) | -0.0063 | -0.008 | no |
| overnight60 | 0.0066 (1.523) | 0.0102 | 0.0008 | no |
| clv20 | 0.0018 (0.538) | -0.0094 | 0.0028 | no |

## What the winners looked like (mean percentile of winners minus losers, top 5 percent against bottom 5 percent of 20-session returns)

| Feature | train | validation | holdout |
|---|---|---|---|
| mom12_1 | 0.067 | 0.038 | 0.026 |
| near_high | 0.033 | 0.039 | 0.016 |
| rev21 | 0.017 | -0.013 | 0.005 |
| smooth_fip | 0.049 | -0.028 | -0.005 |
| eff_ratio60 | 0.033 | 0.017 | 0.019 |
| resid_mom | 0.065 | 0.03 | 0.025 |
| max5 | 0.016 | -0.047 | -0.014 |
| overnight60 | -0.014 | 0.06 | 0.007 |
| vol_shock | -0.011 | 0.063 | 0.018 |
| ud_vol | -0.008 | 0.005 | -0.005 |
| clv20 | 0.001 | -0.052 | -0.015 |
| coil | 0.01 | -0.04 | -0.001 |
| skew60 | -0.002 | -0.035 | -0.028 |
| amihud | 0.037 | 0.078 | 0.047 |
| noise | -0.01 | -0.011 | 0.0 |

Adoption rule and every threshold are in the PREREGISTRATION block of study.py. A feature that fails stays failed.