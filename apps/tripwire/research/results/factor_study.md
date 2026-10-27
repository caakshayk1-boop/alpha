# Tripwire factor study

Run 2026-10-27 07:00 UTC on 660 symbols, 2015-10-27 to 2026-10-27. Survivorship bias applies (today's constituents only): results are an upper bound.

| Feature | kind | train IC (t) | validation IC | holdout IC | holdout Q5 net | adopt |
|---|---|---|---|---|---|---|
| mom12_1 | common baseline | 0.048 (2.511) | 0.044 | 0.032 | 0.0019 | no |
| near_high | common baseline | 0.026 (1.201) | 0.036 | 0.04 | 0.0001 | no |
| rev21 | common baseline | 0.019 (1.475) | -0.016 | -0.008 | -0.0064 | no |
| smooth_fip | candidate | 0.032 (2.446) | 0.001 | 0.028 | -0.0039 | no |
| eff_ratio60 | candidate | 0.033 (2.638) | 0.01 | 0.045 | 0.0041 | no |
| resid_mom | candidate | 0.055 (2.815) | 0.041 | 0.035 | -0.0003 | no |
| max5 | candidate | 0.028 (2.416) | -0.031 | 0.009 | -0.0087 | no |
| overnight60 | candidate | -0.023 (-1.827) | 0.021 | -0.013 | 0.0008 | no |
| vol_shock | candidate | -0.006 (-0.593) | 0.031 | 0.006 | -0.0005 | no |
| ud_vol | candidate | -0.015 (-1.678) | 0.001 | -0.011 | -0.0027 | no |
| clv20 | candidate | 0.013 (1.028) | -0.001 | 0.033 | -0.004 | no |
| coil | candidate | 0.01 (0.752) | -0.026 | 0.005 | -0.0043 | no |
| skew60 | candidate | -0.0 (-0.05) | -0.021 | -0.003 | -0.0067 | no |
| amihud | control | 0.008 (0.706) | 0.027 | -0.004 | 0.0011 | no |
| noise | control | -0.007 (-1.399) | 0.0 | 0.005 | -0.0036 | no |

## Modifiers on top-quintile momentum (higher half minus lower half, mean 20-session return)

| Modifier | train diff (t) | validation | holdout | adopt |
|---|---|---|---|---|
| smooth_fip | 0.004 (1.029) | -0.0106 | -0.0078 | no |
| eff_ratio60 | 0.0083 (2.58) | -0.002 | 0.0115 | no |
| resid_mom | 0.0037 (0.893) | 0.0011 | -0.0036 | no |
| max5 | -0.0094 (-2.572) | -0.0067 | -0.0078 | no |
| overnight60 | 0.0064 (1.419) | 0.0101 | 0.0007 | no |
| clv20 | 0.0039 (1.199) | -0.0048 | 0.0061 | no |

## What the winners looked like (mean percentile of winners minus losers, top 5 percent against bottom 5 percent of 20-session returns)

| Feature | train | validation | holdout |
|---|---|---|---|
| mom12_1 | 0.065 | 0.035 | 0.022 |
| near_high | 0.024 | 0.038 | 0.014 |
| rev21 | 0.026 | -0.023 | 0.014 |
| smooth_fip | 0.041 | -0.031 | -0.0 |
| eff_ratio60 | 0.027 | 0.015 | 0.022 |
| resid_mom | 0.063 | 0.026 | 0.021 |
| max5 | 0.024 | -0.057 | -0.001 |
| overnight60 | -0.017 | 0.06 | 0.003 |
| vol_shock | -0.005 | 0.065 | 0.014 |
| ud_vol | -0.022 | 0.009 | -0.018 |
| clv20 | -0.007 | -0.042 | -0.011 |
| coil | -0.002 | -0.053 | 0.006 |
| skew60 | 0.0 | -0.039 | -0.021 |
| amihud | 0.045 | 0.059 | 0.039 |
| noise | -0.009 | -0.006 | 0.004 |

Adoption rule and every threshold are in the PREREGISTRATION block of study.py. A feature that fails stays failed.