"""From setups to candidates and plans, per engine, with the funnel (spec §5.1) persisted per engine per day:
available -> clean -> liquid -> setup -> context-compatible -> executable -> portfolio-selected.
  clean      a bar with all four prices, High >= Low, and no unexplained overnight move beyond 40% (an adjustment error is
             excluded, never traded); the 3 sessions after such a jump are unclean too (a residual or range built across it is
             not a measurement); a bar that follows a gap of more than 8 calendar days in the symbol's own history (a suspension)
             is stale. Judged per date: how a symbol's history ENDS never decides its past (review finding 1, DECISIONS #8a)
  context    the engine's regime list (configs): active, paper_only (kept, flagged), or inactive (dropped). An engine whose
             required event coverage is MISSING (E4) is paper_only in every regime (DECISIONS #8d)
E6 has no setup function: it is BLOCKED_DATA and produces no candidates (configs/engines/E6.yaml)."""
from __future__ import annotations

from functools import partial

import numpy as np
import pandas as pd

from . import setups as S
from .execsim import Plan
from .portfolio import Cand

ENGINES = ("E1", "E2", "E3", "E4", "E5", "E7")     # E7: forward-only (DECISIONS #15); E6 has no setup


def clean_mask(df: pd.DataFrame) -> pd.Series:
    ok = df[["Open", "High", "Low", "Close"]].notna().all(axis=1) & (df["High"] >= df["Low"]) & (df["Close"] > 0)
    jump = ((df["Open"] / df["Close"].shift(1) - 1).abs() > 0.40).fillna(False)
    after_jump = jump.astype(int).rolling(4, min_periods=1).max().astype(bool)          # the jump bar and the 3 after it
    gap = pd.Series(df.index, index=df.index).diff() > pd.Timedelta(days=8)              # first bar back from a suspension
    return ok & ~after_jump & ~gap.fillna(False)


def round_trip(cost, tv: pd.Series) -> pd.Series:
    """Fees plus modelled spread and slippage on both sides, as a fraction of price, by each day's traded value."""
    base = cost.statutory_round_trip_pct() / 100
    return pd.Series([base + 2 * cost.impact(None if v != v else float(v)) for v in tv.to_numpy()], index=tv.index)


def setup_frame(engine: str, sym: str, df: pd.DataFrame, ctx: dict, cfg: dict, mkt_ret: pd.Series, cost) -> pd.DataFrame:
    """`cost` is a CostModel (fees + spread + slippage enter the reward-to-risk filters) or a plain round-trip fraction."""
    from . import ind
    cost_rt = round_trip(cost, ind.traded_value_cr(df, 20)) if hasattr(cost, "impact") else cost
    if engine in ("E1", "E7"):                      # E7 is E1's setup with a different exit
        return S.e1(sym, df, ctx, cfg)
    if engine == "E2":
        return S.e2(sym, df, ctx, cfg)
    if engine == "E3":
        return S.e3(sym, df, ctx, cfg, cost_rt)
    if engine == "E4":
        return S.e4(sym, df, ctx, cfg, mkt_ret, cost_rt)
    if engine == "E5":
        return S.e5(sym, df, ctx, cfg, cost_rt)
    raise ValueError(engine)


def _plan(engine: str, variant: str, sym: str, df: pd.DataFrame, fr: pd.DataFrame, t: int, cfg: dict, adv: float, qty: int,
          stop_override: float | None = None, time_scale: float = 1.0) -> Plan:
    c = df["Close"].to_numpy(float)
    row = fr.iloc[t]
    ref, atr = c[t], float(row["atr"])
    stop = float(row["stop"]) if stop_override is None else stop_override
    chase = ref + 0.5 * atr
    risk = ref - stop
    ts = max(2, int(round(cfg["exits"]["time_stop_sessions"] * time_scale)))
    rj = cfg["reject"]
    p = Plan(engine, sym, t, stop, chase, ts, adv_cr=adv, qty=qty, stop_pct=(rj["min_stop_distance_pct"], rj["max_stop_distance_pct"]))
    partials = [(k, f) for f, k in cfg["exits"]["challenger"]["partials"]] if variant == "challenger" and "challenger" in cfg["exits"] else []
    if engine == "E1":
        low20 = fr["exit_low20"].to_numpy(float)
        p.exit_on_close = lambda i, e: c[i] < low20[i]
        p.partials_r = partials
    elif engine == "E7":
        pass                                        # no trailing exit: the stop and the 60-session limit only
    elif engine == "E2":
        lvl = float(row["level"])
        p.exit_on_close = lambda i, e: i - 1 > t and c[i] < lvl and c[i - 1] < lvl
        p.partials_r = partials
    elif engine == "E3":
        if partials:
            p.partials_r = partials
        else:
            p.targets = [(float(row["target"]), 1.0)]
    elif engine == "E4":
        z = fr["z"].to_numpy(float)
        p.exit_on_close = lambda i, e: z[i] >= 0
    elif engine == "E5":
        p.targets = [(float(row["t1"]), 0.5), (float(row["t2"]), 0.5)]
    return p


def candidates(engine: str, variant: str, bars: dict, ctx: dict, cfg: dict, regime: pd.Series, sector_of: dict, mkt_ret: pd.Series,
               cost, lo: pd.Timestamp, hi: pd.Timestamp, funnel: dict | None = None, stop_pad: float = 0.25, time_scale: float = 1.0,
               frames: dict | None = None) -> list[Cand]:
    """`stop_pad` and `time_scale` perturb the plan BEFORE sizing (the neighbourhood test); `frames` caches setup frames."""
    rg = cfg["regimes"]
    active, paper = set(rg.get("active", [])), set(rg.get("paper_only", []))
    events_missing = str(cfg.get("setup", {}).get("events", {}).get("coverage", "")).upper() == "MISSING"
    if events_missing:                                     # E4: no event coverage, so nothing it does is promotion evidence
        paper, active = paper | active, set()
    out: list[Cand] = []
    for sym, df in bars.items():
        if len(df) < 260:
            continue
        fr = frames[sym] if frames is not None and sym in frames else setup_frame(engine, sym, df, ctx, cfg, mkt_ret, cost)
        if frames is not None:
            frames[sym] = fr
        clean = clean_mask(df)
        liquid = (fr["tv"] >= cfg["universe"]["min_median_traded_value_cr_20d"]) & (df["Close"] >= cfg["universe"]["min_price"])
        reg = regime.reindex(df.index).fillna("unknown")
        ctx_ok = reg.isin(active | paper)
        window = (df.index >= lo) & (df.index < hi)
        if funnel is not None:
            for k, m in (("available", pd.Series(True, index=df.index)), ("clean", clean), ("liquid", clean & liquid),
                         ("setup", clean & liquid & fr["setup"]), ("context", clean & liquid & fr["setup"] & ctx_ok)):
                hit = m[window]
                funnel.setdefault(k, pd.Series(0, index=pd.DatetimeIndex([]), dtype=int))
                funnel[k] = funnel[k].add(hit.astype(int), fill_value=0)
        sel = window & clean & liquid & fr["setup"] & ctx_ok
        for t in np.flatnonzero(sel.to_numpy()):
            row = fr.iloc[t]
            feats = [row.get("f1"), row.get("f2"), row.get("f3")]
            stop = float(row["stop"]) + (0.25 - stop_pad) * float(row["atr"])          # 0.25 ATR is the frozen pad
            out.append(Cand(engine, sym, df.index[t], int(t), 0.0, float(df["Close"].iloc[t]), stop, float(row["atr"]),
                            float(row["tv"]), sector_of.get(sym), str(reg.iloc[t]),
                            "active" if reg.iloc[t] in active else "paper_only",
                            partial(_plan, engine, variant, sym, df, fr, int(t), cfg, float(row["tv"]), stop_override=stop, time_scale=time_scale)))
            out[-1].feats = feats
    _score(out)
    return out


def _score(cands: list[Cand]) -> None:
    """Rank: equal-weight mean of each feature's percentile among that day's candidates of the engine (caps outliers by
    construction). A percentile score is a rank, not a probability."""
    by_day: dict = {}
    for c in cands:
        by_day.setdefault(c.date, []).append(c)
    for day in by_day.values():
        m = np.array([[np.nan if f is None or f != f else float(f) for f in c.feats] for c in day])
        pct = np.zeros_like(m)
        for j in range(m.shape[1]):
            col = pd.Series(m[:, j])
            pct[:, j] = col.rank(pct=True).fillna(0.5).to_numpy()
        for c, p in zip(day, pct.mean(axis=1)):
            c.score = float(p)
