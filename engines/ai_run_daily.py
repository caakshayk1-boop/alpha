"""ai_run_daily.py — every evening: rebuild the features, train each engine on all the history that is already fully labelled,
score today's market, turn the top ranks into priced signals, track every open trade, and write public/engines.json.

Usage: python ai_run_daily.py [bars.pkl]      (no argument: download fresh prices)
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
import registry
import walkfwd as W
from ai_engines import ENGINES
from ai_finalize import LABELS
from common import Ctx

EXIT_PLAN = [
    "Enter at the next session's open, not at the signal close, and skip it if it opens past T1 or below the stop.",
    "Sell one third at T1, one third at T2, the last third at T3.",
    "After T1, move the stop on the rest to your entry. After T2, move it to T1.",
    "If a session gaps through the stop, you are out at the open, not at the stop price.",
    "If nothing has resolved by the time limit, exit what is left at that day's close.",
    "Size so that a stop-out costs an amount you can afford to lose repeatedly. The stop is the plan; the targets are the hope.",
]
ALERT_MIN_HOLDOUT_R = 0.05          # an engine may buzz a phone only if its holdout trades made at least this much after costs
ALERT_STATUSES = ("EDGE SHOWN", "LEANING POSITIVE")


def train_and_score(panel: pd.DataFrame, lab: pd.DataFrame, eng, log=print):
    """Final model for one engine. Trained on every row whose label is fully known; returns (scores for the latest date, the model)."""
    dates = panel.index.get_level_values("date").unique().sort_values()
    upto = len(dates) - 1 - (eng.H + 1)
    X, y = W.training_rows(panel, lab, eng.target, F.ALL_FEATURES, dates, upto, 3)
    model = W.make_model("clf" if eng.kind == "clf" else "reg").fit(X, y if eng.kind != "clf" else y.astype(int))
    d = panel.index.get_level_values("date")
    recent = dates[-3:]
    blk = d.isin(recent) & (panel["liquid"].values > 0)
    Xb = panel.loc[blk, F.ALL_FEATURES]
    scores = pd.Series(W._predict(model, Xb, "clf" if eng.kind == "clf" else "reg"), index=Xb.index)
    log(f"  {eng.name}: trained on {len(X):,} rows, scored {len(Xb):,}")
    return scores, model, len(X)


def importance(model, panel, lab, eng, kind) -> list[dict]:
    """Permutation importance on the most recent labelled rows: how much shuffling an input hurts the model."""
    from sklearn.inspection import permutation_importance
    dates = panel.index.get_level_values("date").unique().sort_values()
    lo, hi = dates[-(eng.H + 140)], dates[-(eng.H + 1)]
    d = panel.index.get_level_values("date")
    m = (d >= lo) & (d <= hi) & (panel["liquid"].values > 0) & lab[eng.target].notna().values
    X, y = panel.loc[m, F.ALL_FEATURES], lab.loc[m, eng.target]
    if len(X) > 25000:
        idx = np.random.default_rng(0).choice(len(X), 25000, replace=False)
        X, y = X.iloc[idx], y.iloc[idx]
    r = permutation_importance(model, X, y if kind == "reg" else y.astype(int), n_repeats=2, random_state=0, scoring="neg_mean_squared_error" if kind == "reg" else "roc_auc", n_jobs=1)
    order = np.argsort(-r.importances_mean)[:14]
    tot = float(np.clip(r.importances_mean, 0, None).sum()) or 1.0
    return [{"feature": F.ALL_FEATURES[i], "label": LABELS.get(F.ALL_FEATURES[i], F.ALL_FEATURES[i]), "share_pct": round(float(max(r.importances_mean[i], 0) / tot * 100), 1)} for i in order]


def explain(sym: str, date, panel: pd.DataFrame, top_features: list[dict], day_scores: pd.Series) -> list[str]:
    """The inputs that matter most to this model, and where this stock stands on each today. Describes the inputs; it does not claim a cause."""
    today = panel.xs(date, level="date")
    out = []
    for f in top_features:
        if len(out) >= 5:
            break
        col = f["feature"]
        if col not in today.columns or sym not in today.index or pd.isna(today.at[sym, col]) or today[col].nunique() < 3:
            continue            # market-wide inputs are the same for every stock: nothing to say about this one
        pct = float(today[col].rank(pct=True)[sym])
        both = pd.concat([today[col], day_scores], axis=1, join="inner").dropna()
        sign = 1 if len(both) > 30 and both.iloc[:, 0].corr(both.iloc[:, 1], method="spearman") >= 0 else -1
        place = f"higher than {pct * 100:.0f}% of stocks" if pct >= 0.5 else f"lower than {(1 - pct) * 100:.0f}% of stocks"
        favour = "the model favours high readings" if sign > 0 else "the model favours low readings"
        out.append(f"{f['label']}: {place} ({favour})")
    return out


def bench_meta(ctx: Ctx, sym: str, df: pd.DataFrame, t: int) -> dict | None:
    g = ctx.group_name(sym)
    if g is None:
        return None
    b = ctx.bench_for(sym, df.index)
    c = df["Close"]
    r63_b = float(b.iloc[t] / b.iloc[t - 63] - 1) * 100 if t >= 63 else None
    r63_s = float(c.iloc[t] / c.iloc[t - 63] - 1) * 100 if t >= 63 else None
    return {"name": g, "members": ctx.group_n.get(g) or None, "uptrend": bool(ctx.sec_trend(sym, df.index).iloc[t]), "leads_nifty": bool(ctx.sec_lead(sym, df.index).iloc[t]),
            "stock_3m_pct": round(r63_s, 1) if r63_s is not None else None, "benchmark_3m_pct": round(r63_b, 1) if r63_b is not None else None,
            "stock_vs_benchmark_pct": round(r63_s - r63_b, 1) if r63_s is not None and r63_b is not None else None}


def sector_board(ctx: Ctx) -> list[dict]:
    out, nb = [], ctx.bench
    for g, lvl in ctx.group_level.items():
        lvl = lvl.dropna()
        if len(lvl) < 260:
            continue
        s50 = lvl.rolling(50).mean()
        n3 = nb.reindex(lvl.index, method="ffill")
        r21, r63 = float(lvl.iloc[-1] / lvl.iloc[-22] - 1) * 100, float(lvl.iloc[-1] / lvl.iloc[-64] - 1) * 100
        n63 = float(n3.iloc[-1] / n3.iloc[-64] - 1) * 100
        out.append({"name": g, "members": ctx.group_n.get(g) or None, "r1m": round(r21, 1), "r3m": round(r63, 1), "vs_nifty_3m": round(r63 - n63, 1),
                    "uptrend": bool(lvl.iloc[-1] > s50.iloc[-1] and s50.iloc[-1] > s50.iloc[-11]), "leads_nifty": bool(r63 > n63), "real_index": g.startswith("Nifty")})
    return sorted(out, key=lambda x: -x["vs_nifty_3m"])


def build(bars, uni, bench, indices, results, reg, log=print) -> dict:
    ctx = Ctx(bars, bench, uni, indices)
    info = {u["sym"]: u for u in uni}
    try:
        import rotation_export
        pathlib.Path(__file__).resolve().parent.parent.joinpath("public", "rotation.json").write_text(json.dumps(rotation_export.export(ctx), separators=(",", ":")))
    except Exception as e:                      # the rotation page is secondary: a failure here must not stop the engines, but must be loud
        print(f"WARNING rotation export failed: {e!r}", file=sys.stderr)
    t0 = time.time()
    panel = F.build_panel(bars, ctx, log=lambda *_: None)
    lab = L.build_labels(bars, panel, log=lambda *_: None)
    lab = L.add_group_relative(lab, panel, ctx.group_of, 21)
    log(f"panel {panel.shape} and labels in {time.time() - t0:.0f}s")
    atrs = T.atr_table(bars)
    dates = panel.index.get_level_values("date").unique().sort_values()
    today = str(dates[-1].date())
    last = reg.get("last_scan")            # sessions the scanner has not looked at yet: just the latest one, or those a dropped run missed (at most five)
    unseen = dates[dates > pd.Timestamp(last)] if last else dates[-1:]
    lo = unseen[-5:][0] if len(unseen) else dates[-1]
    candidates, eng_out = [], {}
    for key, eng in ENGINES.items():
        scores, model, nrows = train_and_score(panel, lab, eng, log)
        imp = importance(model, panel, lab, eng, "clf" if eng.kind == "clf" else "reg")
        sigs = T.signals_from_scores(eng, scores, bars, atrs, lo, pd.Timestamp("2100-01-01"))
        for s in sigs:
            df = bars[s.sym]
            risk = s.ref_price - s.sl
            day_scores = scores.xs(s.date, level="date")
            rk = float(day_scores.rank(pct=True)[s.sym]) if s.sym in day_scores.index else None
            candidates.append({
                "engine": key, "engine_name": eng.name, "sym": s.sym, "name": info.get(s.sym, {}).get("name", s.sym), "sector": info.get(s.sym, {}).get("sector"),
                "date": str(s.date.date()), "issued": str(s.date.date()), "setup": f"{eng.name} model", "horizon": eng.horizon_label,
                "ref_price": round(s.ref_price, 2), "entry_zone": [round(s.ref_price, 2), round(s.ref_price * 1.01, 2)], "sl": round(s.sl, 2), "risk_pct": round(risk / s.ref_price * 100, 1),
                "targets": [round(x, 2) for x in s.targets], "r_multiples": [round(x, 2) for x in eng.targets_r], "max_hold": eng.max_hold,
                "score": round(float(s.meta["score"]), 4), "score_percentile": round(rk * 100, 1) if rk is not None else None,
                "turnover_cr": round(float((df["Close"] * df["Volume"]).iloc[-20:].mean() / 1e7), 1),
                "reasons": explain(s.sym, s.date, panel, imp, day_scores), "benchmark": bench_meta(ctx, s.sym, df, s.t),
            })
        eng_out[key] = {"importance": imp, "train_rows": nrows}
    registry.update(reg, candidates, bars, today)
    reg["last_scan"] = today
    view = registry.active_view(reg, 14, today)
    engines = {}
    for key, eng in ENGINES.items():
        r = results["engines"][key]
        holdout_r = r["trades"]["holdout"].get("expectancy_r")
        act = [x for x in view if x["engine"] == key and x["status"] in ("pending", "open")]
        engines[key] = {
            "id": eng.id, "key": key, "name": eng.name, "tagline": eng.tagline, "style": eng.style, "how": eng.how, "kind": eng.kind, "horizon_sessions": eng.H,
            "status": r["status"], "status_why": r["status_why"], "signal_count": len(act),
            "alertable": bool(r["status"] in ALERT_STATUSES and (holdout_r or 0) >= ALERT_MIN_HOLDOUT_R),
            "plan": {"stop_atr": eng.stop_atr, "targets_r": list(eng.targets_r), "max_hold": eng.max_hold, "picks_per_day": eng.picks_per_day, "cooldown": eng.cooldown},
            **{k: r[k] for k in ("metrics", "robustness", "trades", "baseline", "clustered", "equity_curve", "baseline_curve", "exits", "timeline")},
            "importance": eng_out[key]["importance"][:8], "train_rows": eng_out[key]["train_rows"],
        }
    signals = []
    for e in view:
        st = engines[e["engine"]]
        signals.append({**e, "engine_status": st["status"], "engine_name": st["name"], "max_hold_days": e["max_hold"], "typical_days_to_t1": st["timeline"].get("median_days_to_t1"),
                        "also_names": [engines[x]["name"] for x in e.get("also", []) if x in engines]})
    order = {"open": 0, "pending": 1, "closed": 2, "void": 3}
    signals.sort(key=lambda x: (order.get(x["status"], 9), -(x.get("score_percentile") or 0), x["engine"], x["sym"]))
    return {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "data_through": today,
            "backtest": {"generated": results["generated"], "data_through": results["data_through"], "universe": results["universe"], "cost_round_trip_pct": results["cost_round_trip_pct"],
                         "periods": results["periods"], "features": results["features"], "notes": results.get("notes", [])},
            "launched": reg.get("launched"), "live_record": registry.forward_record(reg), "exit_plan": EXIT_PLAN, "benchmarks": sector_board(ctx), "engines": engines, "signals": signals}


if __name__ == "__main__":
    import data
    results = json.loads(pathlib.Path("research/ai_results.json").read_text())
    if len(sys.argv) > 1:
        d = pd.read_pickle(sys.argv[1])
        bars, uni, bench, indices = d["bars"], d["universe"], d["bench"], d.get("indices")
    else:
        import yfinance as yf
        uni = data.universe()
        bars = data.download([u["sym"] for u in uni], period="6y")
        ist = pd.Timestamp.now(tz="Asia/Kolkata")
        if ist.hour * 60 + ist.minute < 16 * 60 + 30:      # a bar dated today is still forming before the close: never score on it
            bars = {k: (df[df.index < ist.tz_localize(None).normalize()] if len(df) and df.index[-1] >= ist.tz_localize(None).normalize() else df) for k, df in bars.items()}
        if len(bars) < 0.85 * len(uni):
            raise SystemExit(f"only {len(bars)} of {len(uni)} symbols downloaded: refusing to publish")
        if (pd.Timestamp.now().normalize() - max(df.index[-1] for df in bars.values())).days > 5:
            raise SystemExit("the newest price bar is more than five days old: the data is stale, refusing to publish")
        b = yf.download("^NSEI", period="6y", interval="1d", auto_adjust=True, progress=False)
        b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
        bench = b["Close"].dropna()
        bench.index = pd.to_datetime(bench.index).tz_localize(None)
        indices = data.indices("6y")
    reg = registry.load()
    out = build(bars, uni, bench, indices, results, reg)
    registry.save(reg)
    dest = pathlib.Path("../public/engines.json")
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dest}: {len(out['signals'])} signals in view, data through {out['data_through']}; registry {len(reg['signals'])} trades")
    for k, e in out["engines"].items():
        print(f"  {e['name']:<11} {e['status']:<18} {e['signal_count']} signals now  alertable={e['alertable']}")
