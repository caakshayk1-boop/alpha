"""Candidate indicators for the Tripwire engines, all computed point-in-time: a value at index i uses data up to and including day i's close.
Each function takes a Panel (dates x symbols arrays) and an integer index i, and returns one value per symbol (NaN when there is not
enough history). Every feature is signed so that HIGHER is what the literature says should be BETTER; that expected sign is fixed here,
before any result is seen (see PREREGISTRATION in study.py).

Common baselines (so "unique" is judged against what everyone already uses): mom12_1, near_high, rev21.
Less common: smooth_fip, eff_ratio60, resid_mom, max5, overnight60, vol_shock, ud_vol, clv20, coil, skew60, amihud.
noise is a seeded random control: it must NOT pass."""
from __future__ import annotations
from dataclasses import dataclass
import numpy as np


@dataclass
class Panel:
    dates: np.ndarray        # (T,) datetime64[D]
    syms: list[str]
    O: np.ndarray            # (T, N) each
    H: np.ndarray
    L: np.ndarray
    C: np.ndarray
    V: np.ndarray
    M: np.ndarray            # (T,) the market index close (Nifty 50)


def _w(a: np.ndarray, i: int, n: int) -> np.ndarray:
    """The n rows ending at i inclusive; empty-shaped (0, N) when there is not enough history."""
    return a[i - n + 1: i + 1] if i - n + 1 >= 0 else a[:0]


def mom12_1(p: Panel, i: int) -> np.ndarray:
    if i < 252: return np.full(p.C.shape[1], np.nan)
    return p.C[i - 21] / p.C[i - 252] - 1


def near_high(p: Panel, i: int) -> np.ndarray:
    w = _w(p.C, i, 252)
    if len(w) < 252: return np.full(p.C.shape[1], np.nan)
    return p.C[i] / np.nanmax(w, axis=0)


def rev21(p: Panel, i: int) -> np.ndarray:
    if i < 21: return np.full(p.C.shape[1], np.nan)
    return -(p.C[i] / p.C[i - 21] - 1)


def smooth_fip(p: Panel, i: int) -> np.ndarray:
    """Information discreteness (Da, Gurun and Warachka 2014), unsigned: share of up days minus share of down days over the 12-1 window.
    Used as a MODIFIER of momentum: steady gains continue, a few big jumps do not."""
    if i < 252: return np.full(p.C.shape[1], np.nan)
    r = p.C[i - 251: i - 20] / p.C[i - 252: i - 21] - 1          # daily returns for days i-251 .. i-21 (the 12-1 window)
    return (np.sum(r > 0, axis=0) - np.sum(r < 0, axis=0)) / r.shape[0]


def eff_ratio60(p: Panel, i: int) -> np.ndarray:
    """Kaufman efficiency ratio: net move over 60 sessions divided by the sum of absolute daily moves. 1 is a straight line, 0 is noise."""
    if i < 60: return np.full(p.C.shape[1], np.nan)
    path = np.sum(np.abs(np.diff(p.C[i - 60: i + 1], axis=0)), axis=0)
    return np.abs(p.C[i] - p.C[i - 60]) / np.where(path > 0, path, np.nan)


def resid_mom(p: Panel, i: int) -> np.ndarray:
    """Residual momentum (Blitz, Huij and Martens 2011): the 12-1 return left after removing the market, scaled by its own volatility."""
    if i < 252: return np.full(p.C.shape[1], np.nan)
    r = p.C[i - 251: i + 1] / p.C[i - 252: i] - 1; m = p.M[i - 251: i + 1] / p.M[i - 252: i] - 1
    mc = m - m.mean(); beta = (np.nansum((r - np.nanmean(r, axis=0)) * mc[:, None], axis=0)) / np.sum(mc ** 2)
    res = r - beta * m[:, None]
    win = res[: 252 - 21]                                          # skip the latest month
    sd = np.nanstd(win, axis=0)
    return np.nansum(win, axis=0) / np.where(sd > 0, sd, np.nan)


def max5(p: Panel, i: int) -> np.ndarray:
    """Lottery demand (Bali, Cakici and Whitelaw 2011): the mean of the 5 biggest daily gains in the last 21 sessions, NEGATED, so a calm stock scores high."""
    if i < 22: return np.full(p.C.shape[1], np.nan)
    r = p.C[i - 20: i + 1] / p.C[i - 21: i] - 1
    return -np.mean(np.sort(r, axis=0)[-5:], axis=0)


def overnight60(p: Panel, i: int) -> np.ndarray:
    """The overnight leg of the return (Lou, Polk and Skouras 2019): the sum of close-to-open gaps over 60 sessions."""
    if i < 61: return np.full(p.C.shape[1], np.nan)
    return np.sum(p.O[i - 59: i + 1] / p.C[i - 60: i] - 1, axis=0)


def vol_shock(p: Panel, i: int) -> np.ndarray:
    """The high-volume return premium (Gervais, Kaniel and Mingelgrin 2001): median traded value of the last 20 sessions over the last 120."""
    if i < 120: return np.full(p.C.shape[1], np.nan)
    tv = p.C * p.V
    return np.nanmedian(tv[i - 19: i + 1], axis=0) / np.where(np.nanmedian(tv[i - 119: i + 1], axis=0) > 0, np.nanmedian(tv[i - 119: i + 1], axis=0), np.nan)


def ud_vol(p: Panel, i: int) -> np.ndarray:
    """Volume on up days against volume on down days over 20 sessions, as a log ratio: who is pressing, buyers or sellers."""
    if i < 21: return np.full(p.C.shape[1], np.nan)
    r = p.C[i - 19: i + 1] / p.C[i - 20: i] - 1; v = p.V[i - 19: i + 1]
    up = np.sum(np.where(r > 0, v, 0), axis=0); dn = np.sum(np.where(r < 0, v, 0), axis=0)
    return np.log((up + 1) / (dn + 1))


def clv20(p: Panel, i: int) -> np.ndarray:
    """Close location value, averaged over 20 sessions: where in its daily range a stock tends to close (+1 at the high, -1 at the low)."""
    if i < 20: return np.full(p.C.shape[1], np.nan)
    h, l, c = _w(p.H, i, 20), _w(p.L, i, 20), _w(p.C, i, 20); rng = h - l
    return np.nanmean(np.where(rng > 0, (2 * c - h - l) / np.where(rng > 0, rng, 1), 0), axis=0)


def coil(p: Panel, i: int) -> np.ndarray:
    """Volatility contraction: the average true range of the last 20 sessions over the last 100, NEGATED, so a tightly coiled stock scores high."""
    if i < 101: return np.full(p.C.shape[1], np.nan)
    tr = np.maximum(p.H[i - 99: i + 1] - p.L[i - 99: i + 1], np.maximum(np.abs(p.H[i - 99: i + 1] - p.C[i - 100: i]), np.abs(p.L[i - 99: i + 1] - p.C[i - 100: i])))
    return -(np.nanmean(tr[-20:], axis=0) / np.where(np.nanmean(tr, axis=0) > 0, np.nanmean(tr, axis=0), np.nan))


def skew60(p: Panel, i: int) -> np.ndarray:
    """Realised skewness over 60 sessions, NEGATED: the literature pays for bearing negative skew and charges for lottery-like positive skew."""
    if i < 61: return np.full(p.C.shape[1], np.nan)
    r = p.C[i - 59: i + 1] / p.C[i - 60: i] - 1; mu = np.nanmean(r, axis=0); sd = np.nanstd(r, axis=0)
    return -(np.nanmean((r - mu) ** 3, axis=0) / np.where(sd > 0, sd ** 3, np.nan))


def amihud(p: Panel, i: int) -> np.ndarray:
    """Amihud illiquidity over 60 sessions (log): price impact per rupee traded. Included as a control against 'it just picks thin stocks'."""
    if i < 61: return np.full(p.C.shape[1], np.nan)
    r = np.abs(p.C[i - 59: i + 1] / p.C[i - 60: i] - 1); tv = p.C[i - 59: i + 1] * p.V[i - 59: i + 1]
    a = np.nanmean(np.where(tv > 0, r / np.where(tv > 0, tv, 1), np.nan), axis=0)
    return np.log(a + 1e-15)


def noise(p: Panel, i: int) -> np.ndarray:
    return np.random.default_rng(10_000 + i).standard_normal(p.C.shape[1])


FEATURES = {"mom12_1": mom12_1, "near_high": near_high, "rev21": rev21,
            "smooth_fip": smooth_fip, "eff_ratio60": eff_ratio60, "resid_mom": resid_mom, "max5": max5, "overnight60": overnight60,
            "vol_shock": vol_shock, "ud_vol": ud_vol, "clv20": clv20, "coil": coil, "skew60": skew60, "amihud": amihud, "noise": noise}
COMMON = ("mom12_1", "near_high", "rev21")
CONTROL = ("noise", "amihud")
MODIFIERS = ("smooth_fip", "eff_ratio60", "resid_mom", "max5", "overnight60", "clv20")     # tested as filters on top-quintile momentum
