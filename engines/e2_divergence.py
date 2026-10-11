"""Engine 2 — DIVERGENCE. Regular bullish RSI divergence at a swing low, released by confirmation.

Price makes a lower low while RSI makes a higher low (selling pressure is fading). That alone is a
setup, not a signal: it fires only on a bar that also carries at least three more of the confirmations
below, with a bullish breakout of the prior day's high mandatory. Stops sit under the divergence low;
targets are the 38.2%, 61.8% and 100% retracements of the decline into it.

Swing (up to 20 days) when the stock is below its 200-day, positional (up to 45 days) when above.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Signal, liquid
from indicators import atr, ema, macd_hist, pivots, rsi, sma, stoch_k

NAME = "divergence"
TITLE = "Divergence"
COOLDOWN = 10
K = 4                    # pivot half-width: a low is confirmed K bars after it prints
OPT = {"regime": False, "min_conf": 2, "r1_max": 45}      # FROZEN 2026-10-12 after sweep.py (see research/VARIANTS_LOG.jsonl)
WINDOW = 6               # a divergence stays actionable for this many bars after confirmation


def scan(df: pd.DataFrame, sym: str, ctx=None, last_only: bool = False) -> list[Signal]:
    c, h, l, o, v = df["Close"], df["High"], df["Low"], df["Open"], df["Volume"]
    a = atr(df, 14)
    r = rsi(c, 14)
    mh = macd_hist(c)
    st = stoch_k(df, 14)
    e10 = ema(c, 10)
    s200 = sma(c, 200)
    vr = v / v.rolling(20).mean().shift(1)
    liq = liquid(df)
    rng = (h - l).replace(0, np.nan)
    body = (c - o).abs()
    bull = c > o
    hammer = bull & ((np.minimum(o, c) - l) >= 2 * body) & ((c - l) / rng >= 0.66)
    engulf = bull & (o <= c.shift(1)) & (c >= o.shift(1)) & (c.shift(1) < o.shift(1))
    conf = {
        "RSI rising two bars": (r > r.shift(1)) & (r.shift(1) > r.shift(2)),
        "MACD histogram turning up": (mh > mh.shift(1)) & (mh.shift(1) < 0),
        "volume 1.2x the 20-day average": vr >= 1.2,
        "reclaimed the 10-day average": (c > e10) & (c.shift(1) <= e10.shift(1)),
        "stochastic turning up from the low zone": (st > st.shift(1)) & (st.shift(1) < 30),
        "hammer or bullish engulfing": hammer | engulf,
    }
    n_conf = sum(x.fillna(False).astype(int) for x in conf.values())
    trigger = (c > h.shift(1)) & bull          # mandatory: closes above the prior high
    if ctx is not None and OPT["regime"]:
        liq = liq & ctx.regime_for(df.index)
    lowp = pivots(l, K, "low").values
    piv_pos = [t - K for t in np.flatnonzero(lowp)]          # positions of confirmed swing lows

    out: list[Signal] = []
    last = -10**9
    n = len(df)
    # for each divergence, the actionable bars are [confirm, confirm + WINDOW]
    for j, p2 in enumerate(piv_pos):
        if j == 0:
            continue
        confirm = p2 + K
        # the nearest earlier swing low 8-60 bars back that this low undercuts
        p1 = next((q for q in reversed(piv_pos[:j]) if 8 <= p2 - q <= 60), None)
        if p1 is None:
            continue
        if not (l.iloc[p2] < l.iloc[p1] * 0.995 and r.iloc[p2] > r.iloc[p1] + 2 and r.iloc[p1] < OPT["r1_max"] and r.iloc[p2] < 52):
            continue
        h1 = float(h.iloc[p1:p2 + 1].max())
        if h1 <= l.iloc[p2]:
            continue
        for t in range(confirm, min(confirm + WINDOW, n - 1) + 1):
            if last_only and t != n - 1:
                continue
            if t - last < COOLDOWN or not liq.iloc[t] or not trigger.iloc[t]:
                continue
            if c.iloc[t] < l.iloc[p2]:                       # the low has broken: divergence is void
                break
            hits = [k for k, x in conf.items() if bool(x.iloc[t])]
            if len(hits) < OPT["min_conf"]:
                continue
            price, at = float(c.iloc[t]), float(a.iloc[t])
            if not at > 0:
                continue
            sl = max(float(l.iloc[p2]) - 0.3 * at, price * 0.90)
            risk = price - sl
            leg = h1 - float(l.iloc[p2])
            t1 = float(l.iloc[p2]) + 0.382 * leg
            t2 = float(l.iloc[p2]) + 0.618 * leg
            t3 = float(l.iloc[p2]) + 1.0 * leg
            t1 = max(t1, price + 0.8 * risk)
            if risk <= 0 or t3 < price + 1.8 * risk:         # the prior high must pay at least 1.8R
                continue
            if t2 <= t1:
                t2 = (t1 + t3) / 2
            above200 = bool(s200.iloc[t] and price > s200.iloc[t])
            out.append(Signal(NAME, sym, int(t), df.index[t], price, sl, [t1, t2, t3], 45 if above200 else 20,
                              "Bullish RSI divergence", [
                                  f"price made a lower low ({l.iloc[p2]:.2f} vs {l.iloc[p1]:.2f}) while RSI made a higher low ({r.iloc[p2]:.0f} vs {r.iloc[p1]:.0f})",
                                  "closed above the prior day's high on a bullish candle",
                                  *hits[:4],
                              ], "positional" if above200 else "swing", {"low": float(l.iloc[p2]), "n_conf": len(hits)}))
            last = t
            break
    return out
