"""phase0.py — reproduce the published Swing v2 figures and explain the 0% market gate. No rule is changed here.

Runs on GitHub Actions (Yahoo refuses the dev container). It:
  1. downloads the same bars the backtest downloads (data.py, the same universe call) and saves a hashed snapshot;
  2. re-runs swing_backtest.evaluate() on that snapshot cut to the original window, twice: through 2026-10-20 (completed
     sessions only) and through 2026-10-21 (the date the original run recorded), and compares every published figure;
  3. rebuilds the market gate over the 136 sessions the site shows and writes a per-session funnel, then checks index
     mapping, date alignment, adjustment, the breadth denominator, the 200-day warm-up, nulls and the calendar;
  4. appends each evaluation to research/trials.jsonl.
Writes research/phase0/reproduction.json and research/phase0/gate_funnel.csv. Nothing is published or sent.

Usage: python phase0.py [snapshot.pkl]   (no argument: download, then save the snapshot to $PHASE0_SNAPSHOT or ./phase0_bars.pkl)
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

import numpy as np
import pandas as pd

import swing as SW
import swing_backtest as BT
import trial_registry as TR

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "research" / "phase0"
PUBLISHED = HERE / "research" / "swing_results.json"
FEED = HERE.parent / "public" / "signals.json"
ORIGINAL_RUN_UTC = "2026-10-21T05:07:09Z"       # commit 29c1020: 10:37 IST, during the 21 Oct session
START = pd.Timestamp("2019-10-21")               # period="7y" counted back from the original run date
# The screen as it stood when the original run read it: trading-dashboard docs/screen.json at the last commit before 05:07 UTC on
# 21 Oct 2026. The live screen has since gained AHCL and SMCGLOBAL and lost HINDOILEXP and SHILCTECH, which alone moves trade counts.
UNIVERSE_AT = os.environ.get("PHASE0_UNIVERSE_SHA", "31d8822ff0ac906ebc4e328b26741ac867b88659")
ENDS = {"completed_sessions": pd.Timestamp("2026-10-20"), "as_recorded": pd.Timestamp("2026-10-21")}
FIGURES = [("rules", "holdout", "n"), ("rules", "holdout", "expectancy_r"), ("rules", "holdout", "profit_factor"),
           ("rules", "holdout", "clustered_t_clustered"), ("rules", "development", "n"), ("rules", "all", "n"),
           ("no_gate", "holdout", "n"), ("no_gate", "holdout", "expectancy_r"), ("no_gate", "holdout", "profit_factor"),
           ("no_gate", "holdout", "clustered_t_clustered")]
TOL = {"n": 0, "expectancy_r": 0.0015, "profit_factor": 0.015, "clustered_t_clustered": 0.015}   # trade counts exactly; the rest within the published rounding


def universe_at(sha: str) -> list[dict]:
    import urllib.request
    url = f"https://raw.githubusercontent.com/caakshayk1-boop/trading-dashboard/{sha}/docs/screen.json"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "alpha-engines/phase0"}), timeout=60) as r:
        rows = json.load(r)["rows"]
    return [{"sym": x["sym"], "name": x["name"], "sector": x.get("sector"), "ind": x.get("ind"), "mcap_cr": x.get("mcap_cr")} for x in rows]


def fetch():
    import yfinance as yf
    import data
    uni = universe_at(UNIVERSE_AT)
    _adj, ex = data.download([u["sym"] for u in uni], period="8y", with_exchange=True)

    def one(t):
        b = yf.download(t, period="8y", interval="1d", auto_adjust=False, progress=False)
        b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
        s = b["Close"].dropna()
        s.index = pd.to_datetime(s.index).tz_localize(None)
        return s
    return {"exchange": ex, "universe": uni, "bench": one("^NSEI"), "indices": data.indices("8y"), "vix": one("^INDIAVIX"),
            "fetched": pd.Timestamp.utcnow().isoformat(), "universe_at": UNIVERSE_AT}


def cut(snap: dict, end: pd.Timestamp) -> tuple:
    sl = lambda x: x.loc[(x.index >= START) & (x.index <= end)]  # noqa: E731
    bars = {s: sl(d) for s, d in snap["exchange"].items()}
    bars = {s: d for s, d in bars.items() if len(d) >= 120}        # the same floor data.download applies
    return bars, snap["universe"], sl(snap["bench"]), {k: sl(v) for k, v in (snap["indices"] or {}).items()}, sl(snap["vix"])


def compare(got: dict, want: dict) -> list[dict]:
    rows = []
    for book, period, k in FIGURES:
        g, w = got.get(book, {}).get(period, {}).get(k), want.get(book, {}).get(period, {}).get(k)
        tol = TOL.get(k, 0.015)
        ok = g is not None and w is not None and abs(float(g) - float(w)) <= tol
        rows.append({"figure": f"{book}.{period}.{k}", "published": w, "reproduced": g, "match": bool(ok)})
    return rows


def funnel(bench, vix, bars, published_hist: list[dict]) -> tuple[pd.DataFrame, dict]:
    g = SW.market_gate(bench, vix, bars)
    days = [pd.Timestamp(x["d"]) for x in published_hist]
    win = g.loc[g.index.isin(days)] if days else g.tail(136)
    closes = pd.DataFrame({s: d["Close"] for s, d in bars.items()}).reindex(g.index)
    counted = closes.rolling(50, min_periods=50).mean().notna().sum(axis=1)
    rows = pd.DataFrame({
        "date": win.index.date, "nifty": win["nifty"].round(2), "sma50": win["sma50"].round(2), "sma200": win["sma200"].round(2),
        "sma200_rising_20": (win["sma200"] > g["sma200"].shift(20).reindex(win.index)),
        "trend": win["trend"], "intermediate": win["intermediate"], "breadth": win["breadth"].round(4),
        "breadth_denominator": counted.reindex(win.index).astype(int), "breadth_ok": win["breadth_ok"],
        "vix": win["vix"].round(2), "vix_ok": win["vix_ok"].fillna(False), "passed": win[["trend", "intermediate", "breadth_ok"]].sum(axis=1) + win["vix_ok"].fillna(False).astype(int),
        "on": win["on"],
    })
    pub = {pd.Timestamp(x["d"]).date(): bool(x["on"]) for x in published_hist}
    rows["published_on"] = [pub.get(d) for d in rows["date"]]
    n = len(rows)
    summ = {
        "sessions": n, "first": str(rows["date"].iloc[0]) if n else None, "last": str(rows["date"].iloc[-1]) if n else None,
        "on_sessions": int(rows["on"].sum()), "on_pct": round(float(rows["on"].mean() * 100), 1) if n else None,
        "pass_count": {c: int(rows[c].sum()) for c in ("trend", "intermediate", "breadth_ok", "vix_ok")},
        "passed_distribution": {str(k): int(v) for k, v in rows["passed"].value_counts().sort_index().items()},
        "trend_parts": {"nifty_above_200": int((rows["nifty"] > rows["sma200"]).sum()), "sma200_rising": int(rows["sma200_rising_20"].sum())},
        "breadth": {"min": float(rows["breadth"].min()), "median": float(rows["breadth"].median()), "max": float(rows["breadth"].max())},
        "agrees_with_published": int(sum(1 for a, b in zip(rows["on"], rows["published_on"]) if b is not None and bool(a) == b)),
        "published_sessions_matched": int(rows["published_on"].notna().sum()),
    }
    return rows, summ


def checks(bench, vix, bars, rows) -> list[dict]:
    out = []
    feed = json.loads(FEED.read_text()) if FEED.exists() else {}
    pub_val = next((c["value"] for c in feed.get("gate", {}).get("checks", []) if "200-day" in c.get("rule", "")), None)
    last = rows.iloc[-1] if len(rows) else None
    out.append({"check": "Index symbol mapping", "detail": f"benchmark ^NSEI, {len(bench)} sessions, last {bench.index[-1].date()} close {bench.iloc[-1]:.2f}; "
                f"published 200-day check reads '{pub_val}'; rebuilt on {last['date'] if last is not None else '—'}: Nifty {last['nifty'] if last is not None else '—'}, 200-day {last['sma200'] if last is not None else '—'}"})
    stock_days = pd.Index(sorted(set().union(*[d.index for d in bars.values()])))
    only_stocks, only_bench = stock_days.difference(bench.index), bench.index.difference(stock_days)
    weekend = [str(d.date()) for d in stock_days if d.weekday() >= 5]
    out.append({"check": "Date/timezone alignment", "detail": f"{len(only_stocks)} stock dates with no Nifty bar ({[str(d.date()) for d in only_stocks[-5:]]}), "
                f"{len(only_bench)} Nifty dates with no stock bar, {len(weekend)} weekend dates; indexes are tz-naive exchange dates"})
    out.append({"check": "Adjustment policy", "detail": "backtest and gate read exchange-price bars (split-adjusted Close, dividends NOT removed): "
                "a 50-day average crosses at ex-dates by the dividend amount; trend tests on ^NSEI (a price index)"})
    denom = rows["breadth_denominator"] if len(rows) else pd.Series(dtype=int)
    out.append({"check": "Breadth denominator (point-in-time)", "detail": f"denominator = today's screened universe with 50 bars of history: min {int(denom.min()) if len(denom) else '—'}, "
                f"max {int(denom.max()) if len(denom) else '—'} in the window. Not point-in-time constituents: names delisted or dropped are absent (survivorship), "
                "names listed later enter as soon as they have 50 bars"})
    s200 = SW.sma(bench, 200)
    out.append({"check": "200-day warm-up", "detail": f"first valid 200-day average {s200.dropna().index[0].date()}; window starts {rows['date'].iloc[0] if len(rows) else '—'}; "
                f"null 200-day averages inside the window: {int(rows['sma200'].isna().sum()) if len(rows) else '—'}"})
    out.append({"check": "Null handling", "detail": f"VIX missing on {int(vix.reindex(bench.index).isna().sum())} Nifty sessions before forward-fill; "
                f"inside the window VIX null after fill: {int(rows['vix'].isna().sum()) if len(rows) else '—'} (null fails the check, never passes it); "
                f"breadth null: {int(rows['breadth'].isna().sum()) if len(rows) else '—'}"})
    cover = pd.Series({d: sum(1 for b in bars.values() if d in b.index) for d in bench.index[-136:]})
    thin = cover[cover < 0.5 * len(bars)]
    out.append({"check": "Exchange calendar", "detail": f"sessions = Nifty's own dates; in the last 136, {len(thin)} sessions where under half the universe has a bar "
                f"({[str(d.date()) for d in thin.index[:5]]}); no NSE holiday calendar is applied, so a missing Yahoo bar and a holiday look alike"})
    return out


def main(argv) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if len(argv) > 1:
        snap = pd.read_pickle(argv[1])
    else:
        snap = fetch()
        pd.to_pickle(snap, os.environ.get("PHASE0_SNAPSHOT", "phase0_bars.pkl"))
    published = json.loads(PUBLISHED.read_text())
    if TR.count("swing") == 0:     # the one run made before this registry existed, entered from its own output file
        TR.record("swing", published["version"], published.get("fingerprint", "UNKNOWN"), "UNKNOWN (no snapshot was kept)", published.get("periods", {}),
                  {"holdout": {k: published["rules"]["holdout"].get(k) for k in ("n", "expectancy_r", "profit_factor", "clustered_t_clustered")}},
                  f"original run {ORIGINAL_RUN_UTC}, registered retrospectively by phase0.py from research/swing_results.json")
    report = {"original_run_utc": ORIGINAL_RUN_UTC, "original_data_through": published.get("data_through"),
              "original_partial_bar": "the original run started 10:37 IST on 21 Oct, so any 21 Oct bar it read was an incomplete intraday bar",
              "fetched": snap.get("fetched"), "universe_at": snap.get("universe_at", "live screen"), "runs": {}}
    for name, end in ENDS.items():
        bars, uni, bench, idx, vix = cut(snap, end)
        h = TR.bars_hash(bars, bench, vix)
        got = BT.evaluate(bars, uni, bench, idx, vix)
        cmp_rows = compare(got, published)
        TR.record("swing", got["version"], got["fingerprint"], h, {"start": str(START.date()), "end": str(end.date())},
                  {b: {k: got[b]["holdout"].get(k) for k in ("n", "expectancy_r", "profit_factor", "clustered_t_clustered")} for b in ("rules", "no_gate")},
                  f"phase0 reproduction ({name})")
        report["runs"][name] = {"end": str(end.date()), "data_hash": h, "universe": got["universe"], "data_through": got["data_through"],
                                "comparison": cmp_rows, "all_match": all(r["match"] for r in cmp_rows),
                                "gate_on_pct_by_year": got["gate_on_pct_by_year"], "candidates": got["candidates"]}
    feed = json.loads(FEED.read_text()) if FEED.exists() else {}
    bars, uni, bench, idx, vix = cut(snap, pd.Timestamp(feed.get("data_through", "2026-10-19")))
    rows, summ = funnel(bench, vix, bars, feed.get("gate_history", []))
    rows.to_csv(OUT / "gate_funnel.csv", index=False)
    report["gate"] = summ
    report["diagnosis"] = checks(bench, vix, bars, rows)
    report["reproduced"] = any(r["all_match"] for r in report["runs"].values())
    (OUT / "reproduction.json").write_text(json.dumps(report, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
    print(json.dumps({k: report[k] for k in ("reproduced", "gate")}, indent=1, default=str))
    for name, r in report["runs"].items():
        print(name, "all_match" if r["all_match"] else "MISMATCH", [(x["figure"], x["published"], x["reproduced"]) for x in r["comparison"] if not x["match"]])


if __name__ == "__main__":
    main(sys.argv)
