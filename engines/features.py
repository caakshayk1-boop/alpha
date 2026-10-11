"""features.py — the feature panel every AI engine learns from. One row per (date, stock).

NO LOOKAHEAD. Every value at date t is computed from bars up to and including t, using trailing windows only.
Labels (labels.py) are the only place the future is read, and they are never features.

Groups of features
  price     returns at 1/5/10/21/63/126 days, 12-1 month momentum, distance from 52-week high and low,
            distance from the 20/50/200-day averages in ATR units, trend slope, RSI(14) and RSI(2), MACD, stochastic,
            Bollinger position and width, ADX
  risk      realised volatility (21/63), its ratio, downside volatility, ATR as % of price, 63-day drawdown,
            share of up days
  volume    volume ratios, log traded value, Amihud illiquidity, on-balance-volume slope, close location, gaps
  sector    the stock against its OWN benchmark (leave-one-out group index; real NSE index where Yahoo has it):
            relative return, the benchmark's trend, momentum against the Nifty, distance from its 50-day
  market    Nifty returns, trend and volatility, universe breadth (share above 50-day), dispersion
  rank      the cross-sectional percentile of the key features each day (what matters is rank within the market)
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Ctx, liquid
from indicators import adx, atr, ema, macd_hist, rsi, sma, stoch_k

RANK_COLS = ["ret_21", "ret_63", "ret_126", "mom_12_1", "vol_21", "volr_5_20", "dist_hi", "rel_63", "rsi_14", "amihud"]


def symbol_features(df: pd.DataFrame, sym: str, ctx: Ctx) -> pd.DataFrame:
    c, h, l, o, v = df["Close"], df["High"], df["Low"], df["Open"], df["Volume"]
    r = c.pct_change()
    a = atr(df, 14)
    f = pd.DataFrame(index=df.index)
    for n in (1, 5, 10, 21, 63, 126):
        f[f"ret_{n}"] = c / c.shift(n) - 1
    f["mom_12_1"] = c.shift(21) / c.shift(252) - 1
    f["vol_21"] = r.rolling(21).std()
    f["vol_63"] = r.rolling(63).std()
    f["vol_ratio"] = f["vol_21"] / f["vol_63"]
    f["down_vol_21"] = r.clip(upper=0).rolling(21).std()
    f["atr_pct"] = a / c
    f["mom_vol_adj"] = f["ret_63"] / (f["vol_63"] * np.sqrt(63))
    f["dist_hi"] = c / h.rolling(252, min_periods=120).max() - 1
    f["dist_lo"] = c / l.rolling(252, min_periods=120).min() - 1
    s20, s50, s200 = sma(c, 20), sma(c, 50), sma(c, 200)
    f["d_sma20"] = (c - s20) / a
    f["d_sma50"] = (c - s50) / a
    f["d_sma200"] = (c - s200) / a
    f["slope_50"] = s50 / s50.shift(10) - 1
    f["rsi_14"] = rsi(c, 14)
    f["rsi_2"] = rsi(c, 2)
    f["macd_n"] = macd_hist(c) / c
    f["stoch"] = stoch_k(df, 14)
    sd20 = c.rolling(20).std()
    f["bb_pctb"] = (c - (s20 - 2 * sd20)) / (4 * sd20).replace(0, np.nan)
    width = 4 * sd20 / s20
    f["bb_width_pct"] = width.rolling(120, min_periods=60).rank(pct=True)
    f["adx"] = adx(df, 14)
    f["dd_63"] = c / c.rolling(63).max() - 1
    f["up_frac_63"] = (r > 0).rolling(63).mean()
    f["volr_5_20"] = v.rolling(5).mean() / v.rolling(20).mean()
    f["volr_20_60"] = v.rolling(20).mean() / v.rolling(60).mean()
    tv = c * v
    f["turnover"] = np.log1p(tv.rolling(20).median())
    f["amihud"] = np.log1p((r.abs() / tv.replace(0, np.nan)).rolling(20).mean() * 1e9)
    obv = (np.sign(r).fillna(0) * v).cumsum()
    f["obv_slope"] = (obv - obv.shift(21)) / v.rolling(21).sum().replace(0, np.nan)
    rng = (h - l).replace(0, np.nan)
    f["clv_10"] = ((2 * c - h - l) / rng).rolling(10).mean()
    f["gap_5"] = (o / c.shift(1) - 1).rolling(5).mean()
    f["body_5"] = ((c - o) / rng).rolling(5).mean()
    # the stock against its own benchmark
    gb = ctx.bench_for(sym, df.index)
    if gb is not None:
        g21, g63 = gb / gb.shift(21) - 1, gb / gb.shift(63) - 1
        nb = ctx.bench.reindex(df.index, method="ffill")
        gs50 = sma(gb, 50)
        f["rel_21"] = f["ret_21"] - g21
        f["rel_63"] = f["ret_63"] - g63
        f["g_mom_63"] = g63 - (nb / nb.shift(63) - 1)
        f["g_dist_50"] = gb / gs50 - 1
        f["g_trend"] = ((gb > gs50) & (gs50 > gs50.shift(10))).astype(float)
    else:
        for k in ("rel_21", "rel_63", "g_mom_63", "g_dist_50", "g_trend"):
            f[k] = np.nan
    f["liquid"] = liquid(df).astype(float)
    return f.astype("float32")


def market_features(ctx: Ctx, index: pd.DatetimeIndex) -> pd.DataFrame:
    n = ctx.bench.reindex(index, method="ffill")
    m = pd.DataFrame(index=index)
    m["n_ret_21"] = n / n.shift(21) - 1
    m["n_ret_63"] = n / n.shift(63) - 1
    m["n_dist_200"] = n / sma(n, 200) - 1
    m["n_vol_21"] = n.pct_change().rolling(21).std()
    return m.astype("float32")


def build_panel(bars: dict, ctx: Ctx, log=print) -> pd.DataFrame:
    """The long panel: index (date, sym). Adds universe-wide breadth and dispersion and the cross-sectional ranks."""
    parts = []
    for i, (sym, df) in enumerate(bars.items()):
        if len(df) < 300:
            continue
        f = symbol_features(df, sym, ctx)
        f["sym"] = sym
        parts.append(f)
        if (i + 1) % 250 == 0:
            log(f"  features {i + 1}/{len(bars)}")
    panel = pd.concat(parts)
    panel = panel.reset_index().rename(columns={"index": "date", "Date": "date"}).set_index(["date", "sym"]).sort_index()
    g = panel.groupby(level="date")
    mk = market_features(ctx, panel.index.get_level_values("date").unique().sort_values())
    mk["breadth_50"] = g["d_sma50"].apply(lambda s: (s > 0).mean()).astype("float32")
    mk["dispersion_21"] = g["ret_21"].std().astype("float32")
    mk["mkt_ret_21_med"] = g["ret_21"].median().astype("float32")
    panel = panel.join(mk, on="date")
    for col in RANK_COLS:
        panel[f"rk_{col}"] = panel.groupby(level="date")[col].rank(pct=True).astype("float32")
    return panel


FEATURES_PRICE_VOL = [
    "ret_1", "ret_5", "ret_10", "ret_21", "ret_63", "ret_126", "mom_12_1", "vol_21", "vol_63", "vol_ratio", "down_vol_21", "atr_pct",
    "mom_vol_adj", "dist_hi", "dist_lo", "d_sma20", "d_sma50", "d_sma200", "slope_50", "rsi_14", "rsi_2", "macd_n", "stoch", "bb_pctb",
    "bb_width_pct", "adx", "dd_63", "up_frac_63", "volr_5_20", "volr_20_60", "turnover", "amihud", "obv_slope", "clv_10", "gap_5", "body_5",
]
FEATURES_SECTOR = ["rel_21", "rel_63", "g_mom_63", "g_dist_50", "g_trend"]
FEATURES_MARKET = ["n_ret_21", "n_ret_63", "n_dist_200", "n_vol_21", "breadth_50", "dispersion_21", "mkt_ret_21_med"]
FEATURES_RANK = [f"rk_{c}" for c in RANK_COLS]
ALL_FEATURES = FEATURES_PRICE_VOL + FEATURES_SECTOR + FEATURES_MARKET + FEATURES_RANK
