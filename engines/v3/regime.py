"""Market regime (configs/engines/regime.yaml, regime-1.0.0): deterministic, completed sessions only, with hysteresis.
Missing inputs are 'unknown', never bearish and never zero. VIX missing alone falls back to the realised-volatility test."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .ind import sma


def raw_state(nifty: pd.Series, vix: pd.Series | None) -> pd.Series:
    n = nifty.astype(float)
    s50, s200 = sma(n, 50), sma(n, 200)
    r60 = n / n.shift(60) - 1
    rv = np.log(n).diff().rolling(20, min_periods=20).std() * np.sqrt(252)
    rv_p90 = rv.shift(1).rolling(504, min_periods=252).quantile(0.9)
    v = vix.reindex(n.index) if vix is not None else pd.Series(np.nan, index=n.index)
    v_p90 = v.shift(1).rolling(504, min_periods=252).quantile(0.9)
    out = pd.Series("range", index=n.index, dtype=object)
    up = (n > s200) & (s50 > s200) & (r60 > 0)
    dn = (n < s200) & (s50 < s200) & (r60 < 0)
    stress = (rv > rv_p90) | (v > v_p90)
    out[dn] = "trend_down"
    out[up] = "trend_up"
    out[stress.fillna(False)] = "stress"
    unknown = s200.isna() | r60.isna() | rv_p90.isna() | n.isna()
    out[unknown] = "unknown"
    return out


def with_hysteresis(raw: pd.Series, k: int = 3) -> pd.Series:
    """The published state changes only after k consecutive sessions classify the same new state. 'unknown' is immediate:
    a missing input is never smoothed over."""
    out, cur, cand, run = [], None, None, 0
    for x in raw.to_numpy():
        if x == "unknown":
            cur, cand, run = "unknown", None, 0
        elif cur is None or cur == "unknown":
            cur, cand, run = x, None, 0
        elif x == cur:
            cand, run = None, 0
        else:
            run = run + 1 if x == cand else 1
            cand = x
            if run >= k:
                cur, cand, run = x, None, 0
        out.append(cur)
    return pd.Series(out, index=raw.index, dtype=object)


def regime(nifty: pd.Series, vix: pd.Series | None, k: int = 3) -> pd.Series:
    return with_hysteresis(raw_state(nifty, vix), k)
