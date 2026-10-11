"""common.py — the signal type, the universe filter and the exit simulator every engine shares.

THE EXIT RULE (same for all four engines, so their results are comparable)
  Entry is the NEXT bar's open after the signal closes. Never the signal bar itself.
  Position is split into thirds: one third exits at T1, one at T2, the last at T3.
  After T1 the stop moves to entry (break-even). After T2 it moves to T1.
  A gap through the stop exits at that day's open, not at the stop price. A gap past a target
  fills at that day's open, not at the target.
  If one bar spans both the stop and a target, the STOP is assumed to hit first.
  If nothing has happened by `max_hold` bars the remainder exits at that day's close.
  Costs of COST_PCT per round trip (slippage, brokerage, taxes) are charged in R.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

COST_PCT = 0.0025          # 0.25% of entry price, round trip
SPLITS = (1 / 3, 1 / 3, 1 / 3)


@dataclass
class Signal:
    engine: str
    sym: str
    t: int                      # index of the signal bar (close known)
    date: pd.Timestamp
    ref_price: float            # the signal bar's close; entry will be the next open
    sl: float                   # stop (price)
    targets: list[float]        # T1 < T2 < T3
    max_hold: int               # bars
    setup: str                  # short name of what fired
    reasons: list[str] = field(default_factory=list)
    horizon: str = "swing"      # swing | positional | long
    meta: dict = field(default_factory=dict)


@dataclass
class Trade:
    engine: str
    sym: str
    signal_date: pd.Timestamp
    entry_date: pd.Timestamp
    exit_date: pd.Timestamp
    entry: float
    sl: float
    r: float                    # net R
    gross_r: float
    bars: int
    hit: int                    # number of targets reached (0-3)
    exit_reason: str            # stop | breakeven | target | time
    setup: str
    horizon: str
    t1_bars: int | None = None   # trading days from entry to the first target, when it was reached
    t3_bars: int | None = None


def liquid(df: pd.DataFrame, min_turnover_cr: float = 1.0, window: int = 20) -> pd.Series:
    """Median 20-day traded value, in crore rupees, at or above the floor. Trades in a stock nobody
    trades are not trades."""
    tv = (df["Close"] * df["Volume"]).rolling(window, min_periods=window).median() / 1e7
    return tv >= min_turnover_cr


def simulate(df: pd.DataFrame, sig: Signal, cost_pct: float = COST_PCT) -> Trade | None:
    """Run one signal through the exit rule. None if there is no valid entry (no next bar, a gap that
    already voids the setup, or a stop that is not below the entry)."""
    o, h, l, c = df["Open"].values, df["High"].values, df["Low"].values, df["Close"].values
    t0 = sig.t + 1
    if t0 >= len(df):
        return None
    entry = float(o[t0])
    sl = sig.sl
    if not (entry > 0 and sl < entry):
        return None
    # An opening gap beyond the first target, or below the stop, means the setup no longer exists.
    t1, t2, t3 = sig.targets
    if entry >= t1 or entry <= sl:
        return None
    risk = entry - sl
    if risk / entry > 0.20 or risk / entry < 0.004:      # absurdly wide or absurdly tight is a data/setup fault
        return None

    remaining = 1.0
    pnl = 0.0                      # in price units, weighted by position fraction
    stop = sl
    hit = 0
    t1_bars = t3_bars = None
    last = min(len(df) - 1, t0 + sig.max_hold - 1)
    exit_reason = "time"
    exit_i = last
    tgt = [t1, t2, t3]
    for i in range(t0, last + 1):
        lo, hi, op = l[i], h[i], o[i]
        # stop first (conservative), including a gap through it
        if lo <= stop or op <= stop:
            px = op if op < stop else stop
            pnl += remaining * (px - entry)
            exit_reason = "stop" if hit == 0 else ("breakeven" if hit == 1 else "target")
            exit_i = i
            remaining = 0.0
            break
        # targets, in order, possibly several in one bar
        while hit < 3 and hi >= tgt[hit]:
            px = op if op > tgt[hit] else tgt[hit]
            frac = SPLITS[hit]
            pnl += frac * (px - entry)
            remaining -= frac
            hit += 1
            if hit == 1:
                t1_bars = i - t0 + 1
            if hit == 3:
                t3_bars = i - t0 + 1
            stop = entry if hit == 1 else (t1 if hit == 2 else stop)
        if hit == 3:
            exit_reason = "target"
            exit_i = i
            remaining = 0.0
            break
    if remaining > 1e-9:
        pnl += remaining * (c[last] - entry)
        exit_i = last
        exit_reason = "time"
    gross_r = pnl / risk
    r = gross_r - (cost_pct * entry) / risk
    return Trade(sig.engine, sig.sym, sig.date, df.index[t0], df.index[exit_i], entry, sl, float(r), float(gross_r),
                 int(exit_i - t0 + 1), hit, exit_reason, sig.setup, sig.horizon, t1_bars, t3_bars)


def stats(trades: list[Trade]) -> dict:
    """Plain-numbers summary. t is mean/standard-error of the per-trade R, the number that says whether
    an average of +0.2R is signal or luck."""
    n = len(trades)
    if n == 0:
        return {"n": 0}
    r = np.array([t.r for t in trades])
    wins, losses = r[r > 0], r[r <= 0]
    sd = r.std(ddof=1) if n > 1 else 0.0
    se = sd / np.sqrt(n) if n > 1 else 0.0
    # equity in R, in exit order, for drawdown
    order = sorted(trades, key=lambda t: t.exit_date)
    eq = np.cumsum([t.r for t in order])
    peak = np.maximum.accumulate(np.concatenate([[0.0], eq]))[1:]
    dd = float((eq - peak).min())
    gw, gl = wins.sum(), -losses.sum()
    return {
        "n": n,
        "win_rate": round(float((r > 0).mean() * 100), 1),
        "expectancy_r": round(float(r.mean()), 3),
        "median_r": round(float(np.median(r)), 3),
        "avg_win_r": round(float(wins.mean()), 2) if len(wins) else None,
        "avg_loss_r": round(float(losses.mean()), 2) if len(losses) else None,
        "profit_factor": round(float(gw / gl), 2) if gl > 0 else None,
        "t_stat": round(float(r.mean() / se), 2) if se > 0 else None,
        "max_dd_r": round(dd, 1),
        "avg_bars": round(float(np.mean([t.bars for t in trades])), 1),
        "hit_t1": round(float(np.mean([t.hit >= 1 for t in trades]) * 100), 1),
        "hit_t2": round(float(np.mean([t.hit >= 2 for t in trades]) * 100), 1),
        "hit_t3": round(float(np.mean([t.hit >= 3 for t in trades]) * 100), 1),
        "stopped": round(float(np.mean([t.exit_reason == "stop" for t in trades]) * 100), 1),
    }


class Ctx:
    """Market-wide context the engines may read, all computed without lookahead.

    regime  True when the Nifty is above a rising 200-day average.
    rs126 / rs21  each stock's 126-day and 21-day return, ranked 0-100 across the whole universe that day.
    """

    def __init__(self, bars: dict, bench: pd.Series):
        self.bench = bench
        s200 = bench.rolling(200, min_periods=200).mean()
        self.regime = ((bench > s200) & (s200 > s200.shift(20))).fillna(False)
        closes = pd.DataFrame({s: d["Close"] for s, d in bars.items()})
        self.rs126 = closes.pct_change(126, fill_method=None).rank(axis=1, pct=True) * 100
        self.rs21 = closes.pct_change(21, fill_method=None).rank(axis=1, pct=True) * 100

    def regime_for(self, idx: pd.DatetimeIndex) -> pd.Series:
        return self.regime.reindex(idx, method="ffill").fillna(False).astype(bool)

    def rs(self, sym: str, idx: pd.DatetimeIndex, window: int = 126) -> pd.Series:
        panel = self.rs126 if window == 126 else self.rs21
        return panel[sym].reindex(idx) if sym in panel else pd.Series(np.nan, index=idx)
