"""explore.py — develop on TRAIN and VALIDATION only. The holdout is never printed here."""
import importlib, sys
import pandas as pd
import backtest as B
from common import Ctx
from analysis import excess, clustered_t

path, which = sys.argv[1], sys.argv[2].split(",")
bars, bench, uni = B.load(path)
bench = Ctx(bars, bench)
for name in which:
    mod = importlib.import_module(name)
    tr = B.run_engine(mod, bars, bench)
    dev = [t for t in tr if t.signal_date < B.VAL_END]       # never touches the holdout
    for label, part in (("train", [t for t in dev if t.signal_date < B.TRAIN_END]), ("validation", [t for t in dev if t.signal_date >= B.TRAIN_END])):
        s = B.stats(part)
        ex = excess(bars, part)
        ct = clustered_t(part)
        print(f"{mod.TITLE:<11}{label:<11} n={s.get('n')}  exp {s.get('expectancy_r')}R  win {s.get('win_rate')}%  "
              f"| excess vs random stocks {ex.get('mean_excess_pct')}% (t_clust {ex.get('t_clustered')}, {ex.get('months')} mo)  "
              f"| R t_clust {ct.get('t_clustered')} pos-months {ct.get('positive_months_pct')}%")
