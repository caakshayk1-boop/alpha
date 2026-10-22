"""Validation statistics (spec §5, promotion_policy.yaml). Standard formulas only; no fitted parameter anywhere.
  trade metrics   N, expectancy, PF, win rate, median, expected shortfall (worst 5% of trades)
  book metrics    Sharpe of daily returns, max drawdown, exposure
  bootstrap CI    stationary block bootstrap (Politis-Romano), mean block 21 sessions, fixed seed
  PSR / DSR       Bailey & Lopez de Prado: PSR against SR0, where SR0 is the expected maximum Sharpe of N trials
  PBO             CSCV (Bailey et al.): share of splits where the in-sample best configuration ranks below the OOS median"""
from __future__ import annotations

import itertools
import math
from statistics import NormalDist

import numpy as np
import pandas as pd

N01 = NormalDist()
EULER = 0.5772156649015329


def trade_metrics(r: list[float]) -> dict:
    a = np.asarray(r, float)
    if len(a) == 0:
        return {"n": 0}
    wins, losses = a[a > 0], a[a <= 0]
    k = max(1, int(math.ceil(len(a) * 0.05)))
    return {"n": int(len(a)), "expectancy_r": round(float(a.mean()), 4), "median_r": round(float(np.median(a)), 4),
            "win_rate": round(float((a > 0).mean() * 100), 1),
            "profit_factor": round(float(wins.sum() / -losses.sum()), 3) if losses.sum() < 0 else None,
            "expected_shortfall_r": round(float(np.sort(a)[:k].mean()), 4), "worst_r": round(float(a.min()), 4)}


def sharpe(x: np.ndarray) -> float | None:
    x = np.asarray(x, float)
    sd = x.std(ddof=1) if len(x) > 1 else 0
    return float(x.mean() / sd) if sd > 0 else None


def max_drawdown(daily: pd.Series) -> float:
    eq = daily.cumsum()
    return float((eq - eq.cummax()).min() * 100) if len(eq) else 0.0


def stationary_bootstrap_ci(x: np.ndarray, block: float = 21, reps: int = 10000, seed: int = 20261022, alpha: float = 0.05) -> tuple[float, float]:
    x = np.asarray(x, float)
    n = len(x)
    if n < 10:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    p = 1.0 / block
    jump = rng.random((reps, n)) < p
    fresh = rng.integers(0, n, size=(reps, n))
    idx = np.empty((reps, n), dtype=np.int64)
    idx[:, 0] = fresh[:, 0]
    for k in range(1, n):                                   # vectorised over resamples: a new block, or the next session
        idx[:, k] = np.where(jump[:, k], fresh[:, k], (idx[:, k - 1] + 1) % n)
    means = x[idx].mean(axis=1)
    return float(np.quantile(means, alpha / 2)), float(np.quantile(means, 1 - alpha / 2))


def psr(sr: float, sr0: float, t: int, skew: float, kurt: float) -> float:
    den = 1 - skew * sr + (kurt - 1) / 4 * sr * sr
    if t < 2 or den <= 0:
        return float("nan")
    return float(N01.cdf((sr - sr0) * math.sqrt(t - 1) / math.sqrt(den)))


def expected_max_sr(sr_var: float, n_trials: int) -> float:
    """SR0: the Sharpe the best of n independent trials would reach by luck (per-period units)."""
    if n_trials <= 1 or sr_var <= 0:
        return 0.0
    return math.sqrt(sr_var) * ((1 - EULER) * N01.inv_cdf(1 - 1 / n_trials) + EULER * N01.inv_cdf(1 - 1 / (n_trials * math.e)))


def dsr(daily: np.ndarray, n_trials: int, trial_srs: list[float]) -> dict:
    x = np.asarray(daily, float)
    x = x[~np.isnan(x)]
    sr = sharpe(x)
    if sr is None or len(x) < 30:
        return {"dsr": None, "sr": sr, "sr0": None, "n_trials": n_trials}
    m, s = x.mean(), x.std(ddof=0)
    skew = float(((x - m) ** 3).mean() / s ** 3)
    kurt = float(((x - m) ** 4).mean() / s ** 4)
    var = float(np.var(trial_srs, ddof=1)) if len(trial_srs) > 1 else 0.0
    sr0 = expected_max_sr(var, n_trials)
    return {"dsr": round(psr(sr, sr0, len(x), skew, kurt), 4), "sr": round(sr, 5), "sr0": round(sr0, 5), "n_trials": n_trials,
            "skew": round(skew, 3), "kurt": round(kurt, 3), "t": len(x)}


def pbo_cscv(perf: pd.DataFrame, blocks: int = 16) -> dict:
    """perf: daily returns, one column per configuration. Probability that the in-sample best is below the OOS median."""
    cols = list(perf.columns)
    if len(cols) < 2 or len(perf) < blocks * 5:
        return {"pbo": None, "configs": len(cols), "splits": 0}
    parts = np.array_split(np.arange(len(perf)), blocks)
    lam = []
    for ins in itertools.combinations(range(blocks), blocks // 2):
        i_idx = np.concatenate([parts[k] for k in ins])
        o_idx = np.concatenate([parts[k] for k in range(blocks) if k not in ins])
        is_sr = [sharpe(perf.iloc[i_idx][c].to_numpy()) or -1e9 for c in cols]
        oo_sr = [sharpe(perf.iloc[o_idx][c].to_numpy()) or -1e9 for c in cols]
        best = int(np.argmax(is_sr))
        rank = (np.argsort(np.argsort(oo_sr))[best] + 1) / (len(cols) + 1)
        lam.append(math.log(rank / (1 - rank)))
    lam = np.asarray(lam)
    return {"pbo": round(float((lam <= 0).mean()), 4), "configs": len(cols), "splits": int(len(lam))}
