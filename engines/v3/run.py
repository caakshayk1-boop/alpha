"""Validation run for E1-E5 under the frozen pre-registration (v1.0.0). Research only: writes research/v3/, appends every evaluated
configuration to research/trials.jsonl, and publishes NOTHING (the feed is built in dry-run and saved as a research file).

Segments by signal date (PREREGISTRATION §6):
  unseen       2010-01-01 .. 2019-10-20   never used by any engine; confirmation only
  development  2019-10-21 .. 2022-12-31
  wf1..wf4     2023H1, 2023H2, 2024H1, 2024H2 (walk-forward folds; the rules fit no parameter, so each fold is out of sample)
  inspected    2025-01-01 .. end          read by Swing v2 and the ML engines: historical only, never promotion evidence
Promotion evidence = the four walk-forward folds together, net of costs-1.0.0, tested against promotion_policy.yaml.

Usage: python -m v3.run [snapshot.pkl]   (no argument: download, save $V3_SNAPSHOT or ./v3_bars.pkl, then run)
"""
from __future__ import annotations

import dataclasses
import json
import os
import pathlib
import sys
import time

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import trial_registry as TR  # noqa: E402
from v3 import config, costs as C, engines as EN, portfolio as P, publish as PB, regime as RG, setups as S, stats as ST  # noqa: E402
from v3.execsim import simulate  # noqa: E402

OUT = HERE.parent / "research" / "v3"
SEG = {"unseen": ("2010-01-01", "2019-10-21"), "development": ("2019-10-21", "2023-01-01"), "wf1": ("2023-01-01", "2023-07-01"),
       "wf2": ("2023-07-01", "2024-01-01"), "wf3": ("2024-01-01", "2024-07-01"), "wf4": ("2024-07-01", "2025-01-01"),
       "inspected": ("2025-01-01", "2100-01-01")}
WF = ("wf1", "wf2", "wf3", "wf4")
EQUITY = 1_000_000.0
VARIANTS = {"E1": ("baseline", "challenger"), "E2": ("baseline", "challenger"), "E3": ("baseline", "challenger"), "E4": ("baseline",), "E5": ("baseline",)}


def fetch() -> dict:
    import urllib.request
    import yfinance as yf
    import data
    with urllib.request.urlopen(urllib.request.Request("https://raw.githubusercontent.com/caakshayk1-boop/trading-dashboard/main/docs/screen.json",
                                                       headers={"User-Agent": "alpha-engines/v3"}), timeout=60) as r:
        rows = json.load(r)["rows"]
    uni = [{"sym": x["sym"], "sector": x.get("sector")} for x in rows]
    adj, ex = data.download([u["sym"] for u in uni], period="max", with_exchange=True)

    def one(t):
        b = yf.download(t, period="max", interval="1d", auto_adjust=False, progress=False)
        b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
        s = b["Close"].dropna()
        s.index = pd.to_datetime(s.index).tz_localize(None)
        return s
    return {"adj": adj, "exchange": ex, "universe": uni, "nifty": one("^NSEI"), "vix": one("^INDIAVIX"), "fetched": pd.Timestamp.utcnow().isoformat()}


def complete_sessions(snap: dict) -> dict:
    """Drop any bar dated today or later in IST: a run during the session must never read an intraday bar as a close."""
    today_ist = (pd.Timestamp.utcnow() + pd.Timedelta(hours=5, minutes=30)).normalize().tz_localize(None)
    after_close = (pd.Timestamp.utcnow() + pd.Timedelta(hours=5, minutes=30)).hour >= 18
    cut = today_ist if after_close else today_ist - pd.Timedelta(days=1)
    f = lambda x: x.loc[x.index <= cut]  # noqa: E731
    return {**snap, "adj": {k: f(v) for k, v in snap["adj"].items()}, "exchange": {k: f(v) for k, v in snap["exchange"].items()},
            "nifty": f(snap["nifty"]), "vix": f(snap["vix"]), "cut": str(cut.date())}


def scaled(m: C.CostModel, k: float) -> C.CostModel:
    return C.CostModel(**{**m.__dict__, **{f: getattr(m, f) * k for f in ("stt_buy", "stt_sell", "stamp_buy", "exch", "sebi", "brokerage", "dp_sell", "slippage")},
                          "half_spread": {a: v * k for a, v in m.half_spread.items()}})


def seg_of(d: pd.Timestamp) -> str:
    for k, (a, b) in SEG.items():
        if pd.Timestamp(a) <= d < pd.Timestamp(b):
            return k
    return "none"


def trades_of(positions) -> list[dict]:
    out = []
    for p in positions:
        f = p.fill
        if f.status != "filled":
            continue
        out.append({"engine": p.cand.engine, "sym": p.cand.sym, "date": p.cand.date, "exit": p.exit_date, "r": f.r_net, "r_gross": f.r_gross,
                    "regime": p.cand.regime, "status": p.cand.status, "tags": list(p.tags), "ambiguous": f.ambiguous_bar, "reason": f.reason,
                    "qty": p.qty, "risk_rs": (f.entry - p.cand.stop) * p.qty, "seg": seg_of(p.cand.date)})
    return out


def with_plan(cands, fn):
    """Same candidates, each plan transformed by fn(plan, cand) (delay, stop pad, time stop)."""
    out = []
    for c in cands:
        base = c.make_plan
        out.append(dataclasses.replace(c, make_plan=(lambda q, b=base, cc=c: fn(b(q), cc))))
        out[-1].feats = getattr(c, "feats", None)
    return out


def summarise(trades: list[dict], daily: pd.Series, nifty_ret: pd.Series, exposure: pd.Series, segs) -> dict:
    t = [x for x in trades if x["seg"] in segs]
    lo, hi = SEG[segs[0]][0], SEG[segs[-1]][1]
    d = daily.loc[(daily.index >= lo) & (daily.index < hi)]
    m = ST.trade_metrics([x["r"] for x in t])
    if len(d) > 30:
        ci = ST.stationary_bootstrap_ci(d.to_numpy(), block=21, reps=10000)
        bench = (nifty_ret.reindex(d.index).fillna(0) * exposure.reindex(d.index).fillna(0))
        m.update({"book_return_pct": round(float(d.sum() * 100), 3), "daily_mean_ci95_pct": [round(ci[0] * 100, 5), round(ci[1] * 100, 5)],
                  "sharpe_daily": ST.sharpe(d.to_numpy()), "max_dd_pct": round(ST.max_drawdown(d), 3),
                  "exposure_avg_pct": round(float(exposure.reindex(d.index).fillna(0).mean() * 100), 2),
                  "exposure_matched_nifty_pct": round(float(bench.sum() * 100), 3), "cash_pct": 0.0,
                  "avg_hold_sessions": None, "independent_months": int(len({(x["date"].year, x["date"].month) for x in t}))})
    m["by_regime"] = {r: ST.trade_metrics([x["r"] for x in t if x["regime"] == r]) for r in sorted({x["regime"] for x in t})}
    m["ambiguous_bars"] = int(sum(x["ambiguous"] for x in t))
    return m


def exposure_of(positions, index) -> pd.Series:
    e = pd.Series(0.0, index=index)
    for p in positions:
        f = p.fill
        if f.status != "filled":
            continue
        a, b = p.cand.date, p.exit_date
        e.loc[(e.index > a) & (e.index <= b)] += f.entry * p.qty / EQUITY
    return e


def random_baseline(trades, bars, cost, seed=20261022) -> list[float]:
    """For each trade: a random stock that passed the liquidity floor that day, the same stop distance in %, the same time stop."""
    rng = np.random.default_rng(seed)
    liquid = {s: (d["Close"] * d["Volume"]).rolling(20, min_periods=20).median() / 1e7 for s, d in bars.items()}
    out = []
    for x in trades:
        pool = [s for s, tv in liquid.items() if x["date"] in tv.index and tv.at[x["date"]] >= 10 and bars[s].at[x["date"], "Close"] >= 50]
        if not pool:
            continue
        s = pool[int(rng.integers(len(pool)))]
        df = bars[s]
        t = df.index.get_loc(x["date"])
        ref = float(df["Close"].iloc[t])
        dist = x["risk_rs"] / x["qty"] / ref if x["qty"] else 0.05
        from v3.execsim import Plan
        f = simulate(df, Plan("RND", s, t, ref * (1 - dist), ref * 1.05, 15, adv_cr=float(liquid[s].iloc[t])), cost)
        if f.status == "filled":
            out.append(f.r_net)
    return out


def main(argv) -> None:
    t0 = time.time()
    cfgs = config.all_configs()                                        # FrozenMismatch here stops everything
    OUT.mkdir(parents=True, exist_ok=True)
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
    base, stress = C.CostModel.from_config(cfgs["costs"]), C.CostModel.from_config(cfgs["costs"], stress=True)
    rt = base.statutory_round_trip_pct() / 100
    index = nifty.index
    lo, hi = pd.Timestamp(SEG["unseen"][0]), pd.Timestamp(SEG["inspected"][1])
    res = {"version": "v1.0.0", "evidence": cfgs["evidence"], "freeze_commit": "af7c35ae02c94833f1cedac827a3647dd57d3b70", "data_hash": data_hash,
           "data_through": snap["cut"], "fetched": snap["fetched"], "universe": len(bars), "segments": SEG, "engines": {}, "funnel": {}}
    daily_by_cfg, trades_by_engine, cands_by_engine = {}, {}, {}
    for e, variants in VARIANTS.items():
        cfg = cfgs["engines"][e]
        funnel: dict = {}
        er = {"variants": {}}
        for v in variants:
            cands = EN.candidates(e, v, bars, ctx, cfg, regime, sector_of, mret, rt, lo, hi, funnel if v == "baseline" else None)
            if v == "baseline":
                cands_by_engine[e] = cands
            pos, skipped = P.run_book(cands, bars, base, EQUITY)
            tr = trades_of(pos)
            daily = P.daily_returns(pos, EQUITY, index)
            expo = exposure_of(pos, index)
            name = f"{e}:{v}"
            daily_by_cfg[name] = daily
            vr = {"candidates": len(cands), "skipped": skipped,
                  "segments": {s: summarise(tr, daily, mret, expo, (s,)) for s in SEG},
                  "walk_forward": summarise(tr, daily, mret, expo, WF)}
            # sensitivity on the walk-forward folds: stress broker, 2x costs, one-session delay
            for label, cm, fn in (("broker_stress", stress, None), ("costs_2x", scaled(base, 2.0), None),
                                  ("delay_1", base, lambda p, c: dataclasses.replace(p, t_signal=p.t_signal + 1))):
                cc = with_plan(cands, fn) if fn else cands
                pp, _ = P.run_book(cc, bars, cm, EQUITY)
                vr[f"walk_forward_{label}"] = ST.trade_metrics([x["r"] for x in trades_of(pp) if x["seg"] in WF])
            # parameter neighbourhood: stop pad 0.25 ATR and the time stop, each +-20%, one at a time
            neigh = {}
            for label, fn in (("pad_0.20", lambda p, c: dataclasses.replace(p, stop=p.stop + 0.05 * c.atr)),
                              ("pad_0.30", lambda p, c: dataclasses.replace(p, stop=p.stop - 0.05 * c.atr)),
                              ("time_-20%", lambda p, c: dataclasses.replace(p, time_stop=max(2, int(round(p.time_stop * 0.8))))),
                              ("time_+20%", lambda p, c: dataclasses.replace(p, time_stop=int(round(p.time_stop * 1.2))))):
                pp, _ = P.run_book(with_plan(cands, fn), bars, base, EQUITY)
                m = ST.trade_metrics([x["r"] for x in trades_of(pp) if x["seg"] in WF])
                neigh[label] = m
                TR.record(e, cfg["version"], f"{v}+{label}", data_hash, {"segments": list(WF)}, {"walk_forward": m}, "v3.run neighbourhood")
            vr["neighbourhood"] = neigh
            vr["random_baseline_wf"] = ST.trade_metrics(random_baseline([x for x in tr if x["seg"] in WF], bars, base))
            TR.record(e, cfg["version"], v, data_hash, {"segments": list(WF)}, {"walk_forward": {k: vr["walk_forward"].get(k) for k in ("n", "expectancy_r", "profit_factor", "daily_mean_ci95_pct")}},
                      "v3.run walk-forward of record")
            er["variants"][v] = vr
            if v == "baseline":
                trades_by_engine[e] = tr
        f = pd.DataFrame(funnel).fillna(0).astype(int)
        f.to_csv(OUT / f"funnel_{e}.csv")
        res["funnel"][e] = {k: int(f[k].sum()) for k in f.columns} if len(f) else {}
        res["engines"][e] = er
    # DSR and PBO: N = every configuration of the engine ever registered (variants and neighbours)
    wf_lo, wf_hi = SEG["wf1"][0], SEG["wf4"][1]
    wf_daily = pd.DataFrame({k: v.loc[(v.index >= wf_lo) & (v.index < wf_hi)] for k, v in daily_by_cfg.items()}).fillna(0)
    srs = [ST.sharpe(wf_daily[c].to_numpy()) or 0.0 for c in wf_daily.columns]
    for e in VARIANTS:
        for v in VARIANTS[e]:
            vr = res["engines"][e]["variants"][v]
            vr["dsr"] = ST.dsr(wf_daily[f"{e}:{v}"].to_numpy(), TR.count(e), srs)
    res["pbo"] = ST.pbo_cscv(wf_daily, blocks=16)
    # overlap and incremental value (baseline variants)
    keys = {e: {(c.sym, c.date) for c in cands_by_engine[e]} for e in VARIANTS}
    res["overlap_jaccard"] = {a: {b: round(len(keys[a] & keys[b]) / max(1, len(keys[a] | keys[b])), 4) for b in VARIANTS} for a in VARIANTS}
    res["daily_corr_wf"] = wf_daily[[f"{e}:baseline" for e in VARIANTS]].corr().round(3).to_dict()
    allc = [c for e in VARIANTS for c in cands_by_engine[e]]
    pos_all, _ = P.run_book(allc, bars, base, EQUITY)
    d_all = P.daily_returns(pos_all, EQUITY, index)
    res["combined"] = summarise(trades_of(pos_all), d_all, mret, exposure_of(pos_all, index), WF)
    res["incremental_sharpe_wf"] = {}
    for e in VARIANTS:
        pe, _ = P.run_book([c for c in allc if c.engine != e], bars, base, EQUITY)
        de = P.daily_returns(pe, EQUITY, index)
        w = lambda s: s.loc[(s.index >= wf_lo) & (s.index < wf_hi)].to_numpy()  # noqa: E731
        res["incremental_sharpe_wf"][e] = round((ST.sharpe(w(d_all)) or 0) - (ST.sharpe(w(de)) or 0), 5)
    # policy verdicts (fail closed: anything not met, or not measured, is RESEARCH)
    pol = cfgs["policy"]["promote_to_paper"]
    for e in VARIANTS:
        vr = res["engines"][e]["variants"]["baseline"]
        wf = vr["walk_forward"]
        ci = wf.get("daily_mean_ci95_pct") or [None, None]
        neigh = vr["neighbourhood"]
        checks = {
            "net_lcb_gt_0": ci[0] is not None and ci[0] > 0,
            "dsr_ge_0.95": (vr["dsr"].get("dsr") or 0) >= pol["dsr_probability_ge"],
            "pbo_lt_0.20": res["pbo"].get("pbo") is not None and res["pbo"]["pbo"] < pol["pbo_lt"],
            "neighbourhood_80pct_positive": sum(1 for m in neigh.values() if (m.get("expectancy_r") or -1) > 0) / max(1, len(neigh)) >= 0.8,
            "max_dd_le_10pct": wf.get("max_dd_pct") is not None and wf["max_dd_pct"] >= -pol["max_drawdown_equity_pct_le"],
            "costs_2x_positive": (vr["walk_forward_costs_2x"].get("expectancy_r") or -1) > 0,
            "delay_1_positive": (vr["walk_forward_delay_1"].get("expectancy_r") or -1) > 0,
            "beats_random": (wf.get("expectancy_r") or -9) > (vr["random_baseline_wf"].get("expectancy_r") or 9),
            "beats_exposure_matched_nifty": (wf.get("book_return_pct") or -9) > (wf.get("exposure_matched_nifty_pct") or 9),
            "n_ge_891": (wf.get("n") or 0) >= pol["min_independent_observations"],
        }
        state = "PAPER" if all(checks.values()) else "RESEARCH"
        res["engines"][e].update({"state": state, "checks": checks, "version": cfgs["engines"][e]["version"], "evidence": cfgs["evidence"],
                                  "why": "all promotion criteria met on the walk-forward folds" if state == "PAPER" else
                                  "not promoted: " + ", ".join(k for k, ok_ in checks.items() if not ok_)})
    res["engines"]["E6"] = {"state": "BLOCKED_DATA", "version": "v1.0.0", "evidence": cfgs["evidence"], "why": "; ".join(cfgs["engines"]["E6"]["blocked_by"])}
    res["seconds"] = round(time.time() - t0)
    (OUT / "results.json").write_text(json.dumps(res, indent=1, default=lambda o: str(o) if not hasattr(o, "item") else o.item()))
    feed = PB.build_feed(res, [], [], [], snap["cut"])
    print(PB.publish(feed, HERE.parent.parent / "public" / "engines_v3.json", dry_run=True))
    (OUT / "feed_dry_run.json").write_text(json.dumps(feed, indent=1, default=str))
    print(json.dumps({e: {"state": r["state"], "why": r.get("why")} for e, r in res["engines"].items()}, indent=1))


if __name__ == "__main__":
    main(sys.argv)
