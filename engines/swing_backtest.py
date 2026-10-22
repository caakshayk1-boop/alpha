"""swing_backtest.py — the one test of Swing v2's rules, run once, after the rules were fixed (swing.py, 21 Oct 2026).

Development: signals dated before 2025-01-01. Holdout: signals dated 2025-01-01 onwards. Nothing in swing.py was changed
after this ran; if it is changed, this file records a new version and the old result is kept beside it.

Three comparisons, so the result means something:
  rules      the full book: market gate, stock gate, setups, plan, limits
  no_gate    the same book with the market gate forced on every day (what the gate is worth)
  random     on each day the book took a trade, a random stock that passed only the liquidity floor, with the same stop rule
             and the same plan (what the stock selection is worth, net of the market's drift)

Usage: python swing_backtest.py [bars.pkl]   (no argument: download; writes research/swing_results.json)
"""
from __future__ import annotations

import json
import pathlib
import sys
import time

import numpy as np
import pandas as pd

import swing as SW
import trial_registry as TR
from ai_trades import monthly_t
from common import Ctx, stats

SPLIT = pd.Timestamp("2025-01-01")


def load(argv):
    if len(argv) > 1:
        d = pd.read_pickle(argv[1])
        return d["exchange"] if d.get("exchange") else d["bars"], d["universe"], d["bench"], d.get("indices"), d.get("vix")
    import yfinance as yf
    import data
    uni = data.universe()
    _adj, ex = data.download([u["sym"] for u in uni], period="7y", with_exchange=True)
    def one(t):
        b = yf.download(t, period="7y", interval="1d", auto_adjust=False, progress=False)
        b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
        s = b["Close"].dropna()
        s.index = pd.to_datetime(s.index).tz_localize(None)
        return s
    return ex, uni, one("^NSEI"), data.indices("7y"), one("^INDIAVIX")


def curve(trades) -> list[dict]:
    if not trades:
        return []
    s = pd.Series([t.r for t in trades], index=pd.DatetimeIndex([t.exit_date for t in trades])).sort_index()
    m = s.groupby(s.index.to_period("M")).sum().cumsum()
    return [{"m": str(k), "r": round(float(v), 2)} for k, v in m.items()]


def summary(trades) -> dict:
    out = {}
    for name, sel in (("all", trades), ("development", [t for t in trades if t.signal_date < SPLIT]), ("holdout", [t for t in trades if t.signal_date >= SPLIT])):
        out[name] = {**stats(sel), **{f"clustered_{k}": v for k, v in monthly_t(sel).items()}}
        out[name]["by_setup"] = {s: stats([t for t in sel if t.setup == s]) for s in ("Pullback", "Breakout")}
        out[name]["exits"] = {k: int(sum(1 for t in sel if t.exit_reason == k)) for k in ("stop", "lock", "trail", "t2", "time")}
    return out


def evaluate(bars, uni, bench, indices, vix) -> dict:
    """The whole test on the bars given, with nothing written. main() and the Phase 0 reproduction (phase0.py) both call it,
    so a reproduction runs exactly the code that produced the published figures."""
    t0 = time.time()
    ctx = Ctx(bars, bench, uni, indices)
    sector_of = {u["sym"]: u.get("sector") for u in uni}
    gate = SW.market_gate(bench, vix, bars)
    nifty_r63 = bench / bench.shift(63) - 1
    lo, hi = pd.Timestamp("2000-01-01"), pd.Timestamp("2100-01-01")

    def cands(g):
        out = []
        for sym, df in bars.items():
            out += SW.scan_stock(sym, df, g, ctx, nifty_r63, ctx.rs126[sym] if sym in ctx.rs126 else None, lo, hi)
        return out

    def trades_of(taken):
        return [SW.to_trade(x.sym, x.setup, x.date, bars[x.sym], w) for x, w in taken if not w.get("void") and w["closed"]]

    c_rules = cands(gate)
    t_rules = trades_of(SW.run_book(c_rules, bars, sector_of))
    g_open = gate.copy()
    g_open["on"] = True
    t_nogate = trades_of(SW.run_book(cands(g_open), bars, sector_of))

    # random: same days, same count per day, any stock above the liquidity floor, same stop rule and plan
    rng = np.random.default_rng(21)
    per_day = pd.Series([t.signal_date for t in t_rules]).value_counts()
    rand = []
    feats = {s: SW._features(df) for s, df in bars.items() if len(df) >= 260}
    for d, n in per_day.items():
        pool = [s for s, f in feats.items() if d in f.index and f.at[d, "tv"] >= SW.P["min_turnover_cr"] and bars[s].at[d, "Close"] >= SW.P["min_price"]]
        for s in rng.choice(pool, size=min(int(n), len(pool)), replace=False) if pool else []:
            df, f = bars[s], feats[s]
            t = df.index.get_loc(d)
            ref = float(df["Close"].iloc[t])
            sl = float(f["low10"].iloc[t]) - SW.P["stop_atr_pad"] * float(f["atr"].iloc[t])
            if not (SW.P["risk_min"] <= (ref - sl) / ref <= SW.P["risk_max"]):
                continue
            w = SW.walk(df, t, ref, sl)
            if w and not w.get("void") and w["closed"]:
                rand.append(SW.to_trade(s, "Random", d, df, w))

    sessions = gate.dropna(subset=["sma200"])
    on_by_year = {str(y): round(float(g["on"].mean() * 100), 1) for y, g in sessions.groupby(sessions.index.year)}
    out = {
        "version": SW.VERSION, "fingerprint": SW.fingerprint(), "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "data_through": str(max(df.index[-1] for df in bars.values()).date()), "universe": len(bars),
        "periods": {"development": [str(sessions.index[0].date()), "2024-12-31"], "holdout": ["2025-01-01", str(sessions.index[-1].date())]},
        "cost_round_trip_pct": 0.25, "params": SW.P,
        "gate_on_pct_by_year": on_by_year, "candidates": len(c_rules),
        "rules": summary(t_rules), "no_gate": summary(t_nogate), "random": summary(rand),
        "curve": {"rules": curve(t_rules), "random": curve(rand)},
        "notes": [
            "Universe is today's screened companies, so delisted names are missing from the past (survivorship): it flatters any long book.",
            "Rules were fixed before this test and the holdout was read once. One holdout is one sample.",
            "Fills at the open with no slippage beyond the 0.25% round-trip cost.",
        ],
        "seconds": round(time.time() - t0),
    }
    return out


def main(argv) -> None:
    loaded = load(argv)
    out = evaluate(*loaded)
    TR.record("swing", out["version"], out["fingerprint"], TR.bars_hash(loaded[0], loaded[2], loaded[4]),
              {"start": out["periods"]["development"][0], "end": out["data_through"]},
              {b: {k: out[b]["holdout"].get(k) for k in ("n", "expectancy_r", "profit_factor", "clustered_t_clustered")} for b in ("rules", "no_gate", "random")},
              "swing_backtest.py: the research run of record for this version")
    dest = pathlib.Path(__file__).resolve().parent / "research" / "swing_results.json"
    dest.write_text(json.dumps(out, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
    h = out["rules"]["holdout"]
    print(f"wrote {dest}: {out['rules']['all'].get('n')} trades; holdout n={h.get('n')} exp={h.get('expectancy_r')}R t={h.get('clustered_t_clustered')}")


if __name__ == "__main__":
    main(sys.argv)
