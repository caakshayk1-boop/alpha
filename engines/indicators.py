"""indicators.py — plain numpy/pandas indicators. No lookahead: every value at bar t uses bars <= t only."""
from __future__ import annotations

import numpy as np
import pandas as pd


def sma(s: pd.Series, n: int) -> pd.Series:
    return s.rolling(n, min_periods=n).mean()


def ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False, min_periods=n).mean()


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    """Wilder's RSI."""
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    rs = up / dn.replace(0, np.nan)
    out = 100 - 100 / (1 + rs)
    return out.where(dn != 0, 100.0)


def true_range(df: pd.DataFrame) -> pd.Series:
    pc = df["Close"].shift(1)
    return pd.concat([df["High"] - df["Low"], (df["High"] - pc).abs(), (df["Low"] - pc).abs()], axis=1).max(axis=1)


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    return true_range(df).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def macd_hist(close: pd.Series, fast: int = 12, slow: int = 26, sig: int = 9) -> pd.Series:
    m = ema(close, fast) - ema(close, slow)
    return m - m.ewm(span=sig, adjust=False, min_periods=sig).mean()


def adx(df: pd.DataFrame, n: int = 14) -> pd.Series:
    up = df["High"].diff()
    dn = -df["Low"].diff()
    plus = np.where((up > dn) & (up > 0), up, 0.0)
    minus = np.where((dn > up) & (dn > 0), dn, 0.0)
    tr = true_range(df).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    pdi = 100 * pd.Series(plus, index=df.index).ewm(alpha=1 / n, adjust=False, min_periods=n).mean() / tr
    mdi = 100 * pd.Series(minus, index=df.index).ewm(alpha=1 / n, adjust=False, min_periods=n).mean() / tr
    dx = 100 * (pdi - mdi).abs() / (pdi + mdi).replace(0, np.nan)
    return dx.ewm(alpha=1 / n, adjust=False, min_periods=n).mean()


def stoch_k(df: pd.DataFrame, n: int = 14) -> pd.Series:
    lo = df["Low"].rolling(n, min_periods=n).min()
    hi = df["High"].rolling(n, min_periods=n).max()
    return 100 * (df["Close"] - lo) / (hi - lo).replace(0, np.nan)


def weekly(df: pd.DataFrame) -> pd.DataFrame:
    """Weekly bars labelled by the LAST trading day of the week, so a weekly value is only ever
    visible on the day the week actually completed (no lookahead)."""
    g = df.groupby(pd.Grouper(freq="W-FRI"))
    w = pd.DataFrame({
        "Open": g["Open"].first(), "High": g["High"].max(), "Low": g["Low"].min(),
        "Close": g["Close"].last(), "Volume": g["Volume"].sum(),
    }).dropna(subset=["Close"])
    last_day = df.index.to_series().groupby(pd.Grouper(freq="W-FRI")).last().dropna()
    w.index = pd.DatetimeIndex(last_day.reindex(w.index).values)
    # The final week is only real once it has ended. A scan run on a Wednesday must not see a three-day
    # 'weekly' bar: backtests only ever see completed weeks, so a live scan has to as well. A week that
    # ended early for a holiday is picked up the following Monday, when a new week has begun.
    if len(df) and df.index[-1].weekday() != 4 and len(w) and w.index[-1] == df.index[-1]:
        w = w.iloc[:-1]
    return w


def weekly_to_daily(series_w: pd.Series, daily_index: pd.DatetimeIndex) -> pd.Series:
    """Carry a weekly value forward to the daily bars after the week completed."""
    return series_w.reindex(daily_index, method="ffill")


def pivots(series: pd.Series, k: int, kind: str) -> pd.Series:
    """Swing pivots, CONFIRMED k bars late: the value at bar t is the pivot at t-k, known only at t.
    Returns a boolean Series indexed like `series`, True at the bar where the pivot is confirmed;
    the pivot itself sits at position t-k."""
    x = series.values
    n = len(x)
    out = np.zeros(n, dtype=bool)
    for t in range(2 * k, n):
        c = t - k
        win = x[c - k: t + 1]
        if np.isnan(win).any():
            continue
        if kind == "low" and x[c] == win.min() and (win == x[c]).sum() == 1:
            out[t] = True
        elif kind == "high" and x[c] == win.max() and (win == x[c]).sum() == 1:
            out[t] = True
    return pd.Series(out, index=series.index)
