"""Engine 3 — BREAKOUT. Classic chart-pattern breakouts on a daily close, with candle, volume and trend confirmation.

Patterns (each priced from its own geometry, never from a multiple of price):
  Darvas box          a tight box under a 20-day high that held for 5+ bars
  High breakout       a close above the prior 55-day closing high out of a quiet range
  Flat base           a flat ceiling tested three times above rising lows
  Inverse head & shoulders   head below two similar shoulders, neckline at the two peaks
  Double bottom       two lows within 3% with a 8%+ peak between
  Cup and handle      a 12-35% rounded decline and recovery with a shallow handle
  Bull flag           a 15%+ pole, then a shallow low-volume flag
Every breakout must be a strong bullish candle on volume, in a stage-2 trend, ahead of the index.
Measured-move targets: T1 = half the pattern height above the breakout level, T2 = the full height, T3 = 1.5x.
A WEEKLY variant runs the high-breakout and flat-base rules on weekly bars and holds for months.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Signal, liquid
from indicators import adx, atr, pivots, sma, weekly

NAME = "breakout"
TITLE = "Breakout"
COOLDOWN = 15
OPT = {"regime": True, "rs126_min": 80, "vol_min": 2.0, "weekly": True, "daily": True}      # FROZEN 2026-10-12


def _targets(level: float, height: float) -> list[float]:
    return [level + 0.5 * height, level + 1.0 * height, level + 1.5 * height]


def _daily_patterns(h, l, c, v, t, hi52, a_t):
    """Return (setup, level, floor, height, why) for the first pattern that fits at bar t, else None."""
    n_base = 40
    # ── Darvas box ────────────────────────────────────────────────
    win_h, win_l = h[t - 20:t], l[t - 20:t]
    top, bot = win_h.max(), win_l.min()
    top_pos = int(np.argmax(win_h))
    if (20 - top_pos) >= 5 and (top - bot) / top <= 0.12 and c[t] > top and top >= 0.90 * hi52:
        return ("Darvas box", top, bot, top - bot, [f"tight {((top - bot) / top) * 100:.0f}% box under a {20 - top_pos}-day-old high"])
    # ── flat base ─────────────────────────────────────────────────
    res = h[t - n_base:t].max()
    touches, last_touch = 0, -99
    for k in range(t - n_base, t):
        if h[k] >= res * 0.98 and k - last_touch >= 3:
            touches += 1
            last_touch = k
    if touches >= 3 and l[t - 10:t].min() > l[t - 25:t - 10].min() and c[t] > res * 1.002 and (res - l[t - n_base:t].min()) / res <= 0.22:
        floor = l[t - 15:t].min()
        return ("Flat base", res, floor, res - l[t - n_base:t].min(), [f"ceiling tested {touches} times above rising lows"])
    # ── bull flag ─────────────────────────────────────────────────
    for f in (5, 8, 12):
        fh, fl = h[t - f:t].max(), l[t - f:t].min()
        pole_low = c[t - f - 15:t - f].min()
        pole_gain = c[t - f] / pole_low - 1
        if pole_gain >= 0.15 and (fh - fl) / fh <= 0.10 and (c[t - f] - fl) / max(c[t - f] - pole_low, 1e-9) <= 0.5 \
                and v[t - f:t].mean() < v[t - f - 10:t - f].mean() and c[t] > fh:
            return ("Bull flag", fh, fl, c[t - f] - pole_low, [f"{pole_gain * 100:.0f}% pole then a {f}-day low-volume flag"])
    # ── cup and handle ────────────────────────────────────────────
    lo_w = t - 120
    if lo_w >= 0:
        seg = h[lo_w:t - 25]
        if len(seg) > 20:
            lp = lo_w + int(np.argmax(seg))
            rim_l = h[lp]
            bottom = l[lp:t - 8].min()
            depth = (rim_l - bottom) / rim_l
            rim_r = h[t - 25:t].max()
            handle_low = l[t - 12:t].min()
            if 0.12 <= depth <= 0.35 and 0.95 * rim_l <= rim_r <= 1.03 * rim_l and handle_low >= bottom + 0.5 * (rim_r - bottom) \
                    and (t - lp) >= 35 and c[t] > rim_r * 1.002:
                return ("Cup and handle", rim_r, handle_low, rim_r - bottom, [f"{depth * 100:.0f}% cup, shallow handle"])
    return None


def _pivot_patterns(h, l, c, t, lows_pos, highs_pos, a_t):
    """Inverse head & shoulders and double bottom from confirmed pivots (positions <= t - K)."""
    lp = [p for p in lows_pos if t - 130 <= p <= t - 3]
    hp = [p for p in highs_pos if t - 130 <= p <= t - 3]
    # inverse head and shoulders: three lows, middle lowest
    if len(lp) >= 3:
        l1, l2, l3 = lp[-3], lp[-2], lp[-1]
        a, b, d = l[l1], l[l2], l[l3]
        if b < min(a, d) * 0.97 and abs(a - d) / max(a, d) <= 0.10:
            p1 = [p for p in hp if l1 < p < l2]
            p2 = [p for p in hp if l2 < p < l3]
            if p1 and p2:
                pk1, pk2 = h[p1[-1]], h[p2[-1]]
                neck = (pk1 + pk2) / 2
                if abs(pk1 - pk2) / neck <= 0.06 and c[t] > neck * 1.003 and (t - l3) <= 25 and c[t - 1] <= neck * 1.03:
                    return ("Inverse head and shoulders", neck, d, neck - b,
                            [f"head {b:.2f} below shoulders {a:.2f} and {d:.2f}; neckline {neck:.2f}"])
    # double bottom
    if len(lp) >= 2:
        l1, l2 = lp[-2], lp[-1]
        a, b = l[l1], l[l2]
        if abs(a - b) / max(a, b) <= 0.03 and 15 <= l2 - l1 <= 80:
            peak = h[l1:l2 + 1].max()
            if peak >= max(a, b) * 1.08 and c[t] > peak * 1.002 and (t - l2) <= 30 and c[t - 1] <= peak * 1.03:
                return ("Double bottom", peak, min(a, b), peak - min(a, b), [f"two lows {a:.2f} and {b:.2f}, peak {peak:.2f}"])
    return None


def scan(df: pd.DataFrame, sym: str, ctx=None, last_only: bool = False) -> list[Signal]:
    c, h, l, o, v = df["Close"], df["High"], df["Low"], df["Open"], df["Volume"]
    a = atr(df, 14)
    s50, s200 = sma(c, 50), sma(c, 200)
    rng = (h - l).replace(0, np.nan)
    strong = (c > o) & ((c - l) / rng >= 0.70) & ((c - o) / rng >= 0.45)
    engulf = (c > o) & (o <= c.shift(1)) & (c >= o.shift(1)) & (c.shift(1) < o.shift(1))
    vr = v / v.rolling(20).mean().shift(1)
    hi52 = h.rolling(252, min_periods=120).max()
    stage2 = (c > s50) & (s50 > s200)
    cond = liquid(df) & stage2 & (strong | engulf) & (vr >= OPT["vol_min"]) & (c >= 0.85 * hi52)
    if ctx is not None:
        b = ctx.bench.reindex(df.index, method="ffill")
        cond &= (c / c.shift(63) > b / b.shift(63))
        if OPT["regime"]:
            cond &= ctx.regime_for(df.index)
        if OPT["rs126_min"]:
            cond &= ctx.rs(sym, df.index, 126) >= OPT["rs126_min"]
    hh, ll, cc, vv, hi = h.values, l.values, c.values, v.values, hi52.values
    lowp = pivots(l, 5, "low").values
    highp = pivots(h, 5, "high").values
    lows_pos = np.array([t - 5 for t in np.flatnonzero(lowp)])
    highs_pos = np.array([t - 5 for t in np.flatnonzero(highp)])
    dx = adx(df, 14).values
    out: list[Signal] = []
    last = -10**9
    n = len(df)
    for t in (np.flatnonzero(cond.values) if OPT["daily"] else []):
        if t < 130 or (last_only and t != n - 1) or t - last < COOLDOWN:
            continue
        hit = _daily_patterns(hh, ll, cc, vv, t, hi[t], a.iloc[t]) or _pivot_patterns(hh, ll, cc, t, lows_pos, highs_pos, a.iloc[t])
        if hit is None:
            # plain high breakout out of a quiet range
            prior = cc[t - 55:t].max()
            quiet = (hh[t - 10:t].max() - ll[t - 10:t].min()) / cc[t - 1] <= 0.12
            if cc[t] > prior and quiet and dx[t] >= 18:
                hit = ("High breakout", prior, ll[t - 10:t].min(), prior - ll[t - 25:t].min(), ["closed above the 55-day closing high out of a quiet range"])
        if hit is None:
            continue
        setup, level, floor, height, why = hit
        price, at = float(cc[t]), float(a.iloc[t])
        sl = max(float(floor) - 0.3 * at, price * 0.90)
        if not (sl < price) or height <= 0:
            continue
        tg = _targets(max(level, price), height)
        risk = price - sl
        if tg[1] < price + 1.5 * risk:                      # the full measured move must pay 1.5R
            continue
        out.append(Signal(NAME, sym, int(t), df.index[t], price, sl, tg, 40, setup,
                          [*why, f"breakout candle on {vr.iloc[t]:.1f}x volume", "stage-2 trend, ahead of the index over 3 months"],
                          "positional", {"level": float(level), "height": float(height)}))
        last = t
    if OPT["weekly"]:
        out.extend(_weekly(df, sym, ctx, last_only))
    out.sort(key=lambda s: s.t)
    return out


def _weekly(df: pd.DataFrame, sym: str, ctx, last_only: bool) -> list[Signal]:
    """Weekly high-breakout: a weekly close above the prior 26-week closing high, out of a quiet range,
    on weekly volume, in a stage-2 weekly trend with weekly RSI above 55. Held for months."""
    from indicators import rsi
    w = weekly(df)
    if len(w) < 40:
        return []
    wc, wh, wl, wv = w["Close"], w["High"], w["Low"], w["Volume"]
    ws30 = sma(wc, 30)
    wr = rsi(wc, 14)
    cond = (wc > wc.shift(1).rolling(26).max()) & (wc > ws30) & (wr > 55) & (wv >= 1.3 * wv.rolling(10).mean().shift(1)) \
        & ((wh.shift(1).rolling(8).max() - wl.shift(1).rolling(8).min()) / wc.shift(1) <= 0.25)
    wa = atr(w, 10)
    out: list[Signal] = []
    last = -99
    for k in np.flatnonzero(cond.values):
        date = w.index[k]
        if k < 40 or date not in df.index:        # warm-up is per signal: it must not depend on how much data comes AFTER it
            continue
        t = df.index.get_loc(date)
        if (last_only and t != len(df) - 1) or t - last < 20 or not bool(liquid(df).iloc[t]):
            continue
        price = float(wc.iloc[k])
        level = float(wc.shift(1).rolling(26).max().iloc[k])
        base_low = float(wl.iloc[k - 8:k].min())
        sl = max(base_low - 0.3 * float(wa.iloc[k]), price * 0.85)
        height = level - float(wl.iloc[k - 26:k].min())
        tg = _targets(level, height)
        risk = price - sl
        if height <= 0 or risk <= 0 or tg[1] < price + 1.5 * risk:
            continue
        out.append(Signal(NAME, sym, int(t), date, price, sl, tg, 120, "Weekly high breakout",
                          ["weekly close above the prior 26-week closing high", "quiet 8-week range before it",
                           f"weekly RSI {wr.iloc[k]:.0f}, above the 30-week average", "weekly volume above its 10-week average"],
                          "long", {"level": level}))
        last = t
    return out
