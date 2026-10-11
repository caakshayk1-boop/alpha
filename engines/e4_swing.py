"""Engine 4 — SWING. A pullback inside an uptrend, bought on the first confirmed turn. 3 to 12 trading days.

Trend (50-day above 200-day, price above the 50), a pullback that tagged the 20-day average with RSI
cooled, then a trigger day that closes above the prior high on above-average volume. Strength
relative to the index must be positive. Short holding window by design: the engine is wrong fast.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Signal, liquid
from indicators import adx, atr, ema, rsi, sma

NAME = "swing"
TITLE = "Swing"
COOLDOWN = 6
MAX_HOLD = 12
OPT = {"regime": True, "rs126_min": 85}      # FROZEN 2026-10-12


def scan(df: pd.DataFrame, sym: str, ctx=None, last_only: bool = False) -> list[Signal]:
    c, h, l, o, v = df["Close"], df["High"], df["Low"], df["Open"], df["Volume"]
    a = atr(df, 14)
    e20, s50, s200 = ema(c, 20), sma(c, 50), sma(c, 200)
    r = rsi(c, 14)
    dx = adx(df, 14)
    trend = (s50 > s200) & (c > s50) & (s50 > s50.shift(10))
    pulled = (l.rolling(4).min() <= e20 * 1.01) & (r.rolling(5).min() < 50) & (r.rolling(5).min() > 28)
    trig = (c > o) & (c > h.shift(1)) & (c > e20) & (r > r.shift(1)) & (r.between(42, 65))
    volok = v >= 1.0 * v.rolling(20).mean().shift(1)
    cond = liquid(df) & trend & pulled & trig & volok & (dx >= 16)
    if ctx is not None:
        b = ctx.bench.reindex(df.index, method="ffill")
        cond &= (c / c.shift(63) > b / b.shift(63))
        if OPT["regime"]:
            cond &= ctx.regime_for(df.index)
        if OPT["rs126_min"]:
            cond &= ctx.rs(sym, df.index, 126) >= OPT["rs126_min"]
    idx = np.flatnonzero(cond.values)
    if last_only:
        idx = idx[idx == len(df) - 1]
    hi20 = h.rolling(20).max()
    out: list[Signal] = []
    last = -10**9
    for t in idx:
        if t - last < COOLDOWN:
            continue
        price, at = float(c.iloc[t]), float(a.iloc[t])
        if not (at > 0):
            continue
        sl = float(min(l.iloc[t - 2:t + 1].min(), l.iloc[t - 6:t + 1].min())) - 0.2 * at
        sl = max(sl, price * 0.93)
        risk = price - sl
        if risk <= 0 or risk / price < 0.01:
            continue
        top = float(hi20.iloc[t])
        t1 = price + 1.2 * risk
        t2 = max(price + 2.0 * risk, top)
        t3 = price + 3.0 * risk
        if t2 >= t3:
            t3 = t2 + 1.0 * risk
        out.append(Signal(NAME, sym, int(t), df.index[t], price, sl, [t1, t2, t3], MAX_HOLD, "Pullback turn", [
            "uptrend: 50-day above 200-day, price above the 50-day",
            "pulled back to the 20-day average and RSI cooled",
            "trigger: closed above the prior high on a bullish candle",
            f"ADX {dx.iloc[t]:.0f}, RSI {r.iloc[t]:.0f}, ahead of the index over 3 months",
        ], "swing"))
        last = t
    return out
