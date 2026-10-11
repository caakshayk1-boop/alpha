"""Engine 2 — DIVERGENCE. Regular bullish RSI divergence at a swing low, released by confirmation.

Price makes a lower low while RSI makes a higher low (selling pressure is fading). That alone is a
setup, not a signal: it fires only on a bar that also carries at least three more of the confirmations
below, with a bullish breakout of the prior day's high mandatory. Stops sit under the divergence low;
targets are the 38.2%, 61.8% and 100% retracements of the decline into it.

Swing (up to 20 days) when the stock is below its 200-day, positional (up to 45 days) when above.

TWO KINDS. Regular divergence (above) is a reversal setup. HIDDEN divergence is the continuation twin: inside an
uptrend, price makes a HIGHER low while RSI makes a lower low, and the same confirmations release it. Hidden
divergence is where the stock's own benchmark matters: it can be required to be in an uptrend (OPT sec_*).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Signal, liquid, sector_gate, tag_bench
from indicators import atr, ema, macd_hist, pivots, rsi, sma, stoch_k, weekly

NAME = "divergence"
TITLE = "Divergence"
COOLDOWN = 10
K = 4                    # pivot half-width: a low is confirmed K bars after it prints
OPT = {"regime": False, "min_conf": 2, "r1_max": 45, "sec_trend": False, "sec_lead": False, "stk_lead": False, "hidden": False, "regular": True, "wdiv": False, "daily": True}      # FROZEN 2026-10-12: hidden and weekly kinds were tested and left off      # FROZEN 2026-10-12 after sweep.py (see research/VARIANTS_LOG.jsonl)
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
    gate = sector_gate(ctx, sym, df, OPT)          # applies to the HIDDEN kind only
    s50 = sma(c, 50)
    uptrend = (c > s50) & (s50 > s200)
    lowp = pivots(l, K, "low").values
    piv_pos = [t - K for t in np.flatnonzero(lowp)]          # positions of confirmed swing lows

    out: list[Signal] = []
    last = -10**9
    n = len(df)
    # for each divergence, the actionable bars are [confirm, confirm + WINDOW]
    for j, p2 in (enumerate(piv_pos) if OPT["daily"] else []):
        if j == 0:
            continue
        confirm = p2 + K
        # the nearest earlier swing low 8-60 bars back that this low undercuts
        p1 = next((q for q in reversed(piv_pos[:j]) if 8 <= p2 - q <= 60), None)
        if p1 is None:
            continue
        kinds = []
        if OPT["regular"] and l.iloc[p2] < l.iloc[p1] * 0.995 and r.iloc[p2] > r.iloc[p1] + 2 and r.iloc[p1] < OPT["r1_max"] and r.iloc[p2] < 52:
            kinds.append("regular")
        if OPT["hidden"] and l.iloc[p2] > l.iloc[p1] * 1.005 and r.iloc[p2] < r.iloc[p1] - 2 and 35 <= r.iloc[p2] <= 55:
            kinds.append("hidden")
        if not kinds:
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
            kind = next((k for k in kinds if k == "regular" or (bool(uptrend.iloc[t]) and bool(gate.iloc[t]))), None)
            if kind is None:
                continue
            price, at = float(c.iloc[t]), float(a.iloc[t])
            if not at > 0:
                continue
            sl = max(float(l.iloc[p2]) - 0.3 * at, price * 0.90)
            risk = price - sl
            leg = h1 - float(l.iloc[p2])
            lo2 = float(l.iloc[p2])
            if kind == "regular":
                t1, t2, t3 = lo2 + 0.382 * leg, lo2 + 0.618 * leg, lo2 + 1.0 * leg
                need = 1.8
                title = "Bullish RSI divergence"
                why = f"price made a lower low ({l.iloc[p2]:.2f} vs {l.iloc[p1]:.2f}) while RSI made a higher low ({r.iloc[p2]:.0f} vs {r.iloc[p1]:.0f})"
            else:
                t1, t2, t3 = h1, lo2 + 1.272 * leg, lo2 + 1.618 * leg
                need = 2.0
                title = "Hidden bullish divergence"
                why = f"in an uptrend, price made a higher low ({l.iloc[p2]:.2f} vs {l.iloc[p1]:.2f}) while RSI made a lower low ({r.iloc[p2]:.0f} vs {r.iloc[p1]:.0f})"
            t1 = max(t1, price + 0.8 * risk)
            if risk <= 0 or t3 < price + need * risk:        # the move must pay for the risk
                continue
            if t2 <= t1:
                t2 = (t1 + t3) / 2
            if t3 <= t2:
                t3 = t2 + 0.5 * risk
            above200 = bool(s200.iloc[t] and price > s200.iloc[t])
            out.append(Signal(NAME, sym, int(t), df.index[t], price, sl, [t1, t2, t3], 45 if above200 else 20,
                              title, [why, "closed above the prior day's high on a bullish candle", *hits[:4]],
                              "positional" if above200 else "swing", {"low": lo2, "n_conf": len(hits), "kind": kind}))
            last = t
            break
    if OPT["wdiv"]:
        out.extend(_weekly_div(df, sym, ctx, last_only))
        out.sort(key=lambda x: x.t)
    return tag_bench(out, ctx, sym, df)


def _weekly_div(df: pd.DataFrame, sym: str, ctx, last_only: bool) -> list[Signal]:
    """Regular bullish divergence on WEEKLY bars, released by a weekly close above the prior week's high with two
    of: weekly MACD histogram turning up, weekly volume 1.1x its 10-week average, a reclaim of the 10-week average,
    a hammer or engulfing candle. Slower and rarer than the daily rule; held for months."""
    w = weekly(df)
    if len(w) < 60:
        return []
    wc, wh, wl, wo, wv = w["Close"], w["High"], w["Low"], w["Open"], w["Volume"]
    wr = rsi(wc, 14)
    wmh = macd_hist(wc)
    we10 = ema(wc, 10)
    wa = atr(w, 10)
    rng = (wh - wl).replace(0, np.nan)
    body = (wc - wo).abs()
    bull = wc > wo
    conf = {
        "weekly MACD histogram turning up": (wmh > wmh.shift(1)) & (wmh.shift(1) < 0),
        "weekly volume 1.1x its 10-week average": wv >= 1.1 * wv.rolling(10).mean().shift(1),
        "reclaimed the 10-week average": (wc > we10) & (wc.shift(1) <= we10.shift(1)),
        "weekly hammer or bullish engulfing": (bull & ((np.minimum(wo, wc) - wl) >= 2 * body) & ((wc - wl) / rng >= 0.66)) | (bull & (wo <= wc.shift(1)) & (wc >= wo.shift(1)) & (wc.shift(1) < wo.shift(1))),
    }
    gate_d = sector_gate(ctx, sym, df, OPT)
    lowp = pivots(wl, 3, "low").values
    piv = [k - 3 for k in np.flatnonzero(lowp)]
    out: list[Signal] = []
    last_t = -99
    n = len(w)
    for j, p2 in enumerate(piv):
        if j == 0:
            continue
        p1 = next((q for q in reversed(piv[:j]) if 6 <= p2 - q <= 40), None)
        if p1 is None or not (wl.iloc[p2] < wl.iloc[p1] * 0.99 and wr.iloc[p2] > wr.iloc[p1] + 3 and wr.iloc[p1] < 45 and wr.iloc[p2] < 50):
            continue
        h1 = float(wh.iloc[p1:p2 + 1].max())
        lo2 = float(wl.iloc[p2])
        for k in range(p2 + 3, min(p2 + 6, n - 1) + 1):
            date = w.index[k]
            if date not in df.index or k < 40:
                continue
            t = df.index.get_loc(date)
            if (last_only and t != len(df) - 1) or t - last_t < 40 or not bool(liquid(df).iloc[t]) or not bool(gate_d.iloc[t]):
                continue
            if wc.iloc[k] < lo2:
                break
            hits = [name for name, x in conf.items() if bool(x.iloc[k])]
            if not (bull.iloc[k] and wc.iloc[k] > wh.iloc[k - 1] and wr.iloc[k] > wr.iloc[k - 1] and len(hits) >= 2):
                continue
            price = float(wc.iloc[k])
            sl = max(lo2 - 0.3 * float(wa.iloc[k]), price * 0.82)
            risk = price - sl
            leg = h1 - lo2
            t1, t2, t3 = lo2 + 0.382 * leg, lo2 + 0.618 * leg, lo2 + 1.0 * leg
            t1 = max(t1, price + 0.8 * risk)
            if risk <= 0 or t3 < price + 2.0 * risk:
                continue
            if t2 <= t1:
                t2 = (t1 + t3) / 2
            out.append(Signal(NAME, sym, int(t), date, price, sl, [t1, t2, t3], 120, "Weekly bullish divergence",
                              [f"on weekly bars, price made a lower low ({lo2:.2f} vs {wl.iloc[p1]:.2f}) while RSI made a higher low ({wr.iloc[p2]:.0f} vs {wr.iloc[p1]:.0f})",
                               "weekly close above the prior week's high on a bullish candle", *hits[:3]], "long", {"kind": "weekly"}))
            last_t = t
            break
    return out
