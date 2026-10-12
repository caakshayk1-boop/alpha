"""ai_finalize.py — the first and only look at the holdout. Reads the walk-forward predictions, evaluates every engine on the
development period and the holdout, runs the robustness checks, and writes research/ai_results.json.

Usage: python ai_finalize.py <scratch dir holding bars.pkl, panel.pkl and pred_*.pkl>
"""
from __future__ import annotations

import json
import pathlib
import sys
import time

import numpy as np
import pandas as pd

import ai_trades as T
import context
import features as F
import labels as L
import walkfwd as W
from ai_engines import ENGINES
from common import stats

S = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None      # scratch folder, only used when run as a script
PRED = {"rank": "pred_e1_dev", "barrier": "pred_e2_dev", "relative": "pred_e3_dev", "snapback": "pred_e4_dev", "compounder": "pred_e5_dev"}
START = pd.Timestamp("2023-01-01")
FAR = pd.Timestamp("2100-01-01")
PERIODS = {"development": (START, W.DEV_END), "holdout": (W.DEV_END, FAR)}
LABELS = {  # human names for the inputs the models explain themselves with
    "ret_21": "21-day return", "ret_63": "63-day return", "ret_126": "126-day return", "mom_12_1": "12-1 month momentum", "ret_5": "5-day return",
    "ret_1": "1-day return", "ret_10": "10-day return", "vol_21": "21-day volatility", "vol_63": "63-day volatility", "vol_ratio": "volatility trend",
    "down_vol_21": "downside volatility", "atr_pct": "ATR as % of price", "mom_vol_adj": "momentum per unit of risk", "dist_hi": "distance from 52-week high",
    "dist_lo": "distance from 52-week low", "d_sma20": "distance from 20-day average", "d_sma50": "distance from 50-day average", "d_sma200": "distance from 200-day average",
    "slope_50": "trend slope", "rsi_14": "RSI (14)", "rsi_2": "RSI (2)", "macd_n": "MACD", "stoch": "stochastic", "bb_pctb": "Bollinger position", "bb_width_pct": "Bollinger width",
    "adx": "ADX", "dd_63": "63-day drawdown", "up_frac_63": "share of up days", "volr_5_20": "volume, 5 vs 20 days", "volr_20_60": "volume, 20 vs 60 days", "turnover": "traded value",
    "amihud": "illiquidity", "obv_slope": "on-balance volume trend", "clv_10": "close location", "gap_5": "overnight gaps", "body_5": "candle bodies",
    "rel_21": "21-day return vs its benchmark", "rel_63": "63-day return vs its benchmark", "g_mom_63": "benchmark momentum vs Nifty", "g_dist_50": "benchmark vs its 50-day",
    "g_trend": "benchmark trend", "n_ret_21": "Nifty 21-day return", "n_ret_63": "Nifty 63-day return", "n_dist_200": "Nifty vs its 200-day", "n_vol_21": "Nifty volatility",
    "breadth_50": "market breadth", "dispersion_21": "market dispersion", "mkt_ret_21_med": "median stock 21-day return",
}
LABELS.update({f"rk_{k}": f"market rank of {LABELS.get(k, k)}" for k in F.RANK_COLS})


def curve(trades):
    if not trades:
        return []
    s = pd.Series([t.r for t in trades], index=pd.DatetimeIndex([t.exit_date for t in trades])).sort_index()
    m = s.groupby(s.index.to_period("M")).sum().cumsum()
    return [[str(k), round(float(v), 1)] for k, v in m.items()]


def ranking_verdict(res: dict) -> tuple[str, str]:
    """RANKING SKILL ONLY: did its scores order stocks better than chance, out of sample? Says nothing about whether trading them paid."""
    dev, hold = res["metrics"]["development"], res["metrics"]["holdout"]
    t3h = res["robustness"]["top300"]["holdout"]
    ic_d, ic_h = dev.get("ic_mean"), hold.get("ic_mean")
    if None in (ic_d, ic_h):
        return "NOT ENOUGH DATA", "Too little out-of-sample data in one period to judge its ranking."
    if ic_d <= 0 and ic_h <= 0:
        return "NO RANKING SKILL", "Its scores did not rank stocks better than chance in either period."
    if ic_d > 0 and ic_h > 0 and (hold.get("ic_t") or 0) >= 2 and (t3h.get("ic_mean") or 0) > 0 and (t3h.get("ic_t") or 0) >= 2:
        return "EDGE SHOWN", "Its scores ranked stocks better than chance in both periods, the holdout result is statistically solid, and the skill survives among the 300 most-traded stocks."
    if ic_d > 0 and ic_h > 0:
        gaps = []
        if (hold.get("ic_t") or 0) < 2:
            gaps.append("the holdout result is too short or noisy to rule out luck")
        if not ((t3h.get("ic_mean") or 0) > 0 and (t3h.get("ic_t") or 0) >= 2):
            gaps.append("the skill is not statistically clear among the 300 most-traded stocks")
        return "LEANING POSITIVE", "Its scores ranked stocks better than chance in both periods, but " + " and ".join(gaps) + "."
    return "NO RANKING SKILL", "Its ranking skill was not positive in both periods."


def trading_verdict(res: dict) -> tuple[str, str]:
    """NET TRADING RESULT ONLY: the plan's expectancy in R after the 0.25% round-trip cost, against random picks with the same exits."""
    td, th = res["trades"]["development"], res["trades"]["holdout"]
    bh = res["baseline"]["holdout"]
    ct = res["clustered"]["holdout"].get("t_clustered")
    if not th.get("n"):
        return "NOT ENOUGH DATA", "No holdout trades to judge."
    r, rd = th.get("expectancy_r"), td.get("expectancy_r")
    gap = r - (bh.get("expectancy_r") or 0)
    tail = f" (month-clustered t {ct:+.2f})" if isinstance(ct, (int, float)) else ""
    if r > 0.05 and (ct or 0) >= 2:
        return "PROFITABLE AFTER COSTS", f"Holdout trades averaged {r:+.2f}R after costs{tail}, {gap:+.2f}R better than random picks with the same exits."
    if r > 0.05:
        return "POSITIVE, NOT SIGNIFICANT", f"Holdout trades averaged {r:+.2f}R after costs{tail}: positive, but too noisy to rule out luck. Random picks with the same exits made {bh.get('expectancy_r'):+.2f}R."
    if r >= -0.05:
        return "BREAK-EVEN AFTER COSTS", f"Holdout trades averaged {r:+.2f}R after costs{tail}: indistinguishable from zero. It beat random picks by {gap:+.2f}R, but that is not a profit."
    return "LOSES AFTER COSTS", f"Holdout trades averaged {r:+.2f}R after costs{tail}."


def alert_verdict(rank: str, trade: str) -> tuple[bool, str]:
    """A phone is only buzzed when BOTH hold: it ranks better than chance AND its holdout trades made money after costs."""
    ok_rank = rank in ("EDGE SHOWN", "LEANING POSITIVE")
    ok_trade = trade in ("PROFITABLE AFTER COSTS", "POSITIVE, NOT SIGNIFICANT")
    if ok_rank and ok_trade:
        return True, "Alerts on: it ranks better than chance and its holdout trades made money after costs."
    why = []
    if not ok_rank:
        why.append("it has not shown ranking skill")
    if not ok_trade:
        why.append("its holdout trades did not make money after costs")
    return False, "Alerts off: " + " and ".join(why) + ". Its signals are shown on the site, never pushed."


if __name__ == "__main__":
    t0 = time.time()
    bars, ctx, uni = context.make_ctx(str(S / "bars.pkl"))
    d = pd.read_pickle(S / "panel.pkl")
    panel, lab = d["panel"], d["labels"]
    lab = L.add_group_relative(lab, panel, ctx.group_of, 21)
    atrs = T.atr_table(bars)
    liq = panel["liquid"] > 0
    out = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "data_through": str(max(df.index[-1] for df in bars.values()).date()), "universe": len(bars),
           "cost_round_trip_pct": 0.25, "periods": {k: [str(v[0].date()), str(v[1].date()) if v[1] < FAR else "now"] for k, v in PERIODS.items()},
           "features": len(F.ALL_FEATURES), "engines": {}}
    for key, eng in ENGINES.items():
        pred = pd.read_pickle(S / f"{PRED[key]}.pkl")
        base_col = "excess_21" if eng.kind == "clf" else eng.outcome
        metrics = W.evaluate(pred, lab, eng.target if eng.kind == "clf" else eng.outcome, eng.H, 15, PERIODS, base_col=base_col)
        # robustness: only the 300 most traded stocks each session (a causal definition of large, not today's market cap)
        tn = panel["turnover"].reindex(pred.index)
        top300 = pred[tn.groupby(level="date").rank(ascending=False) <= 300]
        rob = W.evaluate(top300, lab, eng.target if eng.kind == "clf" else eng.outcome, eng.H, 15, PERIODS, base_col=base_col)
        res = {"metrics": metrics, "robustness": {"top300": rob}, "trades": {}, "baseline": {}, "clustered": {}}
        allt, allb, sigs_all = [], [], []
        for name, (lo, hi) in PERIODS.items():
            sigs = T.signals_from_scores(eng, pred, bars, atrs, lo, hi)
            tr = T.simulate_all(sigs, bars)
            base = T.random_baseline(eng, sigs, bars, atrs, liq)
            res["trades"][name], res["baseline"][name], res["clustered"][name] = stats(tr), stats(base), T.monthly_t(tr)
            allt += tr
            allb += base
        res["trades"]["all"], res["baseline"]["all"] = stats(allt), stats(allb)
        res["equity_curve"], res["baseline_curve"] = curve(allt), curve(allb)
        # "target" in the trade ledger covers two endings: all three targets reached, OR T2 reached and the rest stopped at T1.
        # They are separated here so "all targets" is exactly the share that reached T3.
        res["exits"] = {"stop": int(sum(1 for t in allt if t.exit_reason == "stop")),
                        "breakeven": int(sum(1 for t in allt if t.exit_reason == "breakeven")),
                        "after_t2": int(sum(1 for t in allt if t.exit_reason == "target" and t.hit == 2)),
                        "all_targets": int(sum(1 for t in allt if t.exit_reason == "target" and t.hit == 3)),
                        "time": int(sum(1 for t in allt if t.exit_reason == "time"))}
        res["exits_n"] = len(allt)
        hit = [t.t1_bars for t in allt if t.t1_bars]
        res["timeline"] = {"median_days_to_t1": float(np.median(hit)) if hit else None, "median_days_held": float(np.median([t.bars for t in allt])) if allt else None,
                           "p90_days_held": float(np.percentile([t.bars for t in allt], 90)) if allt else None}
        status, why = ranking_verdict(res)
        trading, trading_why = trading_verdict(res)
        alertable, alert_why = alert_verdict(status, trading)
        res["status"], res["status_why"] = status, why                 # kept as the RANKING verdict: older readers still find it here
        res["ranking_status"], res["ranking_why"] = status, why
        res["trading_status"], res["trading_why"] = trading, trading_why
        res["alertable"], res["alert_why"] = alertable, alert_why
        out["engines"][key] = res
        h, dv = metrics["holdout"], metrics["development"]
        print(f"{eng.name:<11} {status:<17} {trading:<26} IC dev {dv['ic_mean']} (t {dv['ic_t']}) hold {h['ic_mean']} (t {h['ic_t']}) | trades R dev {res['trades']['development'].get('expectancy_r')} hold {res['trades']['holdout'].get('expectancy_r')} | random dev {res['baseline']['development'].get('expectancy_r')} hold {res['baseline']['holdout'].get('expectancy_r')} | top300 hold excess {rob['holdout'].get('top_excess_pct')}%", flush=True)
    pathlib.Path("research/ai_results.json").write_text(json.dumps(out, indent=1))
    print("wrote research/ai_results.json", round(time.time() - t0), "s")
