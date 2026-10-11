"""ai_trades.py — turn model scores into priced trades, then test those trades the way the backtest always has:
next-open entry, thirds exit, costs charged, against random picks with the same geometry on the same dates."""
from __future__ import annotations

import numpy as np
import pandas as pd

from ai_engines import Engine
from common import COST_PCT, Signal, Trade, simulate, stats
from indicators import atr


def atr_table(bars: dict) -> dict[str, pd.Series]:
    return {s: atr(df, 14) for s, df in bars.items()}


def plan(eng: Engine, price: float, a: float) -> tuple[float, list[float]] | None:
    """Stop and three targets from the stock's own volatility."""
    if not (a > 0 and price > 0):
        return None
    risk = min(eng.stop_atr * a, price * eng.max_risk_pct)
    if risk / price < 0.005:
        return None
    sl = price - risk
    return sl, [price + m * risk for m in eng.targets_r]


def signals_from_scores(eng: Engine, scores: pd.Series, bars: dict, atrs: dict, lo: pd.Timestamp, hi: pd.Timestamp, last_only: bool = False) -> list[Signal]:
    """Top-ranked stocks per session, one per stock per cooldown. `scores` is indexed (date, sym)."""
    d = scores.index.get_level_values("date")
    s = scores[(d >= lo) & (d < hi)].dropna()
    if eng.min_score is not None:
        s = s[s >= eng.min_score]
    out: list[Signal] = []
    last_idx: dict[str, int] = {}
    dates = s.index.get_level_values("date").unique().sort_values()
    if last_only and len(dates):
        dates = dates[-1:]
    for date in dates:
        day = s.xs(date, level="date").sort_values(ascending=False)
        taken = 0
        for sym in day.index:
            if taken >= eng.picks_per_day:
                break
            df = bars.get(sym)
            if df is None or date not in df.index:
                continue
            t = df.index.get_loc(date)
            if t - last_idx.get(sym, -10**9) < eng.cooldown:
                continue
            price = float(df["Close"].iloc[t])
            p = plan(eng, price, float(atrs[sym].iloc[t]))
            if p is None:
                continue
            sl, tg = p
            out.append(Signal(eng.key, sym, int(t), date, price, sl, tg, eng.max_hold, eng.name, [], eng.horizon_label, {"score": float(day[sym])}))
            last_idx[sym] = t
            taken += 1
    return out


def simulate_all(sigs: list[Signal], bars: dict) -> list[Trade]:
    out = []
    for sg in sigs:
        tr = simulate(bars[sg.sym], sg)
        if tr:
            out.append(tr)
    return out


def random_baseline(eng: Engine, like: list[Signal], bars: dict, atrs: dict, liq: pd.Series, seed: int = 5) -> list[Trade]:
    """For every real signal, a random liquid stock on the same date with the same plan geometry."""
    rng = np.random.default_rng(seed)
    syms = list(bars)
    out: list[Trade] = []
    for sg in like:
        for _ in range(12):
            sym = syms[rng.integers(len(syms))]
            df = bars[sym]
            if sg.date not in df.index:
                continue
            t = df.index.get_loc(sg.date)
            if t < 260 or not bool(liq.get((sg.date, sym), False)):
                continue
            p = plan(eng, float(df["Close"].iloc[t]), float(atrs[sym].iloc[t]))
            if p is None:
                continue
            sl, tg = p
            tr = simulate(df, Signal("baseline", sym, t, sg.date, float(df["Close"].iloc[t]), sl, tg, eng.max_hold, "random", [], eng.horizon_label))
            if tr:
                out.append(tr)
                break
    return out


def monthly_t(trades: list[Trade]) -> dict:
    if len(trades) < 8:
        return {}
    s = pd.Series([t.r for t in trades], index=pd.DatetimeIndex([t.signal_date for t in trades]))
    m = s.groupby(s.index.to_period("M")).mean()
    if len(m) < 4 or m.std(ddof=1) == 0:
        return {"months": int(len(m))}
    return {"months": int(len(m)), "t_clustered": round(float(m.mean() / (m.std(ddof=1) / np.sqrt(len(m)))), 2), "positive_months_pct": round(float((m > 0).mean() * 100), 0)}
