"""E1 decomposition (DECISIONS #13): where does E1's walk-forward result come from? Diagnostic on history that is already inspected,
so nothing here can promote anything. Every book uses the same days, the same plan builder, costs and portfolio as v3.run:

  E1           E1 as frozen (top-quintile momentum + 20-session breakout + rising 50-day, trailing exit, 60-session limit)
  RAND         a random liquid stock on each E1 signal day, E1's plan                          -> market exposure + exit plan
  RAND_TREND   a random liquid stock above a rising 50-day average, E1's plan                   -> + the trend filter
  RAND_MOM     a random liquid stock in the top momentum quintile and above a rising 50-day      -> + the momentum rank
  E1_NOTRAIL   E1's own entries, exiting only at the stop or the 60-session limit                 -> what the trailing exit adds
  NIFTY        the exposure-matched Nifty for E1's book                                          -> the market alone
Each random book is drawn 20 times with different seeds and reported as the median and the 10th-90th percentile range, so one
lucky draw cannot carry the comparison. Writes research/v3/decompose_e1.json and registers each configuration as a trial.

Usage: python -m v3.decompose [snapshot.pkl]
"""
from __future__ import annotations

import dataclasses
import json
import os
import pathlib
import sys

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import trial_registry as TR  # noqa: E402
from v3 import config, costs as C, engines as EN, ind, portfolio as P, regime as RG, setups as S  # noqa: E402
from v3.run import EQUITY, OUT, SEG, WF, complete_sessions, fetch, summarise, trades_of  # noqa: E402

DRAWS = 20


def pools(bars, ctx, cfg):
    """Per-symbol daily eligibility masks: liquid+clean (RAND), + above a rising 50-day (TREND), + top-quintile momentum (MOM)."""
    u = cfg["universe"]
    out = {}
    for s, d in bars.items():
        tv = ind.traded_value_cr(d, 20)
        liq = (tv >= u["min_median_traded_value_cr_20d"]) & (d["Close"] >= u["min_price"]) & EN.clean_mask(d)
        s50 = ind.sma(d["Close"], 50)
        trend = liq & (d["Close"] > s50) & (s50 > s50.shift(10))
        mom = trend & (ctx["mom_pct"][s].reindex(d.index) >= 80) & (ctx["mom"][s].reindex(d.index) > 0)
        out[s] = {"RAND": liq.fillna(False), "RAND_TREND": trend.fillna(False), "RAND_MOM": mom.fillna(False), "tv": tv}
    return out


def random_book(kind, e1_cands, bars, ctx, cfg, sector_of, mret, cost, masks, seed, frames):
    rng = np.random.default_rng(seed)
    out = []
    for c in e1_cands:
        pool = [s for s, m in masks.items() if bool(m[kind].get(c.date, False)) and len(bars[s]) >= 260]
        if not pool:
            continue
        s_ = pool[int(rng.integers(len(pool)))]
        df = bars[s_]
        t = df.index.get_loc(c.date)
        if s_ not in frames:
            frames[s_] = EN.setup_frame("E1", s_, df, ctx, cfg, mret, cost)
        fr = frames[s_]
        ref = float(df["Close"].iloc[t])
        stop = ref * (c.stop / c.ref)
        atr = float(fr["atr"].iloc[t]) if fr["atr"].iloc[t] == fr["atr"].iloc[t] else ref * 0.02
        tv = float(masks[s_]["tv"].iloc[t])
        rc = P.Cand("E1", s_, c.date, t, c.score, ref, stop, atr, tv, sector_of.get(s_), c.regime, c.status,
                    (lambda q, df=df, fr=fr, t=t, stop=stop, s_=s_, tv=tv: EN._plan("E1", "baseline", s_, df, fr, t, cfg, tv, q, stop_override=stop)))
        rc.feats = None
        out.append(rc)
    return out


def main(argv) -> None:
    cfgs = config.all_configs()
    if len(argv) > 1:
        snap = pd.read_pickle(argv[1])
    else:
        snap = fetch()
        pd.to_pickle(snap, os.environ.get("V3_SNAPSHOT", "v3_bars.pkl"))
    snap = complete_sessions(snap)
    bars = {s: d for s, d in snap["exchange"].items() if len(d) >= 260}
    adj = pd.DataFrame({s: snap["adj"][s]["Close"] for s in bars if s in snap["adj"]})
    sector_of = {u["sym"]: u.get("sector") for u in snap["universe"]}
    nifty, vix = snap["nifty"], snap["vix"]
    data_hash = TR.bars_hash(bars, nifty, vix)
    regime = RG.regime(nifty, vix, cfgs["regime"]["hysteresis_sessions"])
    ctx = S.context(adj, sector_of)
    mret = nifty.pct_change(fill_method=None)
    cost = C.CostModel.from_config(cfgs["costs"])
    cfg = cfgs["engines"]["E1"]
    index = nifty.index
    lo, hi = pd.Timestamp(SEG["development"][0]), pd.Timestamp(SEG["inspected"][1])
    frames: dict = {}
    e1 = [c for c in EN.candidates("E1", "baseline", bars, ctx, cfg, regime, sector_of, mret, cost, lo, hi, frames=frames) if c.status == "active"]
    masks = pools(bars, ctx, cfg)
    windows = {"walk_forward_2023_24": WF, "inspected_2025_26": ("inspected",), "development_2019_22": ("development",)}

    def run(cands):
        pos, _ = P.run_book(cands, bars, cost, EQUITY)
        return {w: summarise(pos, bars, cost, mret, index, segs)[0] for w, segs in windows.items()}

    res = {"evidence": cfgs["evidence"], "data_hash": data_hash, "data_through": snap["cut"], "draws": DRAWS, "books": {}}
    res["books"]["E1"] = run(e1)
    notrail = []
    for c in e1:
        nc = dataclasses.replace(c, make_plan=(lambda q, b=c.make_plan: dataclasses.replace(b(q), exit_on_close=None)))
        nc.feats = getattr(c, "feats", None)
        notrail.append(nc)
    res["books"]["E1_NOTRAIL"] = run(notrail)
    for kind in ("RAND", "RAND_TREND", "RAND_MOM"):
        draws = [run(random_book(kind, e1, bars, ctx, cfg, sector_of, mret, cost, masks, 20261022 + k, frames)) for k in range(DRAWS)]
        agg = {}
        for w in windows:
            ex = [d[w].get("expectancy_r") for d in draws if d[w].get("expectancy_r") is not None]
            bk = [d[w].get("book_return_pct") for d in draws if d[w].get("book_return_pct") is not None]
            agg[w] = {"expectancy_r_median": round(float(np.median(ex)), 4) if ex else None,
                      "expectancy_r_p10_p90": [round(float(np.percentile(ex, 10)), 4), round(float(np.percentile(ex, 90)), 4)] if ex else None,
                      "book_return_pct_median": round(float(np.median(bk)), 3) if bk else None,
                      "n_median": int(np.median([d[w].get("n", 0) for d in draws])),
                      "share_of_draws_beating_E1": round(float(np.mean([x > (res["books"]["E1"][w].get("expectancy_r") or -9) for x in ex])), 3) if ex else None}
        res["books"][kind] = agg
        TR.record("E1", cfg["version"], f"decompose:{kind}", data_hash, {"windows": list(windows), "draws": DRAWS},
                  {w: agg[w] for w in windows}, "v3.decompose diagnostic (inspected history; cannot promote)")
    res["nifty_exposure_matched_pct"] = {w: res["books"]["E1"][w].get("exposure_matched_nifty_pct") for w in windows}
    (OUT / "decompose_e1.json").write_text(json.dumps(res, indent=1, default=str))
    for k, v in res["books"].items():
        print(k, {w: (v[w].get("expectancy_r", v[w].get("expectancy_r_median")), v[w].get("n", v[w].get("n_median"))) for w in windows})


if __name__ == "__main__":
    main(sys.argv)
