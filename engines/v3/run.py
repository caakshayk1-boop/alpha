"""Validation run for E1-E5 under the frozen pre-registration (v1.0.0). Research only: writes research/v3/, appends every evaluated
configuration to research/trials.jsonl, and publishes NOTHING (the feed is built in dry-run and saved as a research file).

Segments by signal date (PREREGISTRATION §6):
  unseen       2010-01-01 .. 2019-10-20   never used by any engine; confirmation only
  development  2019-10-21 .. 2022-12-31
  wf1..wf4     2023H1, 2023H2, 2024H1, 2024H2 (walk-forward folds; the rules fit no parameter, so each fold is out of sample)
  inspected    2025-01-01 .. end          read by Swing v2 and the ML engines: historical only, never promotion evidence
Promotion evidence = the four walk-forward folds together, ACTIVE cohort only, net of costs-1.0.0, against promotion_policy.yaml.
impl 1.0.1 (DECISIONS #8): daily returns marked to market and built only from trades signalled inside the segment; active and
paper-only cohorts in separate books; PBO and DSR per engine over its own configurations, N = distinct configurations; the random
baseline uses each engine's own plan through the same book; the neighbourhood perturbs before sizing and is reported PARTIAL; the
unseen segment (seen once, 22 Oct 2026, DECISIONS #9) is withheld unless V3_UNSEEN_ONESHOT=1. The rules fit no parameter, so the
walk-forward folds are plain date splits: no purge or embargo is needed between them, and none is applied.

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
IMPL = "impl-1.0.1"
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
                    "r_ideal": f.r_ideal, "regime": p.cand.regime, "status": p.cand.status, "tags": list(p.tags), "ambiguous": f.ambiguous_bar,
                    "reason": f.reason, "qty": p.qty, "risk_rs": (f.entry - p.cand.stop) * p.qty, "seg": seg_of(p.cand.date),
                    "hold": int(f.exit_i - f.entry_i + 1)})
    return out


def seg_daily(positions, bars, costs, index, segs) -> pd.Series:
    """Marked-to-market book return per session from the positions SIGNALLED inside `segs` only, so a segment's book figures and
    its trade figures describe the same trades (review finding 2)."""
    keep = [p for p in positions if seg_of(p.cand.date) in segs]
    return P.daily_returns(keep, EQUITY, index, bars, costs)


def exposure_of(positions, index) -> pd.Series:
    e = pd.Series(0.0, index=index)
    for p in positions:
        f = p.fill
        if f.status != "filled":
            continue
        e.loc[(e.index > p.cand.date) & (e.index <= p.exit_date)] += f.entry * p.qty / EQUITY
    return e


def summarise(positions, bars, costs, nifty_ret: pd.Series, index, segs) -> dict:
    trades = [x for x in trades_of(positions) if x["seg"] in segs]
    m = ST.trade_metrics([x["r"] for x in trades])
    d = seg_daily(positions, bars, costs, index, segs)
    lo = pd.Timestamp(SEG[segs[0]][0])
    d = d.loc[d.index >= lo]
    last_exit = max([x["exit"] for x in trades], default=None)
    if last_exit is not None:
        d = d.loc[d.index <= last_exit]
    expo = exposure_of([p for p in positions if seg_of(p.cand.date) in segs], index).reindex(d.index).fillna(0)
    if len(d) > 30 and trades:
        ci = ST.stationary_bootstrap_ci(d.to_numpy(), block=21, reps=10000)
        bench = nifty_ret.reindex(d.index).fillna(0) * expo
        m.update({"book_return_pct": round(float(d.sum() * 100), 3), "daily_mean_ci95_pct": [round(ci[0] * 100, 5), round(ci[1] * 100, 5)],
                  "sharpe_daily": ST.sharpe(d.to_numpy()), "max_dd_pct": round(ST.max_drawdown(d), 3), "exposure_avg_pct": round(float(expo.mean() * 100), 2),
                  "exposure_matched_nifty_pct": round(float(bench.sum() * 100), 3), "cash_pct": 0.0,
                  "avg_hold_sessions": round(float(np.mean([x["hold"] for x in trades])), 1),
                  "turnover_trades_per_month": round(len(trades) / max(1, len({(x["date"].year, x["date"].month) for x in trades})), 2),
                  "independent_months": int(len({(x["date"].year, x["date"].month) for x in trades})),
                  "no_cost_expectancy_r": round(float(np.mean([x["r_ideal"] for x in trades])), 4)})
    m["by_regime"] = {r: ST.trade_metrics([x["r"] for x in trades if x["regime"] == r]) for r in sorted({x["regime"] for x in trades})}
    m["ambiguous_bars"] = int(sum(x["ambiguous"] for x in trades))
    return m, d


def random_cands(cands, bars, ctx, cfg, engine, sector_of, mret, cost, seed=20261022):
    """Matched random entry (review finding 7): for each candidate, a random stock that passed THIS engine's liquidity and price
    floors and the clean check that day, with the same stop distance in %, and THIS engine's own plan (time stop, exit rule),
    through the same book."""
    rng = np.random.default_rng(seed)
    tv = {s: S.ind.traded_value_cr(d, 20) for s, d in bars.items()}
    clean = {s: EN.clean_mask(d) for s, d in bars.items()}
    frames: dict = {}
    out = []
    u = cfg["universe"]
    for c in cands:
        pool = [s for s, d in bars.items() if c.date in d.index and len(d) >= 260 and tv[s].get(c.date, 0) >= u["min_median_traded_value_cr_20d"]
                and d.at[c.date, "Close"] >= u["min_price"] and bool(clean[s].get(c.date, False))]
        if not pool:
            continue
        s_ = pool[int(rng.integers(len(pool)))]
        df = bars[s_]
        t = df.index.get_loc(c.date)
        if s_ not in frames:
            frames[s_] = EN.setup_frame(engine, s_, df, ctx, cfg, mret, cost)
        fr = frames[s_]
        ref = float(df["Close"].iloc[t])
        stop = ref * (c.stop / c.ref)
        atr = float(fr["atr"].iloc[t]) if fr["atr"].iloc[t] == fr["atr"].iloc[t] else ref * 0.02
        rc = P.Cand(engine, s_, c.date, t, c.score, ref, stop, atr, float(tv[s_].iloc[t]), sector_of.get(s_), c.regime, c.status,
                    (lambda q, df=df, fr=fr, t=t, stop=stop, s_=s_: EN._plan(engine, "baseline", s_, df, fr, t, cfg, float(tv[s_].iloc[t]), q, stop_override=stop)))
        rc.feats = None
        out.append(rc)
    return out


def scaled(m: C.CostModel, k: float) -> C.CostModel:
    return C.CostModel(**{**m.__dict__, **{f: getattr(m, f) * k for f in ("stt_buy", "stt_sell", "stamp_buy", "exch", "sebi", "brokerage", "dp_sell", "slippage")},
                          "half_spread": {a: v * k for a, v in m.half_spread.items()}})


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
    unseen_ok = os.environ.get("V3_UNSEEN_ONESHOT") == "1"
    segs = [k for k in SEG if unseen_ok or k != "unseen"]
    bars = {s: d for s, d in snap["exchange"].items() if len(d) >= 260}
    adj = pd.DataFrame({s: snap["adj"][s]["Close"] for s in bars if s in snap["adj"]})
    sector_of = {u["sym"]: u.get("sector") for u in snap["universe"]}
    nifty, vix = snap["nifty"], snap["vix"]
    data_hash = TR.bars_hash(bars, nifty, vix)
    regime = RG.regime(nifty, vix, cfgs["regime"]["hysteresis_sessions"])
    ctx = S.context(adj, sector_of)
    mret = nifty.pct_change(fill_method=None)
    base, stress = C.CostModel.from_config(cfgs["costs"]), C.CostModel.from_config(cfgs["costs"], stress=True)
    index = nifty.index
    lo = pd.Timestamp(SEG["unseen" if unseen_ok else "development"][0])
    hi = pd.Timestamp(SEG["inspected"][1])
    res = {"version": "v1.0.0", "impl": IMPL, "evidence": cfgs["evidence"], "freeze_commit": "af7c35ae02c94833f1cedac827a3647dd57d3b70", "data_hash": data_hash,
           "data_through": snap["cut"], "fetched": snap["fetched"], "universe": len(bars), "segments": {k: SEG[k] for k in segs},
           "unseen": "reported (one-shot flag set)" if unseen_ok else "withheld: seen once by run 39710136503 on 22 Oct 2026 (DECISIONS #9)",
           "engines": {}, "funnel": {}}
    wf_daily_by_engine: dict[str, dict[str, pd.Series]] = {}
    cands_by_engine, active_by_engine = {}, {}

    def book(cands, cm=base):
        pos, sk = P.run_book(cands, bars, cm, EQUITY)
        return pos, sk

    def wf_daily(pos, cm=base):
        d = seg_daily(pos, bars, cm, index, WF)
        return d.loc[(d.index >= SEG["wf1"][0]) & (d.index < "2025-07-01")]

    for e, variants in VARIANTS.items():
        cfg = cfgs["engines"][e]
        funnel: dict = {}
        frames: dict = {}
        er = {"variants": {}}
        wf_daily_by_engine[e] = {}
        for v in variants:
            cands = EN.candidates(e, v, bars, ctx, cfg, regime, sector_of, mret, base, lo, hi, funnel if v == "baseline" else None, frames=frames)
            active = [c for c in cands if c.status == "active"]
            paper = [c for c in cands if c.status == "paper_only"]
            if v == "baseline":
                cands_by_engine[e], active_by_engine[e] = cands, active
            pos, skipped = book(active)
            ppos, _ = book(paper)
            name = f"{v}"
            vr = {"candidates": len(cands), "active_candidates": len(active), "paper_only_candidates": len(paper), "skipped": skipped,
                  "segments": {sg: summarise(pos, bars, base, mret, index, (sg,))[0] for sg in segs}}
            vr["walk_forward"], _ = summarise(pos, bars, base, mret, index, WF)
            vr["paper_only_walk_forward"], _ = summarise(ppos, bars, base, mret, index, WF)
            wf_daily_by_engine[e][name] = wf_daily(pos)
            for label, cm in (("broker_stress", stress), ("costs_2x", scaled(stress, 2.0))):
                pp, _ = book(active, cm)
                vr[f"walk_forward_{label}"] = ST.trade_metrics([x["r"] for x in trades_of(pp) if x["seg"] in WF])
            delayed = []
            for c in active:
                nc = dataclasses.replace(c, make_plan=(lambda q, b=c.make_plan: dataclasses.replace(b(q), t_signal=b(q).t_signal + 1)))
                nc.feats = getattr(c, "feats", None)
                delayed.append(nc)
            pp, _ = book(delayed)
            vr["walk_forward_delay_1"] = ST.trade_metrics([x["r"] for x in trades_of(pp) if x["seg"] in WF])
            neigh = {}
            for label, kw in (("pad_0.20", {"stop_pad": 0.20}), ("pad_0.30", {"stop_pad": 0.30}), ("time_-20%", {"time_scale": 0.8}), ("time_+20%", {"time_scale": 1.2})):
                nc = [c for c in EN.candidates(e, v, bars, ctx, cfg, regime, sector_of, mret, base, lo, hi, frames=frames, **kw) if c.status == "active"]
                pp, _ = book(nc)
                m = ST.trade_metrics([x["r"] for x in trades_of(pp) if x["seg"] in WF])
                neigh[label] = m
                wf_daily_by_engine[e][f"{v}+{label}"] = wf_daily(pp)
                TR.record(e, cfg["version"], f"{v}+{label}", data_hash, {"segments": list(WF), "impl": IMPL}, {"walk_forward": m}, "v3.run neighbourhood")
            vr["neighbourhood"] = neigh
            vr["neighbourhood_scope"] = "PARTIAL: stop pad and time stop only (DECISIONS #11)"
            rp, _ = book(random_cands(active, bars, ctx, cfg, e, sector_of, mret, base))
            vr["random_baseline_wf"] = ST.trade_metrics([x["r"] for x in trades_of(rp) if x["seg"] in WF])
            TR.record(e, cfg["version"], v, data_hash, {"segments": list(WF), "impl": IMPL},
                      {"walk_forward": {k: vr["walk_forward"].get(k) for k in ("n", "expectancy_r", "profit_factor", "daily_mean_ci95_pct")}}, "v3.run walk-forward of record")
            er["variants"][v] = vr
        f = pd.DataFrame(funnel).fillna(0).astype(int)
        f.to_csv(OUT / f"funnel_{e}.csv")
        res["funnel"][e] = {k: int(f[k].sum()) for k in f.columns} if len(f) else {}
        res["engines"][e] = er
        # per engine: PBO over its own configurations, DSR with N = its distinct configurations and their Sharpe variance
        mat = pd.DataFrame(wf_daily_by_engine[e]).fillna(0)
        srs = [ST.sharpe(mat[c].to_numpy()) or 0.0 for c in mat.columns]
        er["pbo"] = ST.pbo_cscv(mat, blocks=16)
        n_trials = TR.count_distinct(e, cfg["version"])
        for v in variants:
            er["variants"][v]["dsr"] = ST.dsr(mat[v].to_numpy(), n_trials, srs)
    keys = {e: {(c.sym, c.date) for c in cands_by_engine[e]} for e in VARIANTS}
    res["overlap_jaccard"] = {a: {b: round(len(keys[a] & keys[b]) / max(1, len(keys[a] | keys[b])), 4) for b in VARIANTS} for a in VARIANTS}
    res["daily_corr_wf"] = pd.DataFrame({e: wf_daily_by_engine[e]["baseline"] for e in VARIANTS}).fillna(0).corr().round(3).to_dict()
    allc = [c for e in VARIANTS for c in active_by_engine[e]]
    pos_all, _ = book(allc)
    res["combined"], d_all = summarise(pos_all, bars, base, mret, index, WF)
    res["incremental_sharpe_wf"] = {}
    for e in VARIANTS:
        pe, _ = book([c for c in allc if c.engine != e])
        _, de = summarise(pe, bars, base, mret, index, WF)
        res["incremental_sharpe_wf"][e] = round((ST.sharpe(d_all.to_numpy()) or 0) - (ST.sharpe(de.to_numpy()) or 0), 5)
    pol = cfgs["policy"]["promote_to_paper"]
    for e in VARIANTS:
        er = res["engines"][e]
        vr = er["variants"]["baseline"]
        wf = vr["walk_forward"]
        ci = wf.get("daily_mean_ci95_pct") or [None, None]
        checks = {
            "active_cohort_exists": vr["active_candidates"] > 0,
            "net_lcb_gt_0": ci[0] is not None and ci[0] > 0,
            "dsr_ge_0.95": (vr["dsr"].get("dsr") or 0) >= pol["dsr_probability_ge"],
            "pbo_lt_0.20": er["pbo"].get("pbo") is not None and er["pbo"]["pbo"] < pol["pbo_lt"],
            "neighbourhood_full_and_80pct_positive": False,          # PARTIAL scope cannot pass (DECISIONS #11)
            "max_dd_le_10pct": wf.get("max_dd_pct") is not None and wf["max_dd_pct"] >= -pol["max_drawdown_equity_pct_le"],
            "costs_2x_positive": (vr["walk_forward_costs_2x"].get("expectancy_r") or -1) > 0,
            "delay_1_positive": (vr["walk_forward_delay_1"].get("expectancy_r") or -1) > 0,
            "beats_random": (wf.get("expectancy_r") or -9) > (vr["random_baseline_wf"].get("expectancy_r") or 9),
            "beats_exposure_matched_nifty": (wf.get("book_return_pct") or -9) > (wf.get("exposure_matched_nifty_pct") or 9),
            "n_ge_891": (wf.get("n") or 0) >= pol["min_independent_observations"],
        }
        er.update({"state": "PAPER" if all(checks.values()) else "RESEARCH", "checks": checks, "version": cfgs["engines"][e]["version"], "evidence": cfgs["evidence"],
                   "why": "not promoted: " + ", ".join(k for k, ok_ in checks.items() if not ok_) if not all(checks.values()) else "all criteria met"})
    res["engines"]["E6"] = {"state": "BLOCKED_DATA", "version": "v1.0.0", "evidence": cfgs["evidence"], "why": "; ".join(cfgs["engines"]["E6"]["blocked_by"])}
    res["seconds"] = round(time.time() - t0)
    (OUT / "results.json").write_text(json.dumps(res, indent=1, default=lambda o: str(o) if not hasattr(o, "item") else o.item()))
    feed = PB.build_feed(res, [], [], [], snap["cut"])
    print(PB.publish(feed, HERE.parent.parent / "public" / "engines_v3.json", dry_run=True))
    (OUT / "feed_dry_run.json").write_text(json.dumps(feed, indent=1, default=str))
    print(json.dumps({e: {"state": r["state"], "why": r.get("why")} for e, r in res["engines"].items()}, indent=1))


if __name__ == "__main__":
    main(sys.argv)
