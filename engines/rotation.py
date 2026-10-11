"""rotation.py — Engine 3: learn which industry groups are about to lead, then rank stocks inside them.

The group model works on GROUPS, not stocks. Each group (a real NSE index where Yahoo holds one, otherwise an equal-weighted
index of its industry built from the screened stocks) gets daily features: its own momentum, volatility and trend, how
many of its members are above their 50-day average (breadth), how widely its members disagree (dispersion), its strength
against the Nifty, and the state of the market. The target is the group's return over the next 21 sessions minus the
Nifty's, ranked across groups that day. The two best-scored groups each session are 'in rotation'; their stocks are
then ranked by the Rank engine and the strongest become signals.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import Ctx
from features import FEATURES_MARKET
from indicators import sma

GROUP_FEATURES = ["g_ret_5", "g_ret_21", "g_ret_63", "g_ret_126", "g_vol_21", "g_dist_50", "g_dist_200", "g_trend", "g_breadth_50",
                  "g_disp_21", "g_rel_21", "g_rel_63"] + FEATURES_MARKET
H = 21


def build_group_panel(ctx: Ctx, panel: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    dates = panel.index.get_level_values("date").unique().sort_values()
    nb = ctx.bench.reindex(dates, method="ffill")
    n21, n63 = nb / nb.shift(21) - 1, nb / nb.shift(63) - 1
    mk = panel[FEATURES_MARKET].groupby(level="date").first()
    members: dict[str, list[str]] = {}
    for s, g in ctx.group_of.items():
        members.setdefault(g, []).append(s)
    slim = panel[["d_sma50", "ret_21", "liquid"]].copy()
    slim["group"] = slim.index.get_level_values("sym").map(ctx.group_of)
    slim = slim[(slim["liquid"] > 0) & slim["group"].notna()]
    agg = slim.groupby([slim.index.get_level_values("date"), "group"]).agg(
        g_breadth_50=("d_sma50", lambda x: float((x > 0).mean())), g_disp_21=("ret_21", "std"), n=("ret_21", "size"))
    agg.index.names = ["date", "group"]
    parts, labs = [], []
    for g, syms in members.items():
        lvl = ctx.group_level.get(g)
        if lvl is None or len(syms) < 5:
            continue
        lvl = lvl.reindex(dates, method="ffill")
        f = pd.DataFrame(index=dates)
        for n in (5, 21, 63, 126):
            f[f"g_ret_{n}"] = lvl / lvl.shift(n) - 1
        f["g_vol_21"] = lvl.pct_change().rolling(21).std()
        s50, s200 = sma(lvl, 50), sma(lvl, 200)
        f["g_dist_50"] = lvl / s50 - 1
        f["g_dist_200"] = lvl / s200 - 1
        f["g_trend"] = ((lvl > s50) & (s50 > s50.shift(10))).astype(float)
        a = agg.xs(g, level="group").reindex(dates)
        f["g_breadth_50"] = a["g_breadth_50"]
        f["g_disp_21"] = a["g_disp_21"]
        f["g_rel_21"] = f["g_ret_21"] - n21
        f["g_rel_63"] = f["g_ret_63"] - n63
        f = f.join(mk)
        f["group"] = g
        f["liquid"] = (a["n"].fillna(0) >= 4).astype(float)
        parts.append(f)
        fwd = lvl.shift(-1 - H + 1) / lvl.shift(-1) - 1                      # return over the next H sessions, from tomorrow
        labs.append(pd.DataFrame({"fwd_g": fwd - (nb.shift(-H) / nb.shift(-1) - 1), "group": g}, index=dates))
    gp = pd.concat(parts).reset_index().rename(columns={"index": "date"}).set_index(["date", "group"]).sort_index()
    gl = pd.concat(labs).reset_index().rename(columns={"index": "date"}).set_index(["date", "group"]).sort_index().reindex(gp.index)
    gl["rank_g"] = gl["fwd_g"].groupby(level="date").rank(pct=True)
    gl["excess_g"] = gl["fwd_g"]
    return gp.astype("float32"), gl.astype("float32")


def stock_scores(gscore: pd.Series, stock_scores_: pd.Series, ctx: Ctx, top_groups: int = 2) -> pd.Series:
    """Stocks inside the best-scored groups, ranked by their own score. Everything else is left out."""
    g = gscore.dropna().reset_index()
    g.columns = ["date", "group", "gscore"]
    g["rk"] = g.groupby("date")["gscore"].rank(ascending=False)
    top = g[g["rk"] <= top_groups].groupby("date")["group"].apply(set)
    sc = stock_scores_.dropna()
    d = sc.index.get_level_values("date")
    syms = sc.index.get_level_values("sym")
    grp = pd.Series(syms).map(ctx.group_of).values
    keep = np.fromiter((gr in top.get(dt, ()) for dt, gr in zip(d, grp)), dtype=bool, count=len(sc))
    return sc[keep] + 100.0              # the offset only keeps them ranked in their own bucket; the order is the stock score's
