"""finalize.py — evaluate the FROZEN engines once across all three blocks and write research/results.json.

Run this after the rules are frozen. It is the first and only place the holdout is turned into numbers.
"""
import importlib, json, pathlib, sys, time
import numpy as np
import pandas as pd
import backtest as B
from common import Ctx, stats
from analysis import excess, clustered_t

META = {
    "e1_rebound": {"id": 1, "key": "rebound", "name": "Rebound", "tagline": "Quality dips whose recovery has started",
                   "style": "Positional, 1 to 3 months", "descended": "the earlier Magic and MagicMagic screens"},
    "e2_divergence": {"id": 2, "key": "divergence", "name": "Divergence", "tagline": "Bullish RSI divergence, released by confirmation",
                      "style": "Swing to positional, 2 to 9 weeks", "descended": None},
    "e3_breakout": {"id": 3, "key": "breakout", "name": "Breakout", "tagline": "Classic chart-pattern breakouts on a daily or weekly close",
                    "style": "Positional on the daily chart, months on the weekly", "descended": None},
    "e4_swing": {"id": 4, "key": "swing", "name": "Swing", "tagline": "A pullback inside an uptrend, bought on the first confirmed turn",
                 "style": "Pure swing, 3 to 12 trading days", "descended": None},
}


def block(bars, trades):
    s = stats(trades)
    s["excess"] = excess(bars, trades)
    s["clustered"] = clustered_t(trades)
    return s


def verdict(val, hold, pooled):
    """Plain words, decided by numbers fixed in advance.
    WORSE THAN RANDOM  validation and holdout both negative, pooled t <= -2
    EDGE SHOWN         validation and holdout both positive, pooled clustered t >= 2
    LEANING POSITIVE   validation and holdout both positive, but t < 2
    NO EDGE SHOWN      anything else"""
    v, h = val.get("excess", {}).get("mean_excess_pct"), hold.get("excess", {}).get("mean_excess_pct")
    t = pooled.get("t_clustered")
    if v is None or h is None:
        return "NOT ENOUGH TRADES", "Too few trades in the validation or holdout period to say anything."
    if v < 0 and h < 0 and t is not None and t <= -2:
        return "WORSE THAN RANDOM", "Its picks lagged randomly chosen stocks over the same dates, in both test periods, by a margin too big to be luck."
    if v > 0 and h > 0 and t is not None and t >= 2:
        return "EDGE SHOWN", "Its picks beat randomly chosen stocks over the same dates in both test periods, by a margin unlikely to be luck."
    if v > 0 and h > 0:
        return "LEANING POSITIVE", "Its picks beat random stocks in both test periods, but by too little, over too few independent months, to rule out luck."
    return "NO EDGE SHOWN", "Its picks did not beat randomly chosen stocks over the same dates in both test periods."


def curve(trades):
    if not trades:
        return []
    s = pd.Series([t.r for t in trades], index=pd.DatetimeIndex([t.exit_date for t in trades])).sort_index()
    m = s.groupby(s.index.to_period("M")).sum().cumsum()
    return [[str(k), round(float(v), 1)] for k, v in m.items()]


if __name__ == "__main__":
    path = sys.argv[1]
    out_path = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "research/results.json")
    bars, ctx, uni = B.make_ctx(path)
    tried = {}
    for line in pathlib.Path("research/VARIANTS_LOG.jsonl").read_text().splitlines():
        r = json.loads(line)
        key = r["engine"].replace("_x", "")
        tried[key] = tried.get(key, 0) + 1
    res = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "data_through": str(max(d.index[-1] for d in bars.values()).date()),
           "universe": len(bars), "cost_round_trip_pct": 0.25, "splits": {"train": f"before {B.TRAIN_END.date()}", "validation": f"{B.TRAIN_END.date()} to {B.VAL_END.date()}", "holdout": f"{B.VAL_END.date()} onwards"},
           "notes": ["The holdout was first read after the round-1 rules were frozen. Rounds 2 to 5 (benchmark conditions, hidden and weekly divergence, leader pullbacks) were then chosen on train and validation only, but the holdout is no longer untouched. The live record from the launch date is the only test that cannot have been fitted to the past."], "engines": {}}
    for name, meta in META.items():
        mod = importlib.import_module(name)
        tr = B.run_engine(mod, bars, ctx)
        base = B.baseline(bars, tr, getattr(mod, "MAX_HOLD", 40))
        parts = {"train": [t for t in tr if t.signal_date < B.TRAIN_END],
                 "validation": [t for t in tr if B.TRAIN_END <= t.signal_date < B.VAL_END],
                 "holdout": [t for t in tr if t.signal_date >= B.VAL_END]}
        bparts = {"train": [t for t in base if t.signal_date < B.TRAIN_END],
                  "validation": [t for t in base if B.TRAIN_END <= t.signal_date < B.VAL_END],
                  "holdout": [t for t in base if t.signal_date >= B.VAL_END]}
        blocks = {k: block(bars, v) for k, v in parts.items()}
        pooled = excess(bars, parts["validation"] + parts["holdout"])
        status_all, why_all = verdict(blocks["validation"], blocks["holdout"], pooled)
        # THE BENCHMARK TEST. Every trade is labelled confirmed or not by its own benchmark (sector in an uptrend, leading the
        # Nifty, stock leading the sector). Nothing is filtered: the two groups are measured side by side, in every period.
        tiers = {}
        for tname, sel in (("confirmed", lambda t: t.bench_ok is True), ("unconfirmed", lambda t: t.bench_ok is False)):
            sub = [t for t in tr if sel(t)]
            sp = {"train": [t for t in sub if t.signal_date < B.TRAIN_END],
                  "validation": [t for t in sub if B.TRAIN_END <= t.signal_date < B.VAL_END],
                  "holdout": [t for t in sub if t.signal_date >= B.VAL_END]}
            tiers[tname] = {"n": len(sub), "all": stats(sub), "splits": {k: block(bars, v) for k, v in sp.items()},
                            "pooled_test": excess(bars, sp["validation"] + sp["holdout"])}
        # An engine's status is judged on ALL the signals it publishes. Benchmark confirmation was tested as a possible
        # improvement and did not help (see tiers), so it informs but does not decide.
        status, why = status_all, why_all
        status_confirmed, _ = verdict(tiers["confirmed"]["splits"]["validation"], tiers["confirmed"]["splits"]["holdout"], tiers["confirmed"]["pooled_test"])
        setups = {}
        for t in tr:
            setups.setdefault(t.setup, []).append(t)
        hit = [t.t1_bars for t in tr if t.t1_bars]
        hit3 = [t.t3_bars for t in tr if t.t3_bars]
        res["engines"][meta["key"]] = {
            **meta, "status": status, "status_why": why, "status_confirmed_only": status_confirmed, "tiers": tiers, "options": mod.OPT, "variants_tried": tried.get(name, 0),
            "all": stats(tr), "splits": blocks, "pooled_test": pooled,
            "baseline": {k: stats(v) for k, v in bparts.items()}, "baseline_all": stats(base),
            "by_setup": {k: {**stats(v), "excess": None} for k, v in sorted(setups.items(), key=lambda kv: -len(kv[1]))},
            "timeline": {"median_days_to_t1": float(np.median(hit)) if hit else None, "median_days_to_t3": float(np.median(hit3)) if hit3 else None,
                         "median_days_held": float(np.median([t.bars for t in tr])) if tr else None,
                         "p90_days_held": float(np.percentile([t.bars for t in tr], 90)) if tr else None},
            "equity_curve": curve(tr), "baseline_curve": curve(base),
            "exits": {k: int(sum(1 for t in tr if t.exit_reason == k)) for k in ("stop", "breakeven", "target", "time")},
        }
        print(f"{meta['name']:<11} {status:<18} n={len(tr):<5} val ex {blocks['validation']['excess'].get('mean_excess_pct')}%  hold ex {blocks['holdout']['excess'].get('mean_excess_pct')}%  pooled t {pooled.get('t_clustered')}", flush=True)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(res, indent=1))
    print("wrote", out_path)
