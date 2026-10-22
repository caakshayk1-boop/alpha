"""E1-E5 setups, transcribed from configs/engines/E*.yaml (v1.0.0). Each function takes one symbol's completed daily bars plus the
cross-sectional context and returns a frame indexed like the bars: `setup` (bool), the plan levels and the rank features. No row
reads a later row: every 'previous n sessions' excludes today, every percentile is of preceding values or of that day's
cross-section. Interpretations the configs leave open are listed in DECISIONS.md #7 and fixed here once."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import ind


def context(adj_close: pd.DataFrame, sector_of: dict[str, str]) -> dict:
    """Cross-sectional context from dividend-adjusted closes (returns), one row per session."""
    mom = adj_close.shift(21) / adj_close.shift(147) - 1                        # 126 sessions, skipping the latest 21
    r63 = adj_close / adj_close.shift(63) - 1
    rets = adj_close.pct_change(fill_method=None)
    vol63 = rets.rolling(63, min_periods=63).std()
    sectors = pd.Series(sector_of).reindex(adj_close.columns)
    sec_med_mom = mom.T.groupby(sectors).transform("median").T
    sec_med_r63 = r63.T.groupby(sectors).transform("median").T
    sec_sum = rets.T.groupby(sectors).transform("sum").T                         # leave-one-out sector return
    sec_cnt = rets.notna().T.groupby(sectors).transform("sum").T
    sec_ret = (sec_sum - rets.fillna(0)) / (sec_cnt - rets.notna().astype(int)).replace(0, np.nan)
    return {"mom": mom, "mom_pct": mom.rank(axis=1, pct=True) * 100,
            "sec_rel_mom_pct": (mom - sec_med_mom).rank(axis=1, pct=True) * 100,
            "inv_vol_pct": (-vol63).rank(axis=1, pct=True) * 100,
            "r63": r63, "sec_med_r63": sec_med_r63, "rets": rets, "sec_ret": sec_ret}


def _base(df: pd.DataFrame) -> dict:
    c, h, l, v = df["Close"], df["High"], df["Low"], df["Volume"]
    a = ind.atr(df, 14)
    return {"c": c, "h": h, "l": l, "v": v, "o": df["Open"], "atr": a, "tv": ind.traded_value_cr(df, 20)}


def _stop_ok(c, stop, cfg):
    d = (c - stop) / c * 100
    return (d >= cfg["reject"]["min_stop_distance_pct"]) & (d <= cfg["reject"]["max_stop_distance_pct"])


def e1(sym: str, df: pd.DataFrame, ctx: dict, cfg: dict) -> pd.DataFrame:
    b = _base(df)
    c, h, l, a = b["c"], b["h"], b["l"], b["atr"]
    s50 = ind.sma(c, 50)
    mom, mom_pct = ctx["mom"][sym].reindex(df.index), ctx["mom_pct"][sym].reindex(df.index)
    trig = c > ind.prev_max(h, 20)
    rising = s50 > s50.shift(10)
    stop = ind.prev_min(l, 10) - 0.25 * a
    setup = trig & rising & (mom > 0) & (mom_pct >= 80) & _stop_ok(c, stop, cfg)
    return pd.DataFrame({"setup": setup.fillna(False), "stop": stop, "atr": a, "tv": b["tv"],
                         "f1": mom_pct, "f2": ctx["sec_rel_mom_pct"][sym].reindex(df.index), "f3": ctx["inv_vol_pct"][sym].reindex(df.index),
                         "exit_low20": ind.prev_min(l, 20)})


def e2(sym: str, df: pd.DataFrame, ctx: dict, cfg: dict) -> pd.DataFrame:
    b = _base(df)
    c, h, l, v, a = b["c"], b["h"], b["l"], b["v"], b["atr"]
    atrp = a / c
    q25 = ind.preceding_quantile(atrp, 252, 0.25, 126)
    level = ind.prev_max(h, 20)
    relvol = v / ind.prev_median(v, 20)
    stop = ind.prev_min(l, 10) - 0.25 * a
    setup = (atrp < q25) & (c > level) & (relvol >= 1.5) & _stop_ok(c, stop, cfg)
    return pd.DataFrame({"setup": setup.fillna(False), "stop": stop, "atr": a, "tv": b["tv"], "level": level,
                         "f1": (q25 - atrp) / q25, "f2": (c - level) / a, "f3": relvol})


def e3(sym: str, df: pd.DataFrame, ctx: dict, cfg: dict, cost_rt: float) -> pd.DataFrame:
    b = _base(df)
    o, c, h, l, v, a = b["o"], b["c"], b["h"], b["l"], b["v"], b["atr"]
    s50, e20 = ind.sma(c, 50), ind.ema(c, 20)
    n = len(df)
    cv, lv, hv, ov, av, ev, vv = (x.to_numpy(dtype=float) for x in (c, l, h, o, a, e20, v))
    setup = np.zeros(n, bool)
    stop = np.full(n, np.nan)
    depth = np.full(n, np.nan)
    vcon = np.full(n, np.nan)
    for t in range(12, n):
        if not cv[t] > hv[t - 1]:                                       # recovery close above the previous day's high
            continue
        k = 0                                                           # consecutive lower closes ending yesterday
        while t - 1 - k - 1 >= 0 and cv[t - 1 - k] < cv[t - 2 - k]:
            k += 1
        if not 2 <= k <= 5:
            continue
        s = t - k                                                       # first lower close of the pullback
        peak = s - 1
        if peak - 9 < 0 or hv[peak] < np.nanmax(hv[peak - 9:peak + 1]):    # starts from the most recent 10-session high
            continue
        days = range(s, t)
        plow = np.nanmin(lv[s:t])
        if not (abs(plow - ev[t - 1]) <= av[t - 1]):                    # within 1 ATR of the 20-day average
            continue
        prev = cv[s - 1:t - 1]
        if np.any(np.abs(ov[s:t] / prev - 1) > 0.04):                   # an event gap inside the pullback: routed to E6
            continue
        st = plow - 0.25 * av[t]
        setup[t] = True
        stop[t] = st
        depth[t] = (hv[peak] - plow) / av[t]
        vcon[t] = (np.nanmean(vv[peak - 4:peak + 1]) / np.nanmean(vv[s:t])) if np.nanmean(vv[s:t]) > 0 else np.nan
    target = ind.prev_max(h, 20).shift(0)
    stop_s = pd.Series(stop, index=df.index)
    rr = (target - c) / (c - stop_s) - cost_rt * c / (c - stop_s)
    trend = (c > s50) & (s50 > s50.shift(10))
    rel = ctx["r63"][sym].reindex(df.index) > ctx["sec_med_r63"][sym].reindex(df.index)
    ok = pd.Series(setup, index=df.index) & trend & rel & (rr >= 1.5) & _stop_ok(c, stop_s, cfg)
    return pd.DataFrame({"setup": ok.fillna(False), "stop": stop_s, "atr": a, "tv": b["tv"], "target": target,
                         "f1": (c / s50 - 1) / (a / c), "f2": pd.Series(depth, index=df.index), "f3": pd.Series(vcon, index=df.index)})


def residual_z(stock_ret: pd.Series, mkt_ret: pd.Series, sec_ret: pd.Series, window: int = 126, min_obs: int = 100) -> tuple[pd.Series, pd.Series]:
    """Out-of-sample residual of each day's return on market and sector returns, with betas fitted on t-window..t-1, and the z of the
    last 3 residuals' sum against the preceding window's 3-session residual sums. Returns (z, sum3)."""
    y, x1, x2 = stock_ret, mkt_ret.reindex(stock_ret.index), sec_ret.reindex(stock_ret.index)
    ok = y.notna() & x1.notna() & x2.notna()
    Y, X1, X2 = y.where(ok), x1.where(ok), x2.where(ok)
    r = lambda s: s.rolling(window, min_periods=min_obs).mean().shift(1)    # noqa: E731  (fit through t-1)
    m1, m2, my = r(X1), r(X2), r(Y)
    c11, c22, c12 = r(X1 * X1) - m1 * m1, r(X2 * X2) - m2 * m2, r(X1 * X2) - m1 * m2
    c1y, c2y = r(X1 * Y) - m1 * my, r(X2 * Y) - m2 * my
    det = c11 * c22 - c12 * c12
    b1 = (c1y * c22 - c2y * c12) / det.replace(0, np.nan)
    b2 = (c2y * c11 - c1y * c12) / det.replace(0, np.nan)
    a0 = my - b1 * m1 - b2 * m2
    resid = Y - (a0 + b1 * X1 + b2 * X2)
    sum3 = resid.rolling(3, min_periods=3).sum()
    hist = sum3.shift(1).rolling(window, min_periods=min_obs - 3)
    z = (sum3 - hist.mean()) / hist.std()
    return z, sum3


def e4(sym: str, df: pd.DataFrame, ctx: dict, cfg: dict, mkt_ret: pd.Series, cost_rt: float) -> pd.DataFrame:
    b = _base(df)
    c, l, a = b["c"], b["l"], b["atr"]
    z, sum3 = residual_z(ctx["rets"][sym].reindex(df.index), mkt_ret, ctx["sec_ret"][sym].reindex(df.index))
    dislocated = (z.shift(1) <= -2) | (z.shift(2) <= -2) | (z.shift(3) <= -2)           # within the last 3 sessions
    recovery = c > c.shift(1)
    stop = l.rolling(4, min_periods=4).min() - 0.25 * a                                   # dislocation window t-3..t
    worst = pd.concat([sum3.shift(1), sum3.shift(2), sum3.shift(3)], axis=1).min(axis=1)
    target = c * (1 - worst.clip(upper=0))                                                # residual back to zero
    rr = (target - c) / (c - stop) - cost_rt * c / (c - stop)
    setup = dislocated & recovery & (b["tv"] >= cfg["universe"]["min_median_traded_value_cr_20d"]) & (rr >= 1.0) & _stop_ok(c, stop, cfg)
    return pd.DataFrame({"setup": setup.fillna(False), "stop": stop, "atr": a, "tv": b["tv"], "z": z,
                         "f1": -worst / (a / c), "f2": -z.shift(1), "f3": b["tv"]})


def e5(sym: str, df: pd.DataFrame, ctx: dict, cfg: dict, cost_rt: float) -> pd.DataFrame:
    b = _base(df)
    o, c, h, l, v, a = b["o"], b["c"], b["h"], b["l"], b["v"], b["atr"]
    lo20, hi20 = ind.prev_min(l, 20), ind.prev_max(h, 20)
    rng = h - l
    loc = (c - l) / rng.replace(0, np.nan)
    reclaim = (l < lo20) & (c >= lo20) & (loc >= 0.75) & (rng > 0)
    n = len(df)
    rv, hv, cv = reclaim.fillna(False).to_numpy(), h.to_numpy(float), c.to_numpy(float)
    sig = np.zeros(n, bool)
    src = np.full(n, -1)
    for i in np.flatnonzero(rv):                        # confirmation: a later completed close above the reclaim bar's high
        for t in range(i + 1, min(n, i + 6)):
            if cv[t] > hv[i]:
                if not sig[t]:
                    sig[t], src[t] = True, i
                break
    idx = df.index
    s = pd.Series(src, index=idx)
    pick = lambda ser: pd.Series([ser.iloc[k] if k >= 0 else np.nan for k in src], index=idx)   # noqa: E731
    stop = pick(l) - 0.25 * pick(a)
    t1 = (pick(hi20) + pick(lo20)) / 2
    t2 = pick(hi20)
    rr = (t2 - c) / (c - stop) - cost_rt * c / (c - stop)
    relvol = v / ind.prev_median(v, 20)
    setup = pd.Series(sig, index=idx) & (rr >= 1.5) & (t1 > c) & _stop_ok(c, stop, cfg)
    return pd.DataFrame({"setup": setup.fillna(False), "stop": stop, "atr": a, "tv": b["tv"], "t1": t1, "t2": t2, "src": s,
                         "f1": (c - pick(lo20)) / a, "f2": pick(loc), "f3": relvol})
