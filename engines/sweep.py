"""sweep.py — try a SMALL, pre-declared set of variants per engine on TRAIN and VALIDATION only.

Every run is appended to research/VARIANTS_LOG.jsonl, so the count of attempts is a published fact. The more
variants tried, the less any one of them can be believed; the log is what lets a reader discount accordingly.
The holdout is never loaded into a number here.
"""
import importlib, json, pathlib, sys, time
import backtest as B
from common import Ctx
from analysis import excess, clustered_t

GRID = {
    "e1_rebound": [{}, {"regime": True}, {"rs21_min": 60}, {"above50": True}, {"regime": True, "rs21_min": 60}, {"regime": True, "rs21_min": 60, "above50": True}],
    "e2_divergence": [{}, {"regime": True}, {"min_conf": 2}, {"min_conf": 2, "regime": True}, {"r1_max": 38}],
    "e3_breakout_x": [{"daily": False}, {"daily": False, "regime": True}, {"daily": False, "rs126_min": 80}, {"vol_min": 2.0, "rs126_min": 80, "regime": True}],
    "e3_breakout": [{}, {"regime": True}, {"rs126_min": 80}, {"rs126_min": 80, "regime": True}, {"vol_min": 2.0}, {"weekly": False}],
    "e4_swing": [{}, {"regime": True}, {"rs126_min": 70}, {"rs126_min": 70, "regime": True}, {"rs126_min": 85, "regime": True}],
}
path = sys.argv[1]
which = sys.argv[2].split(",") if len(sys.argv) > 2 else list(GRID)
bars, bench, uni = B.load(path)
ctx = Ctx(bars, bench)
log = pathlib.Path("research/VARIANTS_LOG.jsonl").open("a")
for name in which:
    mod = importlib.import_module(name.replace("_x", ""))
    default = dict(mod.OPT)
    for var in GRID[name]:
        mod.OPT.clear(); mod.OPT.update(default); mod.OPT.update(var)
        tr = B.run_engine(mod, bars, ctx)
        res = {}
        for label, part in (("train", [t for t in tr if t.signal_date < B.TRAIN_END]),
                            ("validation", [t for t in tr if B.TRAIN_END <= t.signal_date < B.VAL_END])):
            s = B.stats(part); ex = excess(bars, part); ct = clustered_t(part)
            res[label] = {"n": s.get("n"), "exp_r": s.get("expectancy_r"), "win": s.get("win_rate"), "excess_pct": ex.get("mean_excess_pct"),
                          "excess_t": ex.get("t_clustered"), "r_t": ct.get("t_clustered")}
        rec = {"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "engine": name, "variant": var, **res}
        log.write(json.dumps(rec) + "\n"); log.flush()
        tr_, va_ = res["train"], res["validation"]
        print(f"{name:<14}{json.dumps(var):<48} train n={tr_['n']:<5} exp {tr_['exp_r']:>6} ex {tr_['excess_pct']:>6}% | val n={va_['n']:<5} exp {va_['exp_r']:>6} ex {va_['excess_pct']:>6}% t={va_['excess_t']}", flush=True)
