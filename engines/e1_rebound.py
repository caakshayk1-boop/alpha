"""Engine 1 — REBOUND. Quality companies in a drawdown whose recovery has started.

Descended from the earlier 'magic' and 'magicmagic' screens (3-year CAGR positive, weekly RSI 46+,
15-40% below the 52-week high, staged targets up to that high). Two changes: the screens had no
trigger, so they caught falling knives; this one waits for the first close above both the 20-day
average and the prior five-day high. And its stop and targets are priced the way the ledger priced
them, so the old and new results are comparable.

Positional: 1 to 3 months.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Signal, liquid
from indicators import atr, ema, rsi, weekly, weekly_to_daily

NAME = "rebound"
TITLE = "Rebound"
COOLDOWN = 20
MAX_HOLD = 60
OPT = {"regime": False, "rs21_min": None, "above50": False}      # variants are set by explore.py


def scan(df: pd.DataFrame, sym: str, ctx=None, last_only: bool = False) -> list[Signal]:
    c, h, l = df["Close"], df["High"], df["Low"]
    a = atr(df, 14)
    hi52 = h.rolling(252, min_periods=200).max()
    lo52 = l.rolling(252, min_periods=200).min()
    dist_hi = (hi52 - c) / hi52
    dist_lo = (c - lo52) / lo52
    w = weekly(df)
    rsi_w = weekly_to_daily(rsi(w["Close"], 14), df.index)
    rsi_w_prev = weekly_to_daily(rsi(w["Close"], 14).shift(2), df.index)
    cagr_ok = c / c.shift(756) > 1.0
    trigger = (c > ema(c, 20)) & (c > h.shift(1).rolling(5).max())
    cond = (liquid(df) & dist_hi.between(0.15, 0.45) & (dist_lo >= 0.10) & (rsi_w >= 46) & (rsi_w > rsi_w_prev)
            & cagr_ok & trigger)
    if ctx is not None and OPT["regime"]:
        cond &= ctx.regime_for(df.index)
    if ctx is not None and OPT["rs21_min"]:
        cond &= ctx.rs(sym, df.index, 21) >= OPT["rs21_min"]
    if OPT["above50"]:
        cond &= c > c.rolling(50).mean()
    idx = np.flatnonzero(cond.values)
    if last_only:
        idx = idx[idx == len(df) - 1]
    swing_low = l.rolling(50, min_periods=50).min()
    out: list[Signal] = []
    last = -10**9
    for t in idx:
        if t - last < COOLDOWN:
            continue
        price, hi, at = float(c.iloc[t]), float(hi52.iloc[t]), float(a.iloc[t])
        if not (at > 0 and np.isfinite(at)):
            continue
        sl_raw = min(float(swing_low.iloc[t]) - 0.5 * at, price - 3.0 * at)       # the WIDER of structure and 3 ATR
        sl = min(max(sl_raw, price * 0.88), price * 0.96)                          # kept between 4% and 12% below
        risk = price - sl
        room = hi - price
        if risk <= 0 or room <= 0:
            continue
        t1, t2, t3 = price + 0.40 * room, price + 0.70 * room, hi
        t1 = max(t1, price + 1.0 * risk)                                            # T1 must repay the risk
        if t3 < t1 * 1.01:
            continue                                                                # no room to the high
        if t1 >= t2:
            t2 = (t1 + t3) / 2
        out.append(Signal(NAME, sym, int(t), df.index[t], price, sl, [t1, t2, t3], MAX_HOLD,
                          "Dip recovery", [
                              f"{dist_hi.iloc[t] * 100:.0f}% below the 52-week high",
                              f"weekly RSI {rsi_w.iloc[t]:.0f} and rising",
                              "3-year return positive",
                              "closed above the 20-day average and the prior 5-day high",
                          ], "positional", {"hi52": hi}))
        last = t
    return out
