"""Indicators. Every rolling statistic at row t uses rows <= t only; 'previous n sessions' means rows t-n..t-1 (today excluded),
and percentiles are of PRECEDING observations only, as the spec requires."""
from __future__ import annotations

import numpy as np
import pandas as pd


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    pc = df["Close"].shift(1)
    tr = pd.concat([df["High"] - df["Low"], (df["High"] - pc).abs(), (df["Low"] - pc).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def prev_max(s: pd.Series, n: int) -> pd.Series:
    return s.shift(1).rolling(n, min_periods=n).max()


def prev_min(s: pd.Series, n: int) -> pd.Series:
    return s.shift(1).rolling(n, min_periods=n).min()


def prev_median(s: pd.Series, n: int) -> pd.Series:
    return s.shift(1).rolling(n, min_periods=n).median()


def preceding_pct_rank(s: pd.Series, window: int, min_obs: int) -> pd.Series:
    """Percentile (0-100) of today's value among the preceding `window` values (today excluded)."""
    vals = s.to_numpy(dtype=float)
    out = np.full(len(vals), np.nan)
    for i in range(len(vals)):
        lo = max(0, i - window)
        hist = vals[lo:i]
        hist = hist[~np.isnan(hist)]
        if len(hist) >= min_obs and not np.isnan(vals[i]):
            out[i] = (hist < vals[i]).mean() * 100
    return pd.Series(out, index=s.index)


def preceding_quantile(s: pd.Series, window: int, q: float, min_obs: int) -> pd.Series:
    return s.shift(1).rolling(window, min_periods=min_obs).quantile(q)


def traded_value_cr(df: pd.DataFrame, n: int = 20) -> pd.Series:
    return (df["Close"] * df["Volume"]).rolling(n, min_periods=n).median() / 1e7
