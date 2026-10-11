"""labels.py — what the models are asked to predict. This is the ONLY module that reads the future.

FORWARD EXCESS (regression targets)
  fwd_H        the return from the NEXT open to the close H sessions later (a signal on a close can only trade next open)
  excess_H     fwd_H minus the median fwd_H of every liquid stock that day, so the model learns to rank stocks against
               the market and the market's own drift cancels
  rank_H       the percentile of excess_H that day (0..1): robust to outliers, which are common in Indian small caps

TRIPLE BARRIER (classification target, López de Prado)
  Enter at the next open. A stop sits k ATRs below, a target m ATRs above, and a time limit of T sessions.
  hit = 1 if the TARGET is touched first, 0 if the stop is touched first or time runs out.
  If one session spans both, the stop is assumed to hit first (the same pessimism as the backtest).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from indicators import atr


def forward_returns(df: pd.DataFrame, horizons=(5, 21, 126)) -> pd.DataFrame:
    o, c = df["Open"], df["Close"]
    out = pd.DataFrame(index=df.index)
    for H in horizons:
        out[f"fwd_{H}"] = c.shift(-H) / o.shift(-1) - 1
    return out.astype("float32")


def barrier_label(df: pd.DataFrame, k: float, m: float, T: int) -> pd.Series:
    """1.0 if the +m ATR target is touched before the -k ATR stop within T sessions of the next open, 0.0 if not, NaN if undecidable."""
    o, h, l = df["Open"].values, df["High"].values, df["Low"].values
    a = atr(df, 14).values
    n = len(df)
    lab = np.full(n, np.nan, dtype="float32")
    if n < T + 3:
        return pd.Series(lab, index=df.index)
    idx = np.arange(n - T - 1)
    entry = o[idx + 1]
    stop = entry - k * a[idx]
    tgt = entry + m * a[idx]
    H = np.lib.stride_tricks.sliding_window_view(h, T)[idx + 1]           # sessions t+1 .. t+T
    L = np.lib.stride_tricks.sliding_window_view(l, T)[idx + 1]
    hit_t = H >= tgt[:, None]
    hit_s = L <= stop[:, None]
    first_t = np.where(hit_t.any(1), hit_t.argmax(1), T + 1)
    first_s = np.where(hit_s.any(1), hit_s.argmax(1), T + 1)
    ok = np.isfinite(a[idx]) & (a[idx] > 0)
    res = np.where(first_t < first_s, 1.0, 0.0)                               # ties go to the stop
    lab[idx] = np.where(ok, res, np.nan)
    return pd.Series(lab, index=df.index)


def build_labels(bars: dict, panel: pd.DataFrame, horizons=(5, 21, 126), barrier=(1.5, 3.0, 15), log=print) -> pd.DataFrame:
    parts = []
    for sym, df in bars.items():
        if len(df) < 300:
            continue
        f = forward_returns(df, horizons)
        f["barrier"] = barrier_label(df, *barrier)
        f["sym"] = sym
        parts.append(f)
    lab = pd.concat(parts)
    lab = lab.reset_index().rename(columns={"index": "date", "Date": "date"}).set_index(["date", "sym"]).sort_index()
    lab = lab.reindex(panel.index)
    liq = panel["liquid"] > 0
    for H in horizons:
        fwd = lab[f"fwd_{H}"].where(liq)
        med = fwd.groupby(level="date").transform("median")
        ex = fwd - med
        lab[f"excess_{H}"] = ex.astype("float32")
        lab[f"rank_{H}"] = ex.groupby(level="date").rank(pct=True).astype("float32")
    return lab


def add_group_relative(lab: pd.DataFrame, panel: pd.DataFrame, group_of: dict, H: int = 21) -> pd.DataFrame:
    """excess_gr_H: the stock's H-session return minus the median of its OWN benchmark group that day (sector beta removed).
    rank_gr_H: its percentile inside that group-day. Used by the Relative engine."""
    fwd = lab[f"fwd_{H}"].where(panel["liquid"] > 0)
    grp = pd.Series(panel.index.get_level_values("sym").map(group_of), index=panel.index)
    key = [panel.index.get_level_values("date"), grp.values]
    med = fwd.groupby(key).transform("median")
    ex = fwd - med
    size = fwd.groupby(key).transform("count")
    ex = ex.where((size >= 5) & grp.notna())                         # a group of fewer than five liquid stocks is not a benchmark
    lab[f"excess_gr_{H}"] = ex.astype("float32")
    lab[f"rank_gr_{H}"] = ex.groupby(key).rank(pct=True).astype("float32")
    return lab
