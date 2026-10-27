# Tripwire factor study

Run 2026-10-27 02:53 UTC on 660 symbols, 2015-10-26 to 2026-10-26. Survivorship bias applies (today's constituents only): results are an upper bound.

| Feature | kind | train IC (t) | validation IC | holdout IC | holdout Q5 net | adopt |
|---|---|---|---|---|---|---|
| mom12_1 | common baseline | 0.047 (2.448) | 0.041 | 0.034 | 0.0026 | no |
| near_high | common baseline | 0.025 (1.104) | 0.033 | 0.037 | -0.0004 | no |
| rev21 | common baseline | 0.02 (1.568) | -0.006 | -0.006 | -0.0053 | no |
| smooth_fip | candidate | 0.031 (2.415) | 0.001 | 0.027 | -0.0045 | no |
| eff_ratio60 | candidate | 0.036 (2.771) | 0.008 | 0.046 | 0.0035 | no |
| resid_mom | candidate | 0.053 (2.699) | 0.037 | 0.037 | -0.0005 | no |
| max5 | candidate | 0.027 (2.227) | -0.029 | 0.001 | -0.0092 | no |
| overnight60 | candidate | -0.02 (-1.662) | 0.02 | -0.012 | 0.0009 | no |
| vol_shock | candidate | -0.001 (-0.138) | 0.027 | 0.009 | 0.0002 | no |
| ud_vol | candidate | -0.012 (-1.302) | 0.002 | -0.008 | -0.0025 | no |
| clv20 | candidate | 0.015 (1.21) | -0.004 | 0.027 | -0.0049 | no |
| coil | candidate | 0.01 (0.7) | -0.023 | 0.003 | -0.0044 | no |
| skew60 | candidate | -0.002 (-0.22) | -0.021 | -0.005 | -0.0063 | no |
| amihud | control | 0.007 (0.556) | 0.027 | 0.004 | 0.0016 | no |
| noise | control | -0.006 (-1.292) | -0.002 | 0.006 | -0.0038 | no |

## Modifiers on top-quintile momentum (higher half minus lower half, mean 20-session return)

| Modifier | train diff (t) | validation | holdout | adopt |
|---|---|---|---|---|
| smooth_fip | 0.0051 (1.348) | -0.0103 | -0.0099 | no |
| eff_ratio60 | 0.0084 (2.504) | -0.004 | 0.0089 | no |
| resid_mom | 0.0042 (0.959) | 0.0015 | -0.0064 | no |
| max5 | -0.0103 (-2.992) | -0.007 | -0.0071 | no |
| overnight60 | 0.0086 (1.982) | 0.0093 | 0.0 | no |
| clv20 | 0.001 (0.337) | -0.0074 | 0.0031 | no |

## What the winners looked like (mean percentile of winners minus losers, top 5 percent against bottom 5 percent of 20-session returns)

| Feature | train | validation | holdout |
|---|---|---|---|
| mom12_1 | 0.063 | 0.039 | 0.015 |
| near_high | 0.02 | 0.04 | 0.016 |
| rev21 | 0.026 | -0.01 | 0.006 |
| smooth_fip | 0.034 | -0.033 | -0.006 |
| eff_ratio60 | 0.03 | 0.023 | 0.019 |
| resid_mom | 0.062 | 0.028 | 0.016 |
| max5 | 0.014 | -0.053 | -0.013 |
| overnight60 | -0.014 | 0.071 | 0.008 |
| vol_shock | -0.001 | 0.062 | 0.022 |
| ud_vol | -0.019 | 0.016 | -0.007 |
| clv20 | -0.005 | -0.048 | -0.015 |
| coil | 0.002 | -0.05 | -0.004 |
| skew60 | -0.0 | -0.031 | -0.027 |
| amihud | 0.046 | 0.079 | 0.04 |
| noise | -0.011 | -0.019 | -0.0 |

Adoption rule and every threshold are in the PREREGISTRATION block of study.py. A feature that fails stays failed.