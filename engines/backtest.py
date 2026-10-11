"""backtest.py — run engines over the whole universe and report honestly.

DISCIPLINE
  Signals are dated by the bar that closed. Entry is the next open (see common.py).
  Three time blocks, never mixed:
    TRAIN       signals before 2024-01-01          rules are chosen here
    VALIDATION  2024-01-01 .. 2025-06-30           rules are confirmed here
    HOLDOUT     2025-07-01 onwards                 looked at ONCE, after the rules were frozen
  A BASELINE is run beside every engine: random entries in the same stocks and dates, same exit
  machinery (stop 2 ATR, targets 1.5/2.5/4 ATR-multiples of risk). An engine that does not beat it
  has found nothing the exit rule alone did not.
"""
from __future__ import annotations

import importlib
import json
import pathlib
import sys

import numpy as np
import pandas as pd

import common
from common import Ctx, Signal, Trade, liquid, simulate, stats
from indicators import atr

TRAIN_END = pd.Timestamp("2024-01-01")
VAL_END = pd.Timestamp("2025-07-01")
ENGINES = ["e1_rebound", "e2_divergence", "e3_breakout", "e4_swing"]


def load(path: str):
    d = pd.read_pickle(path)
    return d["bars"], d.get("bench"), d["universe"]


def run_engine(mod, bars: dict, bench, start: pd.Timestamp | None = None, log=print) -> list[Trade]:
    trades: list[Trade] = []
    for n, (sym, df) in enumerate(bars.items()):
        try:
            sigs = mod.scan(df, sym, bench)  # `bench` here is the Ctx
        except Exception as e:  # noqa: BLE001
            log(f"  {mod.NAME} {sym}: {type(e).__name__}: {e}")
            continue
        for s in sigs:
            if start is not None and s.date < start:
                continue
            tr = simulate(df, s)
            if tr:
                trades.append(tr)
    return trades


def baseline(bars: dict, like: list[Trade], max_hold: int, seed: int = 7) -> list[Trade]:
    """Random entry, same exit machinery, matched to the engine's trade count and its dates."""
    rng = np.random.default_rng(seed)
    syms = list(bars)
    out: list[Trade] = []
    dates = [t.signal_date for t in like]
    for d in dates:
        for _ in range(8):
            sym = syms[rng.integers(len(syms))]
            df = bars[sym]
            if d not in df.index:
                continue
            t = df.index.get_loc(d)
            if t < 60 or t + 2 >= len(df) or not bool(liquid(df).iloc[t]):
                continue
            a = float(atr(df, 14).iloc[t])
            px = float(df["Close"].iloc[t])
            if not a > 0:
                continue
            risk = 2.0 * a
            sig = Signal("baseline", sym, t, d, px, px - risk, [px + 1.5 * risk, px + 2.5 * risk, px + 4.0 * risk], max_hold, "random")
            tr = simulate(df, sig)
            if tr:
                out.append(tr)
                break
    return out


def split(trades: list[Trade]) -> dict:
    tr = [t for t in trades if t.signal_date < TRAIN_END]
    va = [t for t in trades if TRAIN_END <= t.signal_date < VAL_END]
    ho = [t for t in trades if t.signal_date >= VAL_END]
    return {"all": stats(trades), "train": stats(tr), "validation": stats(va), "holdout": stats(ho)}


def fmt(name: str, s: dict) -> str:
    if not s.get("n"):
        return f"  {name:<11} n=0"
    return (f"  {name:<11} n={s['n']:<5} win {s['win_rate']:>5}%  exp {s['expectancy_r']:>+6.3f}R  t={s['t_stat']}  "
            f"PF {s['profit_factor']}  T1 {s['hit_t1']}%  stopped {s['stopped']}%  bars {s['avg_bars']}")


if __name__ == "__main__":
    path = sys.argv[1]
    which = sys.argv[2].split(",") if len(sys.argv) > 2 else ENGINES
    show_holdout = "--holdout" in sys.argv
    bars, bench, uni = load(path)
    bench = Ctx(bars, bench)
    for name in which:
        mod = importlib.import_module(name)
        tr = run_engine(mod, bars, bench)
        base = baseline(bars, tr, getattr(mod, "MAX_HOLD", 40))
        sp, sb = split(tr), split(base)
        print(f"\n== {mod.TITLE} ({name}): {len(tr)} trades")
        for k in ("train", "validation") + (("holdout",) if show_holdout else ()):
            print(fmt(k, sp[k]))
            print(fmt("  baseline", sb[k]))
