"""analysis.py — the two measures that are hard to fool.

EXCESS  For every trade, the stock's return from entry open to the exit bar's close, minus the average
        return of K randomly chosen liquid stocks over exactly the same dates. It isolates whether the
        engine picked better stocks, whatever the market did.
CLUSTERED t  Trades cluster on the same days (one breakout day can fire fifty). Averaging R inside each
        signal month first, then taking the t-stat across months, stops fifty copies of one market move
        counting as fifty independent confirmations.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Trade, liquid


def excess(bars: dict, trades: list[Trade], k: int = 10, seed: int = 11) -> dict:
    rng = np.random.default_rng(seed)
    syms = list(bars)
    liq_cache: dict[str, pd.Series] = {}
    ex = []
    for tr in trades:
        df = bars[tr.sym]
        try:
            ret = float(df["Close"].loc[tr.exit_date] / tr.entry - 1)
        except KeyError:
            continue
        rets = []
        tries = 0
        while len(rets) < k and tries < k * 6:
            tries += 1
            s = syms[rng.integers(len(syms))]
            d = bars[s]
            if tr.entry_date not in d.index or tr.exit_date not in d.index:
                continue
            if s not in liq_cache:
                liq_cache[s] = liquid(d)
            i = d.index.get_loc(tr.entry_date)
            if not bool(liq_cache[s].iloc[max(i - 1, 0)]):
                continue
            rets.append(float(d["Close"].loc[tr.exit_date] / d["Open"].loc[tr.entry_date] - 1))
        if len(rets) >= 3:
            ex.append((tr.signal_date, ret - float(np.mean(rets))))
    if len(ex) < 5:
        return {"n": len(ex)}
    s = pd.Series([e for _, e in ex], index=pd.DatetimeIndex([d for d, _ in ex]))
    m = s.groupby(s.index.to_period("M")).mean()
    t_m = float(m.mean() / (m.std(ddof=1) / np.sqrt(len(m)))) if len(m) > 2 and m.std(ddof=1) > 0 else None
    return {"n": len(s), "mean_excess_pct": round(float(s.mean() * 100), 2), "hit_pct": round(float((s > 0).mean() * 100), 1),
            "months": int(len(m)), "t_clustered": round(t_m, 2) if t_m is not None else None}


def clustered_t(trades: list[Trade]) -> dict:
    if len(trades) < 5:
        return {"months": 0}
    s = pd.Series([t.r for t in trades], index=pd.DatetimeIndex([t.signal_date for t in trades]))
    m = s.groupby(s.index.to_period("M")).mean()
    if len(m) < 3 or m.std(ddof=1) == 0:
        return {"months": int(len(m))}
    return {"months": int(len(m)), "t_clustered": round(float(m.mean() / (m.std(ddof=1) / np.sqrt(len(m)))), 2),
            "positive_months_pct": round(float((m > 0).mean() * 100), 0)}
