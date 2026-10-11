"""walkfwd.py — train on the past, predict the unseen future, repeat. The only way these models are ever scored.

* The first model is trained on data up to START minus an embargo; it predicts the next block of sessions it has never seen.
  Every RETRAIN_EVERY sessions the training window grows and the model is refit. Test rows never touch training.
* EMBARGO: a label looks H sessions ahead, so a training row dated within H sessions of the test block would have
  seen the test period's prices inside its label. Training stops H+1 sessions before each test block.
* Hyperparameters are fixed in advance. They are NOT tuned on the test periods.
* Training rows are every STRIDE-th session of each liquid stock: neighbouring days are nearly the same row, so
  skipping them costs little and keeps the fit honest and fast.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor

REG_PARAMS = dict(max_depth=4, learning_rate=0.06, max_iter=200, min_samples_leaf=300, l2_regularization=2.0, random_state=0)
CLF_PARAMS = dict(max_depth=4, learning_rate=0.06, max_iter=200, min_samples_leaf=300, l2_regularization=2.0, random_state=0)

DEV_END = pd.Timestamp("2025-04-01")       # development period ends here; everything from this date is the HOLDOUT


def make_model(kind: str):
    return HistGradientBoostingRegressor(**REG_PARAMS) if kind == "reg" else HistGradientBoostingClassifier(**CLF_PARAMS)


def _predict(model, X, kind):
    return model.predict(X) if kind == "reg" else model.predict_proba(X)[:, 1]


def training_rows(panel, labels, target, features, dates, upto_idx, stride, rows_from=None):
    """Rows whose label is fully known by dates[upto_idx]."""
    cut = dates[upto_idx]
    d = panel.index.get_level_values("date")
    mask = (d <= cut) & (panel["liquid"].values > 0) & labels[target].notna().values
    if rows_from is not None:
        mask &= d >= rows_from
    mask &= (pd.Index(d).map(dict(zip(dates, np.arange(len(dates))))) % stride == 0)
    return panel.loc[mask, features], labels.loc[mask, target]


def walk_forward(panel, labels, features, target, kind, H, start="2023-01-02", retrain_every=63, stride=3, min_rows=20000, log=print) -> pd.Series:
    dates = panel.index.get_level_values("date").unique().sort_values()
    test_dates = dates[dates >= pd.Timestamp(start)]
    refit_points = test_dates[::retrain_every]
    preds = []
    for k, rd in enumerate(refit_points):
        end = refit_points[k + 1] if k + 1 < len(refit_points) else dates[-1] + pd.Timedelta(days=1)
        pos = int(dates.get_loc(rd))
        upto = pos - (H + 1)
        if upto < 300:
            continue
        X, y = training_rows(panel, labels, target, features, dates, upto, stride)
        if len(X) < min_rows:
            continue
        model = make_model(kind).fit(X, y if kind == "reg" else y.astype(int))
        d = panel.index.get_level_values("date")
        block = (d >= rd) & (d < end) & (panel["liquid"].values > 0)
        Xb = panel.loc[block, features]
        preds.append(pd.Series(_predict(model, Xb, kind), index=Xb.index))
        log(f"    refit {rd.date()} on {len(X):,} rows -> scored {len(Xb):,}")
    return pd.concat(preds).sort_index() if preds else pd.Series(dtype="float32")


# ── evaluation ───────────────────────────────────────────────────────

def _daily_ic(score: pd.Series, outcome: pd.Series, min_n: int = 30) -> pd.Series:
    df = pd.DataFrame({"s": score, "o": outcome}).dropna()
    rk = df.groupby(level="date").rank()
    g = rk.groupby(level="date")
    cov = (rk["s"] - g["s"].transform("mean")) * (rk["o"] - g["o"].transform("mean"))
    num = cov.groupby(level="date").sum()
    den = np.sqrt(((rk["s"] - g["s"].transform("mean")) ** 2).groupby(level="date").sum() * ((rk["o"] - g["o"].transform("mean")) ** 2).groupby(level="date").sum())
    n = df.groupby(level="date").size()
    return (num / den).where(n >= min_n)


def _tstat(x: pd.Series) -> float | None:
    x = x.dropna()
    if len(x) < 6 or x.std(ddof=1) == 0:
        return None
    return float(x.mean() / (x.std(ddof=1) / np.sqrt(len(x))))


def evaluate(score: pd.Series, labels: pd.DataFrame, outcome_col: str, H: int, top_n: int = 15, periods=None, base_col: str | None = None, min_n: int = 30) -> dict:
    """Information coefficient, top-picks excess return and decile spread, per period. `outcome_col` is the excess return the
    model was meant to predict; for a classifier pass the barrier label and the excess return as `base_col`.

    Statistics use every H-th session, so overlapping H-day outcomes are not counted as independent evidence."""
    out = {}
    ex = labels[base_col or outcome_col]
    for name, (lo, hi) in (periods or {}).items():
        d = score.index.get_level_values("date")
        sel = (d >= lo) & (d < hi)
        s = score[sel]
        if len(s) == 0:
            continue
        ic = _daily_ic(s, ex.reindex(s.index), min_n)
        dates = ic.dropna().index
        sample = dates[::H]
        ic_s = ic.loc[sample]
        # top-N picks per date
        df = pd.DataFrame({"s": s, "x": ex.reindex(s.index)}).dropna()
        df["rk"] = df.groupby(level="date")["s"].rank(ascending=False)
        top = df[df["rk"] <= top_n].groupby(level="date")["x"].mean()
        allm = df.groupby(level="date")["x"].mean()
        top_s = (top - allm).reindex(sample).dropna()
        month = top_s.groupby(top_s.index.to_period("M")).mean()
        dec = df.copy()
        dec["q"] = dec.groupby(level="date")["s"].rank(pct=True)
        dec["bucket"] = np.minimum((dec["q"] * 10).astype(int), 9)
        decile = dec.groupby("bucket")["x"].mean() * 100
        out[name] = {
            "dates": int(len(dates)), "ic_mean": round(float(ic.mean()), 4), "ic_t": round(_tstat(ic_s) or 0.0, 2) if _tstat(ic_s) is not None else None,
            "ic_pos_pct": round(float((ic_s > 0).mean() * 100), 0),
            "top_excess_pct": round(float(top_s.mean() * 100), 2) if len(top_s) else None,
            "top_t_month": round(_tstat(month) or 0.0, 2) if _tstat(month) is not None else None,
            "top_hit_pct": round(float((top_s > 0).mean() * 100), 0) if len(top_s) else None,
            "decile_excess_pct": [round(float(decile.get(i, np.nan)), 2) for i in range(10)],
        }
    return out
